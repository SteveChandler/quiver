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
} from "@/lib/constants/ioos-config";

/**
 * Cache entry for observations
 */
interface CacheEntry {
  at: number;
  data: IOOSObservation | null;
}

/**
 * IOOS Service for fetching wave data from ERDDAP API
 */
export class IOOSService {
  private readonly config: IOOSServiceConfig;
  private readonly observationCache: Map<string, CacheEntry> = new Map();

  constructor(configOverrides?: Partial<IOOSServiceConfig>) {
    this.config = {
      ...IOOS_API_CONFIG,
      ...configOverrides,
    };
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

      for (const row of rows) {
        const datasetId = row[idIdx];
        const institution = row[instIdx];
        const lat = (Number(row[minLatIdx]) + Number(row[maxLatIdx])) / 2;
        const lon = (Number(row[minLonIdx]) + Number(row[maxLonIdx])) / 2;

        if (!datasetId || !isFinite(lat) || !isFinite(lon)) continue;

        // Apply geographic bounds filter
        if (bounds) {
          if (lat < bounds.minLat || lat > bounds.maxLat) continue;
          if (lon < bounds.minLon || lon > bounds.maxLon) continue;
        }

        // Check if this looks like a wave dataset
        const hasWaveKeyword = String(datasetId).toLowerCase().includes("wave") ||
          String(institution).toLowerCase().includes("buoy");

        result.totalFound++;

        const station: IOOSStation = {
          station_id: String(datasetId),
          source_network: this.parseNetwork(String(institution)),
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
      return cached.data;
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

      // Parse the most recent observation (first row)
      const row = rows[0];
      const obs = this.parseObservation(stationId, row, columnNames);

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
   * Find stations near a location from the database
   */
  async findNearbyStations(
    lat: number,
    lon: number,
    radiusKm: number = 100
  ): Promise<IOOSStation[]> {
    try {
      const supabase = createSupabaseServiceRoleClient();

      // Use PostGIS ST_DWithin for efficient spatial query
      const { data, error } = await supabase.rpc("find_nearby_ioos_stations", {
        p_lat: lat,
        p_lon: lon,
        p_radius_km: radiusKm,
      });

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
   * Parse institution name to IOOSNetwork type
   */
  private parseNetwork(institution: string): IOOSNetwork {
    const lower = institution.toLowerCase();
    if (lower.includes("pacioos")) return "PacIOOS";
    if (lower.includes("nanoos")) return "NANOOS";
    if (lower.includes("cencoos")) return "CeNCOOS";
    if (lower.includes("sccoos")) return "SCCOOS";
    if (lower.includes("gcoos")) return "GCOOS";
    if (lower.includes("secoora")) return "SECOORA";
    if (lower.includes("maracoos")) return "MARACOOS";
    if (lower.includes("neracoos")) return "NERACOOS";
    if (lower.includes("glos")) return "GLOS";
    if (lower.includes("aoos")) return "AOOS";
    if (lower.includes("ndbc")) return "NDBC";
    return "unknown";
  }

  /**
   * Build URL for fetching observations
   */
  private buildObservationUrl(stationId: string): string {
    // Build query for wave variables
    const waveVars = [
      "time",
      ...IOOS_WAVE_VARIABLES.waveHeight.slice(0, 1),
      ...IOOS_WAVE_VARIABLES.wavePeriod.slice(0, 1),
      ...IOOS_WAVE_VARIABLES.waveDirection.slice(0, 1),
      ...IOOS_WAVE_VARIABLES.waterTemp.slice(0, 1),
    ].join(",");

    const endpoint = IOOS_ENDPOINTS.observations.replace("{datasetId}", stationId);
    return `${this.config.baseUrl}${endpoint}?${waveVars}&time>=max(time)-1hour&orderBy(%22time/desc%22)`;
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
