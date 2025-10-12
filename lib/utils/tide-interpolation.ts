/**
 * Tide Height Interpolation Utility
 * 
 * Provides linear interpolation for tide heights at arbitrary timestamps.
 * Used by tide chart components to calculate exact tide height at "now".
 */

export interface TideDataPoint {
  time: Date | string | number;
  height: number;
}

/**
 * Normalizes various time formats to Unix timestamp (ms)
 */
export function normalizeTimestamp(time: Date | string | number): number {
  if (typeof time === 'number') return time;
  if (time instanceof Date) return time.getTime();
  return new Date(time).getTime();
}

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolates tide height at a specific timestamp using linear interpolation
 * between the nearest surrounding data points.
 * 
 * @param data - Array of tide data points (can be unsorted)
 * @param targetTime - Target timestamp to interpolate (Date, ISO string, or Unix ms)
 * @returns Interpolated tide height in feet, or null if insufficient data
 * 
 * @example
 * ```ts
 * const data = [
 *   { time: '2025-10-12T08:00:00Z', height: 3.5 },
 *   { time: '2025-10-12T14:00:00Z', height: 1.2 },
 * ];
 * const nowHeight = interpolateTideHeight(data, new Date('2025-10-12T11:00:00Z'));
 * // Returns ~2.35 (halfway between 3.5 and 1.2)
 * ```
 */
export function interpolateTideHeight(
  data: TideDataPoint[],
  targetTime: Date | string | number
): number | null {
  if (!data || data.length === 0) return null;

  const targetTs = normalizeTimestamp(targetTime);

  // Normalize all points to have numeric timestamps
  const points = data
    .map(point => ({
      ts: normalizeTimestamp(point.time),
      height: point.height,
    }))
    .filter(p => !isNaN(p.ts) && isFinite(p.height))
    .sort((a, b) => a.ts - b.ts);

  if (points.length === 0) return null;

  // If we only have one point, return its height
  if (points.length === 1) return points[0].height;

  // If target is before first point, return first height
  if (targetTs <= points[0].ts) return points[0].height;

  // If target is after last point, return last height
  if (targetTs >= points[points.length - 1].ts) {
    return points[points.length - 1].height;
  }

  // Find the two points that bracket the target time
  for (let i = 0; i < points.length - 1; i++) {
    const before = points[i];
    const after = points[i + 1];

    if (targetTs >= before.ts && targetTs <= after.ts) {
      // Calculate interpolation factor (0 to 1)
      const timeDiff = after.ts - before.ts;
      if (timeDiff === 0) return before.height;

      const t = (targetTs - before.ts) / timeDiff;

      // Linear interpolation
      return lerp(before.height, after.height, t);
    }
  }

  // Fallback (shouldn't reach here due to early returns)
  return null;
}

/**
 * Finds the two data points that bracket a target timestamp.
 * Useful for debugging or custom interpolation logic.
 * 
 * @param data - Array of tide data points
 * @param targetTime - Target timestamp
 * @returns Object with before/after points, or null if not found
 */
export function findBracketingPoints(
  data: TideDataPoint[],
  targetTime: Date | string | number
): { before: TideDataPoint; after: TideDataPoint } | null {
  if (!data || data.length < 2) return null;

  const targetTs = normalizeTimestamp(targetTime);

  const points = [...data]
    .map(p => ({ ...p, ts: normalizeTimestamp(p.time) }))
    .sort((a, b) => a.ts - b.ts);

  for (let i = 0; i < points.length - 1; i++) {
    if (targetTs >= points[i].ts && targetTs <= points[i + 1].ts) {
      return {
        before: data[i],
        after: data[i + 1],
      };
    }
  }

  return null;
}
