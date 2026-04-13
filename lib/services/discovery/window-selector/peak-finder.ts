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
 * When `now` falls inside the window, past forecast grid points are excluded
 * from peak selection and the interpolated result is clamped to `now` — a
 * still-open window (e.g. 3:00–4:00 PM) can legitimately contain a high-
 * scoring forecast hour that has already passed (3:00 PM at 3:44 PM), and
 * returning that past time makes UI copy contradict itself ("Best time:
 * 3:38 PM" displayed at 3:44 PM). Closed windows are handled with the
 * legacy behavior as a defensive fallback — prepareForecasts in
 * window-selector-core should prevent fully-past windows from reaching
 * this function in the first place.
 *
 * @param windowStart - Start of the window
 * @param windowEnd - End of the window
 * @param forecasts - Array of scored forecasts with forecastTime
 * @param now - Current time; forecasts before `now` are ignored when the
 *              window is still open. Defaults to `new Date()`.
 * @returns Peak time within the window (interpolated for sub-hour precision),
 *          never in the past while the window is still open.
 */
export function findPeakWithinWindow(
  windowStart: Date,
  windowEnd: Date,
  forecasts: Array<{ forecastTime: Date; score: number }>,
  now: Date = new Date()
): Date {
  // "Window still open" means now has not yet reached windowEnd. When the
  // window has entirely passed we fall back to the legacy behavior and
  // ignore `now` — the caller is already dealing with stale data.
  const windowClosed = now.getTime() >= windowEnd.getTime();

  // When the window is still open AND `now` is already past windowStart,
  // only consider forecasts at-or-after `now`. This prevents picking a
  // peak hour that has already elapsed as the "best time to go."
  const effectiveStart =
    !windowClosed && now.getTime() > windowStart.getTime() ? now : windowStart;

  // Find forecasts within the effective window (exclusive end boundary).
  // The window end may be a hard stop (sunset cap), so forecasts AT
  // end time shouldn't be considered "surfable" peaks.
  const windowForecasts = forecasts.filter(
    (f) => f.forecastTime >= effectiveStart && f.forecastTime < windowEnd
  );

  if (windowForecasts.length === 0) {
    // No future forecasts left in an open window → the best available
    // time to go is literally right now. For closed/empty windows, fall
    // back to the window midpoint (legacy behavior).
    if (!windowClosed) {
      return new Date(now.getTime());
    }
    return new Date((windowStart.getTime() + windowEnd.getTime()) / 2);
  }

  // Find the highest scoring forecast within the window
  const peak = windowForecasts.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  // Clamp any returned time to `now` whenever the window is still open —
  // interpolation toward a past neighbor can shift the reported peakTime
  // backward past `now`, which would recreate the same bug this function
  // is guarding against.
  const clampToNow = (candidate: Date): Date => {
    if (!windowClosed && candidate.getTime() < now.getTime()) {
      return new Date(now.getTime());
    }
    return candidate;
  };

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
      return clampToNow(peak.forecastTime);
    }

    // Interpolate toward the higher adjacent score for more precise peak location
    // This shifts the peak time toward whichever neighbor has better conditions
    const prevDiff = peak.score - prev.score;
    const nextDiff = peak.score - next.score;
    const totalDiff = prevDiff + nextDiff;

    if (totalDiff <= 0) {
      // Guard against edge case where peak is lower than neighbors
      return clampToNow(peak.forecastTime);
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

    return clampToNow(new Date(peakTime + shiftMs));
  }

  return clampToNow(peak.forecastTime);
}
