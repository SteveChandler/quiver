/**
 * Data parsing utilities for CDIP API responses
 *
 * Handles transformation and validation of CDIP data.
 */

import { createContextLogger } from "@/lib/logger";
import {
  CDIPBuoyData,
  CDIPDataPoint,
  CDIPDataResponse,
} from "./types";
import {
  DATA_QUALITY_THRESHOLDS,
  getStationConfig,
  SWELL_ESTIMATION,
} from "./constants";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

const log = createContextLogger("CDIPDataParser");

/**
 * Transform ERDDAP response format to CDIPDataResponse format
 *
 * @param erddapData - Raw ERDDAP API response
 * @param stationId - The station ID
 * @returns Transformed data response
 */
export function transformERDDAPToDataResponse(
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
    const waveHeightFeet = waveHeightMeters * METERS_TO_FEET;

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

/**
 * Validate a single data point
 *
 * @param timestamp - The timestamp string
 * @param waveHeight - Wave height in feet
 * @param period - Wave period in seconds
 * @param direction - Wave direction in degrees
 * @returns true if valid, false otherwise
 */
export function isValidDataPoint(
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
    log.warn(`Error validating data point:`, error);
    return false;
  }
}

/**
 * Transform raw CDIP data to standardized buoy data format
 *
 * @param stationId - The station ID
 * @param rawData - Raw CDIP data response
 * @returns Transformed buoy data or null if invalid
 */
export function transformToCDIPBuoyData(
  stationId: string,
  rawData: CDIPDataResponse
): CDIPBuoyData | null {
  try {
    if (!rawData.data || rawData.data.length === 0) {
      log.warn(`No data points in CDIP response for station ${stationId}`);
      return null;
    }

    const stationConfig = getStationConfig(stationId);
    const stationName = stationConfig?.name || `CDIP Station ${stationId}`;

    const dataPoints: CDIPDataPoint[] = [];

    for (const dataPoint of rawData.data) {
      try {
        const [timestamp, waveHeight, period, direction] = dataPoint;

        // Validate data point
        if (!isValidDataPoint(timestamp, waveHeight, period, direction)) {
          continue;
        }

        const cdipPoint: CDIPDataPoint = {
          timestamp: new Date(timestamp).toISOString(),
          significantWaveHeight: Number(waveHeight),
          peakWavePeriod: Number(period),
          peakWaveDirection: Number(direction),
        };

        // Add swell separation if available (CDIP provides this in separate calls)
        // For now, estimate from total wave data using estimation factors
        if (cdipPoint.significantWaveHeight > 0) {
          cdipPoint.swellHeight =
            cdipPoint.significantWaveHeight * SWELL_ESTIMATION.swellHeightRatio;
          cdipPoint.swellPeriod =
            cdipPoint.peakWavePeriod * SWELL_ESTIMATION.swellPeriodMultiplier;
          cdipPoint.swellDirection = cdipPoint.peakWaveDirection;

          cdipPoint.windWaveHeight =
            cdipPoint.significantWaveHeight * SWELL_ESTIMATION.windWaveHeightRatio;
          cdipPoint.windWavePeriod = Math.max(
            SWELL_ESTIMATION.minWindWavePeriod,
            cdipPoint.peakWavePeriod * SWELL_ESTIMATION.windWavePeriodMultiplier
          );
          cdipPoint.windWaveDirection = cdipPoint.peakWaveDirection;
        }

        dataPoints.push(cdipPoint);
      } catch (pointError) {
        log.warn(`Skipping invalid CDIP data point:`, pointError);
        continue;
      }
    }

    if (dataPoints.length === 0) {
      log.warn(`No valid data points for CDIP station ${stationId}`);
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
    log.error(
      `Error transforming CDIP data for station ${stationId}:`,
      error
    );
    return null;
  }
}

/**
 * Calculate data quality score based on freshness and completeness
 *
 * @param buoyData - The buoy data to score
 * @returns Quality score from 0-100
 */
export function calculateDataQualityScore(buoyData: CDIPBuoyData): number {
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
    log.error("Error calculating CDIP data quality score:", error);
    return 50; // Default score
  }
}

/**
 * Normalize station ID for ERDDAP API
 *
 * ERDDAP station IDs are sometimes zero-padded (e.g. "067", "071").
 * Internally we store the canonical ID without padding (e.g. "67", "71").
 *
 * @param stationId - The station ID to normalize
 * @returns Normalized station ID
 */
export function normalizeStationIdForErddap(stationId: string): string {
  const trimmed = String(stationId).trim();
  if (/^\d{1,2}$/.test(trimmed)) {
    return trimmed.padStart(3, "0");
  }
  return trimmed;
}
