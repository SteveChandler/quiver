import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ForecastDataSourceManager, NOAAWeatherDataSource } from "./forecast/data-source-manager";
import { cardinalToDegrees } from "./forecast/forecast-transformer";
import { calculateConfidenceScore } from "./forecast/confidence-scorer";
import { ForecastStorageService } from "./forecast/storage-service";
import { getForecastWeightingService } from "./forecast-weighting-service";
import { calculateDistance } from "@/lib/utils/distance-utils";
import { ForecastBuilder } from "./forecast/forecast-builder";
import type { Beach } from "@/types/database";
import {
  FORECAST_CONSTANTS,
  TOTAL_FORECASTS,
  createConfidenceScore,
  createBeachId,
  createLatitude,
  createLongitude,
  type Location,
  type TimeRange,
  type ForecastTimePoint,
  type WeatherConditions,
  type WaveConditions,
  type TideConditions,
  type SwellComponent,
  type WaveDataSource,
  type TideDataSource,
  type WeatherDataSource,
  type WaveData,
  type TideData,
  type WeatherData,
  type EnhancedForecastEntity,
  type CDIPBuoyData,
  type EnhancedForecastWithRawData,
} from "@/types/forecast";
import { toFaceHeightFeet } from "@/lib/utils/wave-height-formatter";
import {
  ForecastError,
  ForecastErrorCode,
  DataSourceError,
  ValidationError,
  ApiError,
  StorageError,
  isNoaaInvalidPointError,
  isNoaaMarineForecastNotSupportedError,
  withErrorHandling,
  withRetry,
  logError,
} from "@/lib/errors/forecast-errors";

// Data source implementations moved to lib/services/forecast/data-source-manager.ts

export class EnhancedForecastService {
  private readonly warnedSchemaColumns = new Set<string>();
  private isVerboseLoggingEnabled(): boolean {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    return process.env.FORECAST_VERBOSE_LOGS === "true" || env !== "production";
  }

  // cardinalToDegrees method moved to lib/services/forecast/forecast-transformer.ts

  private dataSourceManager: ForecastDataSourceManager;
  private storageService: ForecastStorageService;

  constructor() {
    this.dataSourceManager = new ForecastDataSourceManager();
    this.storageService = new ForecastStorageService();
  }

  /**
   * Generate comprehensive 12-day forecast for a beach
   */
  async generateComprehensiveForecast(
    beach: Beach
  ): Promise<EnhancedForecastEntity[]> {
    return withErrorHandling(
      async () => {
        // Validate input
        if (!beach.id || !beach.lat || !beach.lon) {
          throw new ValidationError(
            "beach",
            beach,
            "Beach must have valid ID, latitude, and longitude"
          );
        }

        // Fetch all data sources in parallel with error handling
        const [waveData, tideData, weatherData, buoyData, cdipData] =
          await Promise.allSettled([
            this.fetchWaveDataWithRetry(beach),
            this.fetchTidalDataWithRetry(beach),
            this.fetchWeatherDataWithRetry(beach),
            this.fetchNearbyBuoyDataWithRetry(beach),
            this.fetchCDIPDataWithRetry(beach),
          ]);

        // Process results and handle failures gracefully
        const processedData = {
          beach,
          waveData: waveData.status === "fulfilled" ? waveData.value : null,
          tideData: tideData.status === "fulfilled" ? tideData.value : null,
          weatherData:
            weatherData.status === "fulfilled" ? weatherData.value : [],
          buoyData: buoyData.status === "fulfilled" ? buoyData.value : null,
          cdipData: cdipData.status === "fulfilled" ? cdipData.value : null,
        };

        // Log any data source failures
        if (waveData.status === "rejected")
          logError(waveData.reason, { beachId: beach.id, dataSource: "wave" });
        if (tideData.status === "rejected")
          logError(tideData.reason, { beachId: beach.id, dataSource: "tide" });
        if (weatherData.status === "rejected")
          logError(weatherData.reason, {
            beachId: beach.id,
            dataSource: "weather",
          });
        if (buoyData.status === "rejected")
          logError(buoyData.reason, { beachId: beach.id, dataSource: "buoy" });
        if (cdipData.status === "rejected")
          logError(cdipData.reason, { beachId: beach.id, dataSource: "cdip" });

        // Process and combine all data sources
        const forecasts = await this.combineDataSources(processedData);

        return forecasts;
      },
      { beachId: beach.id }
    )();
  }

  /**
   * Fetch wave data with retry logic
   */
  private async fetchWaveDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      const result = await this.dataSourceManager.getWaveWatchService().fetchWaveWatchForecast(
        beach.lat ?? 0,
        beach.lon ?? 0,
        FORECAST_CONSTANTS.DAYS
      );
      if (!result) {
        throw new DataSourceError(
          "WaveWatch",
          new Error("No wave data returned")
        );
      }
      return result;
    });
  }

  /**
   * Fetch tidal data with retry logic
   */
  private async fetchTidalDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      try {
        const stationId = this.dataSourceManager.getCOOPSService().getStationForLocation(
          beach.name,
          beach.lat ?? 0,
          beach.lon ?? 0
        );
        const result = await this.dataSourceManager.getCOOPSService().fetchCOOPSData(
          stationId,
          FORECAST_CONSTANTS.DAYS
        );
        return result;
      } catch (error) {
        throw new DataSourceError("CO-OPS", error as Error, {
          beachId: beach.id,
          location: { lat: beach.lat ?? 0, lng: beach.lon ?? 0 },
        });
      }
    });
  }

  /**
   * Fetch weather data with retry logic
   */
  private async fetchWeatherDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      const weatherSource = new NOAAWeatherDataSource();
      const location = {
        latitude: beach.lat as any, // Type assertion for now
        longitude: beach.lon as any,
      };
      try {
        const result = await weatherSource.fetchWeatherData(
          location,
          FORECAST_CONSTANTS.DAYS
        );
        return result.periods;
      } catch (error) {
        // Expected for some beaches (e.g. outside NWS coverage like Baja): treat as "no weather coverage".
        if (isNoaaInvalidPointError(error)) {
          return [];
        }
        // Expected for some coast/offshore points: hourly marine forecasts not supported.
        if (isNoaaMarineForecastNotSupportedError(error)) {
          return [];
        }
        throw error;
      }
    });
  }

  /**
   * Fetch buoy data with retry logic
   */
  private async fetchNearbyBuoyDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      return this.fetchNearbyBuoyData(beach);
    });
  }

  /**
   * Fetch CDIP data with retry logic
   */
  private async fetchCDIPDataWithRetry(beach: Beach) {
    if (this.isVerboseLoggingEnabled()) {
      console.log(
        `🏖️ fetchCDIPDataWithRetry called for beach: ${beach.name} (${beach.lat}, ${beach.lon})`
      );
    }
    return withRetry(async () => {
      try {
        // Prefer explicit override when present
        let selectedStation: string | null = null;
        const beachAny = beach as any;
        if (beachAny.cdip_station) {
          selectedStation = beachAny.cdip_station;
          if (this.isVerboseLoggingEnabled()) {
            console.log(
              `✅ Using CDIP override station ${selectedStation} for ${beach.name}`
            );
          }
        } else {
          if (this.isVerboseLoggingEnabled()) {
            console.log(`🔍 Looking for nearest CDIP station for ${beach.name}`);
          }
          selectedStation = await this.dataSourceManager.getCDIPService().getNearestStation(
            beach.lat ?? 0,
            beach.lon ?? 0,
            150 // 150km radius to cover regional gaps (CDIP station density varies)
          );
        }

        if (!selectedStation) {
          console.warn(
            `❌ No nearby CDIP station found for ${beach.name} within 150km`
          );
          return null;
        }

        if (this.isVerboseLoggingEnabled()) {
          console.log(
            `✅ Selected CDIP station ${selectedStation} for ${beach.name}`
          );
        }

        // Fetch CDIP data for the nearest station
        if (this.isVerboseLoggingEnabled()) {
          console.log(
            `🌊 Fetching CDIP data from station ${selectedStation} for ${beach.name}`
          );
        }
        const cdipData = await this.dataSourceManager.getCDIPService().fetchBuoyData(selectedStation);

        if (cdipData) {
          if (this.isVerboseLoggingEnabled()) {
            console.log(
              `✅ Successfully fetched CDIP data for ${beach.name} from station ${selectedStation}`
            );
          }
        } else {
          console.warn(
            `❌ CDIP data fetch returned null for ${beach.name} from station ${selectedStation}`
          );
        }

        return cdipData;
      } catch (error) {
        console.error(`💥 Error fetching CDIP data for ${beach.name}:`, error);
        throw new DataSourceError("CDIP", error as Error, {
          beachId: beach.id,
          location: { lat: beach.lat ?? 0, lng: beach.lon ?? 0 },
        });
      }
    });
  }

  /**
   * Fetch weather data from NOAA with retry logic
   */
  private async fetchWeatherData(beach: Beach) {
    try {
      // Import retry client dynamically to avoid circular dependencies
      const { apiClient } = await import("@/lib/utils/api-retry");
      
      // Get grid coordinates
      const pointsUrl = `https://api.weather.gov/points/${beach.lat},${beach.lon}`;
      const pointsResponse = await apiClient.fetchNOAAData(pointsUrl);

      if (!pointsResponse.ok) {
        throw new Error(`NOAA points API error: ${pointsResponse.status}`);
      }

      const pointsData = await pointsResponse.json();
      const forecastUrl = pointsData.properties.forecastHourly;

      if (!forecastUrl) {
        throw new Error("No forecast URL available");
      }

      // Fetch hourly forecast with retry
      const forecastResponse = await apiClient.fetchNOAAData(forecastUrl);

      if (!forecastResponse.ok) {
        throw new Error(`NOAA forecast API error: ${forecastResponse.status}`);
      }

      const forecastData = await forecastResponse.json();
      return forecastData.properties.periods || [];
    } catch (error) {
      console.error("Error fetching weather data:", error);
      return [];
    }
  }

  /**
   * Fetch nearby buoy data for real-time conditions
   */
  private async fetchNearbyBuoyData(beach: Beach) {
    try {
      const supabase = await createSupabaseServiceRoleClient();

      // If an override NDBC station is set, return it directly (if present in table)
      const beachAny = beach as any;
      if (beachAny.ndbc_station) {
        const { data: overrideBuoy } = await supabase
          .from("buoys")
          .select("*")
          .eq("buoy_uuid", beachAny.ndbc_station)
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        if (overrideBuoy) {
          return { ...overrideBuoy, distance: 0 } as any;
        }
      }

      // Get nearby buoys with recent data (no coordinates in table; cannot distance-sort here reliably)
      const { data: buoys, error } = await supabase
        .from("buoys")
        .select("*")
        .eq("active", true)
        .not("wave_height", "is", null)
        .not("water_temperature", "is", null);

      if (error || !buoys) {
        return null;
      }

      // Without coordinates, pick the first active with wave data as a coarse fallback
      return buoys[0] || null;
    } catch (error) {
      console.error("Error fetching buoy data:", error);
      return null;
    }
  }

  /**
   * Combine all data sources into comprehensive forecast
   */
  private async combineDataSources({
    beach,
    waveData,
    tideData,
    weatherData,
    buoyData,
    cdipData,
  }: {
    beach: Beach;
    waveData: any;
    tideData: any;
    weatherData: any[];
    buoyData: any;
    cdipData: CDIPBuoyData | null;
  }): Promise<EnhancedForecastWithRawData[]> {
    // Use ForecastBuilder to build forecasts
    const builder = new ForecastBuilder({
      getWaveDirectionText: (deg) =>
        this.dataSourceManager.getWaveWatchService().getWaveDirectionText(deg),
      getTideStatusAtTime: (tides, time) =>
        this.dataSourceManager.getCOOPSService().getTideStatusAtTime(tides, time),
      getTideHeightAtTime: (tides, time) =>
        this.dataSourceManager.getCOOPSService().getTideHeightAtTime(tides, time),
      getNextTideFromTime: (tides, time) =>
        this.dataSourceManager.getCOOPSService().getNextTideFromTime(tides, time),
      getDataQualityScore: (cdipData) =>
        this.dataSourceManager.getCDIPService().getDataQualityScore(cdipData),
    }, this.isVerboseLoggingEnabled());

    const forecasts = await builder.buildForecasts({
      beach,
      waveData,
      tideData,
      weatherData,
      buoyData,
      cdipData,
    });

    // Apply expert weighting and validation
    const weightedForecasts: EnhancedForecastWithRawData[] = [];
    for (const forecast of forecasts) {
      const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}`);
      const weighted = await this.applyExpertWeighting(forecast, beach.name, forecastTime);
      weightedForecasts.push(weighted);
    }

    return weightedForecasts;
  }

  /**
   * Get tide information for a specific time
   */
  private getTideInfoForTime(tideData: any, targetTime: Date) {
    const defaultTideInfo = {
      status: "Unknown",
      currentHeight: "2.5 ft",
      nextTideTime: "Unknown",
      nextTideType: "Unknown",
      nextTideHeight: "Unknown",
      nextTideAt: null as string | null,
    };

    if (!tideData?.tides) return defaultTideInfo;

    const status = this.dataSourceManager.getCOOPSService().getTideStatusAtTime(
      tideData.tides,
      targetTime
    );
    const currentHeight = this.dataSourceManager.getCOOPSService().getTideHeightAtTime(
      tideData.tides,
      targetTime
    );
    const nextTide = this.dataSourceManager.getCOOPSService().getNextTideFromTime(
      tideData.tides,
      targetTime
    );

    return {
      status,
      currentHeight: currentHeight ? `${currentHeight} ft` : "2.5 ft",
      // Keep formatted time for backward compatibility with existing data consumers
      nextTideTime: nextTide
        ? new Date(nextTide.time * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Unknown",
      // ISO timestamp for client-side timezone-aware formatting
      nextTideAt: nextTide
        ? new Date(nextTide.time * 1000).toISOString()
        : null,
      nextTideType: nextTide?.name || "Unknown",
      nextTideHeight: nextTide ? `${nextTide.height} ft` : "Unknown",
    };
  }

  // calculateConfidenceScore moved to lib/services/forecast/confidence-scorer.ts

  /**
   * Apply expert weighting to forecasts silently
   * Uses calibration data to improve forecast accuracy without exposing sources
   */
  private async applyExpertWeighting(
    forecast: EnhancedForecastWithRawData,
    beachName: string,
    forecastTime: Date
  ): Promise<EnhancedForecastWithRawData> {
    try {
      const weightingService = getForecastWeightingService();

      // Parse current forecast values
      const parseHeight = (str: string | null): number => {
        if (!str) return 0;
        const match = str.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const parsePeriod = (str: string | null): number => {
        if (!str) return 0;
        const match = str.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const parseDirection = (str: string | null): number => {
        return cardinalToDegrees(str) ?? 0;
      };

      // Create automated forecast data object
      const automatedForecast = {
        wave_height_ft: parseHeight(forecast.wave_height ?? null),
        wave_period_s: parsePeriod(forecast.wave_period ?? null),
        wave_direction_deg: parseDirection(forecast.wave_direction ?? null),
        wind_speed_mph: forecast.wind_speed ? parseFloat(forecast.wind_speed) : undefined,
        wind_direction_deg: parseDirection(forecast.wind_direction ?? null),
        confidence: forecast.confidence_score || 0.7,
      };

      // Skip weighting if forecast has no data
      if (automatedForecast.wave_height_ft === 0) {
        return forecast;
      }

      // Get weighted forecast from expert calibration
      const weightedForecast = await weightingService.blendForecast(
        automatedForecast,
        beachName,
        forecastTime
      );

      // Format values back to strings
      const formatHeight = (ft: number): string => {
        return `${Math.round(ft * 10) / 10} ft`;
      };

      const formatPeriod = (s: number): string => {
        return `${Math.round(s * 10) / 10}s`;
      };

      // Apply weighted values back to forecast
      const updatedForecast = {
        ...forecast,
        wave_height: formatHeight(weightedForecast.wave_height_ft),
        wave_period: formatPeriod(weightedForecast.wave_period_s),
        confidence_score: weightedForecast.confidence,
        // Note: No visible attribution to expert sources - silent integration
      };

      return updatedForecast;
    } catch (error) {
      // If weighting fails, return original forecast
      console.warn('Expert weighting failed, using original forecast:', error);
      return forecast;
    }
  }

  /**
   * Store enhanced forecasts in database
   * Delegates to ForecastStorageService
   */
  async storeEnhancedForecasts(
    beach: Beach,
    forecasts: EnhancedForecastEntity[]
  ) {
    return this.storageService.storeEnhancedForecasts(beach, forecasts);
  }

  /**
   * Simple deterministic hash function for sharding.
   * Uses djb2 algorithm to produce a stable hash from a string.
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    // Convert to unsigned 32-bit integer
    return hash >>> 0;
  }

  /**
   * Update all beaches with enhanced forecasts
   * Uses batch processing to avoid overwhelming external APIs and preventing timeouts
   * Pre-fetches shared data (tide stations) to avoid duplicate API calls
   * 
   * Supports sharding for horizontal scaling:
   * - shard: 0-based shard index
   * - shardCount: total number of shards
   * When both are set, only beaches where hash(beach_id) % shardCount === shard are processed.
   */
  async updateAllEnhancedForecasts(options: { deadlineMs?: number; shard?: number; shardCount?: number } = {}) {
    const { shard, shardCount } = options;
    const isSharded = typeof shard === "number" && typeof shardCount === "number" && shardCount > 0;
    const shardInfo = isSharded ? ` [shard ${shard}/${shardCount}]` : "";
    console.log(`📊 EnhancedForecastService.updateAllEnhancedForecasts() starting (v3 with stale-only updates)${shardInfo}`);
    const supabase = await createSupabaseServiceRoleClient();
    const deadlineMs = options.deadlineMs;
    const hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);
    const msRemaining = () =>
      hasDeadline ? (deadlineMs as number) - Date.now() : Number.POSITIVE_INFINITY;
    const shouldStop = () => hasDeadline && msRemaining() <= 0;
    // Process beaches in small batches
    const BATCH_SIZE = Number(process.env.FORECAST_BATCH_SIZE ?? 3);
    // Delay between batches to avoid rate limiting
    const BATCH_DELAY_MS = Number(process.env.FORECAST_BATCH_DELAY_MS ?? 1000);
    // Maximum beaches to process per cron run to avoid timeout
    // Default is tuned to stay under Vercel's 5 minute cron limit while improving overall rotation throughput.
    // Override via FORECAST_MAX_BEACHES_PER_RUN if needed.
    const MAX_BEACHES_PER_RUN = Number(process.env.FORECAST_MAX_BEACHES_PER_RUN ?? 45);
    /**
     * Freshness window for deciding what is "stale enough" to refresh.
     *
     * IMPORTANT: This MUST be >= the cron interval (currently 2h) or else the same
     * beaches will be re-selected every run and overall coverage will never catch up.
     */
    const FRESHNESS_WINDOW_HOURS = Number(process.env.FORECAST_FRESHNESS_WINDOW_HOURS ?? 12);

    try {
      const staleThresholdMs = Date.now() - FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000;

      // Get all beaches (authoritative list)
      const { data: allBeaches, error: beachError } = await supabase
        .from("beaches")
        .select("*");

      if (beachError) {
        throw beachError;
      }

      if (!allBeaches || allBeaches.length === 0) {
        console.log("📭 No beaches found to update");
        return { success: true, results: [] };
      }

      // Apply shard filtering if sharding is enabled
      // This enables horizontal scaling by partitioning beaches across multiple cron jobs
      let eligibleBeaches = allBeaches;
      if (isSharded) {
        eligibleBeaches = allBeaches.filter((b) => {
          const beachHash = this.hashString(b.id);
          return beachHash % (shardCount as number) === shard;
        });
        console.log(`📊 Shard ${shard}/${shardCount}: ${eligibleBeaches.length}/${allBeaches.length} beaches in this shard`);
      }

      const totalBeaches = eligibleBeaches.length;

      /**
       * Build a per-beach "latest updated_at" map.
       * Use a DB view that returns a single latest row per beach to avoid PostgREST row caps.
       */
      const latestUpdatedAtByBeachMs = new Map<string, number>();
      const { data: latestRows, error: latestError } = await supabase
        .from("v_enhanced_forecast_latest")
        .select("beach_id, updated_at");

      if (latestError) {
        throw latestError;
      }

      for (const row of (latestRows ?? []) as Array<{ beach_id: string; updated_at: string | null }>) {
        if (!row?.beach_id || !row.updated_at) continue;
        const ts = new Date(row.updated_at).getTime();
        if (!Number.isFinite(ts)) continue;
        latestUpdatedAtByBeachMs.set(row.beach_id, ts);
      }

      // Filter based on eligible beaches (respects sharding if enabled)
      const missingBeaches = eligibleBeaches.filter((b) => !latestUpdatedAtByBeachMs.has(b.id));
      const staleBeaches = eligibleBeaches
        .filter((b) => {
          const updatedAtMs = latestUpdatedAtByBeachMs.get(b.id);
          return Boolean(updatedAtMs && updatedAtMs < staleThresholdMs);
        })
        // Oldest first so we systematically catch up coverage/freshness
        .sort((a, b) => {
          const aUpdated = latestUpdatedAtByBeachMs.get(a.id) ?? 0;
          const bUpdated = latestUpdatedAtByBeachMs.get(b.id) ?? 0;
          return aUpdated - bUpdated;
        });

      // Prioritize missing coverage first, then oldest stale
      let beachesToUpdate = [...missingBeaches, ...staleBeaches];

      // If everything is fresh and present, rotate a few oldest anyway
      if (beachesToUpdate.length === 0) {
        console.log(
          `✅ All beaches have fresh forecasts${shardInfo}, updating oldest 5 for rotation`
        );
        beachesToUpdate = eligibleBeaches
          .filter((b) => latestUpdatedAtByBeachMs.has(b.id))
          .sort((a, b) => {
            const aUpdated = latestUpdatedAtByBeachMs.get(a.id) ?? 0;
            const bUpdated = latestUpdatedAtByBeachMs.get(b.id) ?? 0;
            return aUpdated - bUpdated;
          })
          .slice(0, 5);
      }

      // Limit to max beaches per run
      const beaches = beachesToUpdate.slice(0, MAX_BEACHES_PER_RUN);
      const selectedMissing = beaches.filter((b) => !latestUpdatedAtByBeachMs.has(b.id)).length;

      console.log(
        `🌊 Starting batch forecast update for ${beaches.length}/${eligibleBeaches.length} beaches${shardInfo} (missing: ${missingBeaches.length}, stale>${FRESHNESS_WINDOW_HOURS}h: ${staleBeaches.length}, selectedMissing: ${selectedMissing}, max ${MAX_BEACHES_PER_RUN} per run, batch size: ${BATCH_SIZE})`
      );
      const startTime = Date.now();

      if (shouldStop()) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.warn("⏱️ Time budget exhausted before processing started; stopping early", {
          selected: beaches.length,
          attempted: 0,
          remainingMs: msRemaining(),
        });
        return {
          success: true,
          results: [],
          summary: {
            total: beaches.length,
            attempted: 0,
            successful: 0,
            failed: 0,
            duration: `${duration}s`,
            stoppedEarly: true,
            stopReason: "time_budget",
            remainingMs: msRemaining(),
          },
        };
      }

      // Pre-fetch tide data for unique stations to avoid duplicate API calls
      // This significantly reduces the number of CO-OPS API calls
      await this.prefetchTideStations(beaches);

      // Split beaches into batches
      const batches: typeof beaches[] = [];
      for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
        batches.push(beaches.slice(i, i + BATCH_SIZE));
      }

      const allResults: Array<{
        beach: string;
        success: boolean;
        error?: any;
      }> = [];
      let successCount = 0;
      let failCount = 0;

      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (shouldStop()) {
          console.warn("⏱️ Stopping early due to time budget (before starting next batch)", {
            batchIndex,
            totalBatches: batches.length,
            attempted: allResults.length,
            successful: successCount,
            failed: failCount,
            remainingMs: msRemaining(),
          });
          break;
        }

        const batch = batches[batchIndex];
        const batchNum = batchIndex + 1;
        const totalBatches = batches.length;

        console.log(
          `📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} beaches)`
        );

        // Process beaches within batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (beach) => {
            try {
              const forecasts =
                await this.generateComprehensiveForecast(beach);
              const result = await this.storeEnhancedForecasts(
                beach,
                forecasts
              );
              if (result.success) {
                console.log(
                  `✅ ${beach.name}: ${forecasts.length} forecasts stored`
                );
              } else {
                console.warn(
                  `⚠️ ${beach.name}: store failed - ${result.error}`
                );
              }
              return {
                beach: beach.name,
                success: result.success,
                error: result.error,
              };
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              console.error(`❌ ${beach.name}: ${errorMsg}`);
              return { beach: beach.name, success: false, error: errorMsg };
            }
          })
        );

        // Collect results
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            allResults.push(result.value);
            if (result.value.success) {
              successCount++;
            } else {
              failCount++;
            }
          } else {
            allResults.push({
              beach: "unknown",
              success: false,
              error: "Promise rejected",
            });
            failCount++;
          }
        }

        console.log(
          `📊 Batch ${batchNum} complete: ${successCount} success, ${failCount} failed so far`
        );

        // Add delay between batches to avoid rate limiting (except after last batch)
        if (batchIndex < batches.length - 1) {
          if (hasDeadline && msRemaining() <= BATCH_DELAY_MS) {
            console.warn("⏱️ Skipping batch delay and stopping early due to time budget", {
              batchIndex,
              attempted: allResults.length,
              remainingMs: msRemaining(),
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const attempted = allResults.length;
      const stoppedEarly = attempted < beaches.length && hasDeadline;
      console.log(
        `🏁 Forecast update complete in ${duration}s: ${successCount}/${beaches.length} successful${
          stoppedEarly ? " (stopped early)" : ""
        }`
      );

      return {
        success: true,
        results: allResults,
        summary: {
          total: beaches.length,
          attempted,
          successful: successCount,
          failed: failCount,
          duration: `${duration}s`,
          stoppedEarly,
          stopReason: stoppedEarly ? "time_budget" : undefined,
          remainingMs: hasDeadline ? msRemaining() : undefined,
        },
      };
    } catch (error) {
      console.error("Error updating all enhanced forecasts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update CDIP-sourced beaches with a shorter freshness window.
   *
   * Purpose: keep CDIP-backed enhanced forecasts fresh enough for strict cache
   * consumers (e.g. discovery, which treats CDIP as near-real-time).
   *
   * This is intentionally separate from the main rotation updater, which uses a
   * broader freshness window (default 12h) to fit within cron time budgets.
   */
  async updateCdipEnhancedForecasts(options: { deadlineMs?: number } = {}) {
    console.log(
      "📊 EnhancedForecastService.updateCdipEnhancedForecasts() starting (CDIP-only refresh)"
    );
    const supabase = await createSupabaseServiceRoleClient();
    const deadlineMs = options.deadlineMs;
    const hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);
    const msRemaining = () =>
      hasDeadline ? (deadlineMs as number) - Date.now() : Number.POSITIVE_INFINITY;
    const shouldStop = () => hasDeadline && msRemaining() <= 0;

    const BATCH_SIZE = Number(process.env.FORECAST_BATCH_SIZE ?? 3);
    const BATCH_DELAY_MS = Number(process.env.FORECAST_BATCH_DELAY_MS ?? 1000);
    const MAX_BEACHES_PER_RUN = Number(
      process.env.FORECAST_CDIP_MAX_BEACHES_PER_RUN ??
        process.env.FORECAST_MAX_BEACHES_PER_RUN ??
        25
    );
    const FRESHNESS_WINDOW_HOURS = Number(
      process.env.FORECAST_CDIP_FRESHNESS_WINDOW_HOURS ?? 2
    );

    try {
      const staleThresholdMs = Date.now() - FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000;

      // Get all beaches (authoritative list)
      const { data: allBeaches, error: beachError } = await supabase
        .from("beaches")
        .select("*");

      if (beachError) {
        throw beachError;
      }

      if (!allBeaches || allBeaches.length === 0) {
        console.log("📭 No beaches found to update");
        return { success: true, results: [] };
      }

      // Latest enhanced forecast row per beach (includes data_source)
      const { data: latestRows, error: latestError } = await supabase
        .from("v_enhanced_forecast_latest")
        .select("beach_id, updated_at, data_source");

      if (latestError) {
        throw latestError;
      }

      const latestByBeach = new Map<
        string,
        { updated_at: string; data_source: string | null }
      >();
      for (const row of (latestRows ?? []) as Array<{
        beach_id: string;
        updated_at: string | null;
        data_source: string | null;
      }>) {
        if (!row?.beach_id || !row.updated_at) continue;
        latestByBeach.set(row.beach_id, {
          updated_at: row.updated_at,
          data_source: row.data_source ?? null,
        });
      }

      // Select CDIP beaches older than the short freshness window (oldest first)
      const cdipStale = allBeaches
        .filter((b) => {
          const latest = latestByBeach.get(b.id);
          if (!latest) return false;
          if ((latest.data_source || "").toUpperCase() !== "CDIP") return false;
          const ts = new Date(latest.updated_at).getTime();
          return Number.isFinite(ts) && ts < staleThresholdMs;
        })
        .sort((a, b) => {
          const aUpdated = new Date(latestByBeach.get(a.id)!.updated_at).getTime();
          const bUpdated = new Date(latestByBeach.get(b.id)!.updated_at).getTime();
          return aUpdated - bUpdated;
        });

      const beaches = cdipStale.slice(0, MAX_BEACHES_PER_RUN);

      console.log(
        `🌊 Starting CDIP-only update for ${beaches.length}/${cdipStale.length} CDIP-stale beaches (stale>${FRESHNESS_WINDOW_HOURS}h, max ${MAX_BEACHES_PER_RUN} per run, batch size: ${BATCH_SIZE})`
      );

      const startTime = Date.now();

      if (shouldStop()) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.warn("⏱️ Time budget exhausted before processing started; stopping early", {
          selected: beaches.length,
          attempted: 0,
          remainingMs: msRemaining(),
        });
        return {
          success: true,
          results: [],
          summary: {
            total: beaches.length,
            attempted: 0,
            successful: 0,
            failed: 0,
            duration: `${duration}s`,
            stoppedEarly: true,
            stopReason: "time_budget",
            remainingMs: msRemaining(),
          },
        };
      }

      // Pre-fetch tide data to avoid duplicate CO-OPS calls
      await this.prefetchTideStations(beaches);

      // Split beaches into batches
      const batches: typeof beaches[] = [];
      for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
        batches.push(beaches.slice(i, i + BATCH_SIZE));
      }

      const allResults: Array<{ beach: string; success: boolean; error?: any }> = [];
      let successCount = 0;
      let failCount = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (shouldStop()) {
          console.warn("⏱️ Stopping early due to time budget (before starting next batch)", {
            batchIndex,
            totalBatches: batches.length,
            attempted: allResults.length,
            successful: successCount,
            failed: failCount,
            remainingMs: msRemaining(),
          });
          break;
        }

        const batch = batches[batchIndex];
        const batchNum = batchIndex + 1;
        const totalBatches = batches.length;

        console.log(`📦 Processing CDIP batch ${batchNum}/${totalBatches} (${batch.length} beaches)`);

        const batchResults = await Promise.allSettled(
          batch.map(async (beach) => {
            try {
              const forecasts = await this.generateComprehensiveForecast(beach);
              const result = await this.storeEnhancedForecasts(beach, forecasts);
              if (result.success) {
                console.log(`✅ ${beach.name}: ${forecasts.length} forecasts stored`);
              } else {
                console.warn(`⚠️ ${beach.name}: store failed - ${result.error}`);
              }
              return { beach: beach.name, success: result.success, error: result.error };
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error(`❌ ${beach.name}: ${errorMsg}`);
              return { beach: beach.name, success: false, error: errorMsg };
            }
          })
        );

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            allResults.push(result.value);
            if (result.value.success) successCount++;
            else failCount++;
          } else {
            allResults.push({ beach: "unknown", success: false, error: "Promise rejected" });
            failCount++;
          }
        }

        console.log(`📊 CDIP batch ${batchNum} complete: ${successCount} success, ${failCount} failed so far`);

        if (batchIndex < batches.length - 1) {
          if (hasDeadline && msRemaining() <= BATCH_DELAY_MS) {
            console.warn("⏱️ Skipping batch delay and stopping early due to time budget", {
              batchIndex,
              attempted: allResults.length,
              remainingMs: msRemaining(),
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const attempted = allResults.length;
      const stoppedEarly = attempted < beaches.length && hasDeadline;

      console.log(
        `🏁 CDIP-only update complete in ${duration}s: ${successCount}/${beaches.length} successful${
          stoppedEarly ? " (stopped early)" : ""
        }`
      );

      return {
        success: true,
        results: allResults,
        summary: {
          total: beaches.length,
          attempted,
          successful: successCount,
          failed: failCount,
          duration: `${duration}s`,
          stoppedEarly,
          stopReason: stoppedEarly ? "time_budget" : undefined,
          remainingMs: hasDeadline ? msRemaining() : undefined,
        },
      };
    } catch (error) {
      console.error("Error updating CDIP enhanced forecasts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Pre-fetch tide data for all unique stations to populate the cache
   * This avoids duplicate API calls when multiple beaches share the same station
   */
  private async prefetchTideStations(beaches: Beach[]): Promise<void> {
    // Get unique station IDs for all beaches
    const stationIds = new Set<string>();
    for (const beach of beaches) {
      const stationId = this.dataSourceManager.getCOOPSService().getStationForLocation(
        beach.name,
        beach.lat ?? 0,
        beach.lon ?? 0
      );
      stationIds.add(stationId);
    }

    const uniqueStations = Array.from(stationIds);
    console.log(
      `📡 Pre-fetching tide data for ${uniqueStations.length} unique stations (covering ${beaches.length} beaches)`
    );

    // Fetch in small batches to avoid overwhelming the API
    const STATION_BATCH_SIZE = 5;
    for (let i = 0; i < uniqueStations.length; i += STATION_BATCH_SIZE) {
      const batch = uniqueStations.slice(i, i + STATION_BATCH_SIZE);
      await Promise.allSettled(
        batch.map((stationId) =>
          this.dataSourceManager.getCOOPSService().fetchCOOPSData(stationId, FORECAST_CONSTANTS.DAYS)
        )
      );
      // Small delay between station batches
      if (i + STATION_BATCH_SIZE < uniqueStations.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Tide station pre-fetch complete`);
  }
}
