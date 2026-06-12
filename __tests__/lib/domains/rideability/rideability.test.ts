import { getRideabilityBand } from '@/lib/domains/rideability';
import { SKILL_WAVE_RANGES } from '@/lib/domains/user-preferences/skill-level';

describe('getRideabilityBand', () => {
  it('longboard lowers the ideal max vs shortboard for the same skill and prefers clean surf', () => {
    const longboard = getRideabilityBand('intermediate', 'longboard');
    const shortboard = getRideabilityBand('intermediate', 'shortboard');

    expect(longboard.ideal.max).toBeLessThan(shortboard.ideal.max);
    expect(longboard.prefersClean).toBe(true);
  });

  it('foamie favors small clean surf and caps low', () => {
    const foamie = getRideabilityBand('beginner', 'foamie');

    expect(foamie.ideal.min).toBeLessThanOrEqual(1.5);
    expect(foamie.acceptable.max).toBeLessThanOrEqual(4);
    expect(foamie.prefersClean).toBe(true);
    expect(foamie.powerBias).toBeLessThan(0);
  });

  it('returns the exact skill-only wave band when board is null', () => {
    const skillOnly = getRideabilityBand('intermediate', null);

    expect(skillOnly.ideal).toEqual(SKILL_WAVE_RANGES.intermediate.ideal);
    expect(skillOnly.acceptable).toEqual(
      SKILL_WAVE_RANGES.intermediate.acceptable
    );
    expect(skillOnly.prefersClean).toBe(false);
    expect(skillOnly.powerBias).toBe(0);
  });
});
