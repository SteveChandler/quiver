/**
 * Forecast Transformer Module
 * 
 * Handles transformation and normalization of forecast data:
 * - Direction conversion (cardinal to degrees)
 * - Unit conversion (feet/meters, mph/knots)
 * - Data validation and sanitization
 * - Schema normalization across data sources
 * 
 * Extracted from lib/services/enhanced-forecast-service.ts as part of P1 refactoring
 * to reduce file size and improve maintainability.
 */

/**
 * Convert cardinal wind direction (e.g. "SW") to degrees
 * 
 * Handles:
 * - Cardinal directions (N, S, E, W)
 * - Intercardinal directions (NE, SE, SW, NW)
 * - Secondary intercardinal (NNE, ENE, ESE, etc.)
 * - Numeric strings (already in degrees)
 * 
 * @param dir - Direction as string (cardinal or numeric)
 * @returns Direction in degrees (0-359) or null if unparseable
 * 
 * @example
 * ```typescript
 * cardinalToDegrees("SW");  // Returns: 225
 * cardinalToDegrees("180"); // Returns: 180
 * cardinalToDegrees("N");   // Returns: 0
 * cardinalToDegrees(null);  // Returns: null
 * ```
 */
export function cardinalToDegrees(dir: string | null | undefined): number | null {
  if (!dir) return null;
  const trimmed = dir.trim();
  if (!trimmed) return null;

  // If already numeric, treat as degrees
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    const normalized = ((asNum % 360) + 360) % 360;
    return normalized;
  }

  const directionMap: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };

  const upper = trimmed.toUpperCase();
  return directionMap[upper] ?? null;
}

/**
 * ForecastTransformer class
 * 
 * Provides methods for transforming and normalizing forecast data
 * from various sources into a unified format.
 */
export class ForecastTransformer {
  /**
   * Convert cardinal direction to degrees
   */
  cardinalToDegrees(dir: string | null | undefined): number | null {
    return cardinalToDegrees(dir);
  }

  // Additional transformation methods will be added as extraction continues
  // - transformWaveData()
  // - transformTideData()
  // - transformWeatherData()
  // - normalizeUnits()
  // - validateAndSanitize()
}

