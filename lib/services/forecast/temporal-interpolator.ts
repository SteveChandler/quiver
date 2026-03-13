/**
 * Temporal Data Interpolation
 *
 * Functions for finding data points closest to a target time
 * across different forecast data sources.
 */

import type { CDIPBuoyData } from "@/types/forecast";

/**
 * Get CDIP buoy data for a specific time
 *
 * CDIP provides real-time buoy measurements, not forecasts.
 * Only returns data for current/recent conditions (within 1 hour).
 */
export function getCDIPDataForTime(
  cdipData: CDIPBuoyData | null,
  targetTime: Date,
  options?: { verbose?: boolean }
) {
  if (!cdipData?.data || cdipData.data.length === 0) return null;

  const now = new Date();
  const hoursFromNow =
    (targetTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Only use CDIP data for current conditions (within 1 hour)
  // Beyond that, model-based forecasts provide varying predictions
  if (hoursFromNow > 1) {
    return null;
  }

  // For current/recent times, use the most recent CDIP measurement
  const sortedData = [...cdipData.data].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return sortedData[0];
}

/**
 * Get wave data for a specific time
 * Finds the closest wave forecast point to the target time
 */
export function getWaveDataForTime(waveData: any, targetTime: Date) {
  if (!waveData?.forecast) return null;

  const targetTimestamp = targetTime.getTime();
  let closest = null;
  let minDiff = Infinity;

  for (const point of waveData.forecast) {
    const pointTime = new Date(point.timestamp).getTime();
    const diff = Math.abs(pointTime - targetTimestamp);

    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest;
}

/**
 * Get weather data for a specific time
 * Finds the closest weather forecast point to the target time
 */
export function getWeatherDataForTime(weatherData: any[], targetTime: Date) {
  if (!weatherData || weatherData.length === 0) return null;

  const targetTimestamp = targetTime.getTime();
  let closest = null;
  let minDiff = Infinity;

  for (const point of weatherData) {
    const pointTime = new Date(point.startTime).getTime();
    const diff = Math.abs(pointTime - targetTimestamp);

    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest;
}
