/**
 * NOAA WaveWatch III Service
 *
 * Main orchestration class for fetching and processing wave forecast data.
 * Coordinates between NOAA NWS API, Open-Meteo API, and fallback data generation.
 *
 * @module noaa-wavewatch/noaa-wavewatch-service
 */

import { createContextLogger } from "@/lib/logger";
import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
import { fetchNOAAPointData, fetchNOAAGridData, fetchOpenMeteoData, constructGridUrl } from "./api-client";
import { processNOAAGridData, processOpenMeteoData } from "./data-processors";
import { mergeWaveSources } from "./source-selection";
import { generateFallbackData, generateFallbackSlotsFrom } from "./fallback-generator";
import { FORECAST_CONFIG } from "./constants";
import { hasValidWaveData, logWaveDataAvailability, metersToFeet, getWaveDirectionText } from "./wave-analysis";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import type { WaveWatchForecast, WaveWatchData } from "./types";

const log = createContextLogger("NOAAWaveWatch");

/**
 * Service for fetching NOAA WaveWatch III wave forecast data
 *
 * Provides methods to fetch wave forecasts from multiple sources with automatic
 * fallback handling and data quality validation.
 */
export class NOAAWaveWatchService {
  /**
   * Check if verbose logging is enabled for forecast operations
   */
  private isVerbose(): boolean {
    return isForecastVerboseLoggingEnabled();
  }

  /**
   * Fetch wave forecast data for a specific location
   *
   * Attempts to fetch real NOAA data, falls back to Open-Meteo, and generates
   * synthetic data as a last resort.
   *
   * @param latitude - Latitude in decimal degrees
   * @param longitude - Longitude in decimal degrees
   * @param days - Number of forecast days (default: 10)
   * @returns Wave forecast or null if all sources fail
   */
  async fetchWaveWatchForecast(
    latitude: number,
    longitude: number,
    days: number = 10
  ): Promise<WaveWatchForecast | null> {
    try {
      log.debug(`Fetching NOAA wave forecast for ${latitude}, ${longitude}`);

      // First, try to get real NOAA data
      const noaaData = await this.fetchRealNOAAData(latitude, longitude, days);
      if (noaaData) {
        // OM starts at midnight; past slots must not consume the forward-horizon budget.
        const intervalMs = FORECAST_CONFIG.FORECAST_INTERVAL_HOURS * 3600000;
        const firstSlotMs = Math.floor(Date.now() / intervalMs) * intervalMs;
        noaaData.forecast = noaaData.forecast.filter((point) => Date.parse(point.timestamp) >= firstSlotMs);
      }

      if (noaaData && noaaData.forecast.length > 0) {
        const expectedSlots = days * FORECAST_CONFIG.FORECASTS_PER_DAY;
        // Fill any remaining horizon gaps with fallback slots
        if (noaaData.forecast.length < expectedSlots) {
          const lastTimestamp = new Date(
            noaaData.forecast[noaaData.forecast.length - 1].timestamp
          );
          const slotsNeeded = expectedSlots - noaaData.forecast.length;
          const fillSlots = generateFallbackSlotsFrom(
            latitude,
            longitude,
            lastTimestamp,
            slotsNeeded
          );
          // Safe to mutate: noaaData is local to this call
          noaaData.forecast.push(...fillSlots);
          log.info(
            `Filled ${fillSlots.length} horizon gap slots (${noaaData.forecast.length} total for ${days}d request)`
          );
        }

        log.debug(
          `Successfully fetched real NOAA data with ${noaaData.forecast.length} forecasts`
        );
        return noaaData;
      }

      // If NOAA data fails, fall back to simulated data with clear indication
      log.warn(`Using FALLBACK synthetic data for ${latitude}, ${longitude} — both NOAA and Open-Meteo returned no usable forecasts`);
      trackFallback({
        domain: "noaa-wavewatch",
        field: "wave_forecast",
        fallbackValue: "synthetic",
        reason: "both_sources_empty",
        context: { latitude, longitude, days },
      });
      const fallbackData = generateFallbackData(latitude, longitude, days);

      return {
        lat: latitude,
        lng: longitude,
        forecast: fallbackData,
      };
    } catch (error) {
      log.error(`Using FALLBACK synthetic data for ${latitude}, ${longitude} due to error:`, error);
      trackFallback({
        domain: "noaa-wavewatch",
        field: "wave_forecast",
        fallbackValue: "synthetic",
        reason: "fetch_error",
        context: { latitude, longitude, days, error: String(error) },
      });

      // Generate fallback data on error
      const fallbackData = generateFallbackData(latitude, longitude, days);

      return {
        lat: latitude,
        lng: longitude,
        forecast: fallbackData,
      };
    }
  }

  /**
   * Fetch real wave forecast data from NOAA and Open-Meteo in parallel,
   * then merge by time horizon: NOAA for days 1-3, Open-Meteo for days 4-12,
   * NOAA for days 8+ (Open-Meteo maxes at 12 days).
   *
   * @private
   * @param latitude - Latitude in decimal degrees
   * @param longitude - Longitude in decimal degrees
   * @param days - Number of forecast days
   * @returns Wave forecast or null if unavailable
   */
  private async fetchRealNOAAData(
    latitude: number,
    longitude: number,
    days: number
  ): Promise<WaveWatchForecast | null> {
    try {
      log.debug(
        `Fetching NOAA + Open-Meteo in parallel for ${latitude}, ${longitude}`
      );

      // Fetch both sources in parallel
      const [noaaResult, openMeteoResult] = await Promise.allSettled([
        this.fetchNOAANWSData(latitude, longitude, days),
        this.fetchOpenMeteoDataWrapper(latitude, longitude, Math.min(days, FORECAST_CONFIG.OPEN_METEO_MAX_DAYS)),
      ]);

      const noaaData =
        noaaResult.status === "fulfilled" ? noaaResult.value : null;
      const openMeteoData =
        openMeteoResult.status === "fulfilled" ? openMeteoResult.value : null;

      // If we have both, select by input quality at each valid time.
      if (noaaData?.forecast.length && openMeteoData?.forecast.length) {
        return this.mergeForecasts(noaaData, openMeteoData, latitude, longitude);
      }

      // If only one source, use it. When OM is unavailable but NOAA is not,
      // the downstream rows will be written with NULL _om columns — expected.
      if (noaaData?.forecast.length) {
        if (!openMeteoData?.forecast.length) {
          trackFallback({
            domain: "noaa-wavewatch",
            field: "open_meteo_values",
            fallbackValue: "null",
            reason: "open_meteo_unavailable",
            context: { latitude, longitude },
          });
        }
        return { ...noaaData, forecast: mergeWaveSources(noaaData.forecast, []) };
      }
      if (openMeteoData?.forecast.length) return { ...openMeteoData, forecast: mergeWaveSources([], openMeteoData.forecast) };

      log.debug(
        `Both NOAA NWS and Open-Meteo failed for ${latitude}, ${longitude}`
      );
      return null;
    } catch (error) {
      log.error("Error fetching real wave data:", error);
      return null;
    }
  }

  /**
   * Merge by reported-input completeness at each exact valid time.
   */
  private mergeForecasts(
    noaaData: WaveWatchForecast,
    openMeteoData: WaveWatchForecast,
    latitude: number,
    longitude: number
  ): WaveWatchForecast {
    const merged = mergeWaveSources(noaaData.forecast, openMeteoData.forecast);

    const openMeteoCount = merged.filter(
      (f) => f.data_source === "OPEN_METEO"
    ).length;
    log.info(
      `Merged forecasts: ${merged.length} total (${merged.length - openMeteoCount} NOAA, ${openMeteoCount} Open-Meteo)`
    );

    return {
      lat: latitude,
      lng: longitude,
      forecast: merged,
    };
  }

  /**
   * Fetch wave forecast data from NOAA NWS API
   *
   * @private
   * @param latitude - Latitude in decimal degrees
   * @param longitude - Longitude in decimal degrees
   * @param days - Number of forecast days
   * @returns Wave forecast or null if unavailable
   */
  private async fetchNOAANWSData(
    latitude: number,
    longitude: number,
    days: number
  ): Promise<WaveWatchForecast | null> {
    try {
      // Step 1: Get the grid point for the location
      const pointData = await fetchNOAAPointData(latitude, longitude);
      if (!pointData) {
        return null;
      }

      // Step 2: Construct grid URL
      const gridUrl = constructGridUrl(pointData);
      if (!gridUrl) {
        return null;
      }

      // Step 3: Get the grid data which includes wave information
      const gridData = await fetchNOAAGridData(gridUrl);
      if (!gridData) {
        return null;
      }

      // Step 4: Validate wave data availability
      const waveHeightValues = gridData.properties.waveHeight?.values || [];
      logWaveDataAvailability(
        gridData.properties.waveHeight?.values,
        gridData.properties.wavePeriod?.values,
        gridData.properties.waveDirection?.values
      );

      if (
        !gridData.properties.waveHeight ||
        waveHeightValues.length === 0 ||
        !hasValidWaveData(gridData.properties.waveHeight?.values)
      ) {
        log.debug(
          `NOAA NWS has no usable wave height data, falling back to Open-Meteo`
        );
        return null;
      }

      // Step 5: Process the grid data to extract wave information
      const waveData = processNOAAGridData(gridData, days, latitude, longitude);

      if (waveData.length === 0) {
        log.debug("No wave data could be processed from NOAA NWS grid data");
        return null;
      }

      log.debug(`Successfully processed ${waveData.length} NOAA NWS wave forecasts`);
      return {
        lat: latitude,
        lng: longitude,
        forecast: waveData,
      };
    } catch (error) {
      log.error("Error fetching NOAA NWS data:", error);
      return null;
    }
  }

  /**
   * Fetch wave forecast data from Open-Meteo Marine API
   *
   * @private
   * @param latitude - Latitude in decimal degrees
   * @param longitude - Longitude in decimal degrees
   * @param days - Number of forecast days
   * @returns Wave forecast or null if unavailable
   */
  private async fetchOpenMeteoDataWrapper(
    latitude: number,
    longitude: number,
    days: number
  ): Promise<WaveWatchForecast | null> {
    try {
      const data = await fetchOpenMeteoData(latitude, longitude, days);
      if (!data) {
        return null;
      }

      // Process Open-Meteo data
      const waveData = processOpenMeteoData(data, days);

      if (waveData.length === 0) {
        log.debug("No wave data could be processed from Open-Meteo");
        return null;
      }

      log.debug(`Successfully processed ${waveData.length} Open-Meteo wave forecasts`);
      return {
        lat: latitude,
        lng: longitude,
        forecast: waveData,
      };
    } catch (error) {
      log.error("Error fetching Open-Meteo data:", error);
      return null;
    }
  }

  /**
   * Convert wave height from meters to feet
   *
   * @param meters - Wave height in meters
   * @returns Wave height in feet
   */
  metersToFeet(meters: number): number {
    return metersToFeet(meters);
  }

  /**
   * Get wave direction as compass text
   *
   * @param degrees - Direction in degrees (0-360)
   * @returns Compass direction (e.g., "NW", "SE")
   */
  getWaveDirectionText(degrees: number): string {
    return getWaveDirectionText(degrees);
  }
}
