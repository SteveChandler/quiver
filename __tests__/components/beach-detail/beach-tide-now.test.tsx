import React from "react";
import { render, screen } from "@testing-library/react";

import { BeachTideNow } from "@/components/beach-detail/beach-tide-now";
import type { TideMetaData } from "@/lib/seo/tide-meta-data";
import { buildCityTideView } from "@/lib/tides/city-tide-view";

// 11:00 PM on the 27th and 5:00 AM on the 28th, Pacific daylight time.
const ELEVEN_PM_TONIGHT = "2026-09-28T06:00:00.000Z";
const FIVE_AM_TOMORROW = "2026-09-28T12:00:00.000Z";

function rows(overrides: Partial<TideMetaData>): TideMetaData {
  return {
    nextHighTime: null,
    nextLowTime: null,
    nextHighHeight: null,
    nextLowHeight: null,
    nextHighAt: null,
    nextLowAt: null,
    ...overrides,
  };
}

describe("BeachTideNow without a station table", () => {
  it("reads rising when the next high is tonight and the next low is after midnight", () => {
    render(
      <BeachTideNow
        beachName="Tourmaline"
        view={null}
        display={rows({
          nextHighTime: "11:00 PM",
          nextHighHeight: 4.1,
          nextHighAt: ELEVEN_PM_TONIGHT,
          nextLowTime: "5:00 AM",
          nextLowHeight: 0.8,
          nextLowAt: FIVE_AM_TOMORROW,
        })}
      />
    );
    expect(screen.getByText("Rising")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["High11:00 PM4.1 ft", "Low5:00 AM0.8 ft"]);
  });

  it("reads falling when the next low comes first", () => {
    render(
      <BeachTideNow
        beachName="Tourmaline"
        view={null}
        display={rows({
          nextHighTime: "5:00 AM",
          nextHighAt: FIVE_AM_TOMORROW,
          nextLowTime: "11:00 PM",
          nextLowAt: ELEVEN_PM_TONIGHT,
        })}
      />
    );
    expect(screen.getByText("Falling")).toBeInTheDocument();
  });

  it("shows one model tide with no direction and the model note in the box", () => {
    render(
      <BeachTideNow
        beachName="Monuments"
        view={null}
        display={rows({
          source: "fes2022",
          nextHighTime: "10:00 AM",
          nextHighHeight: 3.3,
          nextHighAt: "2026-11-15T17:00:00Z",
        })}
      />
    );
    expect(screen.getByText("Next tide")).toBeInTheDocument();
    expect(screen.queryByText(/Rising|Falling/)).toBeNull();
    expect(screen.getByText(/FES2022 global tide model/)).toBeInTheDocument();
  });

  it("says so when there is no upcoming tide, with no placeholder numbers", () => {
    render(<BeachTideNow beachName="Blacks" view={null} display={rows({})} />);
    expect(screen.getByText("No upcoming tide in this table. Check back after the next update.")).toBeInTheDocument();
    expect(screen.queryByText(/\d ft/)).toBeNull();
  });
});

describe("BeachTideNow with a station table", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows the station block, its station line and links", () => {
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-15T02:25:00Z"));
    const view = buildCityTideView({
      timeZone: "Pacific/Honolulu",
      renderedAtMs: Date.parse("2026-11-15T02:25:00Z"),
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
    render(<BeachTideNow beachName="Laniakea" view={view} display={null} />);

    expect(screen.getByTestId("tide-station-now")).toBeInTheDocument();
    expect(screen.getByTestId("tide-day-range")).toBeInTheDocument();
    expect(screen.getByText("NOAA 1612668 · Haleiwa, Waialua Bay")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Station →" })).toHaveAttribute(
      "href",
      "/tides/station/haleiwa-waialua-bay-hi-1612668"
    );
    expect(screen.getByRole("link", { name: "7-day chart ↓" })).toHaveAttribute("href", "#tide-chart");
  });
});
