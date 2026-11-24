import React from "react";
import { render, screen, within } from "@testing-library/react";

import { TideStationNow, smallHighLine } from "@/components/tide-stations/tide-station-now";
import type { TideExtremePoint } from "@/lib/tide-stations/series";

const HONOLULU = "Pacific/Honolulu";

// Haleiwa, Waialua Bay (NOAA 1612668), Sat Nov 14 2026: a mixed tide.
const HALEIWA_NOV_14: TideExtremePoint[] = [
  { ts: "2026-11-14T16:26:00Z", type: "high", heightM: 0.47 }, // 6:26 AM 1.5 ft
  { ts: "2026-11-14T23:27:00Z", type: "low", heightM: 0.09 }, // 1:27 PM 0.3 ft
  { ts: "2026-11-15T04:47:00Z", type: "high", heightM: 0.13 }, // 6:47 PM 0.4 ft
  { ts: "2026-11-15T07:41:00Z", type: "low", heightM: 0.1 }, // 9:41 PM 0.3 ft
  { ts: "2026-11-15T17:18:00Z", type: "high", heightM: 0.47 }, // Sun 7:18 AM
];
const FOUR_25_PM = Date.parse("2026-11-15T02:25:00Z");

// Same station, Thu Nov 19 into Fri Nov 20: all of today is past by 5 PM.
const HALEIWA_NOV_19: TideExtremePoint[] = [
  { ts: "2026-11-19T13:58:00Z", type: "low", heightM: 0.18 },
  { ts: "2026-11-19T20:42:00Z", type: "high", heightM: 0.37 },
  { ts: "2026-11-20T02:20:00Z", type: "low", heightM: 0.0 },
  { ts: "2026-11-20T10:17:00Z", type: "high", heightM: 0.4 }, // Fri 12:17 AM 1.3 ft
];
const THU_5_PM = Date.parse("2026-11-20T03:00:00Z");

// The component moves to the real clock after mount; pin it to the render time.
function at(ms: number): number {
  jest.spyOn(Date, "now").mockReturnValue(ms);
  return ms;
}

afterEach(() => jest.restoreAllMocks());

describe("TideStationNow", () => {
  it("names the day when the next tide is after midnight", () => {
    render(<TideStationNow extremes={HALEIWA_NOV_19} timeZone={HONOLULU} renderedAtMs={at(THU_5_PM)} />);
    expect(screen.getByText(/Next high Fri 12:17 AM/)).toBeInTheDocument();
  });

  it("keeps the plain time when the next tide is today", () => {
    render(<TideStationNow extremes={HALEIWA_NOV_14} timeZone={HONOLULU} renderedAtMs={at(FOUR_25_PM)} />);
    expect(screen.getByText(/Next high 6:47 PM/)).toBeInTheDocument();
  });

  it("shows the day shape on a mixed tide: range line, main high, past and next rows", () => {
    render(<TideStationNow extremes={HALEIWA_NOV_14} timeZone={HONOLULU} renderedAtMs={at(FOUR_25_PM)} showDayShape />);

    expect(screen.getByTestId("tide-day-range")).toHaveTextContent(
      "Today 0.3–1.5 ft · main high 6:26 AM. The next high is a small bump."
    );
    expect(screen.getByTitle("Main high of the day")).toHaveTextContent("1.5 ft");
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("data-tide-row"))).toEqual(["past", "past", "next", null]);
    expect(within(rows[2]).getByText("6:47 PM")).toBeInTheDocument();
  });

  it("leaves the city and station layout alone without showDayShape", () => {
    render(<TideStationNow extremes={HALEIWA_NOV_14} timeZone={HONOLULU} renderedAtMs={at(FOUR_25_PM)} />);
    expect(screen.queryByTestId("tide-day-range")).toBeNull();
    expect(screen.queryByTitle("Main high of the day")).toBeNull();
    expect(screen.getAllByRole("listitem").every((row) => !row.hasAttribute("data-tide-row"))).toBe(true);
  });
});

describe("smallHighLine", () => {
  const today = HALEIWA_NOV_14.slice(0, 4);

  it("stays quiet when the next tide is a low", () => {
    expect(smallHighLine(today, today[1], HONOLULU)).toBeNull();
  });

  it("stays quiet when the next high is at least half the main high", () => {
    const evenDay: TideExtremePoint[] = [
      { ts: "2026-11-14T11:05:00Z", type: "high", heightM: 1.29 },
      { ts: "2026-11-14T13:03:00Z", type: "low", heightM: 1.05 },
      { ts: "2026-11-14T19:49:00Z", type: "high", heightM: 1.72 },
      { ts: "2026-11-15T04:24:00Z", type: "low", heightM: 0.56 },
    ];
    expect(smallHighLine(evenDay, evenDay[2], "America/Los_Angeles")).toBeNull();
  });

  it("stays quiet when the next high is tomorrow", () => {
    expect(smallHighLine(today, HALEIWA_NOV_14[4], HONOLULU)).toBeNull();
  });

  it("stays quiet on a day with one high", () => {
    const oneHigh = today.slice(0, 2);
    expect(smallHighLine(oneHigh, today[0], HONOLULU)).toBeNull();
  });
});
