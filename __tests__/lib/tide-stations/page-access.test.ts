jest.mock("@/lib/tide-stations/kept-station-slugs.json", () => ({
  _source: "test",
  linked: [],
  visited: ["kept-ca-9410230"],
  searched: [],
}));
jest.mock("@/lib/tide-stations/predictions", () => ({ getStationSeries: jest.fn() }));
jest.mock("@/lib/tide-stations/queries", () => ({
  getTideStationBySlug: jest.fn(),
  isTideStationLinkedFromBeach: jest.fn(),
}));

import { getStationAccess } from "@/lib/tide-stations/page-data";
import { getStationSeries } from "@/lib/tide-stations/predictions";
import { getTideStationBySlug, isTideStationLinkedFromBeach } from "@/lib/tide-stations/queries";
import type { TideStationRow } from "@/lib/tide-stations/types";

const station = {
  id: "noaa:9410999",
  source: "noaa",
  source_station_id: "9410999",
  slug: "closed-ca-9410999",
  country_slug: "usa",
  region: "CA",
  region_slug: "ca",
} as TideStationRow;

const bySlug = jest.mocked(getTideStationBySlug);
const linked = jest.mocked(isTideStationLinkedFromBeach);
const original = process.env.TIDE_STATION_PRUNE;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.TIDE_STATION_PRUNE;
});
afterAll(() => {
  if (original === undefined) delete process.env.TIDE_STATION_PRUNE;
  else process.env.TIDE_STATION_PRUNE = original;
});

describe("tide station page access", () => {
  it("opens a snapshot station without the live beach probe", async () => {
    bySlug.mockResolvedValue({ ...station, slug: "kept-ca-9410230" });
    await expect(getStationAccess("kept-ca-9410230")).resolves.toEqual({ kind: "open" });
    expect(linked).not.toHaveBeenCalled();
  });

  it("opens a station a beach links today even when the snapshot misses it", async () => {
    bySlug.mockResolvedValue(station);
    linked.mockResolvedValue(true);
    await expect(getStationAccess(station.slug)).resolves.toEqual({ kind: "open" });
  });

  it("closes an unused station to its region hub without reading predictions", async () => {
    bySlug.mockResolvedValue(station);
    linked.mockResolvedValue(false);
    await expect(getStationAccess(station.slug)).resolves.toEqual({ kind: "closed", redirectPath: "/tides/usa/ca" });
    expect(getStationSeries).not.toHaveBeenCalled();
  });

  it("opens every station when TIDE_STATION_PRUNE is false", async () => {
    process.env.TIDE_STATION_PRUNE = "false";
    bySlug.mockResolvedValue(station);
    await expect(getStationAccess(station.slug)).resolves.toEqual({ kind: "open" });
    expect(linked).not.toHaveBeenCalled();
  });

  it("keeps an unknown slug a 404", async () => {
    bySlug.mockResolvedValue(null);
    await expect(getStationAccess("nope")).resolves.toEqual({ kind: "not-found" });
  });
});
