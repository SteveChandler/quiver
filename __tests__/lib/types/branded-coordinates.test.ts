/**
 * Tests for branded coordinate types
 *
 * These tests verify both runtime behavior and TypeScript compilation safety.
 *
 * @jest-environment node
 */

import {
  latitude,
  longitude,
  brandedCoordinates,
  safeLat,
  safeLon,
  safeCoordinates,
  toBranded,
  fromBranded,
  isBrandedCoordinates,
  isValidLatitudeValue,
  isValidLongitudeValue,
  safeToBranded,
  type Latitude,
  type Longitude,
  type BrandedCoordinates,
} from '@/lib/types/branded-coordinates';

describe('Branded Coordinates', () => {
  // =========================================================================
  // LATITUDE CONSTRUCTOR
  // =========================================================================

  describe('latitude()', () => {
    it('should create valid latitude from number', () => {
      const lat = latitude(32.75);
      expect(lat).toBe(32.75);
    });

    it('should accept edge values', () => {
      expect(latitude(-90)).toBe(-90);
      expect(latitude(90)).toBe(90);
      expect(latitude(0)).toBe(0);
    });

    it('should accept decimal values', () => {
      expect(latitude(32.123456)).toBe(32.123456);
      expect(latitude(-45.987654)).toBe(-45.987654);
    });

    it('should reject values above 90', () => {
      expect(() => latitude(90.1)).toThrow(/must be between -90 and 90/i);
      expect(() => latitude(91)).toThrow(/must be between -90 and 90/i);
      expect(() => latitude(180)).toThrow(/must be between -90 and 90/i);
    });

    it('should reject values below -90', () => {
      expect(() => latitude(-90.1)).toThrow(/must be between -90 and 90/i);
      expect(() => latitude(-91)).toThrow(/must be between -90 and 90/i);
      expect(() => latitude(-180)).toThrow(/must be between -90 and 90/i);
    });

    it('should reject non-finite values', () => {
      expect(() => latitude(NaN)).toThrow(/must be a finite number/i);
      expect(() => latitude(Infinity)).toThrow(/must be a finite number/i);
      expect(() => latitude(-Infinity)).toThrow(/must be a finite number/i);
    });
  });

  // =========================================================================
  // LONGITUDE CONSTRUCTOR
  // =========================================================================

  describe('longitude()', () => {
    it('should create valid longitude from number', () => {
      const lon = longitude(-117.25);
      expect(lon).toBe(-117.25);
    });

    it('should accept edge values', () => {
      expect(longitude(-180)).toBe(-180);
      expect(longitude(180)).toBe(180);
      expect(longitude(0)).toBe(0);
    });

    it('should accept decimal values', () => {
      expect(longitude(-117.123456)).toBe(-117.123456);
      expect(longitude(45.987654)).toBe(45.987654);
    });

    it('should reject values above 180', () => {
      expect(() => longitude(180.1)).toThrow(/must be between -180 and 180/i);
      expect(() => longitude(181)).toThrow(/must be between -180 and 180/i);
      expect(() => longitude(360)).toThrow(/must be between -180 and 180/i);
    });

    it('should reject values below -180', () => {
      expect(() => longitude(-180.1)).toThrow(/must be between -180 and 180/i);
      expect(() => longitude(-181)).toThrow(/must be between -180 and 180/i);
      expect(() => longitude(-360)).toThrow(/must be between -180 and 180/i);
    });

    it('should reject non-finite values', () => {
      expect(() => longitude(NaN)).toThrow(/must be a finite number/i);
      expect(() => longitude(Infinity)).toThrow(/must be a finite number/i);
      expect(() => longitude(-Infinity)).toThrow(/must be a finite number/i);
    });
  });

  // =========================================================================
  // BRANDED COORDINATES CONSTRUCTOR
  // =========================================================================

  describe('brandedCoordinates()', () => {
    it('should create valid branded coordinates', () => {
      const coords = brandedCoordinates(32.75, -117.25);
      expect(coords.lat).toBe(32.75);
      expect(coords.lon).toBe(-117.25);
    });

    it('should accept edge values', () => {
      const coords = brandedCoordinates(90, 180);
      expect(coords.lat).toBe(90);
      expect(coords.lon).toBe(180);
    });

    it('should throw on invalid latitude', () => {
      expect(() => brandedCoordinates(91, -117.25)).toThrow(/latitude/i);
    });

    it('should throw on invalid longitude', () => {
      expect(() => brandedCoordinates(32.75, 181)).toThrow(/longitude/i);
    });
  });

  // =========================================================================
  // SAFE CONSTRUCTORS
  // =========================================================================

  describe('safeLat()', () => {
    it('should return branded latitude for valid number', () => {
      const lat = safeLat(32.75);
      expect(lat).toBe(32.75);
    });

    it('should return null for invalid values', () => {
      expect(safeLat(91)).toBeNull();
      expect(safeLat(-91)).toBeNull();
      expect(safeLat(NaN)).toBeNull();
      expect(safeLat(Infinity)).toBeNull();
    });

    it('should return null for non-numbers', () => {
      expect(safeLat('32.75')).toBeNull();
      expect(safeLat(null)).toBeNull();
      expect(safeLat(undefined)).toBeNull();
      expect(safeLat({})).toBeNull();
      expect(safeLat([])).toBeNull();
    });
  });

  describe('safeLon()', () => {
    it('should return branded longitude for valid number', () => {
      const lon = safeLon(-117.25);
      expect(lon).toBe(-117.25);
    });

    it('should return null for invalid values', () => {
      expect(safeLon(181)).toBeNull();
      expect(safeLon(-181)).toBeNull();
      expect(safeLon(NaN)).toBeNull();
      expect(safeLon(Infinity)).toBeNull();
    });

    it('should return null for non-numbers', () => {
      expect(safeLon('-117.25')).toBeNull();
      expect(safeLon(null)).toBeNull();
      expect(safeLon(undefined)).toBeNull();
      expect(safeLon({})).toBeNull();
      expect(safeLon([])).toBeNull();
    });
  });

  describe('safeCoordinates()', () => {
    it('should return branded coordinates for valid values', () => {
      const coords = safeCoordinates(32.75, -117.25);
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBe(32.75);
      expect(coords?.lon).toBe(-117.25);
    });

    it('should return null if latitude is invalid', () => {
      expect(safeCoordinates(91, -117.25)).toBeNull();
      expect(safeCoordinates(NaN, -117.25)).toBeNull();
    });

    it('should return null if longitude is invalid', () => {
      expect(safeCoordinates(32.75, 181)).toBeNull();
      expect(safeCoordinates(32.75, NaN)).toBeNull();
    });

    it('should return null if both are invalid', () => {
      expect(safeCoordinates(91, 181)).toBeNull();
    });

    it('should return null for non-numbers', () => {
      expect(safeCoordinates('32.75', -117.25)).toBeNull();
      expect(safeCoordinates(32.75, '-117.25')).toBeNull();
      expect(safeCoordinates(null, null)).toBeNull();
      expect(safeCoordinates(undefined, undefined)).toBeNull();
    });
  });

  // =========================================================================
  // CONVERSION FUNCTIONS
  // =========================================================================

  describe('toBranded()', () => {
    it('should convert plain coordinates to branded', () => {
      const plain = { lat: 32.75, lon: -117.25 };
      const branded = toBranded(plain);

      expect(branded.lat).toBe(32.75);
      expect(branded.lon).toBe(-117.25);
    });

    it('should throw on invalid coordinates', () => {
      expect(() => toBranded({ lat: 91, lon: -117.25 })).toThrow();
      expect(() => toBranded({ lat: 32.75, lon: 181 })).toThrow();
    });
  });

  describe('fromBranded()', () => {
    it('should convert branded coordinates to plain', () => {
      const branded: BrandedCoordinates = {
        lat: latitude(32.75),
        lon: longitude(-117.25),
      };

      const plain = fromBranded(branded);

      expect(plain.lat).toBe(32.75);
      expect(plain.lon).toBe(-117.25);
    });
  });

  describe('safeToBranded()', () => {
    it('should convert valid coordinates', () => {
      const result = safeToBranded({ lat: 32.75, lon: -117.25 });
      expect(result).not.toBeNull();
      expect(result?.lat).toBe(32.75);
      expect(result?.lon).toBe(-117.25);
    });

    it('should return null for invalid coordinates', () => {
      expect(safeToBranded({ lat: 91, lon: -117.25 })).toBeNull();
      expect(safeToBranded({ lat: 32.75, lon: 181 })).toBeNull();
    });

    it('should return null for non-objects', () => {
      expect(safeToBranded(null)).toBeNull();
      expect(safeToBranded(undefined)).toBeNull();
      expect(safeToBranded('string')).toBeNull();
      expect(safeToBranded(123)).toBeNull();
    });

    it('should return null for objects without lat/lon', () => {
      expect(safeToBranded({})).toBeNull();
      expect(safeToBranded({ lat: 32.75 })).toBeNull();
      expect(safeToBranded({ lon: -117.25 })).toBeNull();
    });
  });

  // =========================================================================
  // TYPE GUARDS
  // =========================================================================

  describe('isBrandedCoordinates()', () => {
    it('should return true for valid branded coordinates', () => {
      const coords: BrandedCoordinates = {
        lat: latitude(32.75),
        lon: longitude(-117.25),
      };

      expect(isBrandedCoordinates(coords)).toBe(true);
    });

    it('should return true for plain coordinates with valid values', () => {
      const plain = { lat: 32.75, lon: -117.25 };
      expect(isBrandedCoordinates(plain)).toBe(true);
    });

    it('should return false for out-of-range values', () => {
      expect(isBrandedCoordinates({ lat: 91, lon: -117.25 })).toBe(false);
      expect(isBrandedCoordinates({ lat: 32.75, lon: 181 })).toBe(false);
    });

    it('should return false for non-finite values', () => {
      expect(isBrandedCoordinates({ lat: NaN, lon: -117.25 })).toBe(false);
      expect(isBrandedCoordinates({ lat: 32.75, lon: Infinity })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isBrandedCoordinates(null)).toBe(false);
      expect(isBrandedCoordinates(undefined)).toBe(false);
      expect(isBrandedCoordinates('string')).toBe(false);
      expect(isBrandedCoordinates(123)).toBe(false);
    });

    it('should return false for objects without lat/lon', () => {
      expect(isBrandedCoordinates({})).toBe(false);
      expect(isBrandedCoordinates({ lat: 32.75 })).toBe(false);
      expect(isBrandedCoordinates({ lon: -117.25 })).toBe(false);
    });

    it('should return false for non-number lat/lon', () => {
      expect(isBrandedCoordinates({ lat: '32.75', lon: -117.25 })).toBe(false);
      expect(isBrandedCoordinates({ lat: 32.75, lon: '-117.25' })).toBe(false);
    });
  });

  describe('isValidLatitudeValue()', () => {
    it('should return true for valid latitude values', () => {
      expect(isValidLatitudeValue(0)).toBe(true);
      expect(isValidLatitudeValue(32.75)).toBe(true);
      expect(isValidLatitudeValue(-45)).toBe(true);
      expect(isValidLatitudeValue(90)).toBe(true);
      expect(isValidLatitudeValue(-90)).toBe(true);
    });

    it('should return false for out-of-range values', () => {
      expect(isValidLatitudeValue(91)).toBe(false);
      expect(isValidLatitudeValue(-91)).toBe(false);
      expect(isValidLatitudeValue(180)).toBe(false);
    });

    it('should return false for non-finite values', () => {
      expect(isValidLatitudeValue(NaN)).toBe(false);
      expect(isValidLatitudeValue(Infinity)).toBe(false);
      expect(isValidLatitudeValue(-Infinity)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isValidLatitudeValue('32.75')).toBe(false);
      expect(isValidLatitudeValue(null)).toBe(false);
      expect(isValidLatitudeValue(undefined)).toBe(false);
    });
  });

  describe('isValidLongitudeValue()', () => {
    it('should return true for valid longitude values', () => {
      expect(isValidLongitudeValue(0)).toBe(true);
      expect(isValidLongitudeValue(-117.25)).toBe(true);
      expect(isValidLongitudeValue(45)).toBe(true);
      expect(isValidLongitudeValue(180)).toBe(true);
      expect(isValidLongitudeValue(-180)).toBe(true);
    });

    it('should return false for out-of-range values', () => {
      expect(isValidLongitudeValue(181)).toBe(false);
      expect(isValidLongitudeValue(-181)).toBe(false);
      expect(isValidLongitudeValue(360)).toBe(false);
    });

    it('should return false for non-finite values', () => {
      expect(isValidLongitudeValue(NaN)).toBe(false);
      expect(isValidLongitudeValue(Infinity)).toBe(false);
      expect(isValidLongitudeValue(-Infinity)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isValidLongitudeValue('-117.25')).toBe(false);
      expect(isValidLongitudeValue(null)).toBe(false);
      expect(isValidLongitudeValue(undefined)).toBe(false);
    });
  });

  // =========================================================================
  // TYPE SAFETY TESTS (Compile-time verification)
  // =========================================================================

  describe('Type Safety', () => {
    it('should prevent coordinate swaps at compile time', () => {
      const lat = latitude(32.75);
      const lon = longitude(-117.25);

      // This should compile fine
      const correct: BrandedCoordinates = { lat, lon };
      expect(correct.lat).toBe(32.75);
      expect(correct.lon).toBe(-117.25);

      // The following would cause compile errors (uncomment to test):
      // const swapped: BrandedCoordinates = { lat: lon, lon: lat }; // ❌ Error
      // const wrongLat: BrandedCoordinates = { lat: longitude(-117.25), lon }; // ❌ Error
      // const wrongLon: BrandedCoordinates = { lat, lon: latitude(32.75) }; // ❌ Error
    });

    it('should allow assigning branded to plain coordinates', () => {
      const branded: BrandedCoordinates = {
        lat: latitude(32.75),
        lon: longitude(-117.25),
      };

      // Branded types can be assigned to plain coordinates (upcast)
      const plain: { lat: number; lon: number } = branded;
      expect(plain.lat).toBe(32.75);
      expect(plain.lon).toBe(-117.25);
    });

    it('should require validation when assigning plain to branded', () => {
      const plain = { lat: 32.75, lon: -117.25 };

      // Must use toBranded() to convert plain to branded
      const branded = toBranded(plain);
      expect(branded.lat).toBe(32.75);
      expect(branded.lon).toBe(-117.25);

      // Direct assignment would fail (uncomment to test):
      // const direct: BrandedCoordinates = plain; // ❌ Error
    });
  });

  // =========================================================================
  // ROUND-TRIP CONVERSIONS
  // =========================================================================

  describe('Round-trip conversions', () => {
    it('should preserve values through toBranded -> fromBranded', () => {
      const original = { lat: 32.75, lon: -117.25 };
      const branded = toBranded(original);
      const back = fromBranded(branded);

      expect(back).toEqual(original);
    });

    it('should preserve values through brandedCoordinates -> fromBranded', () => {
      const lat = 32.75;
      const lon = -117.25;

      const branded = brandedCoordinates(lat, lon);
      const plain = fromBranded(branded);

      expect(plain.lat).toBe(lat);
      expect(plain.lon).toBe(lon);
    });
  });

  // =========================================================================
  // REAL-WORLD EXAMPLES
  // =========================================================================

  describe('Real-world usage examples', () => {
    it('should work with San Diego beaches', () => {
      // Ocean Beach, San Diego
      const oceanBeach = brandedCoordinates(32.7539, -117.2506);
      expect(oceanBeach.lat).toBeCloseTo(32.7539, 4);
      expect(oceanBeach.lon).toBeCloseTo(-117.2506, 4);

      // Pacific Beach, San Diego
      const pacificBeach = brandedCoordinates(32.7966, -117.2389);
      expect(pacificBeach.lat).toBeCloseTo(32.7966, 4);
      expect(pacificBeach.lon).toBeCloseTo(-117.2389, 4);
    });

    it('should work with international locations', () => {
      // Sydney, Australia
      const sydney = brandedCoordinates(-33.8688, 151.2093);
      expect(sydney.lat).toBeCloseTo(-33.8688, 4);
      expect(sydney.lon).toBeCloseTo(151.2093, 4);

      // Bali, Indonesia
      const bali = brandedCoordinates(-8.3405, 115.0920);
      expect(bali.lat).toBeCloseTo(-8.3405, 4);
      expect(bali.lon).toBeCloseTo(115.0920, 4);
    });

    it('should work with extreme locations', () => {
      // North Pole
      const northPole = brandedCoordinates(90, 0);
      expect(northPole.lat).toBe(90);

      // South Pole
      const southPole = brandedCoordinates(-90, 0);
      expect(southPole.lat).toBe(-90);

      // International Date Line
      const dateLine = brandedCoordinates(0, 180);
      expect(dateLine.lon).toBe(180);
    });
  });
});
