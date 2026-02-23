/**
 * Tide analysis utilities
 *
 * Pure functions for parsing timestamps, interpolating tide heights,
 * and detecting tide phases.
 */

import type { TideData, TideStatus } from "./types";

/**
 * CO-OPS returns timestamps like "YYYY-MM-DD HH:mm" (no timezone suffix).
 * We request `time_zone=gmt` and parse explicitly as UTC to avoid server-local
 * timezone interpretation drift.
 *
 * @param timestamp - CO-OPS timestamp string "YYYY-MM-DD HH:mm"
 * @returns Unix timestamp in seconds (UTC), or null if parsing fails
 */
export function parseCOOPSTimestampToUnixSecondsUTC(
  timestamp: string
): number | null {
  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, datePart, hourPart, minutePart] = match;
  const isoUtc = `${datePart}T${hourPart}:${minutePart}:00Z`;
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Get tide status (rising/falling) for a specific time
 *
 * @param tides - Array of tide data points
 * @param targetTime - Time to check status for
 * @returns "Rising", "Falling", or "Unknown"
 */
export function getTideStatusAtTime(
  tides: TideData[],
  targetTime: Date
): TideStatus {
  if (!tides || tides.length === 0) return "Unknown";

  const targetTimestamp = targetTime.getTime() / 1000;

  // Find the closest tide events (before and after target time)
  const sortedTides = [...tides].sort((a, b) => a.time - b.time);

  let prevTide: TideData | null = null;
  let nextTide: TideData | null = null;

  for (let i = 0; i < sortedTides.length; i++) {
    if (sortedTides[i].time <= targetTimestamp) {
      prevTide = sortedTides[i];
    } else {
      nextTide = sortedTides[i];
      break;
    }
  }

  if (!prevTide && nextTide) {
    return nextTide.type === "high" ? "Rising" : "Falling";
  }

  if (prevTide && !nextTide) {
    return prevTide.type === "high" ? "Falling" : "Rising";
  }

  if (prevTide && nextTide) {
    if (prevTide.type === "high" && nextTide.type === "low") return "Falling";
    if (prevTide.type === "low" && nextTide.type === "high") return "Rising";

    // Same-type adjacency: boundary extrema artifact.
    // An implicit opposite extreme exists between them — use midpoint.
    const midpoint = (prevTide.time + nextTide.time) / 2;
    if (prevTide.type === "high") {
      // Both high → implicit low between. First half: Falling, second half: Rising
      return targetTimestamp <= midpoint ? "Falling" : "Rising";
    }
    // Both low → implicit high between. First half: Rising, second half: Falling
    return targetTimestamp <= midpoint ? "Rising" : "Falling";
  }

  return "Unknown"; // Only reached if no extrema at all
}

/**
 * Get tide height estimate for a specific time using linear interpolation
 *
 * @param tides - Array of tide data points
 * @param targetTime - Time to get height for
 * @returns Estimated tide height in feet, or null if cannot be calculated
 */
export function getTideHeightAtTime(
  tides: TideData[],
  targetTime: Date
): number | null {
  if (!tides || tides.length < 2) return null;

  const targetTimestamp = targetTime.getTime() / 1000;
  const sortedTides = [...tides].sort((a, b) => a.time - b.time);

  // Find surrounding tides
  let prevTide: TideData | null = null;
  let nextTide: TideData | null = null;

  for (let i = 0; i < sortedTides.length; i++) {
    if (sortedTides[i].time <= targetTimestamp) {
      prevTide = sortedTides[i];
    } else {
      nextTide = sortedTides[i];
      break;
    }
  }

  if (!prevTide || !nextTide) return null;

  // Linear interpolation between tides
  const timeDiff = nextTide.time - prevTide.time;
  const timeElapsed = targetTimestamp - prevTide.time;
  const progress = timeElapsed / timeDiff;

  const heightDiff = nextTide.height - prevTide.height;
  const currentHeight = prevTide.height + heightDiff * progress;

  return Math.round(currentHeight * 10) / 10;
}

/**
 * Get current tide height estimate
 *
 * @param tides - Array of tide data points
 * @returns Current estimated tide height in feet, or null
 */
export function getCurrentTideHeight(tides: TideData[]): number | null {
  if (!tides || tides.length < 2) return null;

  const now = Date.now() / 1000;
  return getTideHeightAtTime(tides, new Date(now * 1000));
}

/**
 * Get next tide from current time
 *
 * @param tides - Array of tide data points
 * @returns Next tide data, or null if none found
 */
export function getNextTide(tides: TideData[]): TideData | null {
  if (!tides || tides.length === 0) return null;

  const now = Date.now() / 1000;
  return getNextTideFromTime(tides, new Date(now * 1000));
}

/**
 * Get next tide from a specific time
 *
 * @param tides - Array of tide data points
 * @param targetTime - Time to find next tide after
 * @returns Next tide data, or null if none found
 */
export function getNextTideFromTime(
  tides: TideData[],
  targetTime: Date
): TideData | null {
  if (!tides || tides.length === 0) return null;

  const targetTimestamp = targetTime.getTime() / 1000;
  const sortedTides = [...tides].sort((a, b) => a.time - b.time);

  // Find the next tide after the target time
  for (const tide of sortedTides) {
    if (tide.time > targetTimestamp) {
      return tide;
    }
  }

  return null;
}
