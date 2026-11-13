import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { generatePrimaryReason, primaryReasonWithCode } from '@/lib/services/discovery/surf-discovery-orchestrator';

// `skill_level` is widened to allow null because the orchestrator defends
// against null at runtime even though Beach.Row pins it to `string`.
type MakeBeachOverrides = Partial<Omit<Beach, 'skill_level'>> & {
  skill_level?: string | null;
};

const makeBeach = (overrides: MakeBeachOverrides = {}): Beach =>
  ({
    id: 'beach-1',
    name: 'PB Point',
    slug: 'pb-point',
    city: 'San Diego',
    state: 'CA',
    skill_level: 'intermediate',
    ...overrides,
  }) as Beach;

const makeForecast = (waveHeight: string): EnhancedForecastEntity =>
  ({
    beach_id: 'beach-1',
    forecast_at: '2026-04-09T14:00:00Z',
    wave_height: waveHeight,
    wave_period: '13s',
    wind_speed: '5',
  }) as EnhancedForecastEntity;

describe('generatePrimaryReason', () => {
  it('returns null when userSkillLevel is null', () => {
    expect(generatePrimaryReason(makeBeach(), makeForecast('3'), null)).toBeNull();
  });

  describe('skill gap <= 0 (beach matches or is easier than user)', () => {
    // Steven, Nov 12 2026: no line names the surfer's level. The size sentence says it.
    it.each([
      ['beginner beach, beginner, 2 ft', 'beginner', '2', 'beginner'],
      ['beginner-intermediate beach, beginner, 2 ft', 'beginner-intermediate', '2', 'beginner'],
      ['intermediate beach, advanced, 4 ft', 'intermediate', '4', 'advanced'],
      ['flat (0.5ft) for a beginner', 'beginner', '0.5', 'beginner'],
      ['missing wave height for a beginner', 'beginner', '', 'beginner'],
      ['too big (5ft) for a beginner', 'beginner', '5', 'beginner'],
      ['too small (2ft) for an advanced surfer', 'beginner', '2', 'advanced'],
    ] as const)('sends no primary line: %s', (_label, beachSkill, height, skill) => {
      const beach = makeBeach({ skill_level: beachSkill });
      expect(generatePrimaryReason(beach, makeForecast(height), skill)).toBeNull();
    });
  });

  describe('skill gap > 0, waves manageable', () => {
    it.each([
      ['lower-intermediate', 'an intermediate'],
      ['intermediate-advanced', 'an advanced'],
    ])('names a %s beach as %s break on a mellow day', (skillLevel, phrase) => {
      const beach = makeBeach({ skill_level: skillLevel });
      const result = primaryReasonWithCode(beach, makeForecast('2.5'), 'beginner');
      expect(result).toEqual({ text: `PB Point is ${phrase} break, but it's mellow today at 2–3 ft.`, code: 'break_mellow' });
    });
  });

  describe('skill gap > 0, waves above ideal range', () => {
    it.each([
      ['advanced', '3.5', 'Heads up: PB Point is pumping at 3–4 ft.'],
      ['expert', '6.78', 'Heads up: PB Point is pumping at 6–7 ft.'],
      ['advanced', '5', 'Heads up: PB Point is pumping at 4–5 ft.'],
      ['expert', '12.4', 'Heads up: big, powerful surf at 12–13 ft.'],
    ] as const)('a %s beach at %s ft reads "%s" (caution)', (beachSkill, height, text) => {
      const beach = makeBeach({ skill_level: beachSkill });
      const result = primaryReasonWithCode(beach, makeForecast(height), 'beginner');
      expect(result).toEqual({ text, code: 'caution_big_surf' });
      expect(result?.text).not.toMatch(/your usual range|ft waves/);
    });
  });

  describe('beach with no skill_level', () => {
    it('sends no mellow-break line for a null skill_level: it cannot name the break level', () => {
      const beach = makeBeach({ skill_level: null });
      // Beginner = rank 0, default beach = rank 1 → skillGap = 1; 2ft is manageable.
      // The old line called an unknown break "advanced", a claim no data backs.
      expect(generatePrimaryReason(beach, makeForecast('2'), 'beginner')).toBeNull();
    });

    it('still warns on big surf at a beach with a null skill_level', () => {
      const beach = makeBeach({ skill_level: null });
      expect(generatePrimaryReason(beach, makeForecast('6.4'), 'beginner')).toBe('Heads up: PB Point is pumping at 6–7 ft.');
    });
  });
});
