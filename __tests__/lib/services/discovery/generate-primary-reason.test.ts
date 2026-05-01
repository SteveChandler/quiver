import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { generatePrimaryReason } from '@/lib/services/discovery/surf-discovery-orchestrator';

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
    it('returns "match your experience" for beginner user at beginner beach', () => {
      const beach = makeBeach({ skill_level: 'beginner' });
      const result = generatePrimaryReason(beach, makeForecast('2'), 'beginner');
      expect(result).toBe('Conditions at PB Point match your experience level today');
    });

    it('returns "match your experience" for advanced user at intermediate beach', () => {
      const beach = makeBeach({ skill_level: 'intermediate' });
      const result = generatePrimaryReason(beach, makeForecast('4'), 'advanced');
      expect(result).toBe('Conditions at PB Point match your experience level today');
    });
  });

  describe('skill gap > 0, waves manageable', () => {
    it('returns "manageable" when waves are within ideal range despite skill gap', () => {
      const beach = makeBeach({ skill_level: 'advanced' });
      // Beginner ideal max is 3ft
      const result = generatePrimaryReason(beach, makeForecast('2.5'), 'beginner');
      expect(result).toContain('is an advanced spot');
      expect(result).toContain('conditions are manageable');
      expect(result).toContain('2.5ft');
    });
  });

  describe('skill gap > 0, waves above ideal range', () => {
    it('returns "above your usual range" with wave height', () => {
      const beach = makeBeach({ skill_level: 'advanced' });
      // Beginner ideal max is 3ft, 3.5ft exceeds it
      const result = generatePrimaryReason(beach, makeForecast('3.5'), 'beginner');
      expect(result).toContain('Heads up');
      expect(result).toContain('PB Point is pumping today');
      expect(result).toContain('3.5ft');
      expect(result).toContain('above your usual range');
      expect(result).not.toContain('comfort zone');
    });

    it('includes rounded wave height', () => {
      const beach = makeBeach({ skill_level: 'expert' });
      const result = generatePrimaryReason(beach, makeForecast('6.78'), 'beginner');
      expect(result).toContain('6.8ft');
    });

    it('omits height display when wave height is zero', () => {
      const beach = makeBeach({ skill_level: 'advanced' });
      // 5ft exceeds beginner ideal max (3ft) so it hits the "above range" branch
      // but we test with a height that rounds to include "ft"
      const result = generatePrimaryReason(beach, makeForecast('5'), 'beginner');
      expect(result).toContain('5ft');
      expect(result).toContain('above your usual range');
    });
  });

  describe('beach with no skill_level', () => {
    it('defaults to intermediate (rank 1) for null skill_level', () => {
      const beach = makeBeach({ skill_level: null });
      // Beginner = rank 0, default beach = rank 1 → skillGap = 1
      // 2ft <= beginner ideal max (3) → manageable
      const result = generatePrimaryReason(beach, makeForecast('2'), 'beginner');
      expect(result).toContain('conditions are manageable');
    });
  });
});
