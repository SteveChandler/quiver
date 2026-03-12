import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ForecastDataSourceManager, NOAAWeatherDataSource } from "./forecast/data-source-manager";
import { ForecastStorageService } from "./forecast/storage-service";
import { ForecastBuilder } from "./forecast/forecast-builder";
import { hashString } from "./forecast/batch-update-coordinator";
import {
  DeadlineTracker,
  loadBatchConfig,
  loadCdipBatchConfig,
  processBeachesInBatches,
  createBeachProcessor,
  type BatchProcessResult,
} from "./forecast/batch-beach-processor";
import type { Beach } from "@/types/database";
import { createContextLogger } from "@/lib/logger";
import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
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
import { toFaceHeightFeet } from "@/lib/utils/wave-formatters";
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

const log = createContextLogger('EnhancedForecastService');

export class EnhancedForecastService {
  private readonly warnedSchemaColumns = new Set<string>();

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
        // Note: NDBC buoy fetch was removed — it picked a random buoy (no geographic
        // filtering) so its wave/temp data was incorrect for non-local beaches.
        // Water temp is now sourced from IOOS; wave data from CDIP + WaveWatch.
        const [waveData, tideData, weatherData, cdipData, ioosWaterTempResult] =
          await Promise.allSettled([
            this.fetchWaveDataWithRetry(beach),
            this.fetchTidalDataWithRetry(beach),
            this.fetchWeatherDataWithRetry(beach),
            this.fetchCDIPDataWithRetry(beach),
            this.fetchIOOSWaterTemp(beach),
          ]);

        // Process results and handle failures gracefully
        const processedData = {
          beach,
          waveData: waveData.status === "fulfilled" ? waveData.value : null,
          tideData: tideData.status === "fulfilled" ? tideData.value : null,
          weatherData:
            weatherData.status === "fulfilled" ? weatherData.value : [],
          buoyData: null,
          cdipData: cdipData.status === "fulfilled" ? cdipData.value : null,
          ioosWaterTempC: ioosWaterTempResult.status === "fulfilled" ? ioosWaterTempResult.value : null,
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
        if (cdipData.status === "rejected")
          logError(cdipData.reason, { beachId: beach.id, dataSource: "cdip" });
        if (ioosWaterTempResult.status === "rejected")
          logError(ioosWaterTempResult.reason, {
            beachId: beach.id,
            dataSource: "ioos_water_temp",
          });

        // Process and combine all data sources
        return this.combineDataSources(processedData);
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
        beach.lat,
        beach.lon,
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
   *
   * Prefers cached tide data from tide_forecasts table (deterministic, populated weekly)
   * Falls back to live CO-OPS API if cache is empty.
   */
  private async fetchTidalDataWithRetry(beach: Beach) {
    return withRetry(async () => {
      try {
        // First, try to get cached tide data from the database
        // This is the preferred path as tides are deterministic and cached weekly
        const cachedTides = await this.dataSourceManager.getCOOPSService().fetchCachedTides(
          beach.id,
          FORECAST_CONSTANTS.DAYS
        );

        if (cachedTides && cachedTides.tides.length > 0) {
          log.debug(`Using cached tide data for beach ${beach.name}: ${cachedTides.tides.length} extremes`);
          return cachedTides;
        }

        // Fallback to live API if no cached data (should be rare after initial population)
        log.warn(`No cached tides for beach ${beach.name}, falling back to live CO-OPS API`);
        const stationId = this.dataSourceManager.getCOOPSService().getStationForLocation(
          beach.name,
          beach.lat,
          beach.lon
        );
        const result = await this.dataSourceManager.getCOOPSService().fetchCOOPSData(
          stationId,
          FORECAST_CONSTANTS.DAYS
        );
        return result;
      } catch (error) {
        throw new DataSourceError("CO-OPS", error as Error, {
          beachId: beach.id,
          location: { lat: beach.lat, lng: beach.lon },
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
   * Fetch CDIP data with retry logic
   */
  private async fetchCDIPDataWithRetry(beach: Beach) {
    log.debug(`fetchCDIPDataWithRetry called for beach: ${beach.name} (${beach.lat}, ${beach.lon})`);
    return withRetry(async () => {
      try {
        // Prefer explicit override when present
        let selectedStation: string | null = null;
        const beachAny = beach as any;
        if (beachAny.cdip_station) {
          selectedStation = beachAny.cdip_station;
          log.debug(`Using CDIP override station ${selectedStation} for ${beach.name}`);
        } else {
          log.debug(`Looking for nearest CDIP station for ${beach.name}`);
          selectedStation = await this.dataSourceManager.getCDIPService().getNearestStation(
            beach.lat,
            beach.lon,
            150 // 150km radius to cover regional gaps (CDIP station density varies)
          );
        }

        if (!selectedStation) {
          log.warn(`No nearby CDIP station found for ${beach.name} within 150km`);
          return null;
        }

        log.debug(`Selected CDIP station ${selectedStation} for ${beach.name}`);

        // Fetch CDIP data for the nearest station
        log.debug(`Fetching CDIP data from station ${selectedStation} for ${beach.name}`);
        const cdipData = await this.dataSourceManager.getCDIPService().fetchBuoyData(selectedStation);

        if (cdipData) {
          log.debug(`Successfully fetched CDIP data for ${beach.name} from station ${selectedStation}`);
        } else {
          log.warn(`CDIP data fetch returned null for ${beach.name} from station ${selectedStation}`);
        }

        return cdipData;
      } catch (error) {
        log.error(`Error fetching CDIP data for ${beach.name}:`, error);
        throw new DataSourceError("CDIP", error as Error, {
          beachId: beach.id,
          location: { lat: beach.lat, lng: beach.lon },
        });
      }
    });
  }

  /** Maximum age (in hours) for IOOS water temperature observations to be considered valid */
  private static readonly IOOS_STALENESS_HOURS = 48;

  /**
   * Fetch the latest IOOS water temperature for a beach.
   * Uses ioos_stations.nearest_beach_id to find assigned stations,
   * then gets the most recent water_temp_c observation.
   */
  private async fetchIOOSWaterTemp(beach: Beach): Promise<number | null> {
    return withRetry(async () => {
      const supabase = await createSupabaseServiceRoleClient();

      // Find IOOS stations assigned to this beach
      const { data: stations, error: stationError } = await supabase
        .from("ioos_stations")
        .select("station_id")
        .eq("nearest_beach_id", beach.id)
        .eq("active", true)
        .limit(5);

      if (stationError || !stations || stations.length === 0) {
        return null;
      }

      const stationIds = stations.map(s => s.station_id);

      // Get latest water temp observation from any of these stations
      const { data: obs, error: obsError } = await supabase
        .from("ioos_observations")
        .select("water_temp_c, observed_at")
        .in("station_id", stationIds)
        .not("water_temp_c", "is", null)
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (obsError || !obs) {
        return null;
      }

      // Only use if observation is recent
      const obsAge = Date.now() - new Date(obs.observed_at).getTime();
      const stalenessMs = EnhancedForecastService.IOOS_STALENESS_HOURS * 60 * 60 * 1000;
      if (obsAge > stalenessMs) {
        log.debug(`IOOS water temp for ${beach.name} is stale (${Math.round(obsAge / 3600000)}h old), skipping`);
        return null;
      }

      const temp = Number(obs.water_temp_c);
      return isFinite(temp) ? temp : null;
    });
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
    ioosWaterTempC,
  }: {
    beach: Beach;
    waveData: any;
    tideData: any;
    weatherData: any[];
    buoyData: any;
    cdipData: CDIPBuoyData | null;
    ioosWaterTempC: number | null;
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
    }, isForecastVerboseLoggingEnabled());

    const forecasts = await builder.buildForecasts({
      beach,
      waveData,
      tideData,
      weatherData,
      buoyData,
      cdipData,
      ioosWaterTempC,
    });

    return forecasts;
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
   * Update all beaches with enhanced forecasts
   * Uses batch processing to avoid overwhelming external APIs and preventing timeouts
   * Pre-fetches shared data (tide stations) to avoid duplicate API calls
   *
   * Supports sharding for horizontal scaling:
   * - shard: 0-based shard index
   * - shardCount: total number of shards
   * When both are set, only beaches where hash(beach_id) % shardCount === shard are processed.
   */
  async updateAllEnhancedForecasts(options: { deadlineMs?: number; shard?: number; shardCount?: number } = {}): Promise<BatchProcessResult> {
    const { shard, shardCount } = options;
    const isSharded = typeof shard === "number" && typeof shardCount === "number" && shardCount > 0;
    const shardInfo = isSharded ? ` [shard ${shard}/${shardCount}]` : "";
    log.info(`updateAllEnhancedForecasts() starting (v3 with stale-only updates)${shardInfo}`);

    const config = loadBatchConfig();
    const deadlineTracker = new DeadlineTracker(options.deadlineMs);

    try {
      const beaches = await this.selectBeachesForUpdate(config, shard, shardCount);
      if (!beaches) {
        return { success: true, results: [] };
      }

      log.info(
        `Starting batch forecast update for ${beaches.selected.length}/${beaches.eligible.length} beaches${shardInfo} ` +
        `(missing: ${beaches.stats.missing}, stale>${config.freshnessWindowHours}h: ${beaches.stats.stale}, ` +
        `selectedMissing: ${beaches.stats.selectedMissing}, max ${config.maxBeachesPerRun} per run, batch size: ${config.batchSize})`
      );

      const result = await processBeachesInBatches({
        beaches: beaches.selected,
        config,
        deadlineTracker,
        processBeach: createBeachProcessor(
          (beach) => this.generateComprehensiveForecast(beach),
          (beach, forecasts) => this.storeEnhancedForecasts(beach, forecasts)
        ),
        prefetchCallback: (beaches) => this.prefetchTideStations(beaches),
        logPrefix: "📦 ",
      });

      log.info(
        `Forecast update complete in ${result.summary?.duration}: ${result.summary?.successful}/${beaches.selected.length} successful${
          result.summary?.stoppedEarly ? " (stopped early)" : ""
        }`
      );

      return result;
    } catch (error) {
      log.error("Error updating all enhanced forecasts:", error);
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Select beaches for update based on staleness and sharding
   */
  private async selectBeachesForUpdate(
    config: { freshnessWindowHours: number; maxBeachesPerRun: number },
    shard?: number,
    shardCount?: number
  ) {
    const supabase = await createSupabaseServiceRoleClient();
    const isSharded = typeof shard === "number" && typeof shardCount === "number" && shardCount > 0;
    const shardInfo = isSharded ? ` [shard ${shard}/${shardCount}]` : "";
    const staleThresholdMs = Date.now() - config.freshnessWindowHours * 60 * 60 * 1000;

    // Get all beaches
    const { data: allBeaches, error: beachError } = await supabase
      .from("beaches")
      .select("*");

    if (beachError) throw beachError;
    if (!allBeaches || allBeaches.length === 0) {
      log.info("No beaches found to update");
      return null;
    }

    // Apply shard filtering
    let eligibleBeaches = allBeaches;
    if (isSharded) {
      eligibleBeaches = allBeaches.filter((b) => hashString(b.id) % (shardCount as number) === shard);
      log.info(`Shard ${shard}/${shardCount}: ${eligibleBeaches.length}/${allBeaches.length} beaches in this shard`);
    }

    // Build latest updated_at map
    const latestUpdatedAtByBeachMs = new Map<string, number>();
    const { data: latestRows, error: latestError } = await supabase
      .from("v_enhanced_forecast_latest")
      .select("beach_id, updated_at");

    if (latestError) throw latestError;

    for (const row of (latestRows ?? []) as Array<{ beach_id: string; updated_at: string | null }>) {
      if (!row?.beach_id || !row.updated_at) continue;
      const ts = new Date(row.updated_at).getTime();
      if (Number.isFinite(ts)) latestUpdatedAtByBeachMs.set(row.beach_id, ts);
    }

    // Filter beaches
    const missingBeaches = eligibleBeaches.filter((b) => !latestUpdatedAtByBeachMs.has(b.id));
    const staleBeaches = eligibleBeaches
      .filter((b) => {
        const updatedAtMs = latestUpdatedAtByBeachMs.get(b.id);
        return Boolean(updatedAtMs && updatedAtMs < staleThresholdMs);
      })
      .sort((a, b) => (latestUpdatedAtByBeachMs.get(a.id) ?? 0) - (latestUpdatedAtByBeachMs.get(b.id) ?? 0));

    let beachesToUpdate = [...missingBeaches, ...staleBeaches];

    // If everything is fresh, rotate oldest 5
    if (beachesToUpdate.length === 0) {
      log.info(`All beaches have fresh forecasts${shardInfo}, updating oldest 5 for rotation`);
      beachesToUpdate = eligibleBeaches
        .filter((b) => latestUpdatedAtByBeachMs.has(b.id))
        .sort((a, b) => (latestUpdatedAtByBeachMs.get(a.id) ?? 0) - (latestUpdatedAtByBeachMs.get(b.id) ?? 0))
        .slice(0, 5);
    }

    const selected = beachesToUpdate.slice(0, config.maxBeachesPerRun);
    return {
      selected,
      eligible: eligibleBeaches,
      stats: {
        missing: missingBeaches.length,
        stale: staleBeaches.length,
        selectedMissing: selected.filter((b) => !latestUpdatedAtByBeachMs.has(b.id)).length,
      },
    };
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
  async updateCdipEnhancedForecasts(options: { deadlineMs?: number } = {}): Promise<BatchProcessResult> {
    log.info("updateCdipEnhancedForecasts() starting (CDIP-only refresh)");

    const config = loadCdipBatchConfig();
    const deadlineTracker = new DeadlineTracker(options.deadlineMs);

    try {
      const beaches = await this.selectCdipBeachesForUpdate(config);
      if (!beaches) {
        return { success: true, results: [] };
      }

      log.info(
        `Starting CDIP-only update for ${beaches.selected.length}/${beaches.totalStale} CDIP-stale beaches ` +
        `(stale>${config.freshnessWindowHours}h, max ${config.maxBeachesPerRun} per run, batch size: ${config.batchSize})`
      );

      const result = await processBeachesInBatches({
        beaches: beaches.selected,
        config,
        deadlineTracker,
        processBeach: createBeachProcessor(
          (beach) => this.generateComprehensiveForecast(beach),
          (beach, forecasts) => this.storeEnhancedForecasts(beach, forecasts)
        ),
        prefetchCallback: (beaches) => this.prefetchTideStations(beaches),
        logPrefix: "CDIP ",
      });

      log.info(
        `CDIP-only update complete in ${result.summary?.duration}: ${result.summary?.successful}/${beaches.selected.length} successful${
          result.summary?.stoppedEarly ? " (stopped early)" : ""
        }`
      );

      return result;
    } catch (error) {
      log.error("Error updating CDIP enhanced forecasts:", error);
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Select CDIP beaches for update based on staleness
   *
   * FIXED: Previously this method only selected beaches that already had data_source='CDIP',
   * which meant beaches not initially seeded with CDIP data were never updated by the CDIP cron.
   * Now we use the cdip_eligible column to determine which beaches should receive CDIP updates,
   * regardless of their current data_source.
   */
  private async selectCdipBeachesForUpdate(config: { freshnessWindowHours: number; maxBeachesPerRun: number }) {
    const supabase = await createSupabaseServiceRoleClient();
    const staleThresholdMs = Date.now() - config.freshnessWindowHours * 60 * 60 * 1000;

    // Load CDIP-eligible beaches from DB (not all beaches)
    const { data: cdipBeaches, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("cdip_eligible", true);

    if (beachError) throw beachError;
    if (!cdipBeaches || cdipBeaches.length === 0) {
      log.info("No CDIP-eligible beaches found");
      return null;
    }

    // Get latest forecast data
    const { data: latestRows, error: latestError } = await supabase
      .from("v_enhanced_forecast_latest")
      .select("beach_id, updated_at, data_source");

    if (latestError) throw latestError;

    const latestByBeach = new Map<string, { updated_at: string; data_source: string | null }>();
    for (const row of (latestRows ?? []) as Array<{ beach_id: string; updated_at: string | null; data_source: string | null }>) {
      if (!row?.beach_id || !row.updated_at) continue;
      latestByBeach.set(row.beach_id, { updated_at: row.updated_at, data_source: row.data_source ?? null });
    }

    // Select stale OR missing beaches (DO NOT filter by data_source)
    const cdipStale = cdipBeaches
      .filter((b) => {
        const latest = latestByBeach.get(b.id);
        // FIXED: Missing forecast data = needs update (was incorrectly returning false)
        if (!latest) return true;
        // FIXED: Removed data_source check - we want to update based on eligibility, not current source
        const ts = new Date(latest.updated_at).getTime();
        return Number.isFinite(ts) && ts < staleThresholdMs;
      })
      .sort((a, b) => {
        // Sort missing first, then by oldest updated
        const aLatest = latestByBeach.get(a.id);
        const bLatest = latestByBeach.get(b.id);
        if (!aLatest && bLatest) return -1;
        if (aLatest && !bLatest) return 1;
        if (!aLatest && !bLatest) return 0;
        return new Date(aLatest!.updated_at).getTime() - new Date(bLatest!.updated_at).getTime();
      });

    return {
      selected: cdipStale.slice(0, config.maxBeachesPerRun),
      totalStale: cdipStale.length,
    };
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
        beach.lat,
        beach.lon
      );
      stationIds.add(stationId);
    }

    const uniqueStations = Array.from(stationIds);
    log.debug(
      `Pre-fetching tide data for ${uniqueStations.length} unique stations (covering ${beaches.length} beaches)`
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

    log.debug("Tide station pre-fetch complete");
  }
}
