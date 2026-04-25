import {
  calculateDistance,
  calculateDistanceFormatted,
  calculateDistanceInMiles,
  calculateDistanceLegacy,
  toRadians,
  formatDistanceDisplay,
  bearingFromTo,
  compassPointToWord,
  type CompassPoint,
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

describe("formatDistanceDisplay", () => {
  describe("compact variant", () => {
    it("returns null for undefined distance", () => {
      expect(formatDistanceDisplay(undefined, "compact")).toBeNull();
    });

    it("returns null for null distance", () => {
      expect(formatDistanceDisplay(null, "compact")).toBeNull();
    });

    it("returns null for zero distance", () => {
      expect(formatDistanceDisplay(0, "compact")).toBeNull();
    });

    it("returns null for negative distance", () => {
      expect(formatDistanceDisplay(-5, "compact")).toBeNull();
    });

    it("returns null for NaN", () => {
      expect(formatDistanceDisplay(NaN, "compact")).toBeNull();
    });

    it("uses decimal for distances under 10 miles", () => {
      expect(formatDistanceDisplay(3.5, "compact")).toBe("3.5 mi away");
      expect(formatDistanceDisplay(0.1, "compact")).toBe("0.1 mi away");
      expect(formatDistanceDisplay(9.9, "compact")).toBe("9.9 mi away");
    });

    it("rounds distances of 10 miles or more", () => {
      expect(formatDistanceDisplay(10, "compact")).toBe("10 mi away");
      expect(formatDistanceDisplay(15.7, "compact")).toBe("16 mi away");
      expect(formatDistanceDisplay(100.4, "compact")).toBe("100 mi away");
    });

    it("defaults to compact variant when no variant specified", () => {
      expect(formatDistanceDisplay(3.5)).toBe("3.5 mi away");
      expect(formatDistanceDisplay(15.7)).toBe("16 mi away");
    });
  });

  describe("full variant", () => {
    it("returns null for undefined distance", () => {
      expect(formatDistanceDisplay(undefined, "full")).toBeNull();
    });

    it("returns null for zero distance", () => {
      expect(formatDistanceDisplay(0, "full")).toBeNull();
    });

    it("always rounds and uses full word", () => {
      expect(formatDistanceDisplay(3.5, "full")).toBe("4 miles away");
      expect(formatDistanceDisplay(3.4, "full")).toBe("3 miles away");
      expect(formatDistanceDisplay(15.7, "full")).toBe("16 miles away");
      expect(formatDistanceDisplay(0.6, "full")).toBe("1 miles away");
    });
  });
});

describe("bearingFromTo", () => {
  // San Diego coast as origin
  const origin = { lat: 32.75, lon: -117.25 };

  it("returns N for due north", () => {
    expect(bearingFromTo(origin, { lat: origin.lat + 1, lon: origin.lon })).toBe("N");
  });

  it("returns S for due south", () => {
    expect(bearingFromTo(origin, { lat: origin.lat - 1, lon: origin.lon })).toBe("S");
  });

  it("returns E for due east", () => {
    expect(bearingFromTo(origin, { lat: origin.lat, lon: origin.lon + 1 })).toBe("E");
  });

  it("returns W for due west", () => {
    expect(bearingFromTo(origin, { lat: origin.lat, lon: origin.lon - 1 })).toBe("W");
  });

  it("returns NE for northeast quadrant", () => {
    expect(bearingFromTo(origin, { lat: origin.lat + 1, lon: origin.lon + 1 })).toBe("NE");
  });

  it("returns NW for northwest quadrant", () => {
    expect(bearingFromTo(origin, { lat: origin.lat + 1, lon: origin.lon - 1 })).toBe("NW");
  });

  it("returns SE for southeast quadrant", () => {
    expect(bearingFromTo(origin, { lat: origin.lat - 1, lon: origin.lon + 1 })).toBe("SE");
  });

  it("returns SW for southwest quadrant", () => {
    expect(bearingFromTo(origin, { lat: origin.lat - 1, lon: origin.lon - 1 })).toBe("SW");
  });

  it("returns N when target equals origin (deterministic same-point)", () => {
    expect(bearingFromTo(origin, origin)).toBe("N");
  });

  it("handles antimeridian crossing (E across 180 lon)", () => {
    // From slightly west of antimeridian to slightly east — short arc is east.
    expect(bearingFromTo({ lat: 0, lon: 179 }, { lat: 0, lon: -179 })).toBe("E");
  });

  it("handles antimeridian crossing (W across 180 lon)", () => {
    expect(bearingFromTo({ lat: 0, lon: -179 }, { lat: 0, lon: 179 })).toBe("W");
  });

  it("snaps a real-world OB Pier -> The Rock vector to N quadrant", () => {
    // Ocean Beach Pier (San Diego) to The Rock (Oceanside) — ~ due north along coast
    const obPier = { lat: 32.749, lon: -117.252 };
    const theRock = { lat: 33.205, lon: -117.395 };
    const bearing = bearingFromTo(obPier, theRock);
    expect(["N", "NW", "NNW"].includes(bearing as string) || bearing === "NW" || bearing === "N").toBe(true);
  });
});

describe("compassPointToWord", () => {
  it.each<[CompassPoint, string]>([
    ["N", "north"],
    ["NE", "northeast"],
    ["E", "east"],
    ["SE", "southeast"],
    ["S", "south"],
    ["SW", "southwest"],
    ["W", "west"],
    ["NW", "northwest"],
  ])("maps %s to %s", (input, expected) => {
    expect(compassPointToWord(input)).toBe(expected);
  });
});
