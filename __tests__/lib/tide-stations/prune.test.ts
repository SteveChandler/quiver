jest.mock("@/lib/tide-stations/kept-station-slugs.json", () => ({
  _source: "test",
  linked: ["linked-ca-1"],
  visited: ["visited-ca-2"],
  searched: ["searched-gbr-3"],
}));

import { closedTideStationRedirectPath, isTideStationKept, isTideStationPruneOn } from "@/lib/tide-stations/prune";

const original = process.env.TIDE_STATION_PRUNE;

afterEach(() => {
  if (original === undefined) delete process.env.TIDE_STATION_PRUNE;
  else process.env.TIDE_STATION_PRUNE = original;
});

describe("tide station keep rule", () => {
  it("keeps a station on any of the three lists and closes the rest", () => {
    delete process.env.TIDE_STATION_PRUNE;
    expect(isTideStationPruneOn()).toBe(true);
    expect(isTideStationKept("linked-ca-1")).toBe(true);
    expect(isTideStationKept("visited-ca-2")).toBe(true);
    expect(isTideStationKept("searched-gbr-3")).toBe(true);
    expect(isTideStationKept("nobody-ca-4")).toBe(false);
  });

  it("keeps every station when TIDE_STATION_PRUNE is false", () => {
    process.env.TIDE_STATION_PRUNE = "false";
    expect(isTideStationPruneOn()).toBe(false);
    expect(isTideStationKept("nobody-ca-4")).toBe(true);
  });

  it("prunes for any other flag value", () => {
    process.env.TIDE_STATION_PRUNE = "true";
    expect(isTideStationKept("nobody-ca-4")).toBe(false);
    process.env.TIDE_STATION_PRUNE = "";
    expect(isTideStationKept("nobody-ca-4")).toBe(false);
  });
});

describe("closed tide station redirect target", () => {
  it("sends a US station to its region hub", () => {
    expect(closedTideStationRedirectPath({ country_slug: "usa", region: "CA", region_slug: "ca" })).toBe("/tides/usa/ca");
  });

  it("sends a US station without a region to the country hub", () => {
    expect(closedTideStationRedirectPath({ country_slug: "usa", region: null, region_slug: null })).toBe("/tides/usa");
  });

  it("sends a non-US station to its country hub, which lists it", () => {
    expect(closedTideStationRedirectPath({ country_slug: "japan", region: "Hokkaido", region_slug: "hokkaido" })).toBe(
      "/tides/japan"
    );
  });

  it("falls back to /tides without a country", () => {
    expect(closedTideStationRedirectPath({ country_slug: "", region: null, region_slug: null })).toBe("/tides");
  });
});
