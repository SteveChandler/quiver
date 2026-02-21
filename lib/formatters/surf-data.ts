import { SET_WAVE_VARIANCE } from '@/lib/utils/wave-height-transformer';

/**
 * Format wave height as a surfer-friendly range string.
 * Returns "Flat" for zero, negative, NaN, or Infinity values.
 * Uses integer rounding for both average and set heights via SET_WAVE_VARIANCE;
 * collapses to a single value when both round to the same integer.
 */
export function formatWaveHeight(ft: number): string {
  if (!Number.isFinite(ft)) return 'Flat';
  if (ft <= 0) return 'Flat';
  const low = Math.round(ft);
  const high = Math.round(ft * SET_WAVE_VARIANCE);
  if (low === high) return `${low}ft`;
  return `${low}-${high}ft`;
}

/**
 * Format wind speed in mph, rounded to nearest integer.
 */
export function formatWindSpeed(mph: number): string {
  if (!Number.isFinite(mph)) return '-- mph';
  return `${Math.round(mph)} mph`;
}

/**
 * Format swell period in seconds, rounded to nearest integer.
 */
export function formatSwellPeriod(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--s';
  return `${Math.round(seconds)}s`;
}

/**
 * Format tide height in feet with 1 decimal place.
 */
export function formatTideHeight(ft: number): string {
  if (!Number.isFinite(ft)) return '--ft';
  return `${ft.toFixed(1)}ft`;
}

/**
 * Format water temperature in Fahrenheit, rounded to nearest integer.
 */
export function formatWaterTemp(fahrenheit: number): string {
  if (!Number.isFinite(fahrenheit)) return '--°F';
  return `${Math.round(fahrenheit)}°F`;
}
