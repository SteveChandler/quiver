/**
 * Peak Finder
 *
 * Functions for finding peak scoring times within windows using interpolation.
 *
 * @module lib/services/discovery/window-selector/peak-finder
 */

/**
 * Find the peak scoring time within a window for sub-hour precision.
 *
 * This mirrors the approach used by magic-hour-finder.ts to produce consistent
 * sub-hour times between beach detail and discovery/home screens.
 *
 * @param windowStart - Start of the window
 * @param windowEnd - End of the window
 * @param forecasts - Array of scored forecasts with forecastTime
 * @returns Peak time within the window (interpolated for sub-hour precision)
 */
export function findPeakWithinWindow(
  windowStart: Date,
  windowEnd: Date,
  forecasts: Array<{ forecastTime: Date; score: number }>
): Date {
  // Find forecasts within the window (exclusive end boundary).
  // The window end may be a hard stop (sunset cap), so forecasts AT
  // end time shouldn't be considered "surfable" peaks.
  const windowForecasts = forecasts.filter(
    (f) => f.forecastTime >= windowStart && f.forecastTime < windowEnd
  );

  if (windowForecasts.length === 0) {
    // Fallback to window midpoint
    return new Date((windowStart.getTime() + windowEnd.getTime()) / 2);
  }

  // Find the highest scoring forecast within the window
  const peak = windowForecasts.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  // Find peak's position in the full forecast array for interpolation context
  const peakIdx = forecasts.findIndex(
    (f) => f.forecastTime.getTime() === peak.forecastTime.getTime()
  );

  // If we have adjacent forecasts, interpolate for sub-hour precision
  if (peakIdx > 0 && peakIdx < forecasts.length - 1) {
    const prev = forecasts[peakIdx - 1];
    const next = forecasts[peakIdx + 1];

    // If adjacent scores are very similar (within 5 points), use the peak time as-is
    // This prevents unnecessary jitter when conditions are stable
    if (Math.abs(prev.score - next.score) < 5) {
      return peak.forecastTime;
    }

    // Interpolate toward the higher adjacent score for more precise peak location
    // This shifts the peak time toward whichever neighbor has better conditions
    const prevDiff = peak.score - prev.score;
    const nextDiff = peak.score - next.score;
    const totalDiff = prevDiff + nextDiff;

    if (totalDiff <= 0) {
      // Guard against edge case where peak is lower than neighbors
      return peak.forecastTime;
    }

    // Ratio > 0.5 means next has better conditions, shift toward next
    // Ratio < 0.5 means prev has better conditions, shift toward prev
    const ratio = prevDiff / totalDiff;

    const prevTime = prev.forecastTime.getTime();
    const peakTime = peak.forecastTime.getTime();
    const nextTime = next.forecastTime.getTime();

    // Calculate shift: positive shifts toward next, negative toward prev
    // Scale by half the distance to the neighbor (max 30 min shift)
    let shiftMs: number;
    if (ratio > 0.5) {
      // Shift toward next (conditions improving after peak hour)
      shiftMs = (ratio - 0.5) * (nextTime - peakTime);
    } else {
      // Shift toward prev (conditions were better before peak hour)
      shiftMs = (ratio - 0.5) * (peakTime - prevTime);
    }

    // Clamp shift to ±30 minutes to prevent excessive movement
    const maxShiftMs = 30 * 60 * 1000;
    shiftMs = Math.max(-maxShiftMs, Math.min(maxShiftMs, shiftMs));

    return new Date(peakTime + shiftMs);
  }

  return peak.forecastTime;
}
