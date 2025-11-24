/**
 * Tests for branded coordinate utility functions
 *
 * @jest-environment node
 */

import {
  latitude,
  longitude,
  brandedCoordinates,
  calculateBrandedDistance,
  calculateBrandedDistanceFormatted,
  toBrandedMapboxArray,
  fromBrandedMapboxArray,
  toBrandedMapboxLngLat,
  fromBrandedMapboxLngLat,
  calculateBrandedBoundingBox,
  isCoordinateInBoundingBox,
  validateAndBrandCoordinates,
  batchValidateAndBrand,
  sortByDistance,
  filterByDistance,
  type BrandedCoordinates,
  type BrandedBoundingBox,
} from '@/lib/utils/branded-coordinate-utils';

describe('Branded Coordinate Utils', () => {
  // Test data: San Diego beaches
  const oceanBeach: BrandedCoordinates = {
    lat: latitude(32.7539),
    lon: longitude(-117.2506),
  };

  const pacificBeach: BrandedCoordinates = {
    lat: latitude(32.7966),
    lon: longitude(-117.2389),
  };

  const lajolla: BrandedCoordinates = {
    lat: latitude(32.8328),
    lon: longitude(-117.2713),
  };

  // =========================================================================
  // DISTANCE CALCULATIONS
  // =========================================================================

  describe('calculateBrandedDistance()', () => {
    it('should calculate distance between two points in miles', () => {
      const distance = calculateBrandedDistance(oceanBeach, pacificBeach, 'miles');

      // Distance between Ocean Beach and Pacific Beach is approximately 3.5 miles
      expect(distance).toBeGreaterThan(3);
      expect(distance).toBeLessThan(4);
    });

    it('should calculate distance in kilometers', () => {
      const distance = calculateBrandedDistance(oceanBeach, pacificBeach, 'km');

      // Should be approximately 4.9 km
      expect(distance).toBeGreaterThan(4.5);
      expect(distance).toBeLessThan(5.5);
    });

    it('should calculate distance in meters', () => {
      const distance = calculateBrandedDistance(oceanBeach, pacificBeach, 'meters');

      // Should be approximately 4,872 meters
      expect(distance).toBeGreaterThan(4500);
      expect(distance).toBeLessThan(5500);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateBrandedDistance(oceanBeach, oceanBeach);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate larger distances correctly', () => {
      const sydney: BrandedCoordinates = {
        lat: latitude(-33.8688),
        lon: longitude(151.2093),
      };

      const distance = calculateBrandedDistance(oceanBeach, sydney, 'miles');

      // San Diego to Sydney is approximately 7,500 miles
      expect(distance).toBeGreaterThan(7000);
      expect(distance).toBeLessThan(8000);
    });
  });

  describe('calculateBrandedDistanceFormatted()', () => {
    it('should format distance in miles', () => {
      const formatted = calculateBrandedDistanceFormatted(
        oceanBeach,
        pacificBeach,
        'miles'
      );

      expect(formatted).toMatch(/^[\d.]+ miles$/);
      expect(formatted).toMatch(/^3\.\d miles$/); // Should start with 3.
    });

    it('should format distance in kilometers', () => {
      const formatted = calculateBrandedDistanceFormatted(
        oceanBeach,
        pacificBeach,
        'km'
      );

      expect(formatted).toMatch(/^[\d.]+ km$/);
      expect(formatted).toMatch(/^4\.\d km$/); // Should start with 4.
    });

    it('should use one decimal place', () => {
      const formatted = calculateBrandedDistanceFormatted(oceanBeach, pacificBeach);
      const match = formatted.match(/^(\d+\.\d) miles$/);

      expect(match).not.toBeNull();
      expect(match![1].split('.')[1]).toHaveLength(1);
    });
  });

  // =========================================================================
  // MAPBOX TRANSFORMATIONS
  // =========================================================================

  describe('toBrandedMapboxArray()', () => {
    it('should convert to Mapbox format [lng, lat]', () => {
      const mapboxArray = toBrandedMapboxArray(oceanBeach);

      // Mapbox uses [longitude, latitude] order
      expect(mapboxArray[0]).toBeCloseTo(-117.2506, 4); // longitude first
      expect(mapboxArray[1]).toBeCloseTo(32.7539, 4); // latitude second
    });

    it('should preserve precision', () => {
      const precise: BrandedCoordinates = {
        lat: latitude(32.123456789),
        lon: longitude(-117.987654321),
      };

      const mapboxArray = toBrandedMapboxArray(precise);

      expect(mapboxArray[0]).toBe(-117.987654321);
      expect(mapboxArray[1]).toBe(32.123456789);
    });
  });

  describe('fromBrandedMapboxArray()', () => {
    it('should convert from Mapbox format [lng, lat]', () => {
      const mapboxArray: [number, number] = [-117.2506, 32.7539];
      const coords = fromBrandedMapboxArray(mapboxArray);

      expect(coords.lat).toBeCloseTo(32.7539, 4);
      expect(coords.lon).toBeCloseTo(-117.2506, 4);
    });

    it('should round-trip correctly', () => {
      const original = oceanBeach;
      const mapboxArray = toBrandedMapboxArray(original);
      const back = fromBrandedMapboxArray(mapboxArray);

      expect(back.lat).toBe(original.lat);
      expect(back.lon).toBe(original.lon);
    });
  });

  describe('toBrandedMapboxLngLat()', () => {
    it('should convert to Mapbox LngLat object', () => {
      const lngLat = toBrandedMapboxLngLat(oceanBeach);

      expect(lngLat).toEqual({
        lng: expect.any(Number),
        lat: expect.any(Number),
      });

      expect(lngLat.lng).toBeCloseTo(-117.2506, 4);
      expect(lngLat.lat).toBeCloseTo(32.7539, 4);
    });
  });

  describe('fromBrandedMapboxLngLat()', () => {
    it('should convert from Mapbox LngLat object', () => {
      const lngLat = { lng: -117.2506, lat: 32.7539 };
      const coords = fromBrandedMapboxLngLat(lngLat);

      expect(coords.lat).toBeCloseTo(32.7539, 4);
      expect(coords.lon).toBeCloseTo(-117.2506, 4);
    });

    it('should round-trip correctly', () => {
      const original = oceanBeach;
      const lngLat = toBrandedMapboxLngLat(original);
      const back = fromBrandedMapboxLngLat(lngLat);

      expect(back.lat).toBe(original.lat);
      expect(back.lon).toBe(original.lon);
    });
  });

  // =========================================================================
  // BOUNDING BOX
  // =========================================================================

  describe('calculateBrandedBoundingBox()', () => {
    it('should calculate bounding box for multiple points', () => {
      const beaches = [oceanBeach, pacificBeach, lajolla];
      const bbox = calculateBrandedBoundingBox(beaches);

      expect(bbox).not.toBeNull();
      expect(bbox!.north).toBeGreaterThanOrEqual(oceanBeach.lat as number);
      expect(bbox!.south).toBeLessThanOrEqual(oceanBeach.lat as number);
      expect(bbox!.east).toBeGreaterThanOrEqual(oceanBeach.lon as number);
      expect(bbox!.west).toBeLessThanOrEqual(oceanBeach.lon as number);
    });

    it('should handle single point', () => {
      const bbox = calculateBrandedBoundingBox([oceanBeach]);

      expect(bbox).not.toBeNull();
      expect(bbox!.north).toBe(oceanBeach.lat);
      expect(bbox!.south).toBe(oceanBeach.lat);
      expect(bbox!.east).toBe(oceanBeach.lon);
      expect(bbox!.west).toBe(oceanBeach.lon);
    });

    it('should return null for empty array', () => {
      const bbox = calculateBrandedBoundingBox([]);
      expect(bbox).toBeNull();
    });

    it('should calculate correct bounds for San Diego beaches', () => {
      const beaches = [oceanBeach, pacificBeach, lajolla];
      const bbox = calculateBrandedBoundingBox(beaches);

      expect(bbox).not.toBeNull();

      // La Jolla is northernmost
      expect(bbox!.north).toBeCloseTo(32.8328, 4);

      // Ocean Beach is southernmost
      expect(bbox!.south).toBeCloseTo(32.7539, 4);

      // Pacific Beach is easternmost (less negative)
      expect(bbox!.east).toBeCloseTo(-117.2389, 4);

      // La Jolla is westernmost (more negative)
      expect(bbox!.west).toBeCloseTo(-117.2713, 4);
    });
  });

  describe('isCoordinateInBoundingBox()', () => {
    it('should return true for coordinate inside bbox', () => {
      const bbox: BrandedBoundingBox = {
        north: latitude(33),
        south: latitude(32),
        east: longitude(-117),
        west: longitude(-118),
      };

      const inside: BrandedCoordinates = {
        lat: latitude(32.5),
        lon: longitude(-117.5),
      };

      expect(isCoordinateInBoundingBox(inside, bbox)).toBe(true);
    });

    it('should return false for coordinate outside bbox', () => {
      const bbox: BrandedBoundingBox = {
        north: latitude(33),
        south: latitude(32),
        east: longitude(-117),
        west: longitude(-118),
      };

      const outside: BrandedCoordinates = {
        lat: latitude(31.5), // Too far south
        lon: longitude(-117.5),
      };

      expect(isCoordinateInBoundingBox(outside, bbox)).toBe(false);
    });

    it('should return true for coordinate on bbox edge', () => {
      const bbox: BrandedBoundingBox = {
        north: latitude(33),
        south: latitude(32),
        east: longitude(-117),
        west: longitude(-118),
      };

      const onEdge: BrandedCoordinates = {
        lat: latitude(33), // On north edge
        lon: longitude(-117.5),
      };

      expect(isCoordinateInBoundingBox(onEdge, bbox)).toBe(true);
    });
  });

  // =========================================================================
  // VALIDATION
  // =========================================================================

  describe('validateAndBrandCoordinates()', () => {
    it('should validate and brand correct coordinates', () => {
      const result = validateAndBrandCoordinates({ lat: 32.75, lon: -117.25 });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.coordinates.lat).toBe(32.75);
        expect(result.coordinates.lon).toBe(-117.25);
      }
    });

    it('should reject invalid latitude type', () => {
      const result = validateAndBrandCoordinates({ lat: '32.75', lon: -117.25 });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toMatch(/latitude.*number/i);
      }
    });

    it('should reject invalid longitude type', () => {
      const result = validateAndBrandCoordinates({ lat: 32.75, lon: '-117.25' });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toMatch(/longitude.*number/i);
      }
    });

    it('should reject out-of-range latitude', () => {
      const result = validateAndBrandCoordinates({ lat: 91, lon: -117.25 });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toMatch(/latitude.*out of range/i);
      }
    });

    it('should reject out-of-range longitude', () => {
      const result = validateAndBrandCoordinates({ lat: 32.75, lon: 181 });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toMatch(/longitude.*out of range/i);
      }
    });

    it('should reject non-finite values', () => {
      const nanResult = validateAndBrandCoordinates({ lat: NaN, lon: -117.25 });
      expect(nanResult.valid).toBe(false);

      const infResult = validateAndBrandCoordinates({ lat: 32.75, lon: Infinity });
      expect(infResult.valid).toBe(false);
    });
  });

  describe('batchValidateAndBrand()', () => {
    it('should validate multiple coordinates', () => {
      const inputs = [
        { lat: 32.75, lon: -117.25 },
        { lat: 32.80, lon: -117.24 },
        { lat: 32.83, lon: -117.27 },
      ];

      const result = batchValidateAndBrand(inputs);

      expect(result.valid).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should separate valid and invalid coordinates', () => {
      const inputs = [
        { lat: 32.75, lon: -117.25 }, // Valid
        { lat: 91, lon: -117.25 }, // Invalid latitude
        { lat: 32.80, lon: 181 }, // Invalid longitude
      ];

      const result = batchValidateAndBrand(inputs);

      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[1].index).toBe(2);
    });

    it('should handle empty array', () => {
      const result = batchValidateAndBrand([]);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle all invalid coordinates', () => {
      const inputs = [
        { lat: 91, lon: -117.25 },
        { lat: 32.75, lon: 181 },
      ];

      const result = batchValidateAndBrand(inputs);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
    });
  });

  // =========================================================================
  // SORTING AND FILTERING
  // =========================================================================

  describe('sortByDistance()', () => {
    it('should sort coordinates by distance from reference', () => {
      const reference = oceanBeach;
      const beaches = [lajolla, pacificBeach, oceanBeach];

      const sorted = sortByDistance(beaches, reference);

      // Ocean Beach should be first (0 distance)
      expect(sorted[0].distance).toBeCloseTo(0, 5);
      expect(sorted[0].coordinates).toBe(oceanBeach);

      // Distances should be in ascending order
      expect(sorted[0].distance).toBeLessThan(sorted[1].distance);
      expect(sorted[1].distance).toBeLessThan(sorted[2].distance);
    });

    it('should sort in descending order when specified', () => {
      const reference = oceanBeach;
      const beaches = [lajolla, pacificBeach, oceanBeach];

      const sorted = sortByDistance(beaches, reference, false);

      // Furthest should be first
      expect(sorted[0].distance).toBeGreaterThan(sorted[1].distance);
      expect(sorted[1].distance).toBeGreaterThan(sorted[2].distance);

      // Ocean Beach should be last (0 distance)
      expect(sorted[2].distance).toBeCloseTo(0, 5);
    });

    it('should include distance metadata', () => {
      const sorted = sortByDistance([pacificBeach], oceanBeach);

      expect(sorted[0].distance).toBeGreaterThan(0);
      expect(sorted[0].coordinates).toBe(pacificBeach);
    });
  });

  describe('filterByDistance()', () => {
    it('should filter coordinates within max distance', () => {
      const reference = oceanBeach;
      const beaches = [oceanBeach, pacificBeach, lajolla];

      // Filter to within 4 miles
      const nearby = filterByDistance(beaches, reference, 4, 'miles');

      // Ocean Beach and Pacific Beach should be included
      // La Jolla is further than 4 miles
      expect(nearby.length).toBeLessThan(beaches.length);
      expect(nearby).toContainEqual(oceanBeach);
    });

    it('should work with different units', () => {
      const reference = oceanBeach;
      const beaches = [oceanBeach, pacificBeach, lajolla];

      const nearbyKm = filterByDistance(beaches, reference, 6, 'km');
      const nearbyMiles = filterByDistance(beaches, reference, 4, 'miles');

      // Both should filter out some beaches
      expect(nearbyKm.length).toBeGreaterThan(0);
      expect(nearbyMiles.length).toBeGreaterThan(0);
    });

    it('should return empty array if none within range', () => {
      const reference = oceanBeach;
      const beaches = [lajolla];

      // Filter to within 1 mile (La Jolla is further)
      const nearby = filterByDistance(beaches, reference, 1, 'miles');

      expect(nearby).toHaveLength(0);
    });

    it('should include reference point when in array', () => {
      const reference = oceanBeach;
      const beaches = [oceanBeach, pacificBeach];

      const nearby = filterByDistance(beaches, reference, 0.1, 'miles');

      expect(nearby).toContainEqual(oceanBeach);
    });
  });
});
