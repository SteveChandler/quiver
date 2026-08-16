/**
 * CDIP (Coastal Data Information Program) Service
 *
 * Main orchestration class for CDIP wave data integration.
 * Integrates with CDIP API to fetch high-quality wave data from
 * buoy stations along the California coast.
 *
 * CDIP is operated by Scripps Institution of Oceanography and provides:
 * - Real-time wave height, period, and direction
 * - Spectral wave analysis with swell separation
 * - Quality-controlled measurements
 * - Historical data for trend analysis
 */

import { createContextLogger } from "@/lib/logger";
import { calculateDistance } from "@/lib/utils/distance-utils";
import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
import {
  CDIPBuoyData,
  CDIPBuoyDataDiagnostic,
  CDIPMetaResponse,
  CDIPStationConfig,
} from "./types";
import {
  CDIP_STATIONS,
  SOCAL_PRIMARY_STATIONS,
  getStationConfig,
  MAX_CONCURRENT_REQUESTS,
  BATCH_DELAY_MS,
  DEFAULT_MAX_DISTANCE_KM,
  DEFAULT_BLACKLIST,
} from "./constants";
import { CDIPCache } from "./cache";
import { CDIPApiClient } from "./api-client";
import { transformToCDIPBuoyData, calculateDataQualityScore } from "./data-parser";

const log = createContextLogger("CDIPService");

function statusFromError(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Main service class for CDIP wave data
 */
export class CDIPService {
  private readonly stationCache = new Map<string, CDIPStationConfig>();
  private readonly dataCache: CDIPCache;
  private readonly apiClient: CDIPApiClient;
  /**
   * Deduplicate concurrent requests per station.
   * Without this, multiple beaches that map to the same station within a batch
   * can trigger duplicate HTTP calls before the cache is populated.
   */
  private readonly inFlightFetches = new Map<
    string,
    Promise<CDIPBuoyDataDiagnostic>
  >();
  private readonly blacklist: Set<string>;

  constructor() {
    this.dataCache = new CDIPCache();
    this.apiClient = new CDIPApiClient();

    // Pre-populate station cache
    Object.values(CDIP_STATIONS).forEach((station) => {
      this.stationCache.set(station.id, station);
    });

    // Support blacklist via env (comma separated).
    // Defaults include known-bad stations that frequently 404 on the current ERDDAP dataset.
    const fromEnv = (process.env.CDIP_BLACKLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Deduplicate while preserving a readable defaults list.
    this.blacklist = new Set<string>([...DEFAULT_BLACKLIST, ...fromEnv]);
  }

  /**
   * Check if verbose logging is enabled
   */
  private isVerbose(): boolean {
    return isForecastVerboseLoggingEnabled();
  }

  /**
   * Fetch current wave data for a specific CDIP station
   *
   * @param stationId - The station ID to fetch data for
   * @returns Buoy data or null if unavailable
   */
  async fetchBuoyData(stationId: string): Promise<CDIPBuoyData | null> {
    const diagnostic = await this.fetchBuoyDataWithDiagnostics(stationId);
    return diagnostic.data;
  }

  async fetchBuoyDataWithDiagnostics(stationId: string): Promise<CDIPBuoyDataDiagnostic> {
    if (this.isVerbose()) {
      log.debug(`🌊 CDIP fetchBuoyData called for station: ${stationId}`);
    }
    try {
      if (this.blacklist.has(String(stationId))) {
        log.warn(`🚫 CDIP station ${stationId} is blacklisted. Skipping fetch.`);
        return {
          data: null,
          stationId,
          skipReason: "blacklisted_station",
        };
      }

      // Check if station exists
      const stationConfig = getStationConfig(stationId);
      if (!stationConfig) {
        log.warn(`❌ Unknown CDIP station: ${stationId}`);
        return {
          data: null,
          stationId,
          skipReason: "unknown_station",
        };
      }
      if (this.isVerbose()) {
        log.debug(`✅ CDIP station config found: ${stationConfig.name}`);
      }

      // Check cache first (cache hits should never be blocked by rate limiting)
      const cached = this.dataCache.get(stationId);
      if (cached) {
        if (this.isVerbose()) {
          log.debug(`📦 CDIP returning cached data for station ${stationId}`);
        }
        return {
          data: cached,
          stationId,
          skipReason: "success",
        };
      }

      // Deduplicate concurrent fetches for the same station within the same process.
      const inFlight = this.inFlightFetches.get(stationId);
      if (inFlight) {
        if (this.isVerbose()) {
          log.debug(`🧵 CDIP joining in-flight fetch for station ${stationId}`);
        }
        return await inFlight;
      }

      const fetchPromise = (async (): Promise<CDIPBuoyDataDiagnostic> => {
        try {
          // Check rate limiting (only applies when we actually need to hit the network)
          if (!this.apiClient.canMakeRequest()) {
            const waitTime = this.apiClient.getTimeUntilReset();
            log.warn(
              `⏰ CDIP rate limit exceeded, next request available in ${waitTime}ms`
            );
            return {
              data: null,
              stationId,
              skipReason: "cdip_unavailable",
              errorMessage: "rate_limited",
            };
          }
          if (this.isVerbose()) {
            log.debug(`✅ CDIP rate limit check passed`);
          }

          // Fetch data from CDIP API
          if (this.isVerbose()) {
            log.debug(`🔄 CDIP fetching raw data for station ${stationId}`);
          }
          const rawData = await this.apiClient.fetchWaveDataWithDiagnostics(stationId);
          if (!rawData.data) {
            log.warn(
              `❌ CDIP fetchWaveData returned null for station ${stationId}`
            );
            return {
              data: null,
              stationId,
              skipReason: rawData.skipReason,
              breakerKey: rawData.breakerKey,
              errorMessage: rawData.errorMessage,
              status: rawData.status,
            };
          }
          if (this.isVerbose()) {
            log.debug(
              `✅ CDIP raw data fetched successfully for station ${stationId}`
            );
          }

          // Transform and validate data
          const buoyData = transformToCDIPBuoyData(stationId, rawData.data);
          if (!buoyData) {
            return {
              data: null,
              stationId,
              skipReason: "cdip_unavailable",
            };
          }

          // Cache the data
          this.dataCache.set(stationId, buoyData);

          // Record successful request
          this.apiClient.recordRequest(`station/${stationId}`);

          return {
            data: buoyData,
            stationId,
            skipReason: "success",
          };
        } finally {
          // Always clear in-flight marker (success or failure)
          this.inFlightFetches.delete(stationId);
        }
      })();

      this.inFlightFetches.set(stationId, fetchPromise);
      return await fetchPromise;
    } catch (error) {
      const status = statusFromError(error);
      if (status === 400 || status === 404) {
        log.warn(`CDIP station ${stationId} has no deterministic data (${status})`);
      } else {
        log.error(
          `💥 Error fetching CDIP data for station ${stationId}:`,
          error
        );
      }
      return {
        data: null,
        stationId,
        skipReason: "cdip_unavailable",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch data from multiple CDIP stations concurrently
   *
   * @param stationIds - Array of station IDs to fetch
   * @returns Array of buoy data (null for failed fetches)
   */
  async fetchMultipleStations(
    stationIds: string[]
  ): Promise<Array<CDIPBuoyData | null>> {
    // Limit concurrent requests to respect rate limits
    const results: Array<CDIPBuoyData | null> = [];

    for (let i = 0; i < stationIds.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = stationIds.slice(i, i + MAX_CONCURRENT_REQUESTS);
      const batchResults = await Promise.all(
        batch.map((stationId) => this.fetchBuoyData(stationId))
      );
      results.push(...batchResults);

      // Small delay between batches to be respectful to API
      if (i + MAX_CONCURRENT_REQUESTS < stationIds.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return results;
  }

  /**
   * Get Southern California CDIP stations
   *
   * @returns Array of station IDs for SoCal region
   */
  getSouthernCaliforniaStations(): string[] {
    return SOCAL_PRIMARY_STATIONS;
  }

  /**
   * Find the nearest CDIP station to a given location
   *
   * @param latitude - Latitude in degrees
   * @param longitude - Longitude in degrees
   * @param maxDistanceKm - Maximum distance to search (default: 50km)
   * @returns Station ID or null if none found
   */
  async getNearestStation(
    latitude: number,
    longitude: number,
    maxDistanceKm: number = DEFAULT_MAX_DISTANCE_KM,
    excludedStationIds: readonly string[] = [],
  ): Promise<string | null> {
    try {
      let nearestStation: string | null = null;
      let minDistance = Infinity;
      const excluded = new Set(excludedStationIds.map((stationId) => String(stationId)));

      for (const station of Object.values(CDIP_STATIONS)) {
        if (this.blacklist.has(String(station.id)) || excluded.has(String(station.id))) {
          continue; // skip bad stations
        }
        const distance = calculateDistance(
          { lat: latitude, lon: longitude },
          { lat: station.latitude, lon: station.longitude },
          "km"
        );

        if (distance < minDistance && distance <= maxDistanceKm) {
          minDistance = distance;
          nearestStation = station.id;
        }
      }

      if (nearestStation) {
        if (this.isVerbose()) {
          log.debug(
            `📍 Nearest CDIP station to ${latitude}, ${longitude}: ${nearestStation} (${minDistance.toFixed(
              1
            )}km)`
          );
        }
      }

      return nearestStation;
    } catch (error) {
      log.error("Error finding nearest CDIP station:", error);
      return null;
    }
  }

  /**
   * Fetch station metadata from CDIP with retry logic
   *
   * @param stationId - The station ID
   * @returns Station metadata or null on error
   */
  async fetchStationMetadata(
    stationId: string
  ): Promise<CDIPMetaResponse | null> {
    return this.apiClient.fetchMetadata(stationId);
  }

  /**
   * Calculate data quality score based on freshness and completeness
   *
   * @param buoyData - The buoy data to score
   * @returns Quality score from 0-100
   */
  getDataQualityScore(buoyData: CDIPBuoyData): number {
    return calculateDataQualityScore(buoyData);
  }
}
