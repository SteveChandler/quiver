/**
 * Safe Number Parsing Utilities
 *
 * Provides consistent, safe parsing of numbers from various inputs.
 * Eliminates scattered parseFloat/parseInt calls with inconsistent NaN handling.
 *
 * @example
 * // Before: parseFloat(String(forecast.wind_speed ?? '0'))
 * // After: parseFloatSafe(forecast.wind_speed, 0)
 */

export function parseFloatSafe(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isNaN(value) ? fallback : value;
  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseIntSafe(value: unknown, fallback: number, radix: number = 10): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isNaN(value) ? fallback : Math.trunc(value);
  const parsed = parseInt(String(value), radix);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseCoordinate(value: unknown, type?: 'lat' | 'lon'): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value));
  if (Number.isNaN(parsed)) return null;

  if (type === 'lat' && (parsed < -90 || parsed > 90)) return null;
  if (type === 'lon' && (parsed < -180 || parsed > 180)) return null;
  if (!type && (parsed < -180 || parsed > 180)) return null;

  return parsed;
}

export function parseWaveHeightRange(value: unknown): { min: number; max: number } | null {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.replace(/\s*(ft|feet|m|meters?)\s*/gi, '').trim();

  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max };
  }

  const singleMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    if (!Number.isNaN(val)) return { min: val, max: val };
  }

  return null;
}

export function parseWindSpeed(value: unknown, fallback: number = 0): number {
  if (!value) return fallback;
  const str = String(value);
  const cleaned = str.replace(/\s*(mph|kph|knots?|kts?|m\/s)\s*/gi, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseWavePeriod(value: unknown, fallback: number = 0): number {
  if (!value) return fallback;
  const str = String(value);
  const cleaned = str.replace(/\s*(s|sec|seconds?)\s*/gi, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const CARDINAL_TO_DEGREES: Record<string, number> = {
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

/**
 * Convert a direction value to degrees. Accepts numeric degrees or cardinal strings ("SW", "WNW", etc.).
 * Returns null if the input cannot be parsed.
 */
export function getDirectionDegrees(
  deg: number | string | null | undefined,
  cardinal?: string | null | undefined
): number | null {
  if (deg !== null && deg !== undefined) {
    const numDeg = typeof deg === 'string' ? parseFloat(deg) : deg;
    if (!isNaN(numDeg)) return numDeg;
    // First param is a non-numeric string — try cardinal lookup
    if (typeof deg === 'string') {
      const fromCardinal = CARDINAL_TO_DEGREES[deg.toUpperCase()];
      if (fromCardinal !== undefined) return fromCardinal;
    }
  }
  if (!cardinal) return null;
  return CARDINAL_TO_DEGREES[cardinal.toUpperCase()] ?? null;
}
