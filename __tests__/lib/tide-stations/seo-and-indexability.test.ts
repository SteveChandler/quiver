import { evaluateTideHubIndexability, evaluateTideStationIndexability } from "@/lib/seo/indexability";
import { buildStationCopy } from "@/lib/tide-stations/copy";
import { buildHubTitle, buildStationDescription, buildStationTitle } from "@/lib/tide-stations/seo";
import type { TideExtremePoint } from "@/lib/tide-stations/series";
import type { TideStationRow } from "@/lib/tide-stations/types";

const noaaStation: TideStationRow = {
  id: "noaa:9410230",
  source: "noaa",
  source_station_id: "9410230",
  name: "La Jolla",
  slug: "la-jolla-ca-9410230",
  country_code: "US",
  country_slug: "usa",
  region: "CA",
  region_slug: "ca",
  lat: 32.867,
  lon: -117.257,
  timezone: "America/Los_Angeles",
  station_kind: "reference",
  reference_station_id: null,
  datum_label: "MLLW",
  datum_offset_m: null,
  constituents: null,
  operator: "NOAA CO-OPS",
  licence: "us-public-domain",
  licence_url: "https://tidesandcurrents.noaa.gov/disclaimers.html",
  attribution: "Tide predictions from NOAA CO-OPS (tidesandcurrents.noaa.gov).",
  commercial_use: true,
  active: true,
};

describe("tide station indexability", () => {
  it("indexes a station only when predictions loaded", () => {
    expect(evaluateTideStationIndexability({ predictionsAvailable: true })).toEqual({ indexable: true, reason: "forecast-approved" });
    expect(evaluateTideStationIndexability({ predictionsAvailable: false })).toEqual({ indexable: false, reason: "forecast-missing" });
  });

  it("does not index an empty hub", () => {
    expect(evaluateTideHubIndexability(0).indexable).toBe(false);
    expect(evaluateTideHubIndexability(12).indexable).toBe(true);
  });
});

describe("tide station SEO copy", () => {
  it("puts name and place in the title and fits 60 characters", () => {
    expect(buildStationTitle(noaaStation)).toBe("La Jolla, California Tide Times & Chart");
    const long = buildStationTitle({ ...noaaStation, name: "Brunswick River Entrance, Fort Caswell Beach Approach" });
    expect(long.length).toBeLessThanOrEqual(60);
  });

  it("says not for navigation and carries no times", () => {
    const description = buildStationDescription(noaaStation);
    expect(description).toContain("Not for navigation");
    expect(description).toContain("NOAA CO-OPS predictions");
    expect(description).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats hub titles with counts", () => {
    expect(buildHubTitle("California", 193)).toBe("California Tide Times: 193 Tide Stations");
    expect(buildHubTitle(null, 6123)).toBe("Tide Times by Country: 6,123 Tide Stations");
  });

  it("builds station text from the station's own facts", () => {
    const extremes: TideExtremePoint[] = Array.from({ length: 28 }, (_, i) => ({
      ts: new Date(Date.parse("2026-11-10T00:00:00Z") + i * 6.21 * 3_600_000).toISOString(),
      type: i % 2 === 0 ? "high" : "low",
      heightM: i % 2 === 0 ? 1.6 : 0.1,
    }));
    const copy = buildStationCopy({
      station: noaaStation,
      extremes,
      tideType: { type: "semidiurnal", formFactor: null, basis: "predicted-extremes" },
      nearestBeach: { name: "Windansea", distanceKm: 2.4 },
    });
    expect(copy.join(" ")).toContain("La Jolla is a NOAA reference station in California");
    expect(copy.join(" ")).toContain("Semidiurnal");
    expect(copy.join(" ")).toContain("4.9 ft");
    expect(copy.join(" ")).toContain("Windansea, 2 km away");
    expect(copy.join(" ").toLowerCase()).not.toContain("the call");
  });
});
