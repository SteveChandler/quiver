/**
 * Fallback wave data generator
 *
 * Generates realistic synthetic wave forecasts when real NOAA data is unavailable.
 * Uses location-based and seasonal patterns to create plausible forecasts.
 *
 * @module noaa-wavewatch/fallback-generator
 */

import { createContextLogger } from "@/lib/logger";
import { FORECAST_CONFIG } from "./constants";
import { getBaseWaveHeight, getSeasonalFactor, getPrevailingWaveDirection } from "./wave-analysis";
import type { WaveWatchData } from "./types";

const log = createContextLogger("NOAAWaveWatch:FallbackGenerator");

/**
 * Generate fallback wave forecast data
 *
 * Creates synthetic wave forecasts based on typical conditions for the location
 * and season. Used as a fallback when real NOAA data is unavailable.
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @param days - Number of forecast days
 * @returns Array of synthetic wave forecast data points
 */
export function generateFallbackData(
  latitude: number,
  longitude: number,
  days: number
): WaveWatchData[] {
  const forecasts: WaveWatchData[] = [];
  const now = new Date();

  // Base wave conditions vary by location and season
  const baseWaveHeight = getBaseWaveHeight(latitude, longitude);
  const seasonalFactor = getSeasonalFactor(now.getMonth(), latitude);

  log.debug(
    `Generating fallback data for ${latitude}, ${longitude} with base height ${baseWaveHeight}m and seasonal factor ${seasonalFactor}`
  );

  for (let i = 0; i < days * FORECAST_CONFIG.FORECASTS_PER_DAY; i++) {
    const timestamp = new Date(
      now.getTime() + i * FORECAST_CONFIG.FORECAST_INTERVAL_HOURS * 60 * 60 * 1000
    );

    // Add realistic variability using sine wave + random noise
    const waveHeightVariation =
      Math.sin(i * 0.2) * 0.5 + Math.random() * 0.3 - 0.15;
    const significantWaveHeight = Math.max(
      FORECAST_CONFIG.MIN_WAVE_HEIGHT,
      baseWaveHeight * seasonalFactor + waveHeightVariation
    );

    // Wave period typically correlates with wave height
    // Pacific swells have much longer periods (12-16s) than Atlantic
    const peakWavePeriod = Math.max(
      FORECAST_CONFIG.MIN_PACIFIC_SWELL_PERIOD, // Minimum 10 seconds
      12 + significantWaveHeight * 1.5 + (Math.random() - 0.5) * 4 // Generate 12-16s periods typical of Pacific
    );

    // Wave direction varies but has prevailing patterns
    const baseDirection = getPrevailingWaveDirection(latitude, longitude);
    const peakWaveDirection =
      (baseDirection + (Math.random() - 0.5) * 60 + 360) % 360;

    // Primary swell: Usually dominates, longer period, most of the wave height
    const swell1Height = significantWaveHeight * (0.7 + Math.random() * 0.15); // 70-85% of total
    const swell1Period = peakWavePeriod * (1.1 + Math.random() * 0.2); // 10-30% longer than peak
    const swell1Direction =
      (peakWaveDirection + (Math.random() - 0.5) * 20 + 360) % 360; // Less directional variance

    // Secondary swell: Smaller, different direction, shorter period
    const swell2Height = significantWaveHeight * (0.2 + Math.random() * 0.15); // 20-35% of total
    const swell2Period = swell1Period * (0.8 + Math.random() * 0.15); // Shorter than primary
    const swell2Direction =
      (swell1Direction + 45 + (Math.random() - 0.5) * 30 + 360) % 360; // Different direction

    // Wind waves: Typically much smaller than swells and have short periods
    const windWaveHeight =
      significantWaveHeight * (0.15 + Math.random() * 0.15); // 15-30% of total
    const windWavePeriod = Math.max(
      FORECAST_CONFIG.MIN_WIND_WAVE_PERIOD, // Minimum 3 seconds
      peakWavePeriod * (0.4 + Math.random() * 0.2) // Much shorter: 40-60% of peak
    );
    const windWaveDirection =
      (peakWaveDirection + (Math.random() - 0.5) * 60 + 360) % 360; // More variable direction

    forecasts.push({
      timestamp: timestamp.toISOString(),
      significant_wave_height: Math.round(significantWaveHeight * 100) / 100,
      peak_wave_period: Math.round(peakWavePeriod * 10) / 10,
      peak_wave_direction: Math.round(peakWaveDirection),
      swell_1_height: Math.round(swell1Height * 100) / 100,
      swell_1_period: Math.round(swell1Period * 10) / 10,
      swell_1_direction: Math.round(swell1Direction),
      swell_2_height: Math.round(swell2Height * 100) / 100,
      swell_2_period: Math.round(swell2Period * 10) / 10,
      swell_2_direction: Math.round(swell2Direction),
      wind_wave_height: Math.round(windWaveHeight * 100) / 100,
      wind_wave_period: Math.round(windWavePeriod * 10) / 10,
      wind_wave_direction: Math.round(windWaveDirection),
      data_source: "FALLBACK" as const,
    });
  }

  log.debug(`Generated ${forecasts.length} fallback wave forecasts`);
  return forecasts;
}
