/**
 * Unit tests for coordinate validation utilities
 */

import { isValidLatitude, isValidLongitude, getCoordinateValidationError, validateCoordinates } from '@/lib/coordinate-validation';

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
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
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
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      validateCoordinates(91, -117.1611, 'Test Beach');

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Invalid coordinates');
    });

    it('should not log warnings in production mode', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      validateCoordinates(91, -117.1611, 'Test Beach');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });




});
