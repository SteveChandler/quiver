/**
 * NOAA CO-OPS Service
 *
 * Main orchestration class for fetching and analyzing tide data
 * from the NOAA Center for Operational Oceanographic Products and Services.
 */

import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
import { createContextLogger } from "@/lib/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  TideDiagnostics,
  TideRawSample,
  TideExtreme as TideExtremeType,
  TideDataFreshness,
} from "@/types/tide-diagnostics";
import {
  calculateConfidenceScore,
  getVerificationStatus,
} from "@/types/tide-diagnostics";

import type { TideData, TideStatus, COOPSForecast } from "./types";
import { TideCache } from "./tide-cache";
import { getStationForLocation as resolveStation } from "./station-resolver";
import { COOPS_STATIONS } from "./constants/station-mappings";
import {
  fetchAllStationData,
  buildPredictionsUrl,
  formatDateForApi,
} from "./api-client";
import {
  getTideStatusAtTime as analyzeTideStatus,
  getTideHeightAtTime as analyzeHeightAtTime,
  getNextTide as analyzeNextTide,
  getNextTideFromTime as analyzeNextTideFromTime,
  getCurrentTideHeight as analyzeCurrentHeight,
} from "./tide-analysis";
import { TideExtremaDetector, TideSample } from "./tide-extrema-detector";
import { TideCacheMonitor } from "./tide-cache-monitor";
import {
  getUtcHourKey,
  isPreferredTideForecastRow,
  type TideForecastSelectionRow,
} from "../tide-forecast-selection";

const log = createContextLogger("NOAACOOPS");

/**
 * NOAA CO-OPS Service for tide data fetching and analysis
 *
 * Provides methods for:
 * - Station lookup by beach name or coordinates
 * - Fetching tide predictions from CO-OPS API
 * - Caching to avoid duplicate API calls
 * - Tide analysis (height interpolation, phase detection)
 */
export class NOAACOOPSService {
  private readonly cache: TideCache;

  constructor() {
    this.cache = new TideCache({
      timeoutMs: 30 * 60 * 1000, // 30 minutes
      maxSize: 50,
      onCacheHit: (stationId) => {
        if (this.isVerbose()) {
          log.debug(`Using cached tide data for station ${stationId}`);
        }
      },
    });
  }

  private isVerbose(): boolean {
    return isForecastVerboseLoggingEnabled();
  }

  private getLoggerOptions() {
    return {
      verbose: this.isVerbose(),
      logger: {
        debug: (msg: string, ...args: unknown[]) => log.debug(msg, ...args),
        warn: (msg: string, ...args: unknown[]) => log.warn(msg, ...args),
        error: (msg: string, ...args: unknown[]) => log.error(msg, ...args),
      },
    };
  }

  /**
   * Get the appropriate CO-OPS station for a beach location
   */
  getStationForLocation(
    beachName: string,
    lat?: number,
    lng?: number
  ): string {
    return resolveStation(beachName, lat, lng, this.getLoggerOptions());
  }

  /**
   * Fetch comprehensive tide and current data from CO-OPS
   * Uses caching to avoid duplicate API calls for the same station
   */
  async fetchCOOPSData(
    stationId: string,
    days: number = 10
  ): Promise<COOPSForecast | null> {
    try {
      // Check cache first
      const cached = this.cache.get(stationId);
      if (cached) {
        return cached;
      }

      if (this.isVerbose()) {
        log.debug(`Fetching CO-OPS data for station ${stationId}`);
      }

      const { tideData, waterLevel, stationInfo } = await fetchAllStationData(
        stationId,
        days,
        this.getLoggerOptions()
      );

      if (tideData.length === 0) {
        log.warn(`No tide predictions available for station ${stationId}`);
        return null;
      }

      const result: COOPSForecast = {
        station_id: stationId,
        station_name: stationInfo?.name || `Station ${stationId}`,
        tides: tideData,
        water_level: waterLevel,
      };

      // Cache the result
      this.cache.set(stationId, result);

      return result;
    } catch (error) {
      log.error(`Error fetching CO-OPS data for station ${stationId}:`, error);
      return null;
    }
  }

  /**
   * Clear the tide cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get tide status for a specific time
   */
  getTideStatusAtTime(tides: TideData[], targetTime: Date): TideStatus {
    return analyzeTideStatus(tides, targetTime);
  }

  /**
   * Get current tide height estimate
   */
  getCurrentTideHeight(tides: TideData[]): number | null {
    return analyzeCurrentHeight(tides);
  }

  /**
   * Get tide height estimate for a specific time
   */
  getTideHeightAtTime(tides: TideData[], targetTime: Date): number | null {
    return analyzeHeightAtTime(tides, targetTime);
  }

  /**
   * Get next tide from current time
   */
  getNextTide(tides: TideData[]): TideData | null {
    return analyzeNextTide(tides);
  }

  /**
   * Get next tide from a specific time
   */
  getNextTideFromTime(tides: TideData[], targetTime: Date): TideData | null {
    return analyzeNextTideFromTime(tides, targetTime);
  }

  /**
   * Fetch cached tide data from the tide_forecasts table
   *
   * Tides are deterministic astronomical predictions - reading from the cached
   * table ensures consistency and avoids redundant API calls.
   *
   * @param beachId Beach UUID to fetch tides for
   * @param days Number of days of tide data to fetch (default 14)
   * @returns COOPSForecast-compatible object or null if no data
   */
  async fetchCachedTides(
    beachId: string,
    days: number = 14
  ): Promise<COOPSForecast | null> {
    try {
      const supabase = await createSupabaseServiceRoleClient();
      const now = new Date();
      const TIDE_LOOKBACK_MS = 6 * 60 * 60 * 1000; // 6 hours before now for interpolation
      const startTime = new Date(now.getTime() - TIDE_LOOKBACK_MS);
      const endTime = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      if (this.isVerbose()) {
        log.debug(`Fetching cached tides for beach ${beachId}, ${days} days`);
      }

      // Query tide_forecasts table for this beach
      const { data: rows, error } = await supabase
        .from("tide_forecasts")
        .select("ts, tide_height_m, tide_phase, source, created_at")
        .eq("beach_id", beachId)
        .gte("ts", startTime.toISOString())
        .lte("ts", endTime.toISOString())
        .order("ts", { ascending: true });

      if (error) {
        log.error(`Error fetching cached tides for beach ${beachId}:`, error);
        return null;
      }

      if (!rows || rows.length === 0) {
        if (this.isVerbose()) {
          log.warn(`No cached tide data found for beach ${beachId}`);
        }
        TideCacheMonitor.logNoData({ beachId, rowCount: rows?.length ?? 0 });
        return null;
      }

      // Deduplicate rows that share the same hour (multiple cron runs
      // can insert rows at :17, :22, :50 seconds within the same hour).
      // Duplicates cause plateaus that break extrema detection.
      const dedupedRows = this.deduplicateByHour(rows);

      if (this.isVerbose() && dedupedRows.length < rows.length) {
        log.debug(
          `Deduplicated tide rows for beach ${beachId}: ${rows.length} → ${dedupedRows.length}`
        );
      }

      // Use TideExtremaDetector to extract high/low points from hourly data
      const detector = new TideExtremaDetector();
      const samples: TideSample[] = dedupedRows
        .filter((row): row is typeof row & { tide_height_m: number } => row.tide_height_m !== null)
        .map((row) => ({
          ts: row.ts,
          tide_height_m: row.tide_height_m,
        }));
      const extrema = detector.detectExtrema(samples);

      // Convert to TideData format
      const tides: TideData[] = extrema.map((e) => ({
        time: e.time,
        height: e.height,
        type: e.type,
        name: e.name,
      }));

      if (tides.length === 0) {
        // If no extremes found, something is wrong with the data
        log.warn(`No tide extremes found in cached data for beach ${beachId}, rows: ${rows.length}`);
        TideCacheMonitor.logNoExtrema({ beachId, rowCount: rows.length });
        return null;
      }

      if (this.isVerbose()) {
        log.debug(`Found ${tides.length} tide extremes from ${dedupedRows.length} hourly points for beach ${beachId}`);
      }

      /**
       * station_id uses synthetic format "cached_{beachId}" to indicate
       * this data came from the tide_forecasts cache, not a live NOAA API call.
       * Used for logging/debugging purposes to distinguish data sources.
       */
      return {
        station_id: `cached_${beachId}`,
        station_name: "Cached Tide Data",
        tides,
        water_level: null,
      };
    } catch (error) {
      log.error(`Error in fetchCachedTides for beach ${beachId}:`, error);
      return null;
    }
  }

  /**
   * Fetch CO-OPS data with comprehensive diagnostics for debugging and transparency
   */
  async fetchCOOPSDataWithDiagnostics(
    beachName: string,
    lat?: number,
    lng?: number,
    days: number = 10
  ): Promise<{ forecast: COOPSForecast | null; diagnostics: TideDiagnostics }> {
    const fetchStartTime = Date.now();
    const now = new Date();
    const validationErrors: string[] = [];

    // Determine station
    const stationId = this.getStationForLocation(beachName, lat, lng);
    const normalizedBeachName = beachName.toLowerCase().replace(/\s+/g, "-");
    const isPrimaryStation = COOPS_STATIONS[normalizedBeachName] === stationId;

    // Check cache status before fetch
    const cachedData = this.cache.get(stationId);
    const cacheHit = cachedData !== null;

    // Build source URL for transparency
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const sourceUrl = buildPredictionsUrl(
      stationId,
      formatDateForApi(now),
      formatDateForApi(endDate)
    );
    const stationPageUrl = `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${stationId}`;

    // Fetch the data
    const forecast = await this.fetchCOOPSData(stationId, days);

    // Determine data freshness
    let dataFreshness: TideDataFreshness = "fresh";
    const cacheEntry = this.cache.getEntry(stationId);
    let cacheTtlRemaining: number | null = null;

    if (cacheEntry) {
      cacheTtlRemaining = this.cache.getTtlRemaining(stationId);
      const freshness = this.cache.getDataFreshness(stationId);
      if (freshness === "stale") {
        dataFreshness = "stale";
      } else if (cacheHit) {
        dataFreshness = "cached";
      }
    }

    // Build raw sample from tide data
    const rawSample: TideRawSample[] = [];
    if (forecast?.tides && forecast.tides.length > 0) {
      for (const tide of forecast.tides.slice(0, 5)) {
        const date = new Date(tide.time * 1000);
        rawSample.push({
          t: date.toISOString().replace("T", " ").substring(0, 16),
          v: tide.height.toFixed(2),
          type: tide.type === "high" ? "H" : "L",
        });
      }
    }

    // Find next high and low tides
    let nextHigh: TideExtremeType | null = null;
    let nextLow: TideExtremeType | null = null;
    let minutesToNextHigh: number | null = null;
    let minutesToNextLow: number | null = null;

    if (forecast?.tides) {
      const nowTimestamp = now.getTime() / 1000;
      const sortedTides = [...forecast.tides].sort((a, b) => a.time - b.time);

      for (const tide of sortedTides) {
        if (tide.time > nowTimestamp) {
          if (tide.type === "high" && !nextHigh) {
            nextHigh = {
              time: new Date(tide.time * 1000),
              height: tide.height,
            };
            minutesToNextHigh = Math.round((tide.time - nowTimestamp) / 60);
          } else if (tide.type === "low" && !nextLow) {
            nextLow = {
              time: new Date(tide.time * 1000),
              height: tide.height,
            };
            minutesToNextLow = Math.round((tide.time - nowTimestamp) / 60);
          }

          if (nextHigh && nextLow) break;
        }
      }
    }

    // Get current interpolated height
    const nowHeightInterpolated = forecast?.tides
      ? this.getTideHeightAtTime(forecast.tides, now)
      : null;

    // Validation checks
    if (!forecast) {
      validationErrors.push("Failed to fetch tide data from NOAA");
    } else if (forecast.tides.length === 0) {
      validationErrors.push("No tide predictions returned from NOAA");
    } else if (forecast.tides.length < 10) {
      validationErrors.push(
        `Only ${forecast.tides.length} predictions available (expected 10+)`
      );
    }

    // Build diagnostics object
    const diagnostics: TideDiagnostics = {
      stationId,
      stationName: forecast?.station_name || `Station ${stationId}`,
      isPrimaryStation,
      beachName,
      datum: "MLLW",
      units: "feet",
      timezone: this.getTimezoneString(),
      nowHeightFromSource: forecast?.water_level ?? null,
      nowHeightInterpolated,
      interpolationMethod: "linear",
      nextHigh,
      nextLow,
      minutesToNextHigh,
      minutesToNextLow,
      rawSample,
      totalPredictions: forecast?.tides?.length ?? 0,
      sourceUrl,
      stationPageUrl,
      dataFreshness,
      lastFetchTime: new Date(fetchStartTime),
      cacheHit,
      cacheTtlRemaining,
      isValidated: validationErrors.length === 0,
      validationErrors,
      verificationStatus: getVerificationStatus({
        isPrimaryStation,
        dataFreshness,
        validationErrors,
        totalPredictions: forecast?.tides?.length ?? 0,
      }),
      confidenceScore: calculateConfidenceScore({
        isPrimaryStation,
        dataFreshness,
        validationErrors,
        totalPredictions: forecast?.tides?.length ?? 0,
      }),
    };

    return { forecast, diagnostics };
  }

  /**
   * Deduplicate tide forecast rows by hour.
   * Multiple cron runs can insert rows at different seconds within the same
   * hour (e.g., :17, :22, :50). Keeping only the first row per hour prevents
   * plateaus that confuse the TideExtremaDetector.
   */
  private deduplicateByHour(
    rows: TideForecastSelectionRow[]
  ): typeof rows {
    const seen = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (typeof row.tide_height_m !== "number" || !Number.isFinite(row.tide_height_m)) continue;
      const hourKey = getUtcHourKey(row.ts);
      if (!hourKey) continue;
      const existing = seen.get(hourKey);
      if (!existing || isPreferredTideForecastRow(row, existing)) seen.set(hourKey, row);
    }
    return Array.from(seen.values());
  }

  /**
   * Get timezone string for display
   */
  private getTimezoneString(): string {
    const offset = -new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const sign = offset >= 0 ? "+" : "-";
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `GMT→${tzName} (UTC${sign}${hours})`;
  }
}
