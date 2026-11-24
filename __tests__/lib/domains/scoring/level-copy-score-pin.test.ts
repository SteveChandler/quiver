/**
 * The level copy changes words only. These rows pin the discovery score
 * (engine + skill adjustment) on rows that hit the new warnings: over the
 * range, an advanced break, small surf, a missing height. The values were
 * taken on origin/main before this branch.
 */
import { createDiscoveryScoringEngine, scoreBeachWithEngine } from '@/lib/domains/scoring/discovery-adapter';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { createBeach, createForecast } from '../__fixtures__';

const ROWS: ReadonlyArray<[string, string, string | null, SkillLevel]> = [
  ['5.2', '12s', 'beginner', 'beginner'],
  ['8.5', '14s', 'intermediate', 'beginner'],
  ['13.0', '16s', 'advanced', 'intermediate'],
  ['5.5', '12s', 'expert', 'beginner'],
  ['1.5', '9s', 'beginner', 'advanced'],
  ['2.5', '10s', 'intermediate', 'advanced'],
  ['', '12s', 'advanced', 'beginner'],
  ['2.2', '11s', null, 'beginner'],
];

describe('discovery scores on rows with the new level-free lines', () => {
  it('keeps the pinned totals and match quality', () => {
    const engine = createDiscoveryScoringEngine();
    const pinned = ROWS.map(([waveHeight, wavePeriod, beachSkill, userSkill]) => {
      const beach = createBeach({ skill_level: beachSkill } as Partial<Beach>) as Beach;
      const forecast = createForecast({
        wave_height: waveHeight,
        wave_period: wavePeriod,
        swell_1_height: waveHeight,
        swell_1_period: wavePeriod,
      } as Partial<EnhancedForecastEntity>) as EnhancedForecastEntity;
      const score = scoreBeachWithEngine(engine, beach, forecast, { userSkillLevel: userSkill, beachSkillLevel: beachSkill });
      return [score.total, score.matchQuality];
    });
    expect(pinned).toEqual([
      [78, 'perfect'],
      [50, 'perfect'],
      [31, 'perfect'],
      [75, 'perfect'],
      [42, 'good'],
      [72, 'excellent'],
      [0, 'fair'],
      [76, 'excellent'],
    ]);
  });
});
