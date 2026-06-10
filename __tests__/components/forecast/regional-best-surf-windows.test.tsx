import { render, screen } from "@testing-library/react";

import { RegionalBestSurfWindows } from "@/components/forecast/regional-best-surf-windows";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

function makeRecommendation(
  rank: number,
  overrides: Partial<SurfWindowRecommendation> = {}
): SurfWindowRecommendation {
  return {
    windowId: `regional-window-${rank}`,
    rank,
    beach: {
      id: `beach-${rank}`,
      name: rank === 1 ? "Blacks" : `Beach ${rank}`,
      slug: rank === 1 ? "blacks" : `beach-${rank}`,
      city: "San Diego",
      state: "CA",
      country: "USA",
      region: "Southern California",
      lat: 32.889,
      lon: -117.253,
    },
    startIso: "2026-06-03T14:00:00.000Z",
    endIso: "2026-06-03T16:30:00.000Z",
    peakIso: "2026-06-03T15:00:00.000Z",
    forecastAt: "2026-06-03T14:00:00.000Z",
    localTimeLabel: "7:00-9:30 AM",
    score: 86 - rank,
    verdict: "Worth it",
    headline: `Window ${rank} looks worth it at Blacks`,
    wave: {
      height: "4",
      period: "12s",
      direction: "W",
      summary: "4 ft at 12s from W",
    },
    wind: {
      speed: "5",
      direction: "NE",
      quality: "offshore",
      summary: "5 NE (offshore)",
    },
    tide: {
      status: "Rising",
      height: "3.5",
      nextTideAt: "2026-06-03T18:00:00.000Z",
      trend: "rising",
      summary: "Rising, 3.5 ft",
    },
    bestFor: ["intermediate", "longboard", "dawn-patrol"],
    positives: ["Good wave size", "Light offshore wind"],
    watchouts: [],
    dataNotes: [],
    confidence: {
      level: "high",
      score: 84,
      summary: "High confidence",
      reasons: ["Forecast model row is present"],
    },
    sources: {
      forecastModel: true,
      tide: true,
      buoy: true,
      cam: false,
      userReport: false,
      localSpotIntel: true,
    },
    appDeepLink: `/beach/blacks?window=regional-window-${rank}`,
    universalLink: `https://www.quiversurf.app/beach/blacks?window=regional-window-${rank}`,
    canonicalWebUrl: "https://www.quiversurf.app/ca/san-diego/blacks",
    ...overrides,
  };
}

describe("RegionalBestSurfWindows", () => {
  it("renders regional surf windows with shared cards", () => {
    render(
      <RegionalBestSurfWindows
        regionName="Southern California"
        recommendations={[makeRecommendation(1), makeRecommendation(2)]}
      />
    );

    expect(screen.getByTestId("regional-best-surf-windows")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Best windows this week" })).toBeVisible();
    expect(screen.getByText(/southern california/i)).toBeVisible();
    expect(screen.getAllByTestId("surf-window-card")).toHaveLength(2);
    // Cards lead with the spot name + locality, not the sentence headline
    expect(screen.getByRole("heading", { name: "Blacks" })).toBeVisible();
    expect(screen.getAllByText("San Diego, CA")[0]).toBeVisible();
    expect(
      screen.queryByText("Window 1 looks worth it at Blacks")
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /why this call/i })[0]).toBeVisible();
  });

  it("renders a quiet empty state without removing the section", () => {
    render(
      <RegionalBestSurfWindows
        regionName="Southern California"
        recommendations={[]}
      />
    );

    expect(screen.getByTestId("regional-best-surf-windows")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Best windows are still building for Southern California."
    );
    expect(screen.queryByTestId("surf-window-card")).not.toBeInTheDocument();
  });
});
