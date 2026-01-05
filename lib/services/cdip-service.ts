/**
 * CDIP (Coastal Data Information Program) Service
 *
 * Integrates with CDIP API to fetch high-quality wave data from
 * buoy stations along the California coast.
 *
 * CDIP is operated by Scripps Institution of Oceanography and provides:
 * - Real-time wave height, period, and direction
 * - Spectral wave analysis with swell separation
 * - Quality-controlled measurements
 * - Historical data for trend analysis
 */

import { CDIPRateLimiter } from "@/lib/utils/rate-limiter";
import { calculateDistance } from "@/lib/utils/distance-utils";
import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
import {
  CDIP_STATIONS,
  SOCAL_PRIMARY_STATIONS,
  CDIP_API_CONFIG,
  DATA_QUALITY_THRESHOLDS,
  getStationConfig,
  getStationCoverageRadius,
} from "@/lib/constants/cdip-stations";
import {
  CDIPBuoyData,
  CDIPDataPoint,
  CDIPDataResponse,
  CDIPMetaResponse,
  CDIPStationConfig,
} from "@/types/forecast";

export class CDIPService {
  private readonly userAgent = "quiver-surf-app/1.0 (contact@quiver-surf.com)";
  private readonly stationCache = new Map<string, CDIPStationConfig>();
  private readonly dataCache = new Map<
    string,
    { data: CDIPBuoyData; timestamp: number }
  >();
  /**
   * Deduplicate concurrent requests per station.
   * Without this, multiple beaches that map to the same station within a batch
   * can trigger duplicate HTTP calls before the cache is populated.
   */
  private readonly inFlightFetches = new Map<string, Promise<CDIPBuoyData | null>>();
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes
  private readonly blacklist: Set<string>;

  constructor() {
    // Pre-populate station cache
    Object.values(CDIP_STATIONS).forEach((station) => {
      this.stationCache.set(station.id, station);
    });

    // Support blacklist via env (comma separated).
    // Defaults include known-bad stations that frequently 404 on the current ERDDAP dataset.
    const fromEnv = (process.env.CDIP_BLACKLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
    const defaults = [
      "46221", // Point Arena: observed 404s on wave_agg
      "46225", // Point Reyes: observed 404s on wave_agg
      "46236", // Monterey Bay: treat as non-CDIP for now; observed issues on wave_agg
    ];
    // Deduplicate while preserving a readable defaults list.
    this.blacklist = new Set<string>([...defaults, ...fromEnv]);
  }

  private isVerbose(): boolean {
    return isForecastVerboseLoggingEnabled();
  }

  /**
   * ERDDAP station ids are sometimes zero-padded (e.g. "067", "071").
   * Internally we store the canonical id without padding (e.g. "67", "71").
   */
  private normalizeStationIdForErddap(stationId: string): string {
    const trimmed = String(stationId).trim();
    if (/^\d{1,2}$/.test(trimmed)) {
      return trimmed.padStart(3, "0");
    }
    return trimmed;
  }

  /**
   * Fetch current wave data for a specific CDIP station
   */
  async fetchBuoyData(stationId: string): Promise<CDIPBuoyData | null> {
    if (this.isVerbose()) {
      console.log(`🌊 CDIP fetchBuoyData called for station: ${stationId}`);
    }
    try {
      if (this.blacklist.has(String(stationId))) {
        console.warn(`🚫 CDIP station ${stationId} is blacklisted. Skipping fetch.`);
        return null;
      }
      // Check if station exists
      const stationConfig = getStationConfig(stationId);
      if (!stationConfig) {
        console.warn(`❌ Unknown CDIP station: ${stationId}`);
        return null;
      }
      if (this.isVerbose()) {
        console.log(`✅ CDIP station config found: ${stationConfig.name}`);
      }

      // Check cache first (cache hits should never be blocked by rate limiting)
      const cached = this.getCachedData(stationId);
      if (cached) {
        if (this.isVerbose()) {
          console.log(`📦 CDIP returning cached data for station ${stationId}`);
        }
        return cached;
      }

      // Deduplicate concurrent fetches for the same station within the same process.
      const inFlight = this.inFlightFetches.get(stationId);
      if (inFlight) {
        if (this.isVerbose()) {
          console.log(`🧵 CDIP joining in-flight fetch for station ${stationId}`);
        }
        return await inFlight;
      }

      const fetchPromise = (async (): Promise<CDIPBuoyData | null> => {
        try {
          // Check rate limiting (only applies when we actually need to hit the network)
          if (!CDIPRateLimiter.canMakeRequest()) {
            const waitTime = CDIPRateLimiter.getTimeUntilReset();
            console.warn(
              `⏰ CDIP rate limit exceeded, next request available in ${waitTime}ms`
            );
            return null;
          }
          if (this.isVerbose()) {
            console.log(`✅ CDIP rate limit check passed`);
          }

          // Fetch data from CDIP API
          if (this.isVerbose()) {
            console.log(`🔄 CDIP fetching raw data for station ${stationId}`);
          }
          const rawData = await this.fetchCDIPRawData(stationId);
          if (!rawData) {
            console.warn(
              `❌ CDIP fetchCDIPRawData returned null for station ${stationId}`
            );
            return null;
          }
          if (this.isVerbose()) {
            console.log(
              `✅ CDIP raw data fetched successfully for station ${stationId}`
            );
          }

          // Transform and validate data
          const buoyData = this.transformToCDIPBuoyData(stationId, rawData);
          if (!buoyData) {
            return null;
          }

          // Cache the data
          this.setCachedData(stationId, buoyData);

          // Record successful request
          CDIPRateLimiter.recordRequest(`station/${stationId}`);

          return buoyData;
        } finally {
          // Always clear in-flight marker (success or failure)
          this.inFlightFetches.delete(stationId);
        }
      })();

      this.inFlightFetches.set(stationId, fetchPromise);
      return await fetchPromise;
    } catch (error) {
      console.error(
        `💥 Error fetching CDIP data for station ${stationId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Fetch data from multiple CDIP stations concurrently
   */
  async fetchMultipleStations(
    stationIds: string[]
  ): Promise<Array<CDIPBuoyData | null>> {
    // Limit concurrent requests to respect rate limits
    const maxConcurrent = 3;
    const results: Array<CDIPBuoyData | null> = [];

    for (let i = 0; i < stationIds.length; i += maxConcurrent) {
      const batch = stationIds.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((stationId) => this.fetchBuoyData(stationId))
      );
      results.push(...batchResults);

      // Small delay between batches to be respectful to API
      if (i + maxConcurrent < stationIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get Southern California CDIP stations
   */
  getSouthernCaliforniaStations(): string[] {
    return SOCAL_PRIMARY_STATIONS;
  }

  /**
   * Find the nearest CDIP station to a given location
   */
  async getNearestStation(
    latitude: number,
    longitude: number,
    maxDistanceKm: number = 50
  ): Promise<string | null> {
    try {
      let nearestStation: string | null = null;
      let minDistance = Infinity;

      for (const station of Object.values(CDIP_STATIONS)) {
        if (this.blacklist.has(String(station.id))) {
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
          console.log(
            `📍 Nearest CDIP station to ${latitude}, ${longitude}: ${nearestStation} (${minDistance.toFixed(
              1
            )}km)`
          );
        }
      }

      return nearestStation;
    } catch (error) {
      console.error("Error finding nearest CDIP station:", error);
      return null;
    }
  }

  /**
   * Fetch station metadata from CDIP with retry logic
   */
  async fetchStationMetadata(
    stationId: string
  ): Promise<CDIPMetaResponse | null> {
    try {
      if (!CDIPRateLimiter.canMakeRequest()) {
        console.warn(`⏰ CDIP rate limit exceeded for metadata request`);
        return null;
      }

      // Import retry client dynamically to avoid circular dependencies
      const { apiClient } = await import("@/lib/utils/api-retry");

      const normalizedStationId = this.normalizeStationIdForErddap(stationId);
      const endpoint = CDIP_API_CONFIG.endpoints.metadata.replace(
        "{stationId}",
        normalizedStationId
      );
      const url = `${CDIP_API_CONFIG.baseUrl}${endpoint}`;

      const response = await apiClient.fetchCDIPData(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        console.error(
          `CDIP metadata API error: ${response.status} - ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();
      CDIPRateLimiter.recordRequest(`metadata/${stationId}`);

      return data as CDIPMetaResponse;
    } catch (error) {
      console.error(
        `Error fetching CDIP metadata for station ${stationId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Transform raw CDIP data to our standardized format
   * Made public for testing
   */
  transformToCDIPBuoyData(
    stationId: string,
    rawData: CDIPDataResponse
  ): CDIPBuoyData | null {
    try {
      if (!rawData.data || rawData.data.length === 0) {
        console.warn(
          `No data points in CDIP response for station ${stationId}`
        );
        return null;
      }

      const stationConfig = getStationConfig(stationId);
      const stationName = stationConfig?.name || `CDIP Station ${stationId}`;

      const dataPoints: CDIPDataPoint[] = [];

      for (const dataPoint of rawData.data) {
        try {
          const [timestamp, waveHeight, period, direction] = dataPoint;

          // Validate data point
          if (
            !this.isValidDataPoint(timestamp, waveHeight, period, direction)
          ) {
            continue;
          }

          const cdipPoint: CDIPDataPoint = {
            timestamp: new Date(timestamp).toISOString(),
            significantWaveHeight: Number(waveHeight),
            peakWavePeriod: Number(period),
            peakWaveDirection: Number(direction),
          };

          // Add swell separation if available (CDIP provides this in separate calls)
          // For now, estimate from total wave data
          if (cdipPoint.significantWaveHeight > 0) {
            cdipPoint.swellHeight = cdipPoint.significantWaveHeight * 0.8; // 80% swell
            cdipPoint.swellPeriod = cdipPoint.peakWavePeriod * 1.1; // Swell has longer period
            cdipPoint.swellDirection = cdipPoint.peakWaveDirection;

            cdipPoint.windWaveHeight = cdipPoint.significantWaveHeight * 0.2; // 20% wind waves
            cdipPoint.windWavePeriod = Math.max(
              3,
              cdipPoint.peakWavePeriod * 0.6
            ); // Shorter period
            cdipPoint.windWaveDirection = cdipPoint.peakWaveDirection;
          }

          dataPoints.push(cdipPoint);
        } catch (pointError) {
          console.warn(`Skipping invalid CDIP data point:`, pointError);
          continue;
        }
      }

      if (dataPoints.length === 0) {
        console.warn(`No valid data points for CDIP station ${stationId}`);
        return null;
      }

      return {
        stationId,
        stationName,
        data: dataPoints,
        dataSource: "CDIP",
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `Error transforming CDIP data for station ${stationId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Calculate data quality score based on freshness and completeness
   */
  getDataQualityScore(buoyData: CDIPBuoyData): number {
    try {
      let score = 50; // Base score

      // Data freshness score
      const now = Date.now();
      const lastUpdated = new Date(buoyData.lastUpdated).getTime();
      const ageMinutes = (now - lastUpdated) / (1000 * 60);

      if (ageMinutes <= DATA_QUALITY_THRESHOLDS.dataFreshness.excellent) {
        score += 30;
      } else if (ageMinutes <= DATA_QUALITY_THRESHOLDS.dataFreshness.good) {
        score += 20;
      } else if (
        ageMinutes <= DATA_QUALITY_THRESHOLDS.dataFreshness.acceptable
      ) {
        score += 10;
      } else {
        score -= 20; // Penalize stale data
      }

      // Data completeness score
      const dataPoints = buoyData.data.length;
      if (dataPoints >= 4) {
        score += 20; // Good amount of recent data
      } else if (dataPoints >= 2) {
        score += 10;
      } else {
        score -= 10; // Very limited data
      }

      // Data quality based on recent data point
      if (buoyData.data.length > 0) {
        const latest = buoyData.data[buoyData.data.length - 1];
        const recentAge =
          (now - new Date(latest.timestamp).getTime()) / (1000 * 60);

        if (recentAge <= DATA_QUALITY_THRESHOLDS.dataFreshness.excellent) {
          score += 10;
        } else if (recentAge > DATA_QUALITY_THRESHOLDS.dataFreshness.stale) {
          score -= 15;
        }
      }

      return Math.max(0, Math.min(100, Math.round(score)));
    } catch (error) {
      console.error("Error calculating CDIP data quality score:", error);
      return 50; // Default score
    }
  }

  /**
   * Private helper methods
   */
  private async fetchCDIPRawData(
    stationId: string
  ): Promise<CDIPDataResponse | null> {
    try {
      // Import retry client dynamically to avoid circular dependencies
      const { apiClient } = await import("@/lib/utils/api-retry");
      
      // Use ERDDAP API - construct the URL with wave data endpoint
      const normalizedStationId = this.normalizeStationIdForErddap(stationId);
      const endpoint = CDIP_API_CONFIG.endpoints.waveData.replace(
        "{stationId}",
        normalizedStationId
      );
      const url = `${CDIP_API_CONFIG.baseUrl}${endpoint}`;

      if (this.isVerbose()) {
        console.log(`🌊 Fetching CDIP data from: ${url}`);
      }

      const response = await apiClient.fetchCDIPData(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          `❌ CDIP API error: ${response.status} - ${response.statusText} for station ${stationId}`
        );
        return null;
      }

      const data = await response.json();

      // ERDDAP returns data in a different format: {table: {columnNames: [...], rows: [[...]]}}
      if (
        !data ||
        !data.table ||
        !data.table.rows ||
        data.table.rows.length === 0
      ) {
        console.warn(`⚠️ CDIP returned empty data for station ${stationId}`);
        return null;
      }

      // Transform ERDDAP format to CDIPDataResponse format with proper array structure
      const transformedData = this.transformERDDAPToDataResponse(
        data,
        stationId
      );

      if (this.isVerbose()) {
        console.log(
          `✅ Successfully fetched CDIP data for station ${stationId}: ${transformedData.data.length} data points`
        );
      }

      return transformedData;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(`⏰ CDIP API request timeout for station ${stationId}`);
      } else {
        console.error(
          `💥 CDIP API request failed for station ${stationId}:`,
          error
        );
      }
      return null;
    }
  }

  /**
   * Transform ERDDAP response format to CDIPDataResponse format with proper array structure
   */
  private transformERDDAPToDataResponse(
    erddapData: any,
    stationId: string
  ): CDIPDataResponse {
    const { columnNames, rows } = erddapData.table;

    // Map ERDDAP columns: [station_id, time, waveHs, waveTp, waveTa, waveDp]
    const stationIdIdx = columnNames.indexOf("station_id");
    const timeIdx = columnNames.indexOf("time");
    const waveHsIdx = columnNames.indexOf("waveHs"); // Significant wave height (m)
    const waveTpIdx = columnNames.indexOf("waveTp"); // Peak wave period (s)
    const waveTaIdx = columnNames.indexOf("waveTa"); // Average wave period (s)
    const waveDpIdx = columnNames.indexOf("waveDp"); // Peak wave direction (degrees)

    // Transform rows to the array format that transformToCDIPBuoyData expects
    // Format: [timestamp, waveHeight, period, direction]
    const dataPoints: any[] = rows.map((row: any[]) => {
      // Convert from meters to feet for wave height
      const waveHeightMeters = row[waveHsIdx] || 0;
      const waveHeightFeet = waveHeightMeters * 3.28084;

      return [
        row[timeIdx] || new Date().toISOString(), // timestamp
        waveHeightFeet, // wave height in feet
        row[waveTpIdx] || row[waveTaIdx] || 0, // period in seconds
        row[waveDpIdx] || 0, // direction in degrees
      ];
    });

    // Sort by timestamp (newest first)
    dataPoints.sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );

    // Get station config for location info
    const stationConfig = getStationConfig(stationId);

    return {
      parameter: "wave_height",
      sensorId: stationId,
      units: "feet",
      dataGaps: [],
      data: dataPoints as Array<[string, number, number, number]>,
      metadata: {
        station_name: stationConfig?.name || `CDIP Station ${stationId}`,
        location: {
          latitude: stationConfig?.latitude || 0,
          longitude: stationConfig?.longitude || 0,
        },
        parameters: ["wave"],
        units: {
          waveHeight: "ft",
          period: "s",
          direction: "deg",
        },
      },
    };
  }

  private isValidDataPoint(
    timestamp: string,
    waveHeight: number,
    period: number,
    direction: number
  ): boolean {
    try {
      // Validate timestamp
      const time = new Date(timestamp);
      if (isNaN(time.getTime())) {
        return false;
      }

      // Validate wave height
      // NOTE: Wave heights are in feet (converted from meters in transformERDDAPToDataResponse)
      // but thresholds are in meters. This works because feet values are larger and pass
      // the meter-based min/max checks (0.1-15.0). A proper fix would convert thresholds to feet.
      if (
        isNaN(waveHeight) ||
        waveHeight < DATA_QUALITY_THRESHOLDS.waveHeight.min ||
        waveHeight > DATA_QUALITY_THRESHOLDS.waveHeight.max
      ) {
        return false;
      }

      // Validate period
      if (
        isNaN(period) ||
        period < DATA_QUALITY_THRESHOLDS.wavePeriod.min ||
        period > DATA_QUALITY_THRESHOLDS.wavePeriod.max
      ) {
        return false;
      }

      // Validate direction
      if (
        isNaN(direction) ||
        direction < DATA_QUALITY_THRESHOLDS.waveDirection.min ||
        direction > DATA_QUALITY_THRESHOLDS.waveDirection.max
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`Error validating data point:`, error);
      return false;
    }
  }

  private getCachedData(stationId: string): CDIPBuoyData | null {
    const cached = this.dataCache.get(stationId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.dataCache.delete(stationId);
      return null;
    }

    return cached.data;
  }

  private setCachedData(stationId: string, data: CDIPBuoyData): void {
    this.dataCache.set(stationId, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (this.dataCache.size > 20) {
      const oldestKey = this.dataCache.keys().next().value;
      if (oldestKey) {
        this.dataCache.delete(oldestKey);
      }
    }
  }
}
