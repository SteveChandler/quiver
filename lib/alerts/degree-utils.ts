import { normalizeAngle } from "@/lib/domains/shared/angle-utils";
import { resolveWindOrientation } from "@/lib/domains/shared/wind-orientation";

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
 * Offshore falls back to the opposite of the facing direction; returns null
 * when the beach has neither.
 */
export function resolveWindDirection(
  windDeg: number,
  offshoreDeg: number | null,
  offshoreTolDeg: number | null,
  aspectDeg: number | null
): "offshore" | "onshore" | "cross-shore" | null {
  const { offshoreDeg: offshore, toleranceDeg: tolerance } = resolveWindOrientation({
    wind_offshore_deg: offshoreDeg,
    wind_offshore_tol_deg: offshoreTolDeg,
    aspect_deg: aspectDeg,
  });
  if (offshore == null) return null;

  if (angularDistance(windDeg, offshore) <= tolerance) {
    return "offshore";
  }

  const onshore = aspectDeg ?? normalizeAngle(offshore + 180);
  if (angularDistance(windDeg, onshore) <= tolerance) {
    return "onshore";
  }

  return "cross-shore";
}
