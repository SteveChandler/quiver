/**
 * Unit tests for findPeakWithinWindow.
 *
 * Regression target: the native home card rendered "Best time: 3:38 PM" at
 * 3:44 PM because this function picked the highest-scoring forecast inside
 * a still-open window without filtering for `forecastTime >= now`. A
 * still-open window (e.g. 3:00–4:00 PM) can legitimately contain a peak
 * whose forecast hour has already passed (3:00 PM), and interpolation can
 * even shift the reported peakTime further backward.
 *
 * The fix: `findPeakWithinWindow(windowStart, windowEnd, forecasts, now)`
 * filters past forecasts, clamps interpolation drift to `now`, and returns
 * `now` when no future forecasts remain inside an open window.
 */

import { findPeakWithinWindow } from '@/lib/services/discovery/window-selector/peak-finder';

// Build hourly forecasts anchored around a base time.
// `scores` is an array of { hourOffset, score } where hourOffset is hours
// from the base time (can be negative).
function makeForecasts(
  baseTime: Date,
  scores: Array<{ hourOffset: number; score: number }>,
): Array<{ forecastTime: Date; score: number }> {
  return scores
    .map(({ hourOffset, score }) => ({
      forecastTime: new Date(baseTime.getTime() + hourOffset * 60 * 60 * 1000),
      score,
    }))
    .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());
}

describe('findPeakWithinWindow', () => {
  // --------------------------------------------------------------------
  // Baseline — existing behavior for future peaks must keep working
  // --------------------------------------------------------------------

  it('returns the highest-scoring forecast when the peak is in the future', () => {
    const now = new Date('2026-04-10T22:00:00Z'); // 3:00pm PT (UTC-7)
    const windowStart = new Date('2026-04-10T23:00:00Z'); // 4:00pm PT
    const windowEnd = new Date('2026-04-11T02:00:00Z'); // 7:00pm PT

    const forecasts = makeForecasts(windowStart, [
      { hourOffset: 0, score: 72 },   // 4pm
      { hourOffset: 1, score: 85 },   // 5pm ← peak
      { hourOffset: 2, score: 75 },   // 6pm
    ]);

    const result = findPeakWithinWindow(windowStart, windowEnd, forecasts, now);

    // With balanced neighbors (diff 72↔75 = 3, < 5), the short-circuit returns
    // the peak hour exactly without interpolation jitter.
    expect(result.getTime()).toBe(forecasts[1].forecastTime.getTime());
  });

  // --------------------------------------------------------------------
  // The core regression — past peak, still-open window
  // --------------------------------------------------------------------

  it('returns `now` when the peak has already passed but the window is still open', () => {
    // 3:44pm, window runs 3:00–4:00pm, only grid point in window is 3:00pm (past).
    const now = new Date('2026-04-10T22:44:00Z');
    const windowStart = new Date('2026-04-10T22:00:00Z'); // 3:00pm
    const windowEnd = new Date('2026-04-10T23:00:00Z');   // 4:00pm

    // Include neighbors OUTSIDE the window to exercise the interpolation
    // fallback path — they shouldn't be picked since they're not in [start,end).
    const forecasts = makeForecasts(windowStart, [
      { hourOffset: -1, score: 60 }, // 2pm (before window)
      { hourOffset: 0, score: 90 },  // 3pm (in window, but PAST relative to now)
      { hourOffset: 1, score: 80 },  // 4pm (after window)
    ]);

    const result = findPeakWithinWindow(windowStart, windowEnd, forecasts, now);

    // Before the fix: returns 3:00pm (44 minutes ago).
    // After the fix: returns `now` because the peak has passed but the
    // window is still open.
    expect(result.getTime()).toBe(now.getTime());
  });

  it('returns `now` when the only future forecasts in the window are exactly at now', () => {
    const now = new Date('2026-04-10T22:44:00Z');
    const windowStart = new Date('2026-04-10T22:00:00Z');
    const windowEnd = new Date('2026-04-10T23:00:00Z');

    // All forecasts inside the window are in the past relative to `now`.
    const forecasts = makeForecasts(windowStart, [
      { hourOffset: 0, score: 90 }, // 3pm ← past
    ]);

    const result = findPeakWithinWindow(windowStart, windowEnd, forecasts, now);
    expect(result.getTime()).toBe(now.getTime());
  });

  // --------------------------------------------------------------------
  // Interpolation drift clamp — the sneaky case
  // --------------------------------------------------------------------

  it('clamps interpolated peakTime to `now` when interpolation would drift into the past', () => {
    // The first future forecast is the peak, but its PREV neighbor in the
    // full array is in the past and scores higher than its NEXT neighbor.
    // The existing interpolation would shift the reported peakTime backward
    // toward `prev`, potentially landing before `now`. The fix must clamp.
    const now = new Date('2026-04-10T22:30:00Z'); // 3:30pm
    const windowStart = new Date('2026-04-10T22:30:00Z');
    const windowEnd = new Date('2026-04-11T00:30:00Z'); // 5:30pm

    // forecasts span -1h..+2h around now, with the peak at now+0 but a
    // highly-scoring past neighbor at now-1h that would pull interpolation
    // backward by ~30min without clamping.
    const forecasts = makeForecasts(now, [
      { hourOffset: -1, score: 100 }, // 2:30pm — past, very high score
      { hourOffset: 0, score: 90 },   // 3:30pm — first in-window peak
      { hourOffset: 1, score: 20 },   // 4:30pm
      { hourOffset: 2, score: 10 },   // 5:30pm (at window end, excluded)
    ]);

    const result = findPeakWithinWindow(windowStart, windowEnd, forecasts, now);

    // The returned time must never be before `now`.
    expect(result.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  // --------------------------------------------------------------------
  // Edge case — window already ended (prepareForecasts should filter these
  // out upstream, but be defensive)
  // --------------------------------------------------------------------

  it('returns the historical peak when the window has entirely ended', () => {
    // prepareForecasts in window-selector-core should filter past windows
    // out before we get here. If one slips through, don't pretend "now" is
    // the best time — the window is already over. Return the real peak.
    const now = new Date('2026-04-11T00:00:00Z');         // 5:00pm
    const windowStart = new Date('2026-04-10T22:00:00Z'); // 3:00pm
    const windowEnd = new Date('2026-04-10T23:00:00Z');   // 4:00pm — past

    const forecasts = makeForecasts(windowStart, [
      { hourOffset: 0, score: 90 }, // 3pm
    ]);

    const result = findPeakWithinWindow(windowStart, windowEnd, forecasts, now);
    // Single forecast = no interpolation, returns the forecast time as-is.
    expect(result.getTime()).toBe(forecasts[0].forecastTime.getTime());
  });

  it('returns the window midpoint as a last resort when the window is empty AND closed', () => {
    // Degenerate case: window has no forecasts at all AND has already ended.
    // Fall through to the midpoint fallback (existing behavior).
    const now = new Date('2026-04-11T00:00:00Z');         // 5:00pm
    const windowStart = new Date('2026-04-10T22:00:00Z'); // 3:00pm
    const windowEnd = new Date('2026-04-10T23:00:00Z');   // 4:00pm

    // Forecasts exist but none within the window.
    const forecasts = makeForecasts(new Date('2026-04-10T20:00:00Z'), [
      { hourOffset: 0, score: 80 }, // 1pm — outside window
      { hourOffset: 5, score: 80 }, // 6pm — outside window
    ]);

    const result = findPeakWithinWindow(windowStart, windowEnd, forecasts, now);
    const expectedMidpoint = (windowStart.getTime() + windowEnd.getTime()) / 2;
    expect(result.getTime()).toBe(expectedMidpoint);
  });

  // --------------------------------------------------------------------
  // Back-compat — default `now` argument
  // --------------------------------------------------------------------

  it('accepts a default `now` when not explicitly passed', () => {
    // Call signature back-compat: existing callers without `now` should
    // still work (default to new Date()).
    const realNow = new Date();
    const windowStart = new Date(realNow.getTime() + 60 * 60 * 1000); // 1h future
    const windowEnd = new Date(realNow.getTime() + 3 * 60 * 60 * 1000); // 3h future

    const forecasts = makeForecasts(windowStart, [
      { hourOffset: 0, score: 80 },
      { hourOffset: 1, score: 90 }, // peak
      { hourOffset: 2, score: 85 },
    ]);

    // No `now` argument — must not throw, must return a valid Date.
    const result = findPeakWithinWindow(windowStart, windowEnd, forecasts);
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });
});
