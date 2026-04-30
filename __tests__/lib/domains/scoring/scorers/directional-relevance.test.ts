import { getDirectionalRelevance } from '@/lib/domains/scoring/scorers/directional-relevance';

describe('getDirectionalRelevance', () => {
  it('returns 1.0 when period is missing or invalid', () => {
    expect(getDirectionalRelevance(null)).toBe(1);
    expect(getDirectionalRelevance(undefined)).toBe(1);
    expect(getDirectionalRelevance(0)).toBe(1);
    expect(getDirectionalRelevance(-1)).toBe(1);
    expect(getDirectionalRelevance(NaN)).toBe(1);
    expect(getDirectionalRelevance(Infinity)).toBe(1);
  });

  it('floors short-period (<6s) at 0.30', () => {
    expect(getDirectionalRelevance(1)).toBeCloseTo(0.30);
    expect(getDirectionalRelevance(3)).toBeCloseTo(0.30);
    expect(getDirectionalRelevance(5.9)).toBeCloseTo(0.30);
  });

  it('ramps 6s -> 8s from 0.30 to 0.65', () => {
    expect(getDirectionalRelevance(6)).toBeCloseTo(0.30);
    expect(getDirectionalRelevance(7)).toBeCloseTo(0.475);
    expect(getDirectionalRelevance(8)).toBeCloseTo(0.65);
  });

  it('ramps 8s -> 10s from 0.65 to 1.00', () => {
    expect(getDirectionalRelevance(8)).toBeCloseTo(0.65);
    expect(getDirectionalRelevance(9)).toBeCloseTo(0.825);
    expect(getDirectionalRelevance(10)).toBeCloseTo(1.0);
  });

  it('returns 1.0 for groundswell periods (>=10s)', () => {
    expect(getDirectionalRelevance(10)).toBe(1);
    expect(getDirectionalRelevance(12)).toBe(1);
    expect(getDirectionalRelevance(14)).toBe(1);
    expect(getDirectionalRelevance(20)).toBe(1);
  });

  it('is monotonically non-decreasing across the valid period range (>0)', () => {
    // Note: period <= 0 is treated as "missing" (returns 1.0), so only check
    // monotonicity over real-world inputs where period is positive.
    let prev = getDirectionalRelevance(0.1);
    for (let p = 0.5; p <= 20; p += 0.5) {
      const curr = getDirectionalRelevance(p);
      expect(curr).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = curr;
    }
  });
});
