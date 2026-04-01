import { parseWaveHeight, parseWindSpeed } from '@/lib/utils/forecast-parsing';

describe('parseWaveHeight', () => {
  it('parses range format', () => {
    expect(parseWaveHeight('3-4ft')).toBeCloseTo(1.07, 1);
  });

  it('parses range with spaces', () => {
    expect(parseWaveHeight('3 to 4 ft')).toBeCloseTo(1.07, 1);
  });

  it('parses single value', () => {
    expect(parseWaveHeight('3ft')).toBeCloseTo(0.91, 1);
  });

  it('handles flat', () => {
    expect(parseWaveHeight('Flat')).toBe(0.15);
    expect(parseWaveHeight('flat')).toBe(0.15);
  });

  it('handles null/empty', () => {
    expect(parseWaveHeight(null)).toBe(0.15);
    expect(parseWaveHeight('')).toBe(0.15);
  });

  it('returns null for unparseable', () => {
    expect(parseWaveHeight('unknown')).toBeNull();
  });
});

describe('parseWindSpeed', () => {
  it('parses mph format', () => {
    expect(parseWindSpeed('10 mph')).toBeCloseTo(4.47, 1);
  });

  it('returns null for null input', () => {
    expect(parseWindSpeed(null)).toBeNull();
  });
});
