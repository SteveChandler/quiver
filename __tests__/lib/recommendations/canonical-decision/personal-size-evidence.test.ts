import { buildCanonicalSessionDecision, canonicalCandidateVerdict } from '@/lib/recommendations/canonical-decision/engine';
import { parseCanonicalSessionDecision } from '@/lib/recommendations/canonical-decision/contract';
import { getCanonicalPersonalCall } from '@/lib/recommendations/canonical-decision/discovery-adapter';
import type { CanonicalDecisionCandidate } from '@/lib/recommendations/canonical-decision/types';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';

// 2026-11-26, user 73040cff: no logged session above 6.0 ft, yet MEH matches stepped an 8.1 ft
// reef down to skip. A MEH above the biggest logged session is not evidence against the day.
const candidate = (
  waveHeight: string, utilityScore: number, label: string, maxLoggedWaveFt?: unknown,
): CanonicalDecisionCandidate => ({
  candidateId: 'windansea', beachId: 'windansea', beachName: 'Windansea', beachSkillLevel: 'intermediate',
  windowStart: '2026-11-26T15:00:00Z', windowEnd: '2026-11-26T18:00:00Z',
  timezone: 'America/Los_Angeles', forecastId: 'row', forecastAt: '2026-11-26T15:00:00Z',
  waveHeight, utilityScore,
  personalMatch: {
    score: 3.4, label, confidence: 'high', sessionCount: 54, similarSessionCount: 6, reasons: [],
    ...(maxLoggedWaveFt !== undefined ? { maxLoggedWaveFt } : {}),
  } as CanonicalDecisionCandidate['personalMatch'],
});
const verdict = (c: CanonicalDecisionCandidate): string => canonicalCandidateVerdict(c, 'expert');

describe('personal step-down needs size evidence', () => {
  it('keeps the physical verdict for a MEH match above the biggest logged session', () => {
    expect(verdict(candidate('8.1 ft', 94, 'MEH', 6))).toBe('go');
    expect(verdict(candidate('8.6 ft', 50, 'MEH', 6))).toBe('maybe');
    // A range counts by its top: 7-9 ft reaches past 8.5 ft.
    expect(verdict(candidate('7-9 ft', 94, 'MEH', 8.5))).toBe('go');
  });

  it('still steps down at or below the biggest logged session', () => {
    expect(verdict(candidate('6 ft', 94, 'MEH', 6))).toBe('maybe');
    expect(verdict(candidate('5.2 ft', 50, 'MEH', 6))).toBe('no');
    expect(verdict(candidate('5-7 ft', 94, 'MEH', 8))).toBe('maybe');
  });

  it('still steps down when the field is absent (migration not applied, old payload)', () => {
    expect(verdict(candidate('8.1 ft', 94, 'MEH'))).toBe('maybe');
    expect(verdict(candidate('8.1 ft', 50, 'MEH'))).toBe('no');
  });

  it('does not change the step up from a GOOD match above the biggest logged session', () => {
    expect(verdict(candidate('8.1 ft', 50, 'GOOD', 6))).toBe('go');
    expect(verdict(candidate('8.1 ft', 20, 'EPIC', 6))).toBe('maybe');
  });

  it.each([['6'], [Number.NaN], [-1], [0], [null], [Number.POSITIVE_INFINITY]])(
    'a malformed max logged wave (%p) does not enter the guard', (bad) => {
      expect(verdict(candidate('8.1 ft', 94, 'MEH', bad))).toBe('maybe');
    });

  it('labels and the decision follow the kept verdict with no new copy', () => {
    const recommendation = (maxLoggedWaveFt?: number): SurfDiscoveryRecommendation => ({
      recommendationId: 'windansea', score: 82,
      beach: { id: 'windansea', name: 'Windansea', skill_level: 'intermediate' },
      window: { start: '2026-11-26T15:00:00Z', end: '2026-11-26T18:00:00Z', timezone: 'America/Los_Angeles' },
      forecast: { id: 'row', beach_id: 'windansea', forecast_at: '2026-11-26T15:00:00Z', wave_height: '8.1 ft' },
      similarity: {
        state: 'ready', score: 3.4, label: 'MEH', bonusApplied: 0, confidence: 'high', reason: '', reasons: [],
        sessionCount: 54, similarSessionCount: 6, ...(maxLoggedWaveFt !== undefined ? { maxLoggedWaveFt } : {}),
      },
    } as unknown as SurfDiscoveryRecommendation);
    expect(getCanonicalPersonalCall(recommendation(6), 'expert')).toEqual({ verdict: 'go', label: 'GOOD' });
    expect(getCanonicalPersonalCall(recommendation(), 'expert')).toEqual({ verdict: 'maybe', label: 'FAIR' });

    const decide = (c: CanonicalDecisionCandidate) => buildCanonicalSessionDecision({
      anchorTime: '2026-11-26T14:00:00Z',
      scope: { kind: 'plan_next_session', windowStart: '2026-11-26T14:00:00Z', windowEnd: '2026-11-27T02:00:00Z', timezone: 'America/Los_Angeles' },
      profileExperience: 'expert', recommendationAvailability: { state: 'available', holdEpoch: 'test' },
      candidates: [{ ...c, beachSkillLevel: 'intermediate' }],
    });
    const kept = decide(candidate('8.1 ft', 82, 'MEH', 6));
    expect(kept).toMatchObject({ verdict: 'go', conditionLabel: 'GOOD' });
    expect(kept).not.toHaveProperty('personalAdjustmentReason');
    expect(kept.selection?.evidence.personalMatch?.maxLoggedWaveFt).toBe(6);
    expect(() => parseCanonicalSessionDecision(kept)).not.toThrow();
    expect(decide(candidate('8.1 ft', 82, 'MEH'))).toMatchObject({
      verdict: 'maybe', conditionLabel: 'FAIR', personalAdjustmentReason: 'personal_adjusted_down',
    });
  });
});
