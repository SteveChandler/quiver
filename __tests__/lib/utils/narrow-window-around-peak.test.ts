/**
 * @jest-environment node
 *
 * Fix 2 unit tests — narrow the "best window" to ±1h around peak on MAYBE.
 * A pure function with no external dependencies.
 */

import { narrowWindowAroundPeak } from '@/lib/utils/surf-call-logic';

describe('narrowWindowAroundPeak', () => {
  it('narrows to peakTime ± 1h when the peak sits mid-window', () => {
    const peak = new Date('2026-04-20T18:00:00Z'); // 11:00 AM PT
    const windowStart = new Date('2026-04-20T15:32:00Z');
    const windowEnd = new Date('2026-04-21T02:23:00Z');
    const out = narrowWindowAroundPeak(peak, windowStart, windowEnd);
    expect(out.start.toISOString()).toBe('2026-04-20T17:00:00.000Z');
    expect(out.end.toISOString()).toBe('2026-04-20T19:00:00.000Z');
  });

  it('clamps start to windowStart when peak - 1h is before the window opens', () => {
    const peak = new Date('2026-04-20T15:45:00Z');
    const windowStart = new Date('2026-04-20T15:30:00Z');
    const windowEnd = new Date('2026-04-20T18:00:00Z');
    const out = narrowWindowAroundPeak(peak, windowStart, windowEnd);
    expect(out.start.toISOString()).toBe(windowStart.toISOString());
  });

  it('clamps end to windowEnd when peak + 1h is past the window close', () => {
    const peak = new Date('2026-04-20T17:45:00Z');
    const windowStart = new Date('2026-04-20T15:00:00Z');
    const windowEnd = new Date('2026-04-20T18:00:00Z');
    const out = narrowWindowAroundPeak(peak, windowStart, windowEnd);
    expect(out.end.toISOString()).toBe(windowEnd.toISOString());
  });

  it('produces a 2-hour span when the peak has full headroom on both sides', () => {
    const peak = new Date('2026-04-20T18:00:00Z');
    const windowStart = new Date('2026-04-20T12:00:00Z');
    const windowEnd = new Date('2026-04-21T00:00:00Z');
    const out = narrowWindowAroundPeak(peak, windowStart, windowEnd);
    const spanMs = out.end.getTime() - out.start.getTime();
    expect(spanMs).toBe(2 * 60 * 60 * 1000);
  });

  it('never returns an inverted interval when peak falls outside the window', () => {
    // Defensive: upstream scoring could produce a peakTime outside
    // [windowStart, windowEnd] (clock skew, regression in selectBestWindow).
    // The naive clamp would produce end < start. Guard returns a
    // well-ordered zero-span interval at the nearest bound instead.
    const windowStart = new Date('2026-04-20T15:00:00Z');
    const windowEnd = new Date('2026-04-20T18:00:00Z');

    const peakBefore = new Date('2026-04-20T13:00:00Z');
    const outBefore = narrowWindowAroundPeak(peakBefore, windowStart, windowEnd);
    expect(outBefore.end.getTime()).toBeGreaterThanOrEqual(outBefore.start.getTime());

    const peakAfter = new Date('2026-04-20T20:00:00Z');
    const outAfter = narrowWindowAroundPeak(peakAfter, windowStart, windowEnd);
    expect(outAfter.end.getTime()).toBeGreaterThanOrEqual(outAfter.start.getTime());
  });
});
