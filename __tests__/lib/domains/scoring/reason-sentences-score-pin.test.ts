/**
 * The reason sentences change words only. These rows pin the discovery
 * engine's numbers, so a wording change that moves a score, a quality band
 * or a subscore fails here. The values were taken on origin/main 1efb98665.
 */
import { createDiscoveryScoringEngine } from '@/lib/domains/scoring/discovery-adapter';
import { createInput } from '../__fixtures__';

const ROWS = [
  { label: 'below ideal, short period', snapshot: { waveHeight: 1.5, wavePeriod: 7 } },
  { label: 'good size, good period', snapshot: { waveHeight: 3.5, wavePeriod: 12 } },
  { label: 'larger, long period', snapshot: { waveHeight: 6.5, wavePeriod: 16 } },
  { label: 'big, long period', snapshot: { waveHeight: 10, wavePeriod: 15 } },
  { label: 'flat', snapshot: { waveHeight: 0.3, wavePeriod: 9 } },
];

describe('discovery engine scores with reason sentences', () => {
  it('keeps the pinned numbers for fixed rows', () => {
    const engine = createDiscoveryScoringEngine();
    const pinned = ROWS.map(({ label, snapshot }) => {
      const result = engine.score(createInput(snapshot));
      return {
        label,
        total: result.total,
        matchQuality: result.matchQuality,
        skipReason: result.skipReason,
        subscores: Object.fromEntries(result.subscores),
      };
    });
    expect(pinned).toEqual([
      { label: 'below ideal, short period', total: 55, matchQuality: 'good', skipReason: null,
        subscores: { baseConditions: 44, swellAlignment: 100, swellInterference: 50, windQuality: 98, tideFit: 100, tideDirection: 70, windowStability: 50, trendPreference: 50 } },
      { label: 'good size, good period', total: 77, matchQuality: 'excellent', skipReason: null,
        subscores: { baseConditions: 78, swellAlignment: 100, swellInterference: 50, windQuality: 98, tideFit: 100, tideDirection: 70, windowStability: 50, trendPreference: 50 } },
      { label: 'larger, long period', total: 79, matchQuality: 'excellent', skipReason: null,
        subscores: { baseConditions: 86, swellAlignment: 100, swellInterference: 50, windQuality: 98, tideFit: 100, tideDirection: 70, windowStability: 50, trendPreference: 50 } },
      { label: 'big, long period', total: 79, matchQuality: 'excellent', skipReason: null,
        subscores: { baseConditions: 85, swellAlignment: 100, swellInterference: 50, windQuality: 98, tideFit: 100, tideDirection: 70, windowStability: 50, trendPreference: 50 } },
      { label: 'flat', total: 0, matchQuality: 'skip', skipReason: 'Flat conditions - no rideable waves',
        subscores: { baseConditions: 0 } },
    ]);
  });
});
