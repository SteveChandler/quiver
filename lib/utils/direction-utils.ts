/**
 * Normalize degrees to [0, 360)
 */
function normalizeDegrees(
  value: number | null | undefined
): number | null {
  if (value == null || isNaN(value)) return null;
  let v = value % 360;
  if (v < 0) v += 360;
  return v;
}

/**
 * Convert a degree range (min/max) to compact cardinal text (e.g., "W–NW").
 * Falls back to single cardinal if window is small.
 */
export function degreeWindowToCardinal(
  minDeg: number | null | undefined,
  maxDeg: number | null | undefined
): string | null {
  const min = normalizeDegrees(minDeg);
  const max = normalizeDegrees(maxDeg);
  if (min == null || max == null) return null;

  // Cardinal labels at 22.5° increments
  const labels = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

  const toIndex = (deg: number) => Math.round(deg / 22.5) % 16;
  const iMin = toIndex(min);
  const iMax = toIndex(max);

  if (iMin === iMax) {
    return labels[iMin];
  }

  // Handle wrap-around windows (e.g., 300°–40°)
  const span = (iMax - iMin + 16) % 16;
  if (span <= 2) {
    // Small window: show midpoint
    const midIndex = (iMin + Math.round(span / 2)) % 16;
    return labels[midIndex];
  }
  return `${labels[iMin]}–${labels[iMax]}`;
}
