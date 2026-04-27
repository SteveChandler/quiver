/**
 * Parse a wind_speed text value (e.g. "10 mph", "8 kt", "5 m/s") to knots.
 *
 * Returns null for null input or unparseable strings.
 *
 * Bare numbers are treated as mph — that's the current ingest convention
 * for enhanced_forecasts.wind_speed. If we ever migrate that column to a
 * numeric kt field, callers should switch to reading the new column directly.
 */
export function parseWindSpeedToKt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;
  if (raw.includes("kt") || raw.includes("knot")) return num;
  if (raw.includes("m/s")) return num * 1.9438;     // m/s → kt
  if (raw.includes("mph")) return num * 0.868976;   // mph → kt
  // Bare number = treat as mph (current ingest convention)
  return num * 0.868976;
}

/**
 * Parse a swell direction value to degrees. Accepts:
 * - 16-point cardinal text: "N", "NNE", "NE", "ENE", "E", … "NNW"
 * - Numeric strings: "180", "180.5"
 *
 * Returns null for null input or unparseable strings.
 */
const CARDINAL_TO_DEGREES: Record<string, number> = {
  N:    0,
  NNE:  22.5,
  NE:   45,
  ENE:  67.5,
  E:    90,
  ESE:  112.5,
  SE:   135,
  SSE:  157.5,
  S:    180,
  SSW:  202.5,
  SW:   225,
  WSW:  247.5,
  W:    270,
  WNW:  292.5,
  NW:   315,
  NNW:  337.5,
};

export function parseSwellDirectionToDegrees(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper in CARDINAL_TO_DEGREES) return CARDINAL_TO_DEGREES[upper];
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;
  return num;
}
