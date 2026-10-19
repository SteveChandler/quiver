/**
 * Interpolation Logic for Magic Hour Finder
 *
 * Provides linear and circular interpolation between 3-hour forecast blocks
 * to find exact optimal surf window times.
 *
 * CRITICAL: Guards against division by zero during slack tide periods.
 *
 * @module magic-hour/interpolation
 */

/**
 * Formats time as "8:30 AM" or "9:00 AM".
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
