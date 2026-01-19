/**
 * Tide Height Interpolation Utility
 *
 * Provides linear interpolation for tide heights at arbitrary timestamps.
 * Used by tide chart components to calculate exact tide height at "now".
 */

import type { TideScheduleEntry } from "@/types/forecast";

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
 * Cosine interpolation factor - more accurate for tidal motion
 * Returns value between 0 and 1 representing progress through tide cycle
 */
function cosineInterpolationFactor(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
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
 * Interpolates tide height using cosine interpolation (more accurate for tides).
 * Tides follow a sinusoidal pattern, so cosine interpolation is more accurate
 * than linear interpolation between high/low tide events.
 *
 * @param data - Array of tide data points (high/low events)
 * @param targetTime - Target timestamp to interpolate
 * @returns Interpolated tide height in feet, or null if insufficient data
 */
export function interpolateTideHeightCosine(
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
      const timeDiff = after.ts - before.ts;
      if (timeDiff === 0) return before.height;

      const t = (targetTs - before.ts) / timeDiff;
      const cosineT = cosineInterpolationFactor(t);

      // Cosine interpolation
      return before.height + (after.height - before.height) * cosineT;
    }
  }

  return null;
}

/**
 * Inverse cosine interpolation - finds t value (0-1) for a given height
 * @param startHeight - Height at start of interval
 * @param endHeight - Height at end of interval
 * @param targetHeight - Height to find
 * @returns t value (0-1) or null if target outside range
 */
function inverseCosineInterpolation(
  startHeight: number,
  endHeight: number,
  targetHeight: number
): number | null {
  const range = endHeight - startHeight;
  if (range === 0) return null;

  const normalized = (targetHeight - startHeight) / range;
  if (normalized < 0 || normalized > 1) return null;

  // Inverse of cosine interpolation: t = acos(1 - 2*normalized) / π
  return Math.acos(1 - 2 * normalized) / Math.PI;
}

/**
 * Finds when tide crosses a specific height threshold.
 *
 * @param tideSchedule - Array of tide events (high/low points)
 * @param targetHeight - Height threshold to find crossing for
 * @param direction - 'rising' or 'falling' - which crossing to find
 * @param afterTime - Only find crossings after this time
 * @returns Date when tide crosses threshold, or null if not found
 */
export function findTideThresholdCrossing(
  tideSchedule: TideDataPoint[],
  targetHeight: number,
  direction: "rising" | "falling",
  afterTime: Date | string | number
): Date | null {
  if (!tideSchedule || tideSchedule.length < 2) return null;

  const afterTs = normalizeTimestamp(afterTime);

  // Normalize and sort tide events
  const events = tideSchedule
    .map((point) => ({
      ts: normalizeTimestamp(point.time),
      height: point.height,
    }))
    .filter((p) => !isNaN(p.ts) && isFinite(p.height))
    .sort((a, b) => a.ts - b.ts);

  if (events.length < 2) return null;

  // Find consecutive event pairs that could contain the crossing
  for (let i = 0; i < events.length - 1; i++) {
    const start = events[i];
    const end = events[i + 1];

    // Skip if this interval ends before our search start
    if (end.ts <= afterTs) continue;

    // Determine if this interval is rising or falling
    const isRising = end.height > start.height;
    if ((direction === "rising") !== isRising) continue;

    // Check if target height is within this interval's range
    const minHeight = Math.min(start.height, end.height);
    const maxHeight = Math.max(start.height, end.height);
    if (targetHeight < minHeight || targetHeight > maxHeight) continue;

    // Calculate when tide crosses threshold using inverse cosine interpolation
    const t = inverseCosineInterpolation(start.height, end.height, targetHeight);
    if (t === null) continue;

    const crossingTs = start.ts + t * (end.ts - start.ts);

    // Skip if crossing is before our search start
    if (crossingTs <= afterTs) continue;

    return new Date(crossingTs);
  }

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

export interface TideWindowOptions {
  tideSchedule: TideScheduleEntry[];
  minHeight: number;
  maxHeight: number;
  preferredDirection: "rising" | "falling" | "slack" | "either";
  afterTime: Date | string | number;
}

export interface TideExtremum {
  time: Date;
  height: number;
  type: "high" | "low";
}

/**
 * Finds the nearest tide extremum (high or low) after a given time.
 *
 * @param tideSchedule - Array of tide schedule entries (high/low events)
 * @param afterTime - Find extremum after this time
 * @param preferredType - Optional: prefer "high" or "low", or null for nearest
 * @returns The nearest tide extremum, or null if not found
 */
export function findNearestTideExtremum(
  tideSchedule: TideScheduleEntry[],
  afterTime: Date | string | number,
  preferredType?: "high" | "low" | null
): TideExtremum | null {
  if (!tideSchedule || tideSchedule.length === 0) return null;

  const afterTs = normalizeTimestamp(afterTime);

  // Sort by time and find entries after afterTime
  const sorted = [...tideSchedule]
    .map(t => ({
      time: t.time * 1000, // Convert to ms
      height: t.height,
      type: t.type,
    }))
    .sort((a, b) => a.time - b.time)
    .filter(t => t.time > afterTs);

  if (sorted.length === 0) return null;

  // If preferred type specified, find the first matching type
  if (preferredType) {
    const preferred = sorted.find(t => t.type === preferredType);
    if (preferred) {
      return {
        time: new Date(preferred.time),
        height: preferred.height,
        type: preferred.type,
      };
    }
  }

  // Otherwise return the nearest
  const nearest = sorted[0];
  return {
    time: new Date(nearest.time),
    height: nearest.height,
    type: nearest.type,
  };
}

/**
 * Creates a direction-based tide window when threshold crossings aren't available.
 * Used as fallback when tide stays within acceptable range all day.
 *
 * @param tideSchedule - Array of tide schedule entries
 * @param preferredDirection - Direction preference
 * @param afterTime - Start searching after this time
 * @returns Tide window based on tide direction, or null
 */
function calculateDirectionBasedWindow(
  tideSchedule: TideScheduleEntry[],
  preferredDirection: "rising" | "falling" | "slack" | "either",
  afterTime: Date | string | number
): TideWindow | null {
  const afterTs = normalizeTimestamp(afterTime);

  // Sort tide schedule
  const sorted = [...tideSchedule]
    .map(t => ({
      time: t.time * 1000,
      height: t.height,
      type: t.type,
    }))
    .sort((a, b) => a.time - b.time);

  if (sorted.length < 2) return null;

  // For rising: find low tide, window until next high
  // For falling: find high tide, window until next low
  // For slack/either: find nearest extremum, window ±1.5 hours

  if (preferredDirection === "rising") {
    // Find the next low tide after afterTime (start of rising phase)
    const lowIdx = sorted.findIndex(t => t.time > afterTs && t.type === "low");
    if (lowIdx === -1 || lowIdx >= sorted.length - 1) return null;

    const low = sorted[lowIdx];
    // Find the next high after this low
    const highIdx = sorted.findIndex((t, i) => i > lowIdx && t.type === "high");
    if (highIdx === -1) return null;

    const high = sorted[highIdx];
    return {
      start: new Date(low.time),
      end: new Date(high.time),
    };
  }

  if (preferredDirection === "falling") {
    // Find the next high tide after afterTime (start of falling phase)
    const highIdx = sorted.findIndex(t => t.time > afterTs && t.type === "high");
    if (highIdx === -1 || highIdx >= sorted.length - 1) return null;

    const high = sorted[highIdx];
    // Find the next low after this high
    const lowIdx = sorted.findIndex((t, i) => i > highIdx && t.type === "low");
    if (lowIdx === -1) return null;

    const low = sorted[lowIdx];
    return {
      start: new Date(high.time),
      end: new Date(low.time),
    };
  }

  // For "slack" or "either": find nearest extremum and create window around it
  const nearestIdx = sorted.findIndex(t => t.time > afterTs);
  if (nearestIdx === -1) return null;

  const nearest = sorted[nearestIdx];
  const SLACK_WINDOW_MS = 1.5 * 60 * 60 * 1000; // 1.5 hours

  return {
    start: new Date(nearest.time - SLACK_WINDOW_MS),
    end: new Date(nearest.time + SLACK_WINDOW_MS),
  };
}

export interface TideWindow {
  start: Date;
  end: Date;
}

/**
 * Calculates the optimal tide window based on height thresholds and direction preference.
 *
 * For rising tide beaches: window starts when tide reaches minHeight, ends when it reaches maxHeight.
 * For falling tide beaches: window starts when tide drops to maxHeight, ends when it drops to minHeight.
 *
 * @param options - Configuration for tide window calculation
 * @returns Tide window with start/end times, or null if no valid window
 */
export function calculateTideWindow(
  options: TideWindowOptions
): TideWindow | null {
  const {
    tideSchedule,
    minHeight,
    maxHeight,
    preferredDirection,
    afterTime,
  } = options;

  if (!tideSchedule || tideSchedule.length < 2) return null;

  // Convert TideScheduleEntry to TideDataPoint format (time in ms)
  const tidePoints: TideDataPoint[] = tideSchedule.map((t) => ({
    time: t.time * 1000, // Convert seconds to milliseconds
    height: t.height,
  }));

  const afterTs = normalizeTimestamp(afterTime);

  // For 'either' or 'slack', try both directions and pick first valid
  const directionsToTry: ("rising" | "falling")[] =
    preferredDirection === "either" || preferredDirection === "slack"
      ? ["rising", "falling"]
      : [preferredDirection];

  for (const direction of directionsToTry) {
    // For rising tide: start when tide rises to minHeight, end when it reaches maxHeight
    // For falling tide: start when tide falls to maxHeight, end when it falls to minHeight
    const startHeight = direction === "rising" ? minHeight : maxHeight;
    const endHeight = direction === "rising" ? maxHeight : minHeight;

    const startTime = findTideThresholdCrossing(
      tidePoints,
      startHeight,
      direction,
      afterTs
    );
    if (!startTime) continue;

    const endTime = findTideThresholdCrossing(
      tidePoints,
      endHeight,
      direction,
      startTime
    );
    if (!endTime) continue;

    // Validate window is reasonable (at least 30 minutes)
    if (endTime.getTime() - startTime.getTime() < 30 * 60 * 1000) continue;

    return { start: startTime, end: endTime };
  }

  // Fallback: If threshold crossings failed (tide stays within range),
  // use direction-based window calculation
  const directionWindow = calculateDirectionBasedWindow(
    tideSchedule,
    preferredDirection,
    afterTime
  );

  if (directionWindow) {
    // Validate fallback window is reasonable (at least 30 minutes)
    const duration = directionWindow.end.getTime() - directionWindow.start.getTime();
    if (duration >= 30 * 60 * 1000) {
      return directionWindow;
    }
  }

  return null;
}
