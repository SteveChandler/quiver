import { buildCityTideView } from "@/lib/tides/city-tide-view";
import type { TideMetaData } from "@/lib/seo/tide-meta-data";

jest.mock("@/lib/seo/tide-meta-data", () => ({
  ...jest.requireActual("@/lib/seo/tide-meta-data"),
  getTideMetaData: jest.fn(),
}));
jest.mock("@/lib/tides/city-tide-view", () => ({
  ...jest.requireActual("@/lib/tides/city-tide-view"),
  loadStationTideView: jest.fn(),
}));

import { getBeachTidePageData, stationTideMeta, toBeachStationTide } from "@/lib/tides/beach-station-tide";

const { getTideMetaData } = jest.requireMock("@/lib/seo/tide-meta-data");
const { loadStationTideView } = jest.requireMock("@/lib/tides/city-tide-view");

// Sat Nov 14 2026, 9:13 AM in Haleiwa.
const NOW = Date.parse("2026-11-14T19:13:00Z");

// NOAA 1612668 Haleiwa, Waialua Bay, Nov 14 (HST): H 6:26 AM, L 1:27 PM, H 6:47 PM, L 9:41 PM.
const HALEIWA = buildCityTideView({
  timeZone: "Pacific/Honolulu",
  renderedAtMs: NOW,
  station: { name: "Haleiwa, Waialua Bay", slug: "haleiwa-waialua-bay-hi-1612668", sourceStationId: "1612668" },
  adjustmentFt: 0,
  hourly: [],
  extremes: [
    { ts: "2026-11-14T16:26:00Z", type: "high", heightM: 0.47 },
    { ts: "2026-11-14T23:27:00Z", type: "low", heightM: 0.09 },
    { ts: "2026-11-15T04:47:00Z", type: "high", heightM: 0.13 },
    { ts: "2026-11-15T07:41:00Z", type: "low", heightM: 0.1 },
  ],
});

// What the hourly stored rows gave for the same tides: on the hour.
const ROWS: TideMetaData = {
  source: "noaa_hilo_interpolated",
  stationId: "1612668",
  nextHighTime: "7:00 PM",
  nextLowTime: "2:00 PM",
  nextHighHeight: 0.4,
  nextLowHeight: 0.3,
  nextHighAt: "2026-11-15T05:00:00Z",
  nextLowAt: "2026-11-15T00:00:00Z",
};

describe("stationTideMeta", () => {
  it("takes the next high and low from the station table, to the minute", () => {
    const meta = stationTideMeta(ROWS, HALEIWA, NOW);
    expect(meta).toMatchObject({
      source: "noaa_hilo_interpolated",
      stationId: "1612668",
      nextLowTime: "1:27 PM",
      nextLowHeight: 0.3,
      nextLowAt: "2026-11-14T23:27:00Z",
      nextHighTime: "6:47 PM",
      nextHighHeight: 0.4,
      nextHighAt: "2026-11-15T04:47:00Z",
    });
  });

  it("keeps the 24-hour window: an extreme past it is not the next one", () => {
    const meta = stationTideMeta(ROWS, HALEIWA, Date.parse("2026-11-13T19:00:00Z"));
    expect(meta.nextHighAt).toBe("2026-11-14T16:26:00Z");
    expect(meta.nextLowTime).toBeNull();
  });

  it("prints a low just under zero as 0, never -0", () => {
    const view = buildCityTideView({
      ...HALEIWA,
      hourly: [],
      extremes: [{ ts: "2026-11-14T23:27:00Z", type: "low", heightM: -0.01 }],
    });
    expect(Object.is(stationTideMeta(ROWS, view, NOW).nextLowHeight, 0)).toBe(true);
  });
});

describe("toBeachStationTide", () => {
  it("gives the client the station extremes in the tide_schedule shape", () => {
    expect(toBeachStationTide(HALEIWA)).toEqual({
      timeZone: "Pacific/Honolulu",
      stationName: "Haleiwa, Waialua Bay",
      schedule: [
        { time: Date.parse("2026-11-14T16:26:00Z") / 1000, height: expect.closeTo(1.542, 3), type: "high" },
        { time: Date.parse("2026-11-14T23:27:00Z") / 1000, height: expect.closeTo(0.295, 3), type: "low" },
        { time: Date.parse("2026-11-15T04:47:00Z") / 1000, height: expect.closeTo(0.427, 3), type: "high" },
        { time: Date.parse("2026-11-15T07:41:00Z") / 1000, height: expect.closeTo(0.328, 3), type: "low" },
      ],
    });
  });

  it("rounds a height once, so the strip and the hero print the same tenth", () => {
    // 1.72 m is 5.643 ft, and 1.7221 m is 5.650 ft: rounding to 3 dp first turned 5.6499 into 5.7.
    const view = buildCityTideView({ ...HALEIWA, hourly: [], extremes: [{ ts: "2026-11-14T23:27:00Z", type: "high", heightM: 1.72202 }] });
    const strip = toBeachStationTide(view)!.schedule[0].height.toFixed(1);
    const hero = stationTideMeta(ROWS, view, NOW).nextHighHeight!.toFixed(1);
    expect(strip).toBe(hero);
  });

  it("is null for a stored-series view with no station", () => {
    expect(toBeachStationTide({ ...HALEIWA, station: null })).toBeNull();
  });
});

describe("getBeachTidePageData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => jest.restoreAllMocks());

  it("shows the station table and keeps the stored rows for indexing", async () => {
    getTideMetaData.mockResolvedValue(ROWS);
    loadStationTideView.mockResolvedValue(HALEIWA);
    const data = await getBeachTidePageData("beach-station", "Pacific/Honolulu");
    expect(loadStationTideView).toHaveBeenCalledWith("1612668", NOW, "beach-page");
    expect(data.rows).toBe(ROWS);
    expect(data.display.nextLowTime).toBe("1:27 PM");
    expect(data.stationTide?.schedule).toHaveLength(4);
  });

  it("stays on the stored rows when the station table is not available", async () => {
    getTideMetaData.mockResolvedValue(ROWS);
    loadStationTideView.mockResolvedValue(null);
    const data = await getBeachTidePageData("beach-no-table", "Pacific/Honolulu");
    expect(data.display).toBe(ROWS);
    expect(data.stationTide).toBeNull();
  });

  it("does not call NOAA for model tides or an unknown read", async () => {
    getTideMetaData.mockResolvedValueOnce({ ...ROWS, source: "fes2022", stationId: null });
    await getBeachTidePageData("beach-model", null);
    getTideMetaData.mockResolvedValueOnce({ ...ROWS, availability: "sub-page-data-unknown" as const });
    await getBeachTidePageData("beach-unknown", null);
    expect(loadStationTideView).not.toHaveBeenCalled();
  });

  it("lets an unrelated error through instead of falling back", async () => {
    getTideMetaData.mockResolvedValue(ROWS);
    const bug = new TypeError("boom");
    loadStationTideView.mockRejectedValue(bug);
    await expect(getBeachTidePageData("beach-bug", null)).rejects.toBe(bug);
  });
});
