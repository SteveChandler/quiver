/**
 * Unit tests for coordinate validation utilities
 */

import {
  isValidLatitude,
  isValidLongitude,
  isValidCoordinate,
  getCoordinateValidationError,
  validateCoordinates,
  assertValidCoordinates,
  sanitizeCoordinates,
  hasValidCoordinates,
} from '@/lib/coordinate-validation';

describe('Coordinate Validation Utilities', () => {
  describe('isValidLatitude', () => {
    it('should accept valid latitudes', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(45.5)).toBe(true);
      expect(isValidLatitude(-45.5)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it('should reject invalid latitudes', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(NaN)).toBe(false);
      expect(isValidLatitude(undefined)).toBe(false);
      expect(isValidLatitude(null)).toBe(false);
      expect(isValidLatitude(Infinity)).toBe(false);
      expect(isValidLatitude(-Infinity)).toBe(false);
    });
  });

  describe('isValidLongitude', () => {
    it('should accept valid longitudes', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(117.1611)).toBe(true);
      expect(isValidLongitude(-117.1611)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it('should reject invalid longitudes', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
      expect(isValidLongitude(NaN)).toBe(false);
      expect(isValidLongitude(undefined)).toBe(false);
      expect(isValidLongitude(null)).toBe(false);
      expect(isValidLongitude(Infinity)).toBe(false);
      expect(isValidLongitude(-Infinity)).toBe(false);
    });
  });

  describe('isValidCoordinate', () => {
    it('should accept valid coordinate pairs', () => {
      expect(isValidCoordinate(32.7157, -117.1611)).toBe(true); // San Diego
      expect(isValidCoordinate(0, 0)).toBe(true); // Null Island
      expect(isValidCoordinate(90, 180)).toBe(true); // Edge case
      expect(isValidCoordinate(-90, -180)).toBe(true); // Edge case
    });

    it('should reject invalid coordinate pairs', () => {
      expect(isValidCoordinate(91, -117.1611)).toBe(false); // Invalid lat
      expect(isValidCoordinate(32.7157, 181)).toBe(false); // Invalid lon
      expect(isValidCoordinate(91, 181)).toBe(false); // Both invalid
      expect(isValidCoordinate(NaN, -117.1611)).toBe(false);
      expect(isValidCoordinate(32.7157, NaN)).toBe(false);
      expect(isValidCoordinate(undefined, -117.1611)).toBe(false);
      expect(isValidCoordinate(32.7157, null)).toBe(false);
    });
  });

  describe('getCoordinateValidationError', () => {
    it('should return null for valid coordinates', () => {
      expect(getCoordinateValidationError(32.7157, -117.1611)).toBeNull();
      expect(getCoordinateValidationError(0, 0)).toBeNull();
    });

    it('should return error for undefined/null values', () => {
      expect(getCoordinateValidationError(undefined, -117.1611)).toContain('undefined');
      expect(getCoordinateValidationError(null, -117.1611)).toContain('null');
      expect(getCoordinateValidationError(32.7157, undefined)).toContain('undefined');
      expect(getCoordinateValidationError(32.7157, null)).toContain('null');
    });

    it('should return error for NaN values', () => {
      expect(getCoordinateValidationError(NaN, -117.1611)).toContain('NaN');
      expect(getCoordinateValidationError(32.7157, NaN)).toContain('NaN');
    });

    it('should return error for out-of-range values', () => {
      const latError = getCoordinateValidationError(91, -117.1611);
      expect(latError).toContain('out of range');
      expect(latError).toContain('91');

      const lonError = getCoordinateValidationError(32.7157, 181);
      expect(lonError).toContain('out of range');
      expect(lonError).toContain('181');
    });

    it('should include context in error message', () => {
      const error = getCoordinateValidationError(91, -117.1611, 'Beach: Pacific Beach');
      expect(error).toContain('Beach: Pacific Beach');
    });
  });

  describe('validateCoordinates', () => {
    let consoleWarnSpy: jest.SpyInstance;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      console.trace = jest.fn(); // Mock trace to avoid cluttering test output
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should return true for valid coordinates', () => {
      expect(validateCoordinates(32.7157, -117.1611)).toBe(true);
    });

    it('should return false for invalid coordinates', () => {
      expect(validateCoordinates(91, -117.1611)).toBe(false);
      expect(validateCoordinates(32.7157, 181)).toBe(false);
      expect(validateCoordinates(NaN, -117.1611)).toBe(false);
    });

    it('should log warnings in development mode', () => {
      process.env.NODE_ENV = 'development';
      validateCoordinates(91, -117.1611, 'Test Beach');

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Invalid coordinates');
    });

    it('should not log warnings in production mode', () => {
      process.env.NODE_ENV = 'production';
      validateCoordinates(91, -117.1611, 'Test Beach');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('assertValidCoordinates', () => {
    it('should not throw for valid coordinates', () => {
      expect(() => assertValidCoordinates(32.7157, -117.1611)).not.toThrow();
    });

    it('should throw for invalid coordinates', () => {
      expect(() => assertValidCoordinates(91, -117.1611)).toThrow('Invalid coordinates');
      expect(() => assertValidCoordinates(32.7157, 181)).toThrow('Invalid coordinates');
      expect(() => assertValidCoordinates(NaN, -117.1611)).toThrow('Invalid coordinates');
    });

    it('should include context in error message', () => {
      expect(() => assertValidCoordinates(91, -117.1611, 'Test Beach')).toThrow('Test Beach');
    });
  });

  describe('sanitizeCoordinates', () => {
    let consoleWarnSpy: jest.SpyInstance;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should return valid coordinates unchanged', () => {
      const result = sanitizeCoordinates(32.7157, -117.1611);
      expect(result).toEqual({
        latitude: 32.7157,
        longitude: -117.1611,
      });
    });

    it('should clamp out-of-range latitude', () => {
      const result1 = sanitizeCoordinates(91, -117.1611);
      expect(result1).toEqual({
        latitude: 90,
        longitude: -117.1611,
      });

      const result2 = sanitizeCoordinates(-91, -117.1611);
      expect(result2).toEqual({
        latitude: -90,
        longitude: -117.1611,
      });
    });

    it('should clamp out-of-range longitude', () => {
      const result1 = sanitizeCoordinates(32.7157, 181);
      expect(result1).toEqual({
        latitude: 32.7157,
        longitude: 180,
      });

      const result2 = sanitizeCoordinates(32.7157, -181);
      expect(result2).toEqual({
        latitude: 32.7157,
        longitude: -180,
      });
    });

    it('should return null for undefined/null/NaN values', () => {
      expect(sanitizeCoordinates(undefined, -117.1611)).toBeNull();
      expect(sanitizeCoordinates(null, -117.1611)).toBeNull();
      expect(sanitizeCoordinates(32.7157, undefined)).toBeNull();
      expect(sanitizeCoordinates(32.7157, null)).toBeNull();
      expect(sanitizeCoordinates(NaN, -117.1611)).toBeNull();
      expect(sanitizeCoordinates(32.7157, NaN)).toBeNull();
    });

    it('should log warnings when clamping in development mode', () => {
      process.env.NODE_ENV = 'development';
      sanitizeCoordinates(91, 181);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('clamped');
    });

    it('should not log warnings in production mode', () => {
      process.env.NODE_ENV = 'production';
      sanitizeCoordinates(91, 181);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('hasValidCoordinates', () => {
    it('should accept objects with valid lat/lon properties', () => {
      expect(hasValidCoordinates({ lat: 32.7157, lon: -117.1611 })).toBe(true);
    });

    it('should accept objects with valid latitude/longitude properties', () => {
      expect(hasValidCoordinates({ latitude: 32.7157, longitude: -117.1611 })).toBe(true);
    });

    it('should reject objects with invalid coordinates', () => {
      expect(hasValidCoordinates({ lat: 91, lon: -117.1611 })).toBe(false);
      expect(hasValidCoordinates({ lat: 32.7157, lon: 181 })).toBe(false);
      expect(hasValidCoordinates({ latitude: NaN, longitude: -117.1611 })).toBe(false);
    });

    it('should reject objects without coordinate properties', () => {
      expect(hasValidCoordinates({ name: 'Beach' })).toBe(false);
      expect(hasValidCoordinates({})).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(hasValidCoordinates(null)).toBe(false);
      expect(hasValidCoordinates(undefined)).toBe(false);
      expect(hasValidCoordinates('string')).toBe(false);
      expect(hasValidCoordinates(123)).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should validate San Diego coordinates', () => {
      const pacificBeach = { lat: 32.7956, lon: -117.2258 };
      expect(isValidCoordinate(pacificBeach.lat, pacificBeach.lon)).toBe(true);
      expect(hasValidCoordinates(pacificBeach)).toBe(true);
    });

    it('should validate Ocean Beach coordinates', () => {
      const oceanBeach = { lat: 32.7534, lon: -117.2511 };
      expect(isValidCoordinate(oceanBeach.lat, oceanBeach.lon)).toBe(true);
      expect(hasValidCoordinates(oceanBeach)).toBe(true);
    });

    it('should catch swapped coordinates', () => {
      // This is the bug we're preventing - lon in lat field, lat in lon field
      const swapped = { lat: -117.1611, lon: 32.7157 };
      expect(isValidCoordinate(swapped.lat, swapped.lon)).toBe(false);
      expect(getCoordinateValidationError(swapped.lat, swapped.lon)).toContain('out of range');
    });

    it('should handle database null values', () => {
      const beachWithNulls = { lat: null, lon: null };
      expect(hasValidCoordinates(beachWithNulls)).toBe(false);
      expect(validateCoordinates(beachWithNulls.lat, beachWithNulls.lon)).toBe(false);
    });

    it('should handle API missing values', () => {
      const beachWithUndefined = { lat: undefined, lon: undefined };
      expect(hasValidCoordinates(beachWithUndefined)).toBe(false);
      expect(validateCoordinates(beachWithUndefined.lat, beachWithUndefined.lon)).toBe(false);
    });
  });
});
