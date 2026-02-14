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
 * @returns Confidence score on 0-100 scale (e.g., 70 means 70%)
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

// ============================================================================
// Scale Conversion Utilities
// ============================================================================

/**
 * Convert 0-100 confidence scale to 0-1 decimal scale.
 *
 * Use this when passing confidence to systems that expect 0-1 scale.
 *
 * @param score - Confidence score on 0-100 scale
 * @returns Confidence on 0-1 scale, clamped to valid range
 *
 * @example
 * confidenceToDecimal(75)  // Returns 0.75
 * confidenceToDecimal(100) // Returns 1
 * confidenceToDecimal(0)   // Returns 0
 */
export function confidenceToDecimal(score: number): number {
  return Math.max(0, Math.min(1, score / 100));
}

/**
 * Convert 0-1 decimal scale to 0-100 confidence scale.
 *
 * Use this when converting from systems that use 0-1 scale
 * back to our standard 0-100 confidence format.
 *
 * @param decimal - Confidence on 0-1 scale
 * @returns Confidence score on 0-100 scale, rounded and clamped
 *
 * @example
 * decimalToConfidence(0.75) // Returns 75
 * decimalToConfidence(1)    // Returns 100
 * decimalToConfidence(0)    // Returns 0
 */
export function decimalToConfidence(decimal: number): number {
  return Math.round(Math.max(0, Math.min(100, decimal * 100)));
}

// ============================================================================
// Forecast Row Confidence Derivation
// ============================================================================

/**
 * Parameters for deriving confidence from a forecast row.
 * Matches the shape of enhanced_forecasts table rows.
 */
export interface ForecastRowParams {
  /** Data source identifier (e.g., 'CDIP', 'NOAA_NWS') */
  data_source: string | null;
  /** ISO 8601 UTC timestamptz (preferred over forecast_date + forecast_time) */
  forecast_at?: string;
  /** Forecast date in YYYY-MM-DD format */
  forecast_date: string;
  /** Forecast time in HH:MM:SS format */
  forecast_time: string;
  /** Wave height (optional, presence indicates wave data available) */
  wave_height?: number | null;
  /** Tide height (optional) */
  tide_height?: number | null;
  /** Wind speed (optional) */
  wind_speed?: number | null;
}

/**
 * Derives confidence parameters from an enhanced_forecasts row.
 *
 * Use this for:
 * - Backfill scripts recalculating confidence scores
 * - Data correction and migration scripts
 * - Consistent confidence calculation from database rows
 *
 * This function infers data availability from the row's values and
 * calculates time-based decay from the forecast timestamp.
 *
 * @param row - Forecast row data matching ForecastRowParams
 * @returns Confidence score on 0-100 scale
 *
 * @example
 * ```typescript
 * // For a CDIP forecast tomorrow at noon
 * const tomorrow = new Date();
 * tomorrow.setDate(tomorrow.getDate() + 1);
 *
 * const confidence = calculateConfidenceFromForecastRow({
 *   data_source: 'CDIP',
 *   forecast_date: tomorrow.toISOString().split('T')[0],
 *   forecast_time: '12:00:00',
 *   wave_height: 3.5,
 *   tide_height: 2.1,
 *   wind_speed: 8
 * });
 * // Returns: ~93 (high confidence with CDIP data, ~24 hours ahead)
 * ```
 */
export function calculateConfidenceFromForecastRow(row: ForecastRowParams): number {
  const hasCDIPData = row.data_source === 'CDIP';
  const hasWaveData = row.wave_height != null || row.data_source != null;
  const hasTideData = row.tide_height != null;
  const hasWeatherData = row.wind_speed != null;

  // Calculate hours ahead (negative for historical forecasts becomes 0)
  // Prefer forecast_at, fallback to legacy forecast_date + forecast_time (assume UTC)
  const forecastDateTime = row.forecast_at
    ? new Date(row.forecast_at)
    : new Date(`${row.forecast_date}T${row.forecast_time}Z`);
  const hoursAhead = Math.max(0, (forecastDateTime.getTime() - Date.now()) / (1000 * 60 * 60));

  return calculateConfidenceScore({
    hasWaveData,
    hasTideData,
    hasWeatherData,
    hasBuoyData: hasCDIPData,
    hasCDIPData,
    forecastHoursAhead: hoursAhead,
  });
}
