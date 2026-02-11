/**
 * Wave data analysis and processing utilities
 *
 * Provides functions for analyzing wave data, calculating derived values,
 * and converting between units.
 *
 * @module noaa-wavewatch/wave-analysis
 */

import { createContextLogger } from "@/lib/logger";
import { WAVE_REGIONS, SEASONAL_FACTORS, COMPASS_DIRECTIONS, UNIT_CONVERSIONS } from "./constants";
import { METERS_TO_FEET, FEET_TO_METERS } from "@/lib/utils/unit-conversions";

const log = createContextLogger("NOAAWaveWatch:WaveAnalysis");

/**
 * Get base wave height for a geographic location
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns Base wave height in meters
 */
export function getBaseWaveHeight(lat: number, lon: number): number {
  // Pacific Coast (California)
  if (
    lon < WAVE_REGIONS.PACIFIC_COAST.longitudeRange.max &&
    lon > WAVE_REGIONS.PACIFIC_COAST.longitudeRange.min &&
    lat > WAVE_REGIONS.PACIFIC_COAST.latitudeRange.min &&
    lat < WAVE_REGIONS.PACIFIC_COAST.latitudeRange.max
  ) {
    return WAVE_REGIONS.PACIFIC_COAST.baseWaveHeight;
  }

  // Atlantic Coast
  if (
    lon > WAVE_REGIONS.ATLANTIC_COAST.longitudeRange.min &&
    lon < WAVE_REGIONS.ATLANTIC_COAST.longitudeRange.max &&
    lat > WAVE_REGIONS.ATLANTIC_COAST.latitudeRange.min &&
    lat < WAVE_REGIONS.ATLANTIC_COAST.latitudeRange.max
  ) {
    return WAVE_REGIONS.ATLANTIC_COAST.baseWaveHeight;
  }

  // Gulf of Mexico
  if (
    lon > WAVE_REGIONS.GULF_OF_MEXICO.longitudeRange.min &&
    lon < WAVE_REGIONS.GULF_OF_MEXICO.longitudeRange.max &&
    lat > WAVE_REGIONS.GULF_OF_MEXICO.latitudeRange.min &&
    lat < WAVE_REGIONS.GULF_OF_MEXICO.latitudeRange.max
  ) {
    return WAVE_REGIONS.GULF_OF_MEXICO.baseWaveHeight;
  }

  // Hawaii
  if (
    lon > WAVE_REGIONS.HAWAII.longitudeRange.min &&
    lon < WAVE_REGIONS.HAWAII.longitudeRange.max &&
    lat > WAVE_REGIONS.HAWAII.latitudeRange.min &&
    lat < WAVE_REGIONS.HAWAII.latitudeRange.max
  ) {
    return WAVE_REGIONS.HAWAII.baseWaveHeight;
  }

  // Default ocean
  return WAVE_REGIONS.DEFAULT_OCEAN.baseWaveHeight;
}

/**
 * Get seasonal factor for wave height adjustments
 *
 * @param month - Month number (0-11, where 0 is January)
 * @param lat - Latitude in decimal degrees
 * @returns Seasonal adjustment factor
 */
export function getSeasonalFactor(month: number, lat: number): number {
  const isNorthern = lat > 0;

  if (isNorthern) {
    if ((SEASONAL_FACTORS.NORTHERN_WINTER.months as readonly number[]).includes(month)) {
      return SEASONAL_FACTORS.NORTHERN_WINTER.factor;
    }
    if ((SEASONAL_FACTORS.NORTHERN_SUMMER.months as readonly number[]).includes(month)) {
      return SEASONAL_FACTORS.NORTHERN_SUMMER.factor;
    }
  } else {
    // Southern hemisphere - opposite seasons
    if ((SEASONAL_FACTORS.SOUTHERN_WINTER.months as readonly number[]).includes(month)) {
      return SEASONAL_FACTORS.SOUTHERN_WINTER.factor;
    }
    if ((SEASONAL_FACTORS.SOUTHERN_SUMMER.months as readonly number[]).includes(month)) {
      return SEASONAL_FACTORS.SOUTHERN_SUMMER.factor;
    }
  }

  // Spring/Fall
  return SEASONAL_FACTORS.DEFAULT.factor;
}

/**
 * Get prevailing wave direction for a geographic location
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns Wave direction in degrees
 */
export function getPrevailingWaveDirection(lat: number, lon: number): number {
  // Pacific Coast - waves typically from west/northwest
  if (
    lon < WAVE_REGIONS.PACIFIC_COAST.longitudeRange.max &&
    lon > WAVE_REGIONS.PACIFIC_COAST.longitudeRange.min &&
    lat > WAVE_REGIONS.PACIFIC_COAST.latitudeRange.min &&
    lat < WAVE_REGIONS.PACIFIC_COAST.latitudeRange.max
  ) {
    return WAVE_REGIONS.PACIFIC_COAST.prevailingDirection;
  }

  // Atlantic Coast - waves typically from east/southeast
  if (
    lon > WAVE_REGIONS.ATLANTIC_COAST.longitudeRange.min &&
    lon < WAVE_REGIONS.ATLANTIC_COAST.longitudeRange.max &&
    lat > WAVE_REGIONS.ATLANTIC_COAST.latitudeRange.min &&
    lat < WAVE_REGIONS.ATLANTIC_COAST.latitudeRange.max
  ) {
    return WAVE_REGIONS.ATLANTIC_COAST.prevailingDirection;
  }

  // Hawaii - waves typically from NNW
  if (
    lon > WAVE_REGIONS.HAWAII.longitudeRange.min &&
    lon < WAVE_REGIONS.HAWAII.longitudeRange.max &&
    lat > WAVE_REGIONS.HAWAII.latitudeRange.min &&
    lat < WAVE_REGIONS.HAWAII.latitudeRange.max
  ) {
    return WAVE_REGIONS.HAWAII.prevailingDirection;
  }

  // Default
  return WAVE_REGIONS.DEFAULT_OCEAN.prevailingDirection;
}

/**
 * Convert wave height from meters to feet
 *
 * @param meters - Wave height in meters
 * @returns Wave height in feet
 * @deprecated Import from @/lib/utils/unit-conversions instead
 */
export function metersToFeetLocal(meters: number): number {
  return meters * METERS_TO_FEET;
}

// Re-export for backward compatibility
export { METERS_TO_FEET as metersToFeetFactor };

/**
 * Convert wave height from meters to feet
 * @deprecated Import metersToFeetStrict from @/lib/utils/unit-conversions instead
 */
export const metersToFeet = metersToFeetLocal;

/**
 * Convert wave height from feet to meters
 *
 * @param feet - Wave height in feet
 * @returns Wave height in meters
 */
export function feetToMeters(feet: number): number {
  return feet * FEET_TO_METERS;
}

/**
 * Convert wave direction from degrees to compass text
 *
 * @param degrees - Direction in degrees (0-360)
 * @returns Compass direction (e.g., "NW", "SE")
 */
export function getWaveDirectionText(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return COMPASS_DIRECTIONS[index];
}

/**
 * Get timestamp for forecast at specific index
 *
 * Forecasts are generated every 3 hours from current time.
 *
 * @param index - Forecast index (0-based)
 * @returns ISO 8601 timestamp string
 */
export function getTimestampForIndex(index: number): string {
  const now = new Date();
  const forecastTime = new Date(now.getTime() + index * 3 * 60 * 60 * 1000);
  return forecastTime.toISOString();
}

/**
 * Extract value at specific index from NOAA API time series
 *
 * @param values - Array of time-value pairs from NOAA API
 * @param index - Index to extract
 * @returns Value at index or null if unavailable
 */
export function getValueAtIndex(
  values: Array<{ validTime: string; value: number }> | undefined,
  index: number
): number | null {
  if (!values || index >= values.length) return null;
  return values[index]?.value || null;
}

/**
 * Validate wave height data from NOAA
 *
 * Checks if wave height data is meaningful (not all zeros or nulls).
 *
 * @param values - Array of wave height values
 * @returns True if data is valid and usable
 */
export function hasValidWaveData(
  values: Array<{ validTime: string; value: number }> | undefined
): boolean {
  if (!values || values.length === 0) return false;

  const validValues = values.filter((v) => v.value != null && v.value > 0);
  return validValues.length > 0;
}

/**
 * Log wave data availability statistics
 *
 * @param waveHeightValues - Wave height time series
 * @param wavePeriodValues - Wave period time series
 * @param waveDirectionValues - Wave direction time series
 */
export function logWaveDataAvailability(
  waveHeightValues: Array<{ validTime: string; value: number }> | undefined,
  wavePeriodValues: Array<{ validTime: string; value: number }> | undefined,
  waveDirectionValues: Array<{ validTime: string; value: number }> | undefined
): void {
  const hasWaveHeight = !!waveHeightValues;
  const hasWavePeriod = !!wavePeriodValues;
  const hasWaveDirection = !!waveDirectionValues;

  log.debug(`NOAA NWS Wave data availability:`, {
    waveHeight: hasWaveHeight,
    wavePeriod: hasWavePeriod,
    waveDirection: hasWaveDirection,
    waveHeightCount: waveHeightValues?.length || 0,
    wavePeriodCount: wavePeriodValues?.length || 0,
  });

  // Check for valid data
  const validValues = waveHeightValues?.filter((v) => v.value != null && v.value > 0) || [];

  if (validValues.length === 0) {
    log.debug(
      `NOAA NWS has no usable wave height data (${waveHeightValues?.length || 0} total, 0 valid)`
    );
  } else if (validValues.length === 1) {
    log.warn(
      `NOAA NWS has limited wave data (only 1 valid value: ${validValues[0].value}m from ${waveHeightValues?.length || 0} total)`
    );
  } else {
    log.debug(
      `NOAA NWS wave data validated: ${validValues.length} valid forecasts from ${waveHeightValues?.length || 0} total`
    );
  }
}
