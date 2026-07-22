/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";

import { RegionalCallHero } from "@/components/forecast/regional-call-hero";
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

function unavailableSummary(): RegionalForecastSummary {
  const day = {
    date: new Date("2026-07-20T00:00:00.000Z"),
    dateString: "2026-07-20",
    dayOfWeek: "Monday",
    score: 0,
    avgWaveHeight: 4.25,
    waveRange: [3.5, 5.5] as [number, number],
    dominantWindDirection: "E",
    windConditions: "offshore" as const,
    dominantTideStatus: "Rising",
    bestTimeSlot: "dawn-patrol" as const,
    topBeaches: [],
    beachesWithGoodConditions: 0,
  };

  return {
    region: REGION,
    generatedAt: new Date("2026-07-19T12:00:00.000Z"),
    days: [day],
    bestDay: day,
    upcomingSwells: [],
    beachConditions: [],
    bestSurfWindows: [],
    recommendationAvailability: {
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
      avgRegionScore: 0,
    },
  };
}

describe("regional major-event hold UI", () => {
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
  });

  it("keeps objective wave, wind, and tide data without positive hero or score copy", () => {
    const summary = unavailableSummary();

    render(
      <>
        <RegionalCallHero region={REGION} summary={summary} isAuthed={false} />
        <SevenDayOutlook summary={summary} regionName={REGION.name} />
      </>,
    );

    expect(screen.getAllByText(/4-5ft/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/offshore/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rising tide/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/best window/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/go go go|worth the paddle|get on it|firing/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/score .* out of 100/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });
});
