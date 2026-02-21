/**
 * Forecast Data Source Manager
 * 
 * Manages all forecast data sources (WaveWatch, COOPS, CDIP, NOAA Weather)
 * and coordinates multi-source data fetching with failover logic.
 * 
 * Extracted from lib/services/enhanced-forecast-service.ts as part of P1 refactoring
 * to reduce file size and improve maintainability.
 */

import { NOAAWaveWatchService } from "../noaa-wavewatch";
import { NOAACOOPSService } from "../noaa-coops";
import { CDIPService } from "../cdip";
import { IOOSService, ParsedObservation } from "../ioos";
import { rankStations, StationCandidate } from "../ioos-station-scorer";
import {
  IOOS_OBSERVATION_CONFIG,
  CanonicalVar,
} from "@/lib/constants/ioos-config";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createConfidenceScore,
  type Location,
  type TimeRange,
  type WaveDataSource,
  type TideDataSource,
  type WeatherDataSource,
  type WaveData,
  type WeatherData,
} from "@/types/forecast";
import {
  ForecastError,
  ApiError,
  DataSourceError,
  isNoaaMarineForecastNotSupportedError,
} from "@/lib/errors/forecast-errors";

/**
 * WaveWatch III Data Source
 * 
 * Fetches wave forecast data from NOAA WaveWatch III model.
 * Provides significant wave height, period, and direction forecasts.
 */
class WaveWatchDataSource implements WaveDataSource {
  readonly name = "WaveWatch III";

  constructor(private service: NOAAWaveWatchService) {}

  async fetchData(location: Location, timeRange: TimeRange): Promise<any> {
    const days = Math.ceil(
      (timeRange.end.getTime() - timeRange.start.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return this.service.fetchWaveWatchForecast(
      location.latitude,
      location.longitude,
      days
    );
  }

  async fetchWaveData(location: Location, days: number): Promise<WaveData> {
    const result = await this.service.fetchWaveWatchForecast(
      location.latitude,
      location.longitude,
      days
    );

    if (!result || !result.forecast) {
      return {
        forecast: [],
        data_source: "FALLBACK",
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      };
    }

    // Transform the service response to match the WaveData interface
    const forecast = result.forecast.map((point) => ({
      timestamp: new Date(point.timestamp),
      significantWaveHeight: point.significant_wave_height,
      peakWavePeriod: point.peak_wave_period,
      peakWaveDirection: point.peak_wave_direction,
      swell1Height: point.swell_1_height,
      swell1Period: point.swell_1_period,
      swell1Direction: point.swell_1_direction,
      swell2Height: point.swell_2_height,
      swell2Period: point.swell_2_period,
      swell2Direction: point.swell_2_direction,
      windWaveHeight: point.wind_wave_height,
      windWavePeriod: point.wind_wave_period,
      windWaveDirection: point.wind_wave_direction,
      data_source: point.data_source,
    }));

    return {
      forecast,
      data_source: result.data_source,
      location: {
        latitude: result.lat,
        longitude: result.lng,
      },
    };
  }

  isAvailable(): boolean {
    return true;
  }

  getReliabilityScore(): any {
    return createConfidenceScore(85);
  }
}

/**
 * NOAA CO-OPS Tidal Data Source
 * 
 * Fetches tide predictions from NOAA Center for Operational Oceanographic
 * Products and Services.
 */
class TidalDataSource implements TideDataSource {
  readonly name = "NOAA CO-OPS";

  constructor(private service: NOAACOOPSService) {}

  async fetchData(location: Location, timeRange: TimeRange): Promise<any> {
    const days = Math.ceil(
      (timeRange.end.getTime() - timeRange.start.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const stationId = this.service.getStationForLocation(
      "",
      location.latitude,
      location.longitude
    );
    return this.service.fetchCOOPSData(stationId, days);
  }

  async fetchTideData(location: Location, days: number): Promise<any> {
    const stationId = this.service.getStationForLocation(
      "",
      location.latitude,
      location.longitude
    );
    const result = await this.service.fetchCOOPSData(stationId, days);
    return result || { tides: [], currents: [] };
  }

  isAvailable(): boolean {
    return true;
  }

  getReliabilityScore(): any {
    return createConfidenceScore(90);
  }
}

/**
 * NOAA Weather Service Data Source
 * 
 * Fetches weather forecasts from NOAA National Weather Service API.
 * Provides hourly weather conditions including wind and temperature.
 */
export class NOAAWeatherDataSource implements WeatherDataSource {
  readonly name = "NOAA Weather Service";

  async fetchData(location: Location, timeRange: TimeRange): Promise<any> {
    return this.fetchWeatherData(location, 12);
  }

  async fetchWeatherData(
    location: Location,
    days: number
  ): Promise<WeatherData> {
    try {
      const pointsUrl = `https://api.weather.gov/points/${location.latitude},${location.longitude}`;
      const pointsResponse = await fetch(pointsUrl, {
        headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
      });

      if (!pointsResponse.ok) {
        throw new ApiError(
          pointsUrl,
          pointsResponse.status,
          await pointsResponse.text()
        );
      }

      const pointsData = await pointsResponse.json();
      const hourlyUrl: string | null =
        pointsData?.properties?.forecastHourly ?? null;
      const nonHourlyUrl: string | null = pointsData?.properties?.forecast ?? null;

      // Some points (especially marine/offshore) do not have hourly or any forecast URLs.
      // Treat as "no coverage" rather than throwing and spamming cron logs.
      if (!hourlyUrl && !nonHourlyUrl) {
        return { periods: [] };
      }

      const fetchForecast = async (url: string): Promise<any> => {
        const forecastResponse = await fetch(url, {
          headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
        });

        if (!forecastResponse.ok) {
          throw new ApiError(url, forecastResponse.status, await forecastResponse.text());
        }

        return await forecastResponse.json();
      };

      // Prefer hourly, but gracefully fall back for "Marine Forecast Not Supported".
      try {
        if (hourlyUrl) {
          const forecastData = await fetchForecast(hourlyUrl);
          return { periods: forecastData?.properties?.periods || [] };
        }
      } catch (error) {
        // If hourly is unsupported in marine areas, fall back to non-hourly.
        if (!isNoaaMarineForecastNotSupportedError(error)) {
          throw error;
        }
      }

      if (nonHourlyUrl) {
        const forecastData = await fetchForecast(nonHourlyUrl);
        return { periods: forecastData?.properties?.periods || [] };
      }

      return { periods: [] };
    } catch (error) {
      if (error instanceof ForecastError) {
        throw error;
      }
      throw new DataSourceError("NOAA Weather", error as Error, {
        location: { lat: location.latitude, lng: location.longitude },
      });
    }
  }

  isAvailable(): boolean {
    return true;
  }

  getReliabilityScore(): any {
    return createConfidenceScore(80);
  }
}

/**
 * Forecast Data Source Manager
 * 
 * Centralizes management of all forecast data sources and provides
 * a unified interface for fetching wave, tide, and weather data.
 * 
 * Handles:
 * - Service initialization
 * - Data source selection and coordination
 * - Failover logic between sources
 * 
 * @example
 * ```typescript
 * const manager = new ForecastDataSourceManager();
 * const waveData = await manager.fetchWaveData(location, 12);
 * const tideData = await manager.fetchTideData(location, 12);
 * const weatherData = await manager.fetchWeatherData(location, 12);
 * ```
 */
export class ForecastDataSourceManager {
  private waveDataSource: WaveWatchDataSource;
  private tideDataSource: TidalDataSource;
  private weatherDataSource: NOAAWeatherDataSource;

  private waveWatchService: NOAAWaveWatchService;
  private coopsService: NOAACOOPSService;
  private cdipService: CDIPService;
  private ioosService: IOOSService;

  constructor() {
    // Initialize underlying services
    this.waveWatchService = new NOAAWaveWatchService();
    this.coopsService = new NOAACOOPSService();
    this.cdipService = new CDIPService();
    this.ioosService = new IOOSService();

    // Initialize data sources
    this.waveDataSource = new WaveWatchDataSource(this.waveWatchService);
    this.tideDataSource = new TidalDataSource(this.coopsService);
    this.weatherDataSource = new NOAAWeatherDataSource();
  }

  /**
   * Fetch wave forecast data
   */
  async fetchWaveData(location: Location, days: number): Promise<WaveData> {
    return this.waveDataSource.fetchWaveData(location, days);
  }

  /**
   * Fetch tide forecast data
   */
  async fetchTideData(location: Location, days: number): Promise<any> {
    return this.tideDataSource.fetchTideData(location, days);
  }

  /**
   * Fetch weather forecast data
   */
  async fetchWeatherData(location: Location, days: number): Promise<WeatherData> {
    return this.weatherDataSource.fetchWeatherData(location, days);
  }

  /**
   * Get underlying CDIP service for buoy data fetching
   * 
   * Provides access to CDIP-specific methods like getNearestStation()
   */
  getCDIPService(): CDIPService {
    return this.cdipService;
  }

  /**
   * Get underlying WaveWatch service
   * 
   * Provides access to WaveWatch-specific methods like getWaveDirectionText()
   */
  getWaveWatchService(): NOAAWaveWatchService {
    return this.waveWatchService;
  }

  /**
   * Get underlying COOPS service
   *
   * Provides access to CO-OPS-specific methods like getStationForLocation()
   */
  getCOOPSService(): NOAACOOPSService {
    return this.coopsService;
  }

  /**
   * Get underlying IOOS service
   *
   * Provides access to IOOS-specific methods for wave buoy observations.
   * IOOS covers Hawaii, East Coast, and other regions where CDIP has limited coverage.
   */
  getIOOSService(): IOOSService {
    return this.ioosService;
  }

  /**
   * Get latest cached observations for multiple stations
   *
   * Returns an object with:
   * - data: Map of station_id -> observation data
   * - cacheError: true if the cache fetch failed, false otherwise
   *
   * When cacheError is true, callers should log a warning and proceed
   * to live fetch normally.
   */
  private async getLatestCachedObservations(
    stationIds: string[],
    maxAgeHours: number = IOOS_OBSERVATION_CONFIG.maxCacheAgeHours
  ): Promise<{
    data: Map<string, {
      observed_at: string;
      wave_height_m: number | null;
      wave_period_s: number | null;
      wave_direction_deg: number | null;
      water_temp_c: number | null;
    }>;
    cacheError: boolean;
  }> {
    const supabase = createSupabaseServiceRoleClient();
    const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();

    const { data, error } = await supabase
      .from("ioos_observations")
      .select("station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg, water_temp_c")
      .in("station_id", stationIds)
      .gte("observed_at", cutoff)
      .order("observed_at", { ascending: false });

    if (error) {
      console.error("[DataSourceManager] Error fetching cached observations:", error);
      return { data: new Map(), cacheError: true };
    }

    // Group by station, keep only most recent per station
    const result = new Map<string, typeof data[0]>();
    for (const row of data || []) {
      if (!result.has(row.station_id)) {
        result.set(row.station_id, row);
      }
    }

    return { data: result, cacheError: false };
  }

  /**
   * Fetch buoy observation with cached-first strategy and station ranking
   *
   * Flow:
   * 1. Try CDIP first (primary for West Coast)
   * 2. Find nearby IOOS stations
   * 3. Get cached observations for all candidates
   * 4. Rank stations by freshness, completeness, distance, network
   * 5. Return best cached observation if fresh enough
   * 6. Otherwise, try live fetch for top candidates
   *
   * @param location - The location to fetch buoy data for
   * @param radiusKm - Search radius in kilometers (default: 150km)
   * @param cdipStationOverride - Explicit CDIP station ID to use instead of nearest-station lookup
   * @returns Observation data with source indicator, or null if no data
   */
  async fetchBuoyObservationWithFallback(
    location: Location,
    radiusKm: number = 150,
    cdipStationOverride?: string
  ): Promise<{
    source: "CDIP" | "IOOS";
    stationId: string;
    waveHeight: number | null;
    wavePeriod: number | null;
    waveDirection: number | null;
    waterTemp: number | null;
    observedAt: string;
  } | null> {
    // Try CDIP first (primary for West Coast)
    try {
      // Bug Fix #3: Add timeout to CDIP fallback (10 seconds)
      const cdipTimeout = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('CDIP fetch timeout')), 10000)
      );

      const cdipFetch = (async () => {
        const cdipStation = cdipStationOverride
          ?? await this.cdipService.getNearestStation(
            location.latitude,
            location.longitude,
            radiusKm
          );

        if (cdipStation) {
          const cdipData = await this.cdipService.fetchBuoyData(cdipStation);
          if (cdipData && cdipData.data && cdipData.data.length > 0) {
            const latestPoint = cdipData.data[cdipData.data.length - 1];
            if (latestPoint.significantWaveHeight !== null) {
              return {
                source: "CDIP" as const,
                stationId: cdipStation,
                waveHeight: latestPoint.significantWaveHeight,
                wavePeriod: latestPoint.peakWavePeriod,
                waveDirection: latestPoint.peakWaveDirection,
                waterTemp: null,
                observedAt: latestPoint.timestamp || cdipData.lastUpdated,
              };
            }
          }
        }
        return null;
      })();

      const cdipResult = await Promise.race([cdipFetch, cdipTimeout]);
      if (cdipResult) {
        return cdipResult;
      }
    } catch (error) {
      console.debug('[DataSourceManager] CDIP buoy fetch failed, falling back to IOOS', {
        lat: location.latitude,
        lon: location.longitude,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // IOOS cached-first strategy
    try {
      // 1. Find nearby stations
      const ioosStations = await this.ioosService.findNearbyStations(
        location.latitude,
        location.longitude,
        radiusKm
      );

      if (ioosStations.length === 0) {
        return null;
      }

      // 2. Get cached observations
      const stationIds = ioosStations.map(s => s.station_id);
      const { data: cachedObs, cacheError } = await this.getLatestCachedObservations(stationIds);

      if (cacheError) {
        console.warn('[DataSourceManager] Cache fetch failed for IOOS observations, proceeding with live fetch', {
          lat: location.latitude,
          lon: location.longitude,
          stationCount: stationIds.length,
        });
      }

      // 3. Build candidates with observation data
      const now = new Date();
      const candidates: StationCandidate[] = ioosStations.map(s => {
        const obs = cachedObs.get(s.station_id);
        return {
          stationId: s.station_id,
          distanceKm: s.distance_to_beach_km ?? Infinity,
          network: s.source_network,
          latestObservedAt: obs ? new Date(obs.observed_at) : null,
          hasWaveHeight: obs?.wave_height_m != null,
          hasPeriod: obs?.wave_period_s != null,
          hasDirection: obs?.wave_direction_deg != null,
        };
      });

      // 4. Rank stations
      const ranked = rankStations(candidates, now);

      // 5. Try to use cached observation from best station
      const maxCacheAge = IOOS_OBSERVATION_CONFIG.maxCacheAgeHours * 3600_000;

      for (const candidate of ranked) {
        const obs = cachedObs.get(candidate.stationId);
        if (obs && candidate.latestObservedAt) {
          const age = now.getTime() - candidate.latestObservedAt.getTime();
          if (age <= maxCacheAge && obs.wave_height_m != null) {
            return {
              source: "IOOS",
              stationId: candidate.stationId,
              waveHeight: obs.wave_height_m,
              wavePeriod: obs.wave_period_s,
              waveDirection: obs.wave_direction_deg,
              waterTemp: obs.water_temp_c,
              observedAt: obs.observed_at,
            };
          }
        }
      }

      // 6. Cache miss: try live fetch for top candidates
      const maxAttempts = IOOS_OBSERVATION_CONFIG.maxLiveFetchAttempts;

      for (const candidate of ranked.slice(0, maxAttempts)) {
        const station = ioosStations.find(s => s.station_id === candidate.stationId);
        if (!station) continue;

        const variableMap = (station.variable_map || {}) as Partial<Record<CanonicalVar, string>>;
        if (!variableMap.wave_height) continue;

        const liveObs = await this.ioosService.fetchObservationDynamic(
          candidate.stationId,
          variableMap
        );

        if (liveObs && liveObs.waveHeightM != null) {
          // Bug Fix #2: Add error handler for cache write promise
          // Write to cache (fire-and-forget)
          const supabase = createSupabaseServiceRoleClient();
          supabase.from("ioos_observations").upsert({
            station_id: candidate.stationId,
            observed_at: liveObs.observedAt,
            wave_height_m: liveObs.waveHeightM,
            wave_period_s: liveObs.wavePeriodS,
            wave_direction_deg: liveObs.waveDirectionDeg,
            water_temp_c: liveObs.waterTempC,
            wind_speed_ms: liveObs.windSpeedMS,
            wind_direction_deg: liveObs.windDirectionDeg,
            raw_data: liveObs.raw,
          }, {
            onConflict: "station_id,observed_at",
            ignoreDuplicates: true,
          }).then(
            () => {},
            (err: unknown) => {
              console.error('[DataSourceManager] Cache write failed:', err);
            }
          );

          return {
            source: "IOOS",
            stationId: candidate.stationId,
            waveHeight: liveObs.waveHeightM,
            wavePeriod: liveObs.wavePeriodS,
            waveDirection: liveObs.waveDirectionDeg,
            waterTemp: liveObs.waterTempC,
            observedAt: liveObs.observedAt,
          };
        }
      }

      return null;
    } catch (error) {
      console.debug('[DataSourceManager] IOOS observation fetch failed', {
        lat: location.latitude,
        lon: location.longitude,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get all data sources for testing/inspection
   */
  getDataSources() {
    return {
      wave: this.waveDataSource,
      tide: this.tideDataSource,
      weather: this.weatherDataSource,
    };
  }
}

