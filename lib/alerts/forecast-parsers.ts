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
