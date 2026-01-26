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
import { generateFallbackData } from "./fallback-generator";
import { hasValidWaveData, logWaveDataAvailability, metersToFeet, getWaveDirectionText } from "./wave-analysis";
import type { WaveWatchForecast } from "./types";

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

      if (noaaData && noaaData.forecast.length > 0) {
        log.debug(
          `Successfully fetched real NOAA data with ${noaaData.forecast.length} forecasts`
        );
        return noaaData;
      }

      // If NOAA data fails, fall back to simulated data with clear indication
      log.debug("NOAA data unavailable, falling back to simulated data");
      const fallbackData = generateFallbackData(latitude, longitude, days);

      return {
        lat: latitude,
        lng: longitude,
        forecast: fallbackData,
        data_source: "FALLBACK",
      };
    } catch (error) {
      log.error("Error fetching wave forecast:", error);

      // Generate fallback data on error
      const fallbackData = generateFallbackData(latitude, longitude, days);

      return {
        lat: latitude,
        lng: longitude,
        forecast: fallbackData,
        data_source: "FALLBACK",
      };
    }
  }

  /**
   * Fetch real wave forecast data from NOAA or Open-Meteo
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
        `Attempting to fetch real NOAA data for ${latitude}, ${longitude}`
      );

      // First try NOAA NWS API
      const noaaData = await this.fetchNOAANWSData(latitude, longitude, days);
      if (noaaData && noaaData.forecast.length > 0) {
        log.debug(
          `Successfully fetched NOAA NWS data with ${noaaData.forecast.length} forecasts`
        );
        return noaaData;
      }

      // If NOAA NWS fails or has no wave data, try Open-Meteo as a better fallback
      log.debug(
        `NOAA NWS unavailable, trying Open-Meteo API for ${latitude}, ${longitude}`
      );
      const openMeteoData = await this.fetchOpenMeteoDataWrapper(
        latitude,
        longitude,
        days
      );
      if (openMeteoData && openMeteoData.forecast.length > 0) {
        log.debug(
          `Successfully fetched Open-Meteo data with ${openMeteoData.forecast.length} forecasts`
        );
        return openMeteoData;
      }

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
        data_source: "NOAA_NWS",
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
        data_source: "NOAA_NWS", // Keep as NOAA_NWS for consistency
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
