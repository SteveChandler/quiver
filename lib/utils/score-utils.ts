/**
 * Small, pure scoring helpers used in recommendations.
 */

/**
 * Smallest absolute angular difference between a and b, in degrees within [0, 180].
 */
export function angleDiff180(a: number, b: number): number {
  if (!isFinite(a) || !isFinite(b)) return NaN;
  let d = (((a - b) % 360) + 360) % 360; // [0,360)
  if (d > 180) d = 360 - d;
  return d; // [0,180]
}

/**
 * Triangle score centered at mid with total width. Returns 1 at mid, 0 at edges (mid ± width/2),
 * and 0 outside the width. Width <= 0 yields 0.
 */
export function triangleScore(
  value: number,
  mid: number,
  width: number
): number {
  if (!isFinite(value) || !isFinite(mid) || !isFinite(width) || width <= 0)
    return 0;
  const half = width / 2;
  const x = Math.abs(value - mid);
  if (x >= half) return 0;
  return Math.max(0, 1 - x / half);
}

/**
 * Swell window score using a wrapped window [minDeg..maxDeg] with fade (30° default).
 * Returns 1 inside, decreasing linearly to 0 over fadeDeg beyond window.
 */
export function swellWindowScore(
  directionDeg: number,
  minDeg: number,
  maxDeg: number,
  fadeDeg = 30
): number {
  if (
    !isFinite(directionDeg) ||
    !isFinite(minDeg) ||
    !isFinite(maxDeg) ||
    fadeDeg <= 0
  )
    return 0;
  const span = (maxDeg - minDeg + 360) % 360;
  const center = (minDeg + span / 2) % 360;
  const diff = angleDiff180(directionDeg, center);
  const insideHalf = span / 2;
  if (diff <= insideHalf) return 1;
  const over = diff - insideHalf;
  return Math.max(0, 1 - over / fadeDeg);
}
