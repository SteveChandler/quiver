import { normalizeAngle } from "@/lib/domains/shared/angle-utils";

export { normalizeAngle };

/** Shortest angular distance between two bearings (0-180) */
export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Check if a bearing falls within an arc from minDeg to maxDeg (clockwise).
 * Handles wrapping around 0/360.
 * If minDeg === maxDeg, the arc is 360° (matches everything).
 */
export function isWithinArc(
  bearing: number,
  minDeg: number,
  maxDeg: number
): boolean {
  const b = normalizeAngle(bearing);
  const min = normalizeAngle(minDeg);
  const max = normalizeAngle(maxDeg);

  if (min === max) return true;
  if (min < max) return b >= min && b <= max;
  return b >= min || b <= max;
}

/**
 * Classify wind direction relative to a beach's orientation.
 * Returns null if beach metadata is insufficient.
 */
export function resolveWindDirection(
  windDeg: number,
  offshoreDeg: number | null,
  offshoreTolDeg: number | null,
  aspectDeg: number | null
): "offshore" | "onshore" | "cross-shore" | null {
  if (offshoreDeg == null) return null;

  const tolerance = offshoreTolDeg ?? 45;

  if (angularDistance(windDeg, offshoreDeg) <= tolerance) {
    return "offshore";
  }

  if (aspectDeg != null && angularDistance(windDeg, aspectDeg) <= tolerance) {
    return "onshore";
  }

  return "cross-shore";
}
