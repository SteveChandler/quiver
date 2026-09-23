import {
  parseWaveHeightMidpointFt,
  parseWaveHeightRangeFt,
} from '@/lib/alerts/forecast-parsers';

describe('wave height parsing', () => {
  it.each([
    ['3-4 ft', 3.5],
    ['3 to 4 ft', 3.5],
    ['3.2 ft', 3.2],
    [3.5, 3.5],
  ])('uses the midpoint for %p', (raw, expected) => {
    expect(parseWaveHeightMidpointFt(raw)).toBe(expected);
  });

  it('preserves signed single values for input validation', () => {
    expect(parseWaveHeightMidpointFt('-1')).toBe(-1);
  });

  it('retains range bounds for callers that need safety limits', () => {
    expect(parseWaveHeightRangeFt('3-4 ft')).toEqual({ min: 3, max: 4 });
    expect(parseWaveHeightMidpointFt('flat')).toBeNull();
  });
});
