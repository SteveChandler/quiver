import { cityTideHeadline, buildCityTideView, loadStationTideView } from "@/lib/tides/city-tide-view";
import { redirect } from "next/navigation";

import { formatFeet } from "@/lib/tide-stations/format";

jest.mock("@/lib/tide-stations/queries", () => ({
  getNoaaTideStationBySourceId: jest.fn(),
}));
jest.mock("@/lib/tide-stations/predictions", () => ({
  getStationSeries: jest.fn(),
}));

const { getNoaaTideStationBySourceId } = jest.requireMock("@/lib/tide-stations/queries");
const { getStationSeries } = jest.requireMock("@/lib/tide-stations/predictions");

const STATION = {
  id: "noaa:1612668",
  source: "noaa",
  source_station_id: "1612668",
  name: "Haleiwa, Waialua Bay",
  slug: "haleiwa-waialua-bay-hi-1612668",
  timezone: "Pacific/Honolulu",
  station_kind: "subordinate",
};
const NOW = Date.parse("2026-11-13T02:40:00Z");

describe("loadStationTideView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("skips synthetic cached_ ids without a registry lookup", async () => {
    await expect(loadStationTideView("cached_beach-1", NOW)).resolves.toBeNull();
    expect(getNoaaTideStationBySourceId).not.toHaveBeenCalled();
  });

  it("falls back (null) when NOAA fails with an ordinary error", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    getNoaaTideStationBySourceId.mockResolvedValue(STATION);
    getStationSeries.mockRejectedValue(new Error("NOAA 503"));
    await expect(loadStationTideView("1612668", NOW)).resolves.toBeNull();
  });

  it("lets Next.js render-control errors through instead of falling back", async () => {
    getNoaaTideStationBySourceId.mockResolvedValue(STATION);
    let control: unknown;
    try {
      redirect("/tides");
    } catch (error) {
      control = error;
    }
    getStationSeries.mockRejectedValue(control);
    await expect(loadStationTideView("1612668", NOW)).rejects.toBe(control);
  });

  it("returns null when NOAA has no table for the station", async () => {
    getNoaaTideStationBySourceId.mockResolvedValue(STATION);
    getStationSeries.mockResolvedValue({ status: "failed", reason: "noaa-empty" });
    await expect(loadStationTideView("1612668", NOW)).resolves.toBeNull();
  });
});

describe("cityTideHeadline", () => {
  it("reads next tide and height from the same series, in the station's zone", () => {
    const view = buildCityTideView({
      timeZone: "Pacific/Honolulu",
      renderedAtMs: NOW,
      station: null,
      hourly: [],
      extremes: [
        { ts: "2026-11-13T02:19:00Z", type: "high", heightM: 0.14 },
        { ts: "2026-11-13T06:28:00Z", type: "low", heightM: 0.04 },
      ],
    });
    expect(cityTideHeadline(view)).toEqual({
      currentStatus: "Falling",
      currentHeight: "0.4 ft",
      nextTideType: "Low",
      nextTideTime: "8:28 PM",
      nextTideHeight: "0.1 ft",
    });
  });
});

describe("formatFeet", () => {
  it("never prints -0.0 ft", () => {
    expect(formatFeet(-0.01)).toBe("0.0 ft");
  });
});
