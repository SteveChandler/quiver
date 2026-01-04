/**
 * Forecast Confidence Scorer
 * 
 * Calculates confidence scores for forecast data based on:
 * - Data source availability (wave, tide, weather, buoy)
 * - Data quality (CDIP buoy data gets premium scores)
 * - Temporal factors (forecasts degrade over time)
 * 
 * Extracted from lib/services/enhanced-forecast-service.ts as part of P1 refactoring
 * to reduce file size and improve maintainability.
 */

/**
 * Parameters for confidence calculation
 */
export interface ConfidenceParams {
  /** Whether wave data is available */
  hasWaveData: boolean;
  /** Whether tide data is available */
  hasTideData: boolean;
  /** Whether weather data is available */
  hasWeatherData: boolean;
  /** Whether buoy data is available */
  hasBuoyData: boolean;
  /** Whether CDIP buoy data is available (premium quality) */
  hasCDIPData?: boolean;
  /** Hours into the future for this forecast */
  forecastHoursAhead: number;
}

/**
 * Calculate confidence score based on data availability and quality
 * 
 * Scoring breakdown:
 * - Base score: 50
 * - CDIP buoy data: +25 (premium quality)
 * - Wave model data: +20 (standard quality)
 * - Tide data: +15
 * - Buoy data: +15
 * - Weather data: +10
 * - Time penalty: -0.3 to -0.5 per hour (depends on data source)
 * 
 * @param params - Confidence parameters
 * @returns Confidence score from 0-100
 * 
 * @example
 * ```typescript
 * const confidence = calculateConfidenceScore({
 *   hasWaveData: true,
 *   hasTideData: true,
 *   hasWeatherData: true,
 *   hasBuoyData: false,
 *   hasCDIPData: true,
 *   forecastHoursAhead: 6
 * });
 * // Returns: ~93 (high confidence with CDIP data, 6 hours ahead)
 * ```
 */
export function calculateConfidenceScore({
  hasWaveData,
  hasTideData,
  hasWeatherData,
  hasBuoyData,
  hasCDIPData,
  forecastHoursAhead,
}: ConfidenceParams): number {
  let score = 50; // Base score

  // Data availability bonuses - CDIP gets highest bonus for quality
  if (hasCDIPData) score += 25; // Premium for high-quality CDIP buoy data
  else if (hasWaveData) score += 20; // Standard wave model data

  if (hasTideData) score += 15;
  if (hasWeatherData) score += 10;
  if (hasBuoyData) score += 15;

  // Time penalty (forecasts get less reliable over time)
  // CDIP data is real-time so less time penalty for recent forecasts
  const timePenalty = hasCDIPData
    ? Math.min(20, forecastHoursAhead * 0.3) // Reduced penalty for CDIP data
    : Math.min(30, forecastHoursAhead * 0.5);
  score -= timePenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

