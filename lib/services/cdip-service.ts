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
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Pre-populate station cache
    Object.values(CDIP_STATIONS).forEach((station) => {
      this.stationCache.set(station.id, station);
    });
  }

  /**
   * Fetch current wave data for a specific CDIP station
   */
  async fetchBuoyData(stationId: string): Promise<CDIPBuoyData | null> {
    try {
      // Check if station exists
      const stationConfig = getStationConfig(stationId);
      if (!stationConfig) {
        console.warn(`❌ Unknown CDIP station: ${stationId}`);
        return null;
      }

      // Check rate limiting
      if (!CDIPRateLimiter.canMakeRequest()) {
        const waitTime = CDIPRateLimiter.getTimeUntilReset();
        console.warn(
          `⏰ CDIP rate limit exceeded, next request available in ${waitTime}ms`
        );
        return null;
      }

      // Check cache
      const cached = this.getCachedData(stationId);
      if (cached) {
        return cached;
      }

      // Fetch data from CDIP API
      const rawData = await this.fetchCDIPRawData(stationId);
      if (!rawData) {
        return null;
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
        const distance = calculateDistance(
          latitude,
          longitude,
          station.latitude,
          station.longitude,
          "km"
        );

        if (distance < minDistance && distance <= maxDistanceKm) {
          minDistance = distance;
          nearestStation = station.id;
        }
      }

      if (nearestStation) {
        console.log(
          `📍 Nearest CDIP station to ${latitude}, ${longitude}: ${nearestStation} (${minDistance.toFixed(
            1
          )}km)`
        );
      }

      return nearestStation;
    } catch (error) {
      console.error("Error finding nearest CDIP station:", error);
      return null;
    }
  }

  /**
   * Fetch station metadata from CDIP
   */
  async fetchStationMetadata(
    stationId: string
  ): Promise<CDIPMetaResponse | null> {
    try {
      if (!CDIPRateLimiter.canMakeRequest()) {
        console.warn(`⏰ CDIP rate limit exceeded for metadata request`);
        return null;
      }

      const url = `${CDIP_API_CONFIG.baseUrl}?stn=${stationId}&param=meta&format=${CDIP_API_CONFIG.formats.json}`;

      const response = await fetch(url, {
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
      // CDIP API endpoint for recent wave data
      const url = `${CDIP_API_CONFIG.baseUrl}?stn=${stationId}&param=${CDIP_API_CONFIG.dataTypes.wave}&format=${CDIP_API_CONFIG.formats.json}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        console.error(
          `CDIP API error: ${response.status} - ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();

      if (!data || !data.data) {
        console.warn(
          `CDIP returned empty or invalid data for station ${stationId}`
        );
        return null;
      }

      return data as CDIPDataResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(`CDIP API request timeout for station ${stationId}`);
      } else {
        console.error(
          `CDIP API request failed for station ${stationId}:`,
          error
        );
      }
      return null;
    }
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
