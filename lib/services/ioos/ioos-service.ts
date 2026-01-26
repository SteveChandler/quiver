/**
 * IOOS Service
 *
 * Main orchestration class for fetching wave buoy data from IOOS ERDDAP API.
 * Provides station discovery, observation fetching, and database integration.
 *
 * @module ioos/ioos-service
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  IOOSStation,
  IOOSObservation,
  IOOSServiceConfig,
  IOOSStationDiscoveryResult,
  GeoBounds,
} from "@/types/ioos";
import { IOOS_API_CONFIG, IOOS_OBSERVATION_CONFIG, CanonicalVar } from "@/lib/constants/ioos-config";
import {
  buildDynamicObservationUrl,
  buildObservationUrl,
  buildStationInfoUrl,
  buildAllDatasetsUrl,
} from "./url-builder";
import {
  parseObservationRow,
  parseObservationArray,
  parseNetwork,
  buildVariableMap,
  rowToObject,
} from "./data-parser";
import { fetchAllDatasets, fetchObservation, fetchStationInfo, isUnrecognizedVariableError } from "./api-client";
import { ObservationCache } from "./cache";
import { ParsedObservation, StationVariablesResult } from "./types";
import {
  STATION_FILTERS,
  ISM_FILTER_WARNING_THRESHOLD,
  NEARBY_STATIONS_LIMIT,
} from "./constants";
import { fetchWithTimeout } from "@/lib/utils/fetch-utils";

/**
 * IOOS Service for fetching wave data from ERDDAP API
 *
 * @example
 * ```ts
 * const service = new IOOSService();
 * const stations = await service.discoverStations();
 * const obs = await service.fetchObservation(stationId);
 * ```
 */
export class IOOSService {
  private readonly config: IOOSServiceConfig;
  private readonly observationCache: ObservationCache;
  /** Track stations that returned "Unrecognized variable" errors (no wave data) */
  private readonly stationsWithoutWaveData: Set<string> = new Set();

  constructor(configOverrides?: Partial<IOOSServiceConfig>) {
    this.config = {
      ...IOOS_API_CONFIG,
      ...configOverrides,
    };
    this.observationCache = new ObservationCache(this.config.cacheTtlMs);
  }

  /**
   * Get stations that were found to not have wave data
   * (returned "Unrecognized variable" error for wave height)
   *
   * @returns Array of station IDs without wave data
   */
  getStationsWithoutWaveData(): string[] {
    return Array.from(this.stationsWithoutWaveData);
  }

  /**
   * Clear the set of stations without wave data
   */
  clearStationsWithoutWaveData(): void {
    this.stationsWithoutWaveData.clear();
  }

  /**
   * Get current configuration
   *
   * @returns Copy of service configuration
   */
  getConfig(): IOOSServiceConfig {
    return { ...this.config };
  }

  /**
   * Discover IOOS stations with wave data
   *
   * @param bounds - Optional geographic bounds to filter stations
   * @returns Discovery result with stations and metadata
   *
   * @example
   * ```ts
   * const result = await service.discoverStations({
   *   minLat: 20, maxLat: 50, minLon: -130, maxLon: -60
   * });
   * console.log(`Found ${result.waveStationsFound} wave stations`);
   * ```
   */
  async discoverStations(bounds?: GeoBounds): Promise<IOOSStationDiscoveryResult> {
    const result: IOOSStationDiscoveryResult = {
      stations: [],
      totalFound: 0,
      waveStationsFound: 0,
      linkedToBeaches: 0,
      errors: [],
    };

    try {
      const url = buildAllDatasetsUrl();
      const json = await fetchAllDatasets(url, this.config);

      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      // Find column indexes
      const idIdx = columnNames.indexOf("datasetID");
      const instIdx = columnNames.indexOf("institution");
      const minLatIdx = columnNames.indexOf("minLatitude");
      const maxLatIdx = columnNames.indexOf("maxLatitude");
      const minLonIdx = columnNames.indexOf("minLongitude");
      const maxLonIdx = columnNames.indexOf("maxLongitude");

      // Track ISM-filtered stations for monitoring
      let ismFilteredCount = 0;

      for (const row of rows) {
        const datasetId = row[idIdx];
        const institution = row[instIdx];
        const lat = (Number(row[minLatIdx]) + Number(row[maxLatIdx])) / 2;
        const lon = (Number(row[minLonIdx]) + Number(row[maxLonIdx])) / 2;

        if (!datasetId || !isFinite(lat) || !isFinite(lon)) continue;

        // Skip ISM federated IDs - they don't work with tabledap API
        if (String(datasetId).toLowerCase().startsWith(STATION_FILTERS.ISM_PREFIX)) {
          ismFilteredCount++;
          continue;
        }

        // Apply geographic bounds filter
        if (bounds) {
          if (lat < bounds.minLat || lat > bounds.maxLat) continue;
          if (lon < bounds.minLon || lon > bounds.maxLon) continue;
        }

        // Check if this is a wave-capable dataset
        const lowerDatasetId = String(datasetId).toLowerCase();
        const lowerInstitution = String(institution).toLowerCase();

        const isCdipStation = lowerInstitution.includes("cdip") || lowerDatasetId.startsWith("edu_ucsd_cdip");
        const hasWaveInId = STATION_FILTERS.WAVE_KEYWORDS.some((kw) => lowerDatasetId.includes(kw));
        const isDartBuoy = lowerDatasetId.includes(STATION_FILTERS.DART_KEYWORD);
        const isNdbcOceanBuoy = lowerInstitution.includes("ndbc") && STATION_FILTERS.NDBC_OCEAN_BUOY.test(lowerDatasetId);

        const hasWaveKeyword = (isCdipStation || hasWaveInId || isNdbcOceanBuoy) && !isDartBuoy;

        result.totalFound++;

        const station: IOOSStation = {
          station_id: String(datasetId),
          source_network: parseNetwork(String(datasetId), String(institution)),
          name: String(datasetId),
          latitude: lat,
          longitude: lon,
          sensors: hasWaveKeyword ? ["wave_height", "wave_period"] : null,
          has_wave_data: hasWaveKeyword,
          nearest_beach_id: null,
          distance_to_beach_km: null,
          active: true,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        result.stations.push(station);
        if (hasWaveKeyword) result.waveStationsFound++;
      }

      // Log ISM filtering stats for monitoring
      if (ismFilteredCount > 0) {
        console.log(
          `[IOOS] Filtered ${ismFilteredCount} ISM-prefixed stations (incompatible with tabledap API)`
        );
      }

      // Warn if suspiciously high filter rate (potential API change indicator)
      const totalProcessed = result.totalFound + ismFilteredCount;
      if (totalProcessed > 0 && ismFilteredCount / totalProcessed > ISM_FILTER_WARNING_THRESHOLD) {
        console.warn(
          `[IOOS] Warning: Over 50% of stations were ISM-prefixed and filtered ` +
            `(${ismFilteredCount}/${totalProcessed}). This may indicate an ERDDAP API change.`
        );
      }
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error during station discovery"
      );
    }

    return result;
  }

  /**
   * Fetch latest observation for a single station (legacy format)
   *
   * @param stationId - ERDDAP dataset ID
   * @returns Observation data or null if unavailable
   *
   * @example
   * ```ts
   * const obs = await service.fetchObservation("edu_ucsd_cdip_155");
   * if (obs) {
   *   console.log(`Wave height: ${obs.wave_height_m}m`);
   * }
   * ```
   */
  async fetchObservation(stationId: string): Promise<IOOSObservation | null> {
    // Check cache first
    const cached = this.observationCache.get(stationId);
    if (cached !== undefined) {
      return cached as IOOSObservation | null;
    }

    try {
      const url = buildObservationUrl(stationId);
      const response = await fetchWithTimeout(url, {
        timeoutMs: this.config.timeoutMs,
        init: {
          headers: {
            "User-Agent": this.config.userAgent,
          },
        },
      });

      if (!response.ok) {
        // Check if the error is due to missing wave variables
        if (await isUnrecognizedVariableError(response)) {
          this.stationsWithoutWaveData.add(stationId);
          console.log(`[IOOS] Station ${stationId} has no wave variables`);
        }
        this.observationCache.set(stationId, null);
        return null;
      }

      const json = await response.json();
      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      if (rows.length === 0) {
        this.observationCache.set(stationId, null);
        return null;
      }

      // Find the most recent row with non-null wave height
      let selectedRow = rows[0];
      const waveHeightIdx = columnNames.findIndex((name: string) =>
        name.includes("wave") && name.includes("height")
      );

      if (waveHeightIdx >= 0) {
        for (const row of rows) {
          if (row[waveHeightIdx] !== null) {
            selectedRow = row;
            break;
          }
        }
      }

      const obs = parseObservationArray(stationId, selectedRow, columnNames);

      this.observationCache.set(stationId, obs);
      return obs;
    } catch (error) {
      this.observationCache.set(stationId, null);
      return null;
    }
  }

  /**
   * Fetch observations for multiple stations in batches
   *
   * @param stationIds - Array of station IDs to fetch
   * @param batchSize - Number of concurrent requests (default: config.maxConcurrentRequests)
   * @returns Map of station IDs to observations
   */
  async fetchBatch(
    stationIds: string[],
    batchSize: number = this.config.maxConcurrentRequests
  ): Promise<Map<string, IOOSObservation>> {
    const results = new Map<string, IOOSObservation>();

    // Process in batches
    for (let i = 0; i < stationIds.length; i += batchSize) {
      const batch = stationIds.slice(i, i + batchSize);

      // Fetch batch in parallel
      const promises = batch.map(async (stationId) => {
        const obs = await this.fetchObservation(stationId);
        if (obs) {
          results.set(stationId, obs);
        }
      });

      await Promise.allSettled(promises);

      // Delay between batches (except for last batch)
      if (i + batchSize < stationIds.length) {
        await this.delay(this.config.batchDelayMs);
      }
    }

    return results;
  }

  /**
   * Fetch latest observation for a single station using dynamic URL
   * Requires station to have variable_map populated
   *
   * @param stationId - ERDDAP dataset ID
   * @param variableMap - Mapping of canonical names to ERDDAP variable names
   * @returns Parsed observation or null if unavailable
   */
  async fetchObservationDynamic(
    stationId: string,
    variableMap: Partial<Record<CanonicalVar, string>>
  ): Promise<ParsedObservation | null> {
    // Check cache first
    const cacheKey = `dynamic_${stationId}`;
    const cached = this.observationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached as ParsedObservation | null;
    }

    const url = buildDynamicObservationUrl(stationId, variableMap);
    if (!url) {
      console.log(`[IOOS] Station ${stationId} has no wave height variable, skipping`);
      return null;
    }

    try {
      const json = await fetchObservation(url, this.config);

      if (!json) {
        console.warn(`[IOOS] Station ${stationId} returned 400, may need variable refresh`);
        this.observationCache.set(cacheKey, null);
        return null;
      }

      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      if (rows.length === 0) {
        this.observationCache.set(cacheKey, null);
        return null;
      }

      // Convert array row to object using column names
      const rowObj = rowToObject(rows[0], columnNames);
      const obs = parseObservationRow(rowObj, variableMap);

      // Validate observation is fresh enough to store
      if (obs) {
        const obsTime = new Date(obs.observedAt);
        const maxAge = IOOS_OBSERVATION_CONFIG.maxStorageAgeHours * 3600_000;
        if (Date.now() - obsTime.getTime() > maxAge) {
          console.log(`[IOOS] Station ${stationId} observation too old (${obs.observedAt}), skipping`);
          this.observationCache.set(cacheKey, null);
          return null;
        }
      }

      this.observationCache.set(cacheKey, obs);
      return obs;
    } catch (error) {
      console.error(`[IOOS] Error fetching observation for ${stationId}:`, error);
      this.observationCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Fetch available variables for a station from ERDDAP /info endpoint
   * Returns both raw variable list and computed variable_map
   *
   * @param stationId - ERDDAP dataset ID
   * @returns Station variables result or null if station doesn't exist
   */
  async fetchStationVariables(stationId: string): Promise<StationVariablesResult | null> {
    try {
      const url = buildStationInfoUrl(stationId);
      const json = await fetchStationInfo(url, this.config);

      if (!json) {
        return null; // Station doesn't exist
      }

      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      // Find the column indices
      const rowTypeIdx = columnNames.indexOf("Row Type");
      const varNameIdx = columnNames.indexOf("Variable Name");

      if (rowTypeIdx === -1 || varNameIdx === -1) {
        console.error(`[IOOS] Unexpected /info response format for ${stationId}`);
        return null;
      }

      // Extract variable names from rows where Row Type is "variable"
      const availableVariables: string[] = [];
      for (const row of rows) {
        if (row[rowTypeIdx] === "variable") {
          const varName = row[varNameIdx];
          if (typeof varName === "string") {
            availableVariables.push(varName);
          }
        }
      }

      const variableMap = buildVariableMap(availableVariables);

      return { availableVariables, variableMap };
    } catch (error) {
      console.error(`[IOOS] Error fetching variables for ${stationId}:`, error);
      return null;
    }
  }

  /**
   * Find stations near a location from the database
   *
   * @param lat - Latitude
   * @param lon - Longitude
   * @param radiusKm - Search radius in kilometers (default: 100km)
   * @returns Array of nearby stations
   */
  async findNearbyStations(lat: number, lon: number, radiusKm: number = 100): Promise<IOOSStation[]> {
    try {
      const supabase = createSupabaseServiceRoleClient();

      // Bug Fix #4: Add limit to prevent unbounded station queries
      const { data, error } = await supabase
        .rpc("find_nearby_ioos_stations", {
          p_lat: lat,
          p_lon: lon,
          p_radius_km: radiusKm,
        })
        .limit(NEARBY_STATIONS_LIMIT);

      if (error) {
        console.error("Error finding nearby stations:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error in findNearbyStations:", error);
      return [];
    }
  }

  /**
   * Clear the observation cache
   */
  clearCache(): void {
    this.observationCache.clear();
  }

  /**
   * Delay utility for batching
   *
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
