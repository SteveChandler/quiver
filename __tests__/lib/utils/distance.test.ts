import {
  calculateDistanceMeters,
  calculateDistanceKm,
  calculateDistanceMiles,
  isWithinDistance,
  calculateDistanceBetweenCoords,
  calculateDistanceBetweenCoordsKm,
  areCoordsWithinDistance,
  findClosestCoordinate,
  type Coordinates,
} from "@/lib/utils/distance";

describe("calculateDistanceMeters", () => {
  it("should calculate distance between San Diego and Los Angeles correctly", () => {
    const sanDiego = { lat: 32.715736, lon: -117.161087 };
    const losAngeles = { lat: 34.052235, lon: -118.243683 };

    const distance = calculateDistanceMeters(
      sanDiego.lat,
      sanDiego.lon,
      losAngeles.lat,
      losAngeles.lon
    );

    // Distance should be approximately 179 km (179,000 meters)
    expect(distance).toBeGreaterThan(178000);
    expect(distance).toBeLessThan(180000);
  });

  it("should return 0 for same coordinates", () => {
    const lat = 32.715736;
    const lon = -117.161087;

    const distance = calculateDistanceMeters(lat, lon, lat, lon);

    expect(distance).toBe(0);
  });

  it("should return NaN for invalid coordinates", () => {
    expect(calculateDistanceMeters(NaN, -117.0, 33.0, -117.0)).toBeNaN();
    expect(calculateDistanceMeters(32.0, NaN, 33.0, -117.0)).toBeNaN();
    expect(calculateDistanceMeters(32.0, -117.0, NaN, -117.0)).toBeNaN();
    expect(calculateDistanceMeters(32.0, -117.0, 33.0, NaN)).toBeNaN();
    expect(calculateDistanceMeters(Infinity, -117.0, 33.0, -117.0)).toBeNaN();
  });

  it("should handle negative coordinates correctly", () => {
    // Southern hemisphere
    const sydney = { lat: -33.8688, lon: 151.2093 };
    const melbourne = { lat: -37.8136, lon: 144.9631 };

    const distance = calculateDistanceMeters(
      sydney.lat,
      sydney.lon,
      melbourne.lat,
      melbourne.lon
    );

    // Distance should be approximately 714 km
    expect(distance).toBeGreaterThan(700000);
    expect(distance).toBeLessThan(730000);
  });

  it("should calculate short distances accurately", () => {
    // Two points about 1 km apart in San Diego
    const point1 = { lat: 32.7157, lon: -117.1611 };
    const point2 = { lat: 32.7247, lon: -117.1611 }; // ~1km north

    const distance = calculateDistanceMeters(
      point1.lat,
      point1.lon,
      point2.lat,
      point2.lon
    );

    // Should be approximately 1000 meters
    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(1100);
  });
});

describe("calculateDistanceKm", () => {
  it("should return distance in kilometers", () => {
    const sanDiego = { lat: 32.715736, lon: -117.161087 };
    const losAngeles = { lat: 34.052235, lon: -118.243683 };

    const distanceKm = calculateDistanceKm(
      sanDiego.lat,
      sanDiego.lon,
      losAngeles.lat,
      losAngeles.lon
    );

    // Distance should be approximately 179 km
    expect(distanceKm).toBeGreaterThan(178);
    expect(distanceKm).toBeLessThan(180);
  });
});

describe("calculateDistanceMiles", () => {
  it("should return distance in miles", () => {
    const sanDiego = { lat: 32.715736, lon: -117.161087 };
    const losAngeles = { lat: 34.052235, lon: -118.243683 };

    const distanceMiles = calculateDistanceMiles(
      sanDiego.lat,
      sanDiego.lon,
      losAngeles.lat,
      losAngeles.lon
    );

    // Distance should be approximately 111 miles
    expect(distanceMiles).toBeGreaterThan(110);
    expect(distanceMiles).toBeLessThan(113);
  });
});

describe("isWithinDistance", () => {
  it("should return true when points are within distance", () => {
    const point1 = { lat: 32.7157, lon: -117.1611 };
    const point2 = { lat: 32.7247, lon: -117.1611 }; // ~1km north

    expect(
      isWithinDistance(point1.lat, point1.lon, point2.lat, point2.lon, 2000)
    ).toBe(true);
  });

  it("should return false when points are outside distance", () => {
    const point1 = { lat: 32.7157, lon: -117.1611 };
    const point2 = { lat: 32.7247, lon: -117.1611 }; // ~1km north

    expect(
      isWithinDistance(point1.lat, point1.lon, point2.lat, point2.lon, 500)
    ).toBe(false);
  });

  it("should return false for invalid coordinates", () => {
    expect(isWithinDistance(NaN, -117.0, 33.0, -117.0, 1000)).toBe(false);
  });
});

describe("Coordinate object functions", () => {
  describe("calculateDistanceBetweenCoords", () => {
    it("should calculate distance between coordinate objects", () => {
      const coord1: Coordinates = { lat: 32.715736, lon: -117.161087 };
      const coord2: Coordinates = { lat: 34.052235, lon: -118.243683 };

      const distance = calculateDistanceBetweenCoords(coord1, coord2);

      expect(distance).toBeGreaterThan(178000);
      expect(distance).toBeLessThan(180000);
    });

    it("should return NaN for null coordinates", () => {
      const coord1: Coordinates = { lat: 32.715736, lon: -117.161087 };

      expect(calculateDistanceBetweenCoords(null as unknown as Coordinates, coord1)).toBeNaN();
      expect(calculateDistanceBetweenCoords(coord1, null as unknown as Coordinates)).toBeNaN();
    });
  });

  describe("calculateDistanceBetweenCoordsKm", () => {
    it("should calculate distance in km between coordinate objects", () => {
      const coord1: Coordinates = { lat: 32.715736, lon: -117.161087 };
      const coord2: Coordinates = { lat: 34.052235, lon: -118.243683 };

      const distance = calculateDistanceBetweenCoordsKm(coord1, coord2);

      expect(distance).toBeGreaterThan(178);
      expect(distance).toBeLessThan(180);
    });
  });

  describe("areCoordsWithinDistance", () => {
    it("should return true when coordinates are within distance", () => {
      const coord1: Coordinates = { lat: 32.7157, lon: -117.1611 };
      const coord2: Coordinates = { lat: 32.7247, lon: -117.1611 };

      expect(areCoordsWithinDistance(coord1, coord2, 2000)).toBe(true);
    });

    it("should return false when coordinates are outside distance", () => {
      const coord1: Coordinates = { lat: 32.7157, lon: -117.1611 };
      const coord2: Coordinates = { lat: 32.7247, lon: -117.1611 };

      expect(areCoordsWithinDistance(coord1, coord2, 500)).toBe(false);
    });

    it("should return false for null coordinates", () => {
      const coord1: Coordinates = { lat: 32.7157, lon: -117.1611 };

      expect(areCoordsWithinDistance(null as unknown as Coordinates, coord1, 1000)).toBe(false);
    });
  });

  describe("findClosestCoordinate", () => {
    it("should find the closest coordinate from an array", () => {
      const reference: Coordinates = { lat: 32.7157, lon: -117.1611 };
      const candidates: Coordinates[] = [
        { lat: 34.0522, lon: -118.2437 }, // Los Angeles (~179km)
        { lat: 32.7247, lon: -117.1611 }, // ~1km north
        { lat: 33.1581, lon: -117.3506 }, // Oceanside (~50km)
      ];

      const result = findClosestCoordinate(reference, candidates);

      expect(result).not.toBeNull();
      expect(result!.coordinate.lat).toBe(32.7247);
      expect(result!.distance).toBeGreaterThan(900);
      expect(result!.distance).toBeLessThan(1100);
    });

    it("should return null for empty candidates array", () => {
      const reference: Coordinates = { lat: 32.7157, lon: -117.1611 };

      expect(findClosestCoordinate(reference, [])).toBeNull();
    });

    it("should return null for null reference", () => {
      const candidates: Coordinates[] = [
        { lat: 34.0522, lon: -118.2437 },
      ];

      expect(findClosestCoordinate(null as unknown as Coordinates, candidates)).toBeNull();
    });

    it("should skip invalid coordinates in candidates", () => {
      const reference: Coordinates = { lat: 32.7157, lon: -117.1611 };
      const candidates: Coordinates[] = [
        { lat: NaN, lon: -118.2437 }, // Invalid
        { lat: 32.7247, lon: -117.1611 }, // Valid, ~1km north
      ];

      const result = findClosestCoordinate(reference, candidates);

      expect(result).not.toBeNull();
      expect(result!.coordinate.lat).toBe(32.7247);
    });
  });
});
