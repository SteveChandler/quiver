import {
  getStationDistanceKm,
  getStationForLocation,
} from "@/lib/services/noaa-coops/station-resolver";
import { COOPS_STATIONS } from "@/lib/services/noaa-coops/constants/station-mappings";
import { GEOGRAPHIC_STATIONS } from "@/lib/services/noaa-coops/constants/geographic-regions";
import { COOPS_STATION_COORDINATES } from "@/lib/services/noaa-coops/constants/station-coordinates";

const LA_JOLLA = "9410230";
const SANDY_HOOK = "8531680";
const LONG_BEACH_NY = { lat: 40.5834, lon: -73.6664 };

describe("getStationForLocation", () => {
  describe("blank names", () => {
    it("resolves by coordinates instead of matching the first station name", () => {
      // "" is a substring of every key, so it used to return La Jolla for any coordinates.
      expect(getStationForLocation("", LONG_BEACH_NY.lat, LONG_BEACH_NY.lon)).toBe(SANDY_HOOK);
      expect(getStationForLocation("   ", LONG_BEACH_NY.lat, LONG_BEACH_NY.lon)).toBe(SANDY_HOOK);
      expect(getStationForLocation("", 21.2765, -157.8225)).toBe("1612340"); // Waikiki -> Honolulu
    });

    it("falls back to La Jolla when there are no coordinates either", () => {
      expect(getStationForLocation("")).toBe(LA_JOLLA);
    });
  });

  describe("name matches", () => {
    it("skips a same-name station on another coast and keeps looking", () => {
      // "long-beach" is Long Beach, WA (Toke Point); "long-beach-ny" is the Sandy Hook entry.
      expect(getStationForLocation("Long Beach", LONG_BEACH_NY.lat, LONG_BEACH_NY.lon)).toBe(SANDY_HOOK);
      // "ocean-beach" is San Diego's; "ocean-beach-sf" is the Golden Gate entry.
      expect(getStationForLocation("Ocean Beach SF – Middle", 37.7601, -122.5123)).toBe("9414290");
    });

    it("falls through to the geographic lookup when no name match is in range", () => {
      // "newport" is Newport, OR (Southbeach), 1,330 km from Newport Beach, CA.
      expect(getStationForLocation("Newport 56th St", 33.6128, -117.9298)).toBe("9410580");
      // "seaside" is Seaside, OR (Astoria); Seaside Reef is in Solana Beach.
      expect(getStationForLocation("Seaside Reef", 32.9988, -117.278)).toBe("9410170");
    });

    it("keeps a nearby name match", () => {
      expect(getStationForLocation("Windansea", 32.8299, -117.2823)).toBe(LA_JOLLA);
      expect(getStationForLocation("Pipeline", 21.6644, -158.0517)).toBe("1612340");
    });

    it("trusts the name match when no coordinates are given", () => {
      expect(getStationForLocation("Long Beach")).toBe(COOPS_STATIONS["long-beach"]);
    });
  });

  it("has coordinates for every station it can return", () => {
    const stationIds = new Set([
      ...Object.values(COOPS_STATIONS),
      ...GEOGRAPHIC_STATIONS.map((region) => region.stationId),
      LA_JOLLA,
    ]);
    const missing = [...stationIds].filter((id) => !COOPS_STATION_COORDINATES[id]);
    expect(missing).toEqual([]);
  });
});

describe("getStationDistanceKm", () => {
  it("measures from a point to a known station", () => {
    expect(getStationDistanceKm(LA_JOLLA, 32.8299, -117.2823)).toBeCloseTo(4.7, 0);
  });

  it("returns null for a station without coordinates", () => {
    expect(getStationDistanceKm("0000000", 32.8299, -117.2823)).toBeNull();
  });
});
