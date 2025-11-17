import {
  calculateDistance,
  calculateDistanceFormatted,
  calculateDistanceInMiles,
  calculateDistanceLegacy,
  toRadians,
} from "@/lib/utils/distance-utils";
import type { Coordinates } from "@/lib/types/coordinates";

describe("calculateDistance", () => {
  it("returns NaN when coordinates are invalid", () => {
    const invalid1: Coordinates = { lat: NaN, lon: -117.2 };
    const valid: Coordinates = { lat: 32.7, lon: -117.1 };
    const invalid2: Coordinates = { lat: 32.7, lon: NaN };
    const invalid3: Coordinates = { lat: Infinity, lon: -117.2 };

    expect(calculateDistance(invalid1, valid)).toBeNaN();
    expect(calculateDistance(valid, invalid2)).toBeNaN();
    expect(calculateDistance(invalid3, valid)).toBeNaN();
  });

  it("computes the haversine distance between two points in miles", () => {
    const sanDiego: Coordinates = { lat: 32.715736, lon: -117.161087 };
    const losAngeles: Coordinates = { lat: 34.052235, lon: -118.243683 };

    const miles = calculateDistance(sanDiego, losAngeles, "miles");

    expect(miles).toBeCloseTo(111.48, 1);
  });

  it("computes the haversine distance between two points in kilometers", () => {
    const sanDiego: Coordinates = { lat: 32.715736, lon: -117.161087 };
    const losAngeles: Coordinates = { lat: 34.052235, lon: -118.243683 };

    const km = calculateDistance(sanDiego, losAngeles, "km");

    expect(km).toBeCloseTo(179.4, 1);
  });

  it("computes the haversine distance between two points in meters", () => {
    const sanDiego: Coordinates = { lat: 32.715736, lon: -117.161087 };
    const losAngeles: Coordinates = { lat: 34.052235, lon: -118.243683 };

    const meters = calculateDistance(sanDiego, losAngeles, "meters");

    expect(meters).toBeCloseTo(179400, -2); // ~179.4 km
  });

  it("is zero when coordinates match exactly", () => {
    const location: Coordinates = { lat: 32.715736, lon: -117.161087 };
    expect(calculateDistance(location, location)).toBe(0);
  });
});

describe("calculateDistanceFormatted", () => {
  it("returns fallback when coordinates are invalid", () => {
    const invalid1: Coordinates = { lat: NaN, lon: -117.2 };
    const valid: Coordinates = { lat: 32.7, lon: -117.1 };
    const invalid2: Coordinates = { lat: 32.7, lon: NaN };

    expect(calculateDistanceFormatted(invalid1, valid)).toBe("—");
    expect(calculateDistanceFormatted(valid, invalid2)).toBe("—");
  });

  it("formats distance in miles with one decimal place", () => {
    const sanDiego: Coordinates = { lat: 32.715736, lon: -117.161087 };
    const losAngeles: Coordinates = { lat: 34.052235, lon: -118.243683 };

    const result = calculateDistanceFormatted(sanDiego, losAngeles, "miles");

    expect(result).toMatch(/^\d+\.\d miles$/);
    expect(result).toContain("111.5 miles");
  });

  it("formats distance in kilometers with one decimal place", () => {
    const sanDiego: Coordinates = { lat: 32.715736, lon: -117.161087 };
    const losAngeles: Coordinates = { lat: 34.052235, lon: -118.243683 };

    const result = calculateDistanceFormatted(sanDiego, losAngeles, "km");

    expect(result).toMatch(/^\d+\.\d km$/);
    expect(result).toContain("179.4 km");
  });

  it("returns 0.0 when coordinates match exactly", () => {
    const location: Coordinates = { lat: 32.715736, lon: -117.161087 };
    expect(calculateDistanceFormatted(location, location, "miles")).toBe(
      "0.0 miles"
    );
  });
});

describe("calculateDistanceInMiles", () => {
  it("computes distance in miles (convenience wrapper)", () => {
    const sanDiego: Coordinates = { lat: 32.715736, lon: -117.161087 };
    const losAngeles: Coordinates = { lat: 34.052235, lon: -118.243683 };

    const miles = calculateDistanceInMiles(sanDiego, losAngeles);

    expect(miles).toBeCloseTo(111.48, 1);
  });
});

describe("calculateDistanceLegacy", () => {
  it("computes distance using old signature (backward compatibility)", () => {
    const sanDiegoLat = 32.715736;
    const sanDiegoLng = -117.161087;
    const losAngelesLat = 34.052235;
    const losAngelesLng = -118.243683;

    const miles = calculateDistanceLegacy(
      sanDiegoLat,
      sanDiegoLng,
      losAngelesLat,
      losAngelesLng,
      "miles"
    );

    expect(miles).toBeCloseTo(111.48, 1);
  });

  it("handles lng parameter name (legacy compatibility)", () => {
    const km = calculateDistanceLegacy(
      32.715736,
      -117.161087, // lng parameter (old naming)
      34.052235,
      -118.243683, // lng parameter (old naming)
      "km"
    );

    expect(km).toBeCloseTo(179.4, 1);
  });
});

describe("toRadians", () => {
  it("converts degrees to radians", () => {
    expect(toRadians(0)).toBe(0);
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
    expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 10);
  });
});
