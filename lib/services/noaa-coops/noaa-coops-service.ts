/**
 * NOAA CO-OPS Service
 *
 * Main orchestration class for fetching and analyzing tide data
 * from the NOAA Center for Operational Oceanographic Products and Services.
 */

import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
import { createContextLogger } from "@/lib/logger";
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

import type { TideData, COOPSForecast } from "./types";
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
  getTideStatusAtTime(tides: TideData[], targetTime: Date): string {
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
