// __tests__/lib/utils/number-parsing.test.ts
import {
  parseFloatSafe,
  parseIntSafe,
  parseCoordinate,
  parseWaveHeightRange,
  parseWindSpeed,
  parseWavePeriod,
} from '@/lib/utils/number-parsing';

describe('number-parsing', () => {
  describe('parseFloatSafe', () => {
    it('should parse valid float strings', () => {
      expect(parseFloatSafe('3.14', 0)).toBe(3.14);
      expect(parseFloatSafe('42', 0)).toBe(42);
      expect(parseFloatSafe('-1.5', 0)).toBe(-1.5);
    });

    it('should return fallback for invalid inputs', () => {
      expect(parseFloatSafe('abc', 0)).toBe(0);
      expect(parseFloatSafe('', 5)).toBe(5);
      expect(parseFloatSafe(null, 10)).toBe(10);
      expect(parseFloatSafe(undefined, 10)).toBe(10);
      expect(parseFloatSafe(NaN, 0)).toBe(0);
    });

    it('should handle number inputs', () => {
      expect(parseFloatSafe(3.14, 0)).toBe(3.14);
      expect(parseFloatSafe(42, 0)).toBe(42);
    });
  });

  describe('parseIntSafe', () => {
    it('should parse valid integer strings', () => {
      expect(parseIntSafe('42', 0)).toBe(42);
      expect(parseIntSafe('-10', 0)).toBe(-10);
    });

    it('should truncate floats', () => {
      expect(parseIntSafe('3.7', 0)).toBe(3);
      expect(parseIntSafe('3.2', 0)).toBe(3);
    });

    it('should return fallback for invalid inputs', () => {
      expect(parseIntSafe('abc', 0)).toBe(0);
      expect(parseIntSafe(null, 5)).toBe(5);
    });
  });

  describe('parseCoordinate', () => {
    it('should parse valid coordinates', () => {
      expect(parseCoordinate('33.7701')).toBe(33.7701);
      expect(parseCoordinate('-118.1937')).toBe(-118.1937);
    });

    it('should return null for invalid coordinates', () => {
      expect(parseCoordinate('abc')).toBeNull();
      expect(parseCoordinate('')).toBeNull();
      expect(parseCoordinate(null)).toBeNull();
    });

    it('should reject out-of-range coordinates', () => {
      expect(parseCoordinate('91', 'lat')).toBeNull();
      expect(parseCoordinate('-181', 'lon')).toBeNull();
    });
  });

  describe('parseWaveHeightRange', () => {
    it('should parse wave height strings with units', () => {
      expect(parseWaveHeightRange('3-5 ft')).toEqual({ min: 3, max: 5 });
      expect(parseWaveHeightRange('4ft')).toEqual({ min: 4, max: 4 });
      expect(parseWaveHeightRange('2-3')).toEqual({ min: 2, max: 3 });
    });

    it('should return null for invalid formats', () => {
      expect(parseWaveHeightRange('flat')).toBeNull();
      expect(parseWaveHeightRange('')).toBeNull();
    });
  });

  describe('parseWindSpeed', () => {
    it('should parse wind speed strings', () => {
      expect(parseWindSpeed('10 mph')).toBe(10);
      expect(parseWindSpeed('15mph')).toBe(15);
      expect(parseWindSpeed('8')).toBe(8);
    });

    it('should return fallback for invalid inputs', () => {
      expect(parseWindSpeed('calm', 0)).toBe(0);
      expect(parseWindSpeed('', 5)).toBe(5);
    });
  });

  describe('parseWavePeriod', () => {
    it('should parse wave period strings with units', () => {
      expect(parseWavePeriod('12s')).toBe(12);
      expect(parseWavePeriod('8 sec')).toBe(8);
      expect(parseWavePeriod('10 seconds')).toBe(10);
      expect(parseWavePeriod('15')).toBe(15);
    });

    it('should return fallback for invalid inputs', () => {
      expect(parseWavePeriod('long', 0)).toBe(0);
      expect(parseWavePeriod('', 5)).toBe(5);
      expect(parseWavePeriod(null, 8)).toBe(8);
    });
  });
});
