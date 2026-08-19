/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";

import { SevenDayOutlook } from "@/components/forecast/seven-day-outlook";
import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";

const REGION: ForecastRegion = {
  slug: "san-diego",
  name: "San Diego",
  title: "San Diego surf forecast",
  metaDescription: "San Diego surf forecast",
  states: ["ca"],
  centerLat: 32.8,
  centerLon: -117.2,
  zoom: 10,
};

function makeSummary(
  availability: "available" | "none" = "available",
): RegionalForecastSummary {
  const days = [
    {
      date: new Date("2026-07-20T00:00:00.000Z"),
      dateString: "2026-07-20",
      dayOfWeek: "Monday",
      score: 62,
      avgWaveHeight: 3.5,
      waveRange: [3, 4] as [number, number],
      dominantWindDirection: "E",
      windConditions: "offshore" as const,
      dominantTideStatus: "Rising",
      bestTimeSlot: "dawn-patrol" as const,
      topBeaches: [],
      beachesWithGoodConditions: 2,
    },
    {
      date: new Date("2026-07-21T00:00:00.000Z"),
      dateString: "2026-07-21",
      dayOfWeek: "Tuesday",
      score: 84,
      avgWaveHeight: 5,
      waveRange: [4, 6] as [number, number],
      dominantWindDirection: "NE",
      windConditions: "light" as const,
      dominantTideStatus: "Falling",
      bestTimeSlot: "morning" as const,
      topBeaches: [],
      beachesWithGoodConditions: 4,
    },
  ];

  return {
    region: REGION,
    generatedAt: new Date("2026-07-19T12:00:00.000Z"),
    days,
    bestDay: days[1],
    upcomingSwells: [],
    beachConditions: [],
    bestSurfWindows: [],
    recommendationAvailability:
      availability === "available"
        ? { state: "available", holdEpoch: "epoch-1" }
        : {
            state: "none",
            reasonCode: "major_event_hold",
            holdEpoch: "epoch-1",
          },
    photoUrl: null,
    photoBeachName: null,
    secondaryPhotoUrl: null,
    secondaryPhotoBeachName: null,
    stats: {
      totalBeaches: 7,
      beachesWithData: 7,
      avgRegionScore: 73,
    },
  };
}

describe("SevenDayOutlook", () => {
  beforeAll(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    });

    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(),
      root: null,
      rootMargin: "0px",
      thresholds: [],
    }));
  });

  it("renders the zine outlook and sticky arc on paper without navy chrome", () => {
    render(
      <SevenDayOutlook
        summary={makeSummary()}
        regionName={REGION.name}
        variant="zine"
      />,
    );

    const outlook = screen.getByTestId("seven-day-outlook");
    const arc = screen.getByTestId("swell-arc");

    expect(outlook.className).toContain("bg-[#FBF6E8]");
    expect(arc.className).toContain("bg-[#F0E5CC]");
    expect(outlook.innerHTML).not.toMatch(/#252D6B|#2D357D|#1a2051/i);
    expect(screen.getAllByTestId(/^outlook-day-/)).toHaveLength(2);
    expect(screen.getByTestId("outlook-day-1")).toHaveAttribute(
      "data-peak",
      "true",
    );
    expect(screen.getByLabelText(/score 84 out of 100/i)).toBeVisible();
    expect(
      screen.getByLabelText(/trend building vs previous day/i),
    ).toBeVisible();
  });

  it("keeps day rows but suppresses scores, arc, and trends during a hold", () => {
    render(
      <SevenDayOutlook
        summary={makeSummary("none")}
        regionName={REGION.name}
        variant="zine"
      />,
    );

    expect(screen.getAllByTestId(/^outlook-day-/)).toHaveLength(2);
    expect(screen.queryByTestId("swell-arc")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/score .* out of 100/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/trend .* previous day/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/rising tide/i)).toBeVisible();
    expect(screen.getByText(/falling tide/i)).toBeVisible();
  });
});
