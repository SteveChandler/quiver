/**
 * Unit tests for pre-forecast candidate-pool preference fit.
 *
 * Pool ordering is expressed in "effective miles" — real distance minus the
 * detour a preference match earns. These tests pin the two properties that
 * matter: preference decides between comparably-distant spots, and it can never
 * buy more than the detour budget.
 */

import {
  effectiveDistanceMiles,
  preferenceFit,
  PREFERENCE_DETOUR_BUDGET_MILES,
  type PoolFitBeach,
  type PoolPreferenceProfile,
} from '@/lib/services/discovery/candidate-pool-fit';

const EMPTY_PROFILE: PoolPreferenceProfile = {
  skillLevel: null,
  surfStyles: [],
};

const SHORTBOARD_INTERMEDIATE: PoolPreferenceProfile = {
  skillLevel: 'intermediate',
  surfStyles: ['shortboard'],
};

function beach(overrides: PoolFitBeach = {}): PoolFitBeach {
  return {
    skill_level: null,
    break_type: null,
    average_rating: null,
    ...overrides,
  };
}

describe('preferenceFit', () => {
  it('ignores skill and style entirely when the profile is empty', () => {
    // Same (unrated) spot, opposite skill/break profiles: an empty profile must
    // not distinguish them, so a preference-less user keeps distance ordering.
    const expertReef = beach({ skill_level: 'expert', break_type: 'reef' });
    const beginnerBeach = beach({ skill_level: 'beginner', break_type: 'beach' });

    expect(preferenceFit(expertReef, EMPTY_PROFILE)).toBeCloseTo(0.5, 5);
    expect(preferenceFit(beginnerBeach, EMPTY_PROFILE)).toBeCloseTo(0.5, 5);
  });

  it('is fully neutral for a beach with no static data', () => {
    expect(preferenceFit(beach(), SHORTBOARD_INTERMEDIATE)).toBeCloseTo(0.5, 5);
  });

  it('scores a matching skill + style + quality spot above a mismatched one', () => {
    const match = beach({
      skill_level: 'intermediate',
      break_type: 'reef',
      average_rating: 4.6,
    });
    const mismatch = beach({
      skill_level: 'expert',
      break_type: 'pier',
      average_rating: 3.1,
    });

    expect(preferenceFit(match, SHORTBOARD_INTERMEDIATE)).toBeGreaterThan(
      preferenceFit(mismatch, SHORTBOARD_INTERMEDIATE)
    );
  });

  it('parses compound beach skill levels instead of discarding them', () => {
    const profile: PoolPreferenceProfile = { skillLevel: 'intermediate', surfStyles: [] };

    const upperIntermediate = preferenceFit(
      beach({ skill_level: 'upper-intermediate' }),
      profile
    );
    const expertOnly = preferenceFit(beach({ skill_level: 'expert' }), profile);
    const unparseable = preferenceFit(beach({ skill_level: 'gnarly' }), profile);

    expect(upperIntermediate).toBeGreaterThan(expertOnly);
    expect(unparseable).toBeCloseTo(0.5, 5);
  });

  it('penalises a spot above the surfer harder than one below them', () => {
    const profile: PoolPreferenceProfile = { skillLevel: 'intermediate', surfStyles: [] };

    const tooHard = preferenceFit(beach({ skill_level: 'expert' }), profile);
    const tooEasy = preferenceFit(beach({ skill_level: 'beginner' }), profile);

    expect(tooEasy).toBeGreaterThan(tooHard);
  });

  it('matches compound break types token-by-token', () => {
    const longboarder: PoolPreferenceProfile = {
      skillLevel: null,
      surfStyles: ['longboard'],
    };

    const compound = preferenceFit(beach({ break_type: 'reef/point' }), longboarder);
    const nonMatch = preferenceFit(beach({ break_type: 'reef' }), longboarder);

    expect(compound).toBeGreaterThan(nonMatch);
  });

  it('ignores unknown surf styles rather than treating them as a mismatch', () => {
    const unknownStyle: PoolPreferenceProfile = {
      skillLevel: null,
      surfStyles: ['kneeboard'],
    };

    expect(preferenceFit(beach({ break_type: 'reef' }), unknownStyle)).toBeCloseTo(
      0.5,
      5
    );
  });

  it('understands the native style vocabulary (foamie, midlength, fish)', () => {
    // profiles.surf_styles is written by two clients with different option
    // lists; both must resolve through normalizeBoardClass.
    const foamie: PoolPreferenceProfile = { skillLevel: null, surfStyles: ['foamie'] };
    const midlength: PoolPreferenceProfile = {
      skillLevel: null,
      surfStyles: ['midlength'],
    };

    expect(preferenceFit(beach({ break_type: 'beach' }), foamie)).toBeGreaterThan(
      preferenceFit(beach({ break_type: 'reef' }), foamie)
    );
    expect(preferenceFit(beach({ break_type: 'point' }), midlength)).toBeGreaterThan(
      preferenceFit(beach({ break_type: 'jetty' }), midlength)
    );
  });
});

describe('effectiveDistanceMiles', () => {
  it('never discounts more than the detour budget', () => {
    expect(effectiveDistanceMiles(40, 1)).toBe(40 - PREFERENCE_DETOUR_BUDGET_MILES);
    expect(effectiveDistanceMiles(40, 0)).toBe(40);
    expect(effectiveDistanceMiles(40, 5)).toBe(40 - PREFERENCE_DETOUR_BUDGET_MILES);
  });

  it('lets a perfect match beat a non-match inside the budget', () => {
    expect(effectiveDistanceMiles(14, 1)).toBeLessThan(effectiveDistanceMiles(6, 0));
  });

  it('cannot let a far spot leapfrog a near one beyond the budget', () => {
    expect(effectiveDistanceMiles(80, 1)).toBeGreaterThan(effectiveDistanceMiles(60, 0));
  });

  it('sinks non-finite distances to the back of the pool', () => {
    expect(effectiveDistanceMiles(Number.NaN, 1)).toBeGreaterThan(
      effectiveDistanceMiles(100, 0)
    );
  });
});
