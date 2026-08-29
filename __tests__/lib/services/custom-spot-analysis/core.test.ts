import {
  analyzeCustomSpot,
  deriveSwellWindow,
  getCustomSpotCoordinateHash,
  isValidDirectionalFactors,
  normalizeDirection,
} from '@/lib/services/custom-spot-analysis/core';

const factors = (value: number): number[] => Array(72).fill(value);

describe('custom spot analysis core', () => {
  it('normalizes 360 degrees to north', () => {
    expect(normalizeDirection(360)).toBe(0);
    expect(normalizeDirection(-5)).toBe(355);
  });

  it('preserves a north-crossing swell window', () => {
    const access = factors(0);
    [70, 71, 0, 1, 2].forEach((index) => { access[index] = 1; });

    expect(deriveSwellWindow(access)).toEqual({
      minDeg: 350,
      maxDeg: 10,
      centerDeg: 0,
    });
  });

  it('rejects invalid factor arrays', () => {
    expect(isValidDirectionalFactors(factors(0.5))).toBe(true);
    expect(isValidDirectionalFactors(factors(0.5).slice(1))).toBe(false);
    expect(isValidDirectionalFactors([...factors(0.5).slice(1), Number.NaN])).toBe(false);
  });

  it('does not invent a swell direction when no direction is accessible', () => {
    expect(() => deriveSwellWindow(factors(0))).toThrow('indeterminate_shoreline_orientation');
  });

  it('derives geometry while leaving tide and skill out of the model', async () => {
    const swell = factors(0);
    [48, 49, 50, 51, 52].forEach((index) => { swell[index] = 0.9; });

    const result = await analyzeCustomSpot(
      { customSpotId: 'spot', lat: 32.5, lon: -117.1, breakType: 'reef' },
      {
        analyzeTerrain: async () => ({
          swellAccessFactors: swell,
          windExposureFactors: factors(0.5),
          debug: {},
        }),
        now: () => new Date('2026-08-28T12:00:00.000Z'),
      }
    );

    expect(result).toMatchObject({
      facingDirectionDeg: 250,
      offshoreDirectionDeg: 70,
      swellWindowMinDeg: 240,
      swellWindowMaxDeg: 260,
      exposureLevel: 'mixed',
      analyzedAt: '2026-08-28T12:00:00.000Z',
    });
    expect(result).not.toHaveProperty('skillLevel');
    expect(result).not.toHaveProperty('preferredTideFtMin');
  });

  it('changes the cache key when coordinates or model inputs change', () => {
    const reef = getCustomSpotCoordinateHash({ customSpotId: 'spot', lat: 32.5, lon: -117.1, breakType: 'reef' });
    const beach = getCustomSpotCoordinateHash({ customSpotId: 'spot', lat: 32.5, lon: -117.1, breakType: 'beach' });
    const moved = getCustomSpotCoordinateHash({ customSpotId: 'spot', lat: 32.50001, lon: -117.1, breakType: 'reef' });

    expect(new Set([reef, beach, moved]).size).toBe(3);
  });
});
