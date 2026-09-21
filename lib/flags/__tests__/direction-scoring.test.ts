import {
  DIRECTION_SCORING_EXCLUDED_SLUGS,
  isDirectionScoringEnabledForBeach,
} from '@/lib/flags/direction-scoring';

describe('direction scoring flag', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DIRECTION_SCORING_ENABLED;
    delete process.env.DIRECTION_SCORING_ALLOWED_SLUGS;
    delete process.env.DIRECTION_SCORING_EXCLUDED_SLUGS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('requires the exact true flag and calibrated data', () => {
    const beach = { slug: 'church', shoaling_factors: {} };
    expect(isDirectionScoringEnabledForBeach(beach)).toBe(false);
    process.env.DIRECTION_SCORING_ENABLED = 'true';
    expect(isDirectionScoringEnabledForBeach(beach)).toBe(true);
    expect(isDirectionScoringEnabledForBeach({ ...beach, shoaling_factors: null })).toBe(false);
  });

  it('supports allow and exclusion lists', () => {
    process.env.DIRECTION_SCORING_ENABLED = 'true';
    expect(isDirectionScoringEnabledForBeach({ slug: 'avalanche', shoaling_factors: {} })).toBe(false);
    expect(DIRECTION_SCORING_EXCLUDED_SLUGS.has('imperial-beach-pier')).toBe(true);
    process.env.DIRECTION_SCORING_ALLOWED_SLUGS = 'church, cottons';
    expect(isDirectionScoringEnabledForBeach({ slug: 'church', shoaling_factors: {} })).toBe(true);
    expect(isDirectionScoringEnabledForBeach({ slug: 'cottons', shoaling_factors: {} })).toBe(true);
    expect(isDirectionScoringEnabledForBeach({ slug: 'scripps', shoaling_factors: {} })).toBe(false);
  });
});
