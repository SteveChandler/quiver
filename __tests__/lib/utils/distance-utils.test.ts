import {
  calculateDistance,
  calculateDistanceFormatted,
  calculateDistanceInMiles,
  toRadians,
} from "@/lib/utils/distance-utils";

describe("calculateDistance", () => {
  it("returns NaN when coordinates are invalid", () => {
    expect(calculateDistance(NaN, -117.2, 32.7, -117.1)).toBeNaN();
    expect(calculateDistance(32.7, NaN, 32.7, -117.1)).toBeNaN();
    expect(calculateDistance(32.7, -117.2, NaN, -117.1)).toBeNaN();
    expect(calculateDistance(32.7, -117.2, 32.7, NaN)).toBeNaN();
    expect(calculateDistance(Infinity, -117.2, 32.7, -117.1)).toBeNaN();
    expect(calculateDistance(32.7, -117.2, 32.7, Infinity)).toBeNaN();
  });

  it("computes the haversine distance between two points in miles", () => {
    const sanDiegoLat = 32.715736;
    const sanDiegoLng = -117.161087;
    const losAngelesLat = 34.052235;
    const losAngelesLng = -118.243683;

    const miles = calculateDistance(
      sanDiegoLat,
      sanDiegoLng,
      losAngelesLat,
      losAngelesLng,
      "miles"
    );

    expect(miles).toBeCloseTo(111.48, 1);
  });

  it("computes the haversine distance between two points in kilometers", () => {
    const sanDiegoLat = 32.715736;
    const sanDiegoLng = -117.161087;
    const losAngelesLat = 34.052235;
    const losAngelesLng = -118.243683;

    const km = calculateDistance(
      sanDiegoLat,
      sanDiegoLng,
      losAngelesLat,
      losAngelesLng,
      "km"
    );

    expect(km).toBeCloseTo(179.4, 1);
  });

  it("is zero when coordinates match exactly", () => {
    const lat = 32.715736;
    const lng = -117.161087;
    expect(calculateDistance(lat, lng, lat, lng)).toBe(0);
  });
});

describe("calculateDistanceFormatted", () => {
  it("returns fallback when coordinates are invalid", () => {
    expect(calculateDistanceFormatted(NaN, -117.2, 32.7, -117.1)).toBe("—");
    expect(calculateDistanceFormatted(32.7, NaN, 32.7, -117.1)).toBe("—");
    expect(calculateDistanceFormatted(32.7, -117.2, NaN, -117.1)).toBe("—");
    expect(calculateDistanceFormatted(32.7, -117.2, 32.7, NaN)).toBe("—");
  });

  it("formats distance in miles with one decimal place", () => {
    const sanDiegoLat = 32.715736;
    const sanDiegoLng = -117.161087;
    const losAngelesLat = 34.052235;
    const losAngelesLng = -118.243683;

    const result = calculateDistanceFormatted(
      sanDiegoLat,
      sanDiegoLng,
      losAngelesLat,
      losAngelesLng,
      "miles"
    );

    expect(result).toMatch(/^\d+\.\d miles$/);
    expect(result).toContain("111.5 miles");
  });

  it("formats distance in kilometers with one decimal place", () => {
    const sanDiegoLat = 32.715736;
    const sanDiegoLng = -117.161087;
    const losAngelesLat = 34.052235;
    const losAngelesLng = -118.243683;

    const result = calculateDistanceFormatted(
      sanDiegoLat,
      sanDiegoLng,
      losAngelesLat,
      losAngelesLng,
      "km"
    );

    expect(result).toMatch(/^\d+\.\d km$/);
    expect(result).toContain("179.4 km");
  });

  it("returns 0.0 when coordinates match exactly", () => {
    const lat = 32.715736;
    const lng = -117.161087;
    expect(calculateDistanceFormatted(lat, lng, lat, lng, "miles")).toBe(
      "0.0 miles"
    );
  });
});

describe("calculateDistanceInMiles", () => {
  it("computes distance in miles (legacy compatibility)", () => {
    const sanDiegoLat = 32.715736;
    const sanDiegoLng = -117.161087;
    const losAngelesLat = 34.052235;
    const losAngelesLng = -118.243683;

    const miles = calculateDistanceInMiles(
      sanDiegoLat,
      sanDiegoLng,
      losAngelesLat,
      losAngelesLng
    );

    expect(miles).toBeCloseTo(111.48, 1);
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
