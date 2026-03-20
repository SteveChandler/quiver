/**
 * @jest-environment node
 */

import { matchToMetroArea, DEFAULT_LOCATION } from "@/lib/location/ip-location";
import type { IPLocationData } from "@/lib/location/types";

describe("matchToMetroArea", () => {
  it("returns San Diego metro when city matches a known city", () => {
    const ipLocation: IPLocationData = {
      city: "La Jolla",
      region: "CA",
      country: "US",
      latitude: 32.8328,
      longitude: -117.2713,
    };

    const result = matchToMetroArea(ipLocation);

    expect(result.slug).toBe("san-diego");
    expect(result.displayName).toBe("San Diego");
    expect(result.coordinates).toEqual({ lat: 32.7157, lon: -117.1611 });
  });

  it("returns Orange County metro when city matches", () => {
    const ipLocation: IPLocationData = {
      city: "Huntington Beach",
      region: "CA",
      country: "US",
      latitude: 33.6595,
      longitude: -117.9988,
    };

    const result = matchToMetroArea(ipLocation);

    expect(result.slug).toBe("orange-county");
    expect(result.displayName).toBe("Orange County");
  });

  it("returns raw IP coordinates when no metro matches but coords exist", () => {
    const ipLocation: IPLocationData = {
      city: "Woodbridge",
      region: "NJ",
      country: "US",
      latitude: 40.56,
      longitude: -74.28,
    };

    const result = matchToMetroArea(ipLocation);

    expect(result.slug).toBeNull();
    expect(result.coordinates).toEqual({ lat: 40.56, lon: -74.28 });
  });

  it("returns display name from IP city/region when no metro matches", () => {
    const ipLocation: IPLocationData = {
      city: "Woodbridge",
      region: "NJ",
      country: "US",
      latitude: 40.56,
      longitude: -74.28,
    };

    const result = matchToMetroArea(ipLocation);

    expect(result.displayName).toBe("Woodbridge, NJ");
  });

  it("falls back to DEFAULT_LOCATION only when no coordinates available", () => {
    const ipLocation: IPLocationData = {
      city: null,
      region: null,
      country: null,
      latitude: null,
      longitude: null,
    };

    const result = matchToMetroArea(ipLocation);

    expect(result).toEqual(DEFAULT_LOCATION);
    expect(result.slug).toBe("san-diego");
  });

  it("returns coordinates for international locations", () => {
    const ipLocation: IPLocationData = {
      city: "Dublin",
      region: "Ireland",
      country: "IE",
      latitude: 53.35,
      longitude: -6.26,
    };

    const result = matchToMetroArea(ipLocation);

    expect(result.slug).toBeNull();
    expect(result.displayName).toBe("Dublin, Ireland");
    expect(result.coordinates).toEqual({ lat: 53.35, lon: -6.26 });
  });

  it("uses 'Your Area' when city and region are both null but coords exist", () => {
    const ipLocation: IPLocationData = {
      city: null,
      region: null,
      country: "US",
      latitude: 40.56,
      longitude: -74.28,
    };

    const result = matchToMetroArea(ipLocation);

    expect(result.slug).toBeNull();
    expect(result.displayName).toBe("Your Area");
    expect(result.coordinates).toEqual({ lat: 40.56, lon: -74.28 });
  });

  it("matches metro by coordinate proximity within 100 miles", () => {
    // Point near San Diego but with unknown city name
    const ipLocation: IPLocationData = {
      city: "UnknownCity",
      region: "CA",
      country: "US",
      latitude: 32.72,
      longitude: -117.16,
    };

    const result = matchToMetroArea(ipLocation);

    // Should match San Diego by proximity
    expect(result.slug).toBe("san-diego");
    expect(result.displayName).toBe("San Diego");
  });
});
