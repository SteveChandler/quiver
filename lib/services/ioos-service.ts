/**
 * IOOS Service
 *
 * Fetches wave buoy data from IOOS (Integrated Ocean Observing System) ERDDAP API.
 * Provides station discovery, observation fetching, and database integration.
 *
 * Usage:
 *   const service = new IOOSService();
 *   const stations = await service.discoverStations();
 *   const obs = await service.fetchObservation(stationId);
 */

import { fetchWithTimeout } from "@/lib/utils/fetch-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  IOOSStation,
  IOOSObservation,
  IOOSServiceConfig,
  IOOSStationDiscoveryResult,
  GeoBounds,
  IOOSNetwork,
} from "@/types/ioos";
import {
  IOOS_API_CONFIG,
  IOOS_ENDPOINTS,
  IOOS_WAVE_VARIABLES,
  IOOS_QUALITY_THRESHOLDS,
  IOOS_VARIABLE_ALIASES,
  IOOS_OBSERVATION_CONFIG,
  CanonicalVar,
} from "@/lib/constants/ioos-config";

/**
 * Format date as ISO Zulu string without milliseconds (ERDDAP format)
 */
function isoZulu(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Build observation URL dynamically based on station's variable_map
 * Uses absolute time constraints to avoid ancient data
 * Returns null if station has no wave height variable
 */
export function buildDynamicObservationUrl(
  stationId: string,
  variableMap: Partial<Record<CanonicalVar, string>>,
  now: Date = new Date()
): string | null {
  // Bug Fix #1: Validate station ID format to prevent URL injection
  if (!/^[a-zA-Z0-9_-]+$/.test(stationId)) {
    console.warn(`[IOOS] Invalid station ID format: ${stationId}`);
    return null;
  }

  // Bug Fix #1: Must have at least wave height to be useful (with trim check for empty strings)
  if (!variableMap.wave_height || variableMap.wave_height.trim() === '') {
    return null;
  }

  const { lookbackHours, maxFutureMinutes } = IOOS_OBSERVATION_CONFIG;
  const minTime = new Date(now.getTime() - lookbackHours * 3600_000);
  const maxTime = new Date(now.getTime() + maxFutureMinutes * 60_000);

  // Build variable list from what's available
  const vars: string[] = ["time"];
  if (variableMap.wave_height) vars.push(variableMap.wave_height);
  if (variableMap.wave_period) vars.push(variableMap.wave_period);
  if (variableMap.wave_direction) vars.push(variableMap.wave_direction);
  if (variableMap.water_temp) vars.push(variableMap.water_temp);
  if (variableMap.wind_speed) vars.push(variableMap.wind_speed);
  if (variableMap.wind_direction) vars.push(variableMap.wind_direction);

  const base = `${IOOS_API_CONFIG.baseUrl}/tabledap/${stationId}.json`;

  // Build constraints with proper URL encoding
  const constraints = [
    `time>=${isoZulu(minTime)}`,
    `time<=${isoZulu(maxTime)}`,
    `${variableMap.wave_height}!=NaN`,
    `orderByMax("time")`,
  ].map(c => encodeURIComponent(c));

  return `${base}?${vars.join(",")}&${constraints.join("&")}`;
}

/**
 * Build a variable map by matching available ERDDAP variables to canonical names
 * Uses alias priority: first match in the alias list wins
 */
export function buildVariableMap(
  availableVars: string[]
): Partial<Record<CanonicalVar, string>> {
  const varSet = new Set(availableVars);
  const result: Partial<Record<CanonicalVar, string>> = {};

  for (const [canonical, aliases] of Object.entries(IOOS_VARIABLE_ALIASES)) {
    for (const alias of aliases) {
      if (varSet.has(alias)) {
        result[canonical as CanonicalVar] = alias;
        break; // First match wins
      }
    }
  }

  return result;
}

/**
 * Parsed observation with canonical field names
 */
export interface ParsedObservation {
  observedAt: string;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDirectionDeg: number | null;
  waterTempC: number | null;
  windSpeedMS: number | null;
  windDirectionDeg: number | null;
  raw: Record<string, unknown>;
}

/**
 * Safely convert value to number, returning null for invalid values
 */
function toNumber(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse an ERDDAP response row into a canonical observation
 * Uses the station's variable_map to find the right columns
 */
export function parseObservationRow(
  row: Record<string, unknown>,
  variableMap: Partial<Record<CanonicalVar, string>>
): ParsedObservation | null {
  const time = row["time"];
  if (typeof time !== "string") return null;

  const get = (k?: string): unknown => (k ? row[k] : null);

  return {
    observedAt: time,
    waveHeightM: toNumber(get(variableMap.wave_height)),
    wavePeriodS: toNumber(get(variableMap.wave_period)),
    waveDirectionDeg: toNumber(get(variableMap.wave_direction)),
    waterTempC: toNumber(get(variableMap.water_temp)),
    windSpeedMS: toNumber(get(variableMap.wind_speed)),
    windDirectionDeg: toNumber(get(variableMap.wind_direction)),
    raw: row,
  };
}

/**
 * Cache entry for observations
 */
interface CacheEntry {
  at: number;
  data: IOOSObservation | ParsedObservation | null;
}

/**
 * IOOS Service for fetching wave data from ERDDAP API
 */
export class IOOSService {
  private readonly config: IOOSServiceConfig;
  private readonly observationCache: Map<string, CacheEntry> = new Map();
  // Track stations that returned "Unrecognized variable" errors (no wave data)
  private readonly stationsWithoutWaveData: Set<string> = new Set();

  constructor(configOverrides?: Partial<IOOSServiceConfig>) {
    this.config = {
      ...IOOS_API_CONFIG,
      ...configOverrides,
    };
  }

  /**
   * Get stations that were found to not have wave data
   * (returned "Unrecognized variable" error for wave height)
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
   */
  getConfig(): IOOSServiceConfig {
    return { ...this.config };
  }

  /**
   * Discover IOOS stations with wave data
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
      const url = `${this.config.baseUrl}${IOOS_ENDPOINTS.allDatasets}`;
      const response = await fetchWithTimeout(url, {
        timeoutMs: this.config.timeoutMs,
        init: {
          headers: {
            "User-Agent": this.config.userAgent,
          },
        },
      });

      if (!response.ok) {
        result.errors.push(`ERDDAP API error: ${response.status}`);
        return result;
      }

      const json = await response.json();
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
        // Example ISM ID: "ism-secoora-cap2wave-capers-near"
        // We only want native IDs: "cap2wave-capers-nearshore-wave"
        if (String(datasetId).toLowerCase().startsWith("ism-")) {
          ismFilteredCount++;
          continue;
        }

        // Apply geographic bounds filter
        if (bounds) {
          if (lat < bounds.minLat || lat > bounds.maxLat) continue;
          if (lon < bounds.minLon || lon > bounds.maxLon) continue;
        }

        // Check if this is a wave-capable dataset
        // Detection rules:
        // 1. CDIP stations always have wave data (edu_ucsd_cdip_* or institution contains "CDIP")
        // 2. Stations with "wave" in ID (e.g., cap2wave, sun2wave)
        // 3. NDBC ocean buoys (wmo_4xxxx pattern) - most have wave data
        // 4. Exclude DART buoys (tsunami detection, not wave height)
        // Note: Stations incorrectly marked will be cleaned up during observation sync
        const lowerDatasetId = String(datasetId).toLowerCase();
        const lowerInstitution = String(institution).toLowerCase();

        const isCdipStation = lowerInstitution.includes("cdip") ||
          lowerDatasetId.startsWith("edu_ucsd_cdip");
        const hasWaveInId = lowerDatasetId.includes("wave");
        const isDartBuoy = lowerDatasetId.includes("dart");
        // NDBC ocean buoys typically have wave data (wmo_4xxxx or wmo_5xxxx pattern)
        const isNdbcOceanBuoy = lowerInstitution.includes("ndbc") &&
          (lowerDatasetId.match(/^wmo_[45]\d{4}/) !== null);

        // CDIP, wave-named stations, and NDBC ocean buoys are likely to have wave data
        const hasWaveKeyword = (isCdipStation || hasWaveInId || isNdbcOceanBuoy) && !isDartBuoy;

        result.totalFound++;

        const station: IOOSStation = {
          station_id: String(datasetId),
          source_network: this.parseNetwork(String(datasetId), String(institution)),
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
      if (totalProcessed > 0 && ismFilteredCount / totalProcessed > 0.5) {
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
   * Fetch latest observation for a single station
   */
  async fetchObservation(stationId: string): Promise<IOOSObservation | null> {
    // Check cache first
    const cached = this.observationCache.get(stationId);
    if (cached && Date.now() - cached.at < this.config.cacheTtlMs) {
      return cached.data as IOOSObservation | null;
    }

    try {
      const url = this.buildObservationUrl(stationId);
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
        // ERDDAP returns 400 with "Unrecognized variable" for missing fields
        try {
          const errorText = await response.text();
          if (errorText.includes("Unrecognized variable")) {
            // This station doesn't have wave data - track it
            this.stationsWithoutWaveData.add(stationId);
            console.log(`[IOOS] Station ${stationId} has no wave variables`);
          }
        } catch {
          // Ignore error parsing failures
        }
        this.observationCache.set(stationId, { at: Date.now(), data: null });
        return null;
      }

      const json = await response.json();
      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      if (rows.length === 0) {
        this.observationCache.set(stationId, { at: Date.now(), data: null });
        return null;
      }

      // Find the wave height column index
      const waveHeightIdx = columnNames.indexOf(IOOS_WAVE_VARIABLES.waveHeight[0]);

      // Find the most recent row with non-null wave height
      // CDIP data often has interleaved null/non-null values
      let selectedRow = rows[0];
      if (waveHeightIdx >= 0) {
        for (const row of rows) {
          if (row[waveHeightIdx] !== null) {
            selectedRow = row;
            break;
          }
        }
      }

      const obs = this.parseObservation(stationId, selectedRow, columnNames);

      this.observationCache.set(stationId, { at: Date.now(), data: obs });
      return obs;
    } catch (error) {
      this.observationCache.set(stationId, { at: Date.now(), data: null });
      return null;
    }
  }

  /**
   * Fetch observations for multiple stations
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
   */
  async fetchObservationDynamic(
    stationId: string,
    variableMap: Partial<Record<CanonicalVar, string>>
  ): Promise<ParsedObservation | null> {
    // Check cache first
    const cacheKey = `dynamic_${stationId}`;
    const cached = this.observationCache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.config.cacheTtlMs) {
      return cached.data as ParsedObservation | null;
    }

    const url = buildDynamicObservationUrl(stationId, variableMap);
    if (!url) {
      console.log(`[IOOS] Station ${stationId} has no wave height variable, skipping`);
      return null;
    }

    try {
      const response = await fetchWithTimeout(url, {
        timeoutMs: this.config.timeoutMs,
        init: {
          headers: {
            "User-Agent": this.config.userAgent,
          },
        },
      });

      if (!response.ok) {
        if (response.status === 400) {
          // Likely variable mismatch - mark for re-sync
          console.warn(`[IOOS] Station ${stationId} returned 400, may need variable refresh`);
        }
        this.observationCache.set(cacheKey, { at: Date.now(), data: null });
        return null;
      }

      const json = await response.json();
      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      if (rows.length === 0) {
        this.observationCache.set(cacheKey, { at: Date.now(), data: null });
        return null;
      }

      // Convert array row to object using column names
      const rowObj: Record<string, unknown> = {};
      for (let i = 0; i < columnNames.length; i++) {
        rowObj[columnNames[i]] = rows[0][i];
      }

      const obs = parseObservationRow(rowObj, variableMap);

      // Validate observation is fresh enough to store
      if (obs) {
        const obsTime = new Date(obs.observedAt);
        const maxAge = IOOS_OBSERVATION_CONFIG.maxStorageAgeHours * 3600_000;
        if (Date.now() - obsTime.getTime() > maxAge) {
          console.log(`[IOOS] Station ${stationId} observation too old (${obs.observedAt}), skipping`);
          this.observationCache.set(cacheKey, { at: Date.now(), data: null });
          return null;
        }
      }

      this.observationCache.set(cacheKey, { at: Date.now(), data: obs });
      return obs;
    } catch (error) {
      console.error(`[IOOS] Error fetching observation for ${stationId}:`, error);
      this.observationCache.set(cacheKey, { at: Date.now(), data: null });
      return null;
    }
  }

  /**
   * Fetch available variables for a station from ERDDAP /info endpoint
   * Returns both raw variable list and computed variable_map
   */
  async fetchStationVariables(stationId: string): Promise<{
    availableVariables: string[];
    variableMap: Partial<Record<CanonicalVar, string>>;
  } | null> {
    try {
      const url = `${this.config.baseUrl}/info/${stationId}/index.json`;

      const response = await fetchWithTimeout(url, {
        timeoutMs: this.config.timeoutMs,
        init: {
          headers: {
            "User-Agent": this.config.userAgent,
          },
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Station doesn't exist
        }
        console.error(`[IOOS] Failed to fetch variables for ${stationId}: ${response.status}`);
        return null;
      }

      const json = await response.json();
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
   */
  async findNearbyStations(
    lat: number,
    lon: number,
    radiusKm: number = 100
  ): Promise<IOOSStation[]> {
    try {
      const supabase = createSupabaseServiceRoleClient();

      // Bug Fix #4: Add limit to prevent unbounded station queries
      // Use PostGIS ST_DWithin for efficient spatial query
      const { data, error } = await supabase.rpc("find_nearby_ioos_stations", {
        p_lat: lat,
        p_lon: lon,
        p_radius_km: radiusKm,
      }).limit(100);

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

  // ==================== Private Methods ====================

  /**
   * Parse network from datasetId and institution
   *
   * IOOS dataset IDs often follow pattern: "ism-NETWORK-..."
   * e.g., "ism-secoora-sun2wave-sunset-nearshore-wave"
   */
  private parseNetwork(datasetId: string, institution: string): IOOSNetwork {
    // First check datasetId for "ism-NETWORK-" pattern
    const ismMatch = datasetId.toLowerCase().match(/^ism-([a-z]+)-/);
    if (ismMatch) {
      const network = ismMatch[1];
      if (network === "pacioos") return "PacIOOS";
      if (network === "nanoos") return "NANOOS";
      if (network === "cencoos") return "CeNCOOS";
      if (network === "sccoos") return "SCCOOS";
      if (network === "gcoos") return "GCOOS";
      if (network === "secoora") return "SECOORA";
      if (network === "maracoos") return "MARACOOS";
      if (network === "neracoos") return "NERACOOS";
      if (network === "glos") return "GLOS";
      if (network === "aoos") return "AOOS";
    }

    // Also check if network name appears anywhere in datasetId
    const lowerDatasetId = datasetId.toLowerCase();
    if (lowerDatasetId.includes("pacioos")) return "PacIOOS";
    if (lowerDatasetId.includes("secoora")) return "SECOORA";
    if (lowerDatasetId.includes("maracoos")) return "MARACOOS";
    if (lowerDatasetId.includes("neracoos")) return "NERACOOS";
    if (lowerDatasetId.includes("nanoos")) return "NANOOS";
    if (lowerDatasetId.includes("cencoos")) return "CeNCOOS";
    if (lowerDatasetId.includes("sccoos")) return "SCCOOS";
    if (lowerDatasetId.includes("gcoos")) return "GCOOS";
    if (lowerDatasetId.includes("glos")) return "GLOS";
    if (lowerDatasetId.includes("aoos")) return "AOOS";
    if (lowerDatasetId.includes("ndbc")) return "NDBC";

    // Fallback to institution name check
    const lowerInst = institution.toLowerCase();
    if (lowerInst.includes("pacioos")) return "PacIOOS";
    if (lowerInst.includes("secoora")) return "SECOORA";
    if (lowerInst.includes("maracoos")) return "MARACOOS";
    if (lowerInst.includes("neracoos")) return "NERACOOS";
    if (lowerInst.includes("nanoos")) return "NANOOS";
    if (lowerInst.includes("cencoos")) return "CeNCOOS";
    if (lowerInst.includes("sccoos")) return "SCCOOS";
    if (lowerInst.includes("gcoos")) return "GCOOS";
    if (lowerInst.includes("glos")) return "GLOS";
    if (lowerInst.includes("aoos")) return "AOOS";
    if (lowerInst.includes("ndbc") || lowerInst.includes("data buoy")) return "NDBC";
    // CDIP (Coastal Data Information Program) - run by Scripps/UCSD
    // Map to CeNCOOS as they operate California coastal buoys
    if (lowerInst.includes("cdip")) return "CeNCOOS";

    return "unknown";
  }

  /**
   * Build URL for fetching observations
   */
  private buildObservationUrl(stationId: string): string {
    // Only request time and wave height - the most universally available variable
    // Different datasets use different variable names for period (peak vs mean)
    // which causes 400 errors if the variable doesn't exist
    const waveVars = [
      "time",
      ...IOOS_WAVE_VARIABLES.waveHeight.slice(0, 1),
    ].join(",");

    const endpoint = IOOS_ENDPOINTS.observations.replace("{datasetId}", stationId);
    // URL-encode >= as %3E= to avoid 500 errors on some ERDDAP servers
    return `${this.config.baseUrl}${endpoint}?${waveVars}&time%3E=max(time)-1hour`;
  }

  /**
   * Parse observation row into IOOSObservation
   */
  private parseObservation(
    stationId: string,
    row: (string | number | null)[],
    columnNames: string[]
  ): IOOSObservation {
    const getValue = (varNames: readonly string[]): number | null => {
      for (const varName of varNames) {
        const idx = columnNames.indexOf(varName);
        if (idx >= 0 && row[idx] != null) {
          const val = Number(row[idx]);
          return isFinite(val) ? val : null;
        }
      }
      return null;
    };

    const timeIdx = columnNames.indexOf("time");
    const observedAt = timeIdx >= 0 ? String(row[timeIdx]) : new Date().toISOString();

    let waveHeight = getValue(IOOS_WAVE_VARIABLES.waveHeight);
    const wavePeriod = getValue(IOOS_WAVE_VARIABLES.wavePeriod);
    const waveDirection = getValue(IOOS_WAVE_VARIABLES.waveDirection);
    const waterTemp = getValue(IOOS_WAVE_VARIABLES.waterTemp);
    const windSpeed = getValue(IOOS_WAVE_VARIABLES.windSpeed);
    const windDirection = getValue(IOOS_WAVE_VARIABLES.windDirection);

    // Validate wave height bounds
    if (
      waveHeight !== null &&
      (waveHeight < IOOS_QUALITY_THRESHOLDS.waveHeight.min ||
        waveHeight > IOOS_QUALITY_THRESHOLDS.waveHeight.max)
    ) {
      waveHeight = null;
    }

    return {
      station_id: stationId,
      observed_at: observedAt,
      wave_height_m: waveHeight,
      wave_period_s: wavePeriod,
      wave_direction_deg: waveDirection,
      water_temp_c: waterTemp,
      wind_speed_ms: windSpeed,
      wind_direction_deg: windDirection,
      raw_data: { row, columnNames },
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for convenience
 */
let defaultService: IOOSService | null = null;

export function getIOOSService(): IOOSService {
  if (!defaultService) {
    defaultService = new IOOSService();
  }
  return defaultService;
}
