import { getConditionCharacter } from '@/lib/domains/scoring/condition-character';
import { createDiscoveryScoringEngine } from '@/lib/domains/scoring/discovery-adapter';
import { LOW_TIDE_HEAVY_SWELL_WARNING } from '@/lib/domains/scoring/scorers/setup-risk-scorer';
import { createProfile, createSnapshot } from '../__fixtures__';

it('preserves the closeout/tide cause through classification without changing the score', () => {
  const profile = createProfile({ breakType: 'beach' });
  const snapshot = createSnapshot({ waveHeight: 7, wavePeriod: 12,
    wind: { speedMph: 2, directionDeg: 90 },
    tide: { heightFt: -1, status: 'falling', direction: 'falling' } });
  const composite = createDiscoveryScoringEngine().score({ profile, snapshot, window: null, preferences: null });
  expect(composite.skipReason).toBe(LOW_TIDE_HEAVY_SWELL_WARNING);
  const originalScore = composite.total;
  expect(getConditionCharacter(snapshot, profile, composite)).toEqual({ category: 'skip', label: LOW_TIDE_HEAVY_SWELL_WARNING });
  expect(composite.total).toBe(originalScore);
  expect(composite.subscores.has('setupRisk')).toBe(true);
});
