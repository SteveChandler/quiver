import { canonicalCandidateVerdict } from '@/lib/recommendations/canonical-decision/engine';
import type { CanonicalDecisionCandidate } from '@/lib/recommendations/canonical-decision/types';

const candidate = (score: number, label: string, count = 5, confidence = 'high'): CanonicalDecisionCandidate => ({
  candidateId: 'ponto', beachId: 'ponto', beachName: 'Ponto', beachSkillLevel: 'intermediate',
  windowStart: '2026-09-23T12:00:00Z', windowEnd: '2026-09-23T15:00:00Z',
  timezone: 'America/Los_Angeles', forecastId: 'row', forecastAt: '2026-09-23T12:00:00Z',
  waveHeight: '3.7 ft', utilityScore: score,
  personalMatch: { score: 6.4, label, confidence, sessionCount: 39, similarSessionCount: count, reasons: [] } as CanonicalDecisionCandidate['personalMatch'],
});

it.each([
  [94, 'FAIR', 5, 'high', 'go'], [94, 'RIDEABLE', 5, 'high', 'go'],
  [94, 'MEH', 5, 'high', 'maybe'], [50, 'MEH', 5, 'high', 'no'],
  [50, 'GOOD', 5, 'high', 'go'], [20, 'EPIC', 5, 'high', 'maybe'],
  [50, 'GOOD', 4, 'high', 'maybe'], [50, 'GOOD', 5, 'medium', 'maybe'],
])('physical %s with %s (%s/%s) gives %s', (score, label, count, confidence, verdict) => {
  expect(canonicalCandidateVerdict(candidate(Number(score), String(label), Number(count), String(confidence)), 'advanced')).toBe(verdict);
});
it('keeps safety maxima and physical ceilings', () => {
  expect(canonicalCandidateVerdict({ ...candidate(50, 'EPIC'), waveHeight: '25 ft' }, 'advanced')).toBe('no');
  expect(canonicalCandidateVerdict({ ...candidate(50, 'EPIC'), effects: [{ code: 'ceiling', severity: 'severe', verdictCeiling: 60, message: 'Crossing swells' }] }, 'advanced')).toBe('maybe');
});
