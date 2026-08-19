/**
 * Tests for the dev-only _forceVerdict override applied to surf call results.
 *
 * This exists so we can exercise YES / MAYBE / NO branches in sim and web
 * without waiting for real-world conditions to produce each verdict.
 */

import { applyForceVerdict } from '@/lib/utils/dev-force-verdict';
import type { SpotSurfReportResult } from '@/lib/services/spot-surf-report-service';
import type { SurfCallResult } from '@/lib/utils/surf-call-logic';
import type { RecommendationAvailability } from '@/lib/recommendations/major-event-hold/types';

type HoldAwareSurfCallResult = SurfCallResult & {
  recommendationAvailability: RecommendationAvailability;
};

function makeResult(
  overrides: Partial<HoldAwareSurfCallResult> = {},
): SpotSurfReportResult {
  const report: HoldAwareSurfCallResult = {
    verdict: 'YES',
    bestWindowStart: '2026-04-20T08:32:00-07:00',
    bestWindowEnd: '2026-04-20T19:23:00-07:00',
    windowMinutes: 651,
    shortWindow: false,
    waveHeight: '1.5-2.5ft',
    windDescription: 'W 10 mph onshore',
    windSpeed: '10',
    windCompass: 'W',
    windType: 'onshore',
    tideDescription: 'Falling',
    tidePhase: 'falling',
    tideHeight: '1.4',
    nextTideType: 'low',
    nextTideAt: '2026-04-20T17:00:00-07:00',
    whySentence: 'Small for this break but conditions look fun.',
    forecastConfidence: 0.8,
    lowForecastConfidence: false,
    score: 62,
    peakTime: '2026-04-20T11:00:00-07:00',
    trendTags: [],
    updatedAt: '2026-04-20T13:52:00Z',
    isCalibrated: true,
    rideableWavesPerHour: 14,
    dominantBeatIntervalS: 8,
    recommendationAvailability: {
      state: 'available',
      holdEpoch: 'dev-force-test-epoch',
    },
    ...overrides,
  };
  return { report, isTomorrow: false, forecastContext: null };
}

describe('applyForceVerdict', () => {
  it('returns result unchanged when forceVerdict is null', () => {
    const result = makeResult({ verdict: 'YES' });
    const out = applyForceVerdict(result, null, true);
    expect(out).toBe(result);
  });

  it('returns result unchanged when isDev is false (production guard)', () => {
    const result = makeResult({ verdict: 'YES' });
    const out = applyForceVerdict(result, 'MAYBE', false);
    expect(out).toBe(result);
    expect(out?.report.verdict).toBe('YES');
  });

  it('returns result unchanged when forceVerdict is an invalid value', () => {
    const result = makeResult({ verdict: 'YES' });
    const out = applyForceVerdict(result, 'GOOD', true);
    expect(out).toBe(result);
    expect(out?.report.verdict).toBe('YES');
  });

  it('returns null when the underlying result is null', () => {
    const out = applyForceVerdict(null, 'MAYBE', true);
    expect(out).toBeNull();
  });

  it('overrides verdict to YES when forceVerdict="YES" and isDev is true', () => {
    const result = makeResult({ verdict: 'NO' });
    const out = applyForceVerdict(result, 'YES', true);
    expect(out?.report.verdict).toBe('YES');
  });

  it('overrides verdict to MAYBE when forceVerdict="MAYBE" and isDev is true', () => {
    const result = makeResult({ verdict: 'YES' });
    const out = applyForceVerdict(result, 'MAYBE', true);
    expect(out?.report.verdict).toBe('MAYBE');
  });

  it('overrides verdict to NO when forceVerdict="NO" and isDev is true', () => {
    const result = makeResult({ verdict: 'YES' });
    const out = applyForceVerdict(result, 'NO', true);
    expect(out?.report.verdict).toBe('NO');
  });

  it('preserves non-window report fields when verdict is forced', () => {
    const result = makeResult({ verdict: 'YES' });
    const out = applyForceVerdict(result, 'MAYBE', true);
    expect(out?.report.peakTime).toBe(result.report.peakTime);
    expect(out?.report.waveHeight).toBe(result.report.waveHeight);
    expect(out?.report.score).toBe(result.report.score);
    expect(out?.report.whySentence).toBe(result.report.whySentence);
  });

  it('narrows bestWindow to peakTime ± 1h when forced to MAYBE', () => {
    // peakTime 2026-04-20T11:00 local (-07:00) = 18:00Z
    const result = makeResult({
      verdict: 'YES',
      peakTime: '2026-04-20T18:00:00.000Z',
      bestWindowStart: '2026-04-20T15:32:00.000Z',
      bestWindowEnd: '2026-04-21T02:23:00.000Z',
    });
    const out = applyForceVerdict(result, 'MAYBE', true);
    expect(out?.report.bestWindowStart).toBe('2026-04-20T17:00:00.000Z');
    expect(out?.report.bestWindowEnd).toBe('2026-04-20T19:00:00.000Z');
  });

  it('nulls bestWindowStart + bestWindowEnd when forced to NO', () => {
    const result = makeResult({ verdict: 'YES' });
    const out = applyForceVerdict(result, 'NO', true);
    expect(out?.report.bestWindowStart).toBeNull();
    expect(out?.report.bestWindowEnd).toBeNull();
  });

  it('leaves bestWindow untouched when forced to YES', () => {
    const result = makeResult({ verdict: 'MAYBE' });
    const out = applyForceVerdict(result, 'YES', true);
    expect(out?.report.bestWindowStart).toBe(result.report.bestWindowStart);
    expect(out?.report.bestWindowEnd).toBe(result.report.bestWindowEnd);
  });

  it('preserves isTomorrow flag when verdict is forced', () => {
    const result: SpotSurfReportResult = { ...makeResult(), isTomorrow: true };
    const out = applyForceVerdict(result, 'NO', true);
    expect(out?.isTomorrow).toBe(true);
  });

  it('does not mutate the input result', () => {
    const result = makeResult({ verdict: 'YES' });
    applyForceVerdict(result, 'NO', true);
    expect(result.report.verdict).toBe('YES');
  });

  it('does not invent a window or positive verdict when forcing MAYBE without an exact window', () => {
    const result = makeResult({
      verdict: 'NO',
      bestWindowStart: null,
      bestWindowEnd: null,
      peakTime: '2026-04-20T18:00:00.000Z',
    });
    const out = applyForceVerdict(result, 'MAYBE', true);
    expect(out?.report.verdict).toBe('NO');
    expect(out?.report.bestWindowStart).toBeNull();
    expect(out?.report.bestWindowEnd).toBeNull();
  });

  it('leaves bestWindow null when forcing MAYBE on a NO result with no peakTime', () => {
    // Defensive: if both windows and peakTime are null, we have nothing to
    // synthesize from. Don't invent data — surface null so the UI hides the row.
    const result = makeResult({
      verdict: 'NO',
      bestWindowStart: null,
      bestWindowEnd: null,
      peakTime: null,
    });
    const out = applyForceVerdict(result, 'MAYBE', true);
    expect(out?.report.verdict).toBe('NO');
    expect(out?.report.bestWindowStart).toBeNull();
    expect(out?.report.bestWindowEnd).toBeNull();
  });

  it.each(['YES', 'MAYBE'] as const)(
    'cannot force %s when hold availability is none',
    (verdict) => {
      const result = makeResult({
        verdict: 'NO',
        bestWindowStart: null,
        bestWindowEnd: null,
        recommendationAvailability: {
          state: 'none',
          reasonCode: 'major_event_hold',
          holdEpoch: 'blocked-epoch',
        },
      });

      const out = applyForceVerdict(result, verdict, true);

      expect(out).toBe(result);
      expect(out?.report.verdict).toBe('NO');
      expect(out?.report.bestWindowStart).toBeNull();
      expect(out?.report.bestWindowEnd).toBeNull();
    },
  );
});
