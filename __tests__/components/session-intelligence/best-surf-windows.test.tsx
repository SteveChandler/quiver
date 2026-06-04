import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BestSurfWindows } from "@/components/session-intelligence";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

function getLocalTimeLabel(rank: number): string {
  if (rank === 1) {
    return "7:00-9:30 AM";
  }

  if (rank === 2) {
    return "9:00-11:00 AM";
  }

  return "10:00 AM-12:00 PM";
}

function makeRecommendation(
  rank: number,
  overrides: Partial<SurfWindowRecommendation> = {}
): SurfWindowRecommendation {
  return {
    windowId: `beach-${rank}-2026-06-03T14-00-00-000Z`,
    rank,
    beach: {
      id: `beach-${rank}`,
      name: rank === 1 ? "Ocean Beach" : `Beach ${rank}`,
      slug: rank === 1 ? "ocean-beach" : `beach-${rank}`,
      city: "San Diego",
      state: "CA",
      country: "USA",
      region: "Southern California",
      lat: 32.75,
      lon: -117.25,
    },
    startIso: "2026-06-03T14:00:00.000Z",
    endIso: "2026-06-03T16:30:00.000Z",
    peakIso: "2026-06-03T15:00:00.000Z",
    forecastAt: "2026-06-03T14:00:00.000Z",
    localTimeLabel: getLocalTimeLabel(rank),
    score: 84 - rank,
    verdict: rank === 3 ? "Maybe" : "Worth it",
    headline:
      rank === 1
        ? "7:00-9:30 AM looks worth it at Ocean Beach"
        : `Window ${rank} looks surfable`,
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
    watchouts: ["Morning crowd may build"],
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
    appDeepLink: `/app/spot/ocean-beach?window=window-${rank}`,
    universalLink: `https://www.quiversurf.app/app/spot/ocean-beach?window=window-${rank}`,
    canonicalWebUrl: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
    ...overrides,
  };
}

describe("BestSurfWindows", () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it("renders one complete recommendation card", () => {
    render(<BestSurfWindows recommendations={[makeRecommendation(1)]} />);

    expect(screen.getByTestId("best-surf-windows")).toBeInTheDocument();
    expect(screen.getAllByTestId("surf-window-card")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Best surf windows" })).toBeInTheDocument();
    expect(screen.getByText("7:00-9:30 AM")).toBeInTheDocument();
    expect(screen.getByText("7:00-9:30 AM looks worth it at Ocean Beach")).toBeInTheDocument();
    expect(screen.getByText("Worth it")).toBeInTheDocument();
    expect(screen.getByText("4 ft at 12s from W")).toBeInTheDocument();
    expect(screen.getByText("5 NE (offshore)")).toBeInTheDocument();
    expect(screen.getByText("Rising, 3.5 ft")).toBeInTheDocument();
    expect(screen.getByText("longboard")).toBeInTheDocument();
    const card = screen.getByTestId("surf-window-card");
    expect(card.querySelector('[data-zine-sticker="spot-swell-match"]')).toBeInTheDocument();
    expect(card.querySelector('[data-zine-sticker="spot-wind-read"]')).toBeInTheDocument();
    expect(card.querySelector('[data-zine-sticker="spot-tide-window"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open this window in Quiver" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /why this call/i })).toBeInTheDocument();
  });

  it("renders two recommendations", () => {
    render(
      <BestSurfWindows
        recommendations={[makeRecommendation(1), makeRecommendation(2)]}
      />
    );

    expect(screen.getAllByTestId("surf-window-card")).toHaveLength(2);
  });

  it("renders a maximum of three recommendations", () => {
    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1),
          makeRecommendation(2),
          makeRecommendation(3),
          makeRecommendation(4),
        ]}
      />
    );

    expect(screen.getAllByTestId("surf-window-card")).toHaveLength(3);
    expect(screen.queryByText("Window 4 looks surfable")).not.toBeInTheDocument();
  });

  it("works with missing tide, buoy, cam, and user-report data", () => {
    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1, {
            tide: {
              status: null,
              height: null,
              nextTideAt: null,
              trend: "unknown",
              summary: "Tide data is unavailable",
            },
            confidence: {
              level: "low",
              score: 31,
              summary: "Low confidence",
              reasons: ["Forecast confidence is low"],
            },
            sources: {
              forecastModel: true,
              tide: false,
              buoy: false,
              cam: false,
              userReport: false,
              localSpotIntel: false,
            },
            dataNotes: [
              "Tide data is unavailable for this window",
              "No buoy source is attached to this window",
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("Tide data is unavailable")).toBeInTheDocument();
    expect(screen.getByText("Low - sparse data")).toBeInTheDocument();
    expect(screen.queryByText("buoy")).not.toBeInTheDocument();
    expect(screen.queryByText("cam")).not.toBeInTheDocument();
    expect(screen.queryByText("user report")).not.toBeInTheDocument();
  });

  it("labels model-only non-low confidence without inventing missing sources", async () => {
    const user = userEvent.setup();

    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1, {
            confidence: {
              level: "medium",
              score: 61,
              summary: "Medium confidence",
              reasons: ["Forecast model row is present"],
            },
            sources: {
              forecastModel: true,
              tide: false,
              buoy: false,
              cam: false,
              userReport: false,
              localSpotIntel: false,
            },
            dataNotes: [
              "Tide data is unavailable for this window",
              "No buoy source is attached to this window",
              "No cam source is attached to this window",
              "No user-report source is attached to this window",
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("Model only")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /why this call/i }));

    expect(screen.getByText("model")).toBeInTheDocument();
    expect(screen.queryByText("buoy")).not.toBeInTheDocument();
    expect(screen.queryByText("cam")).not.toBeInTheDocument();
    expect(screen.queryByText("user report")).not.toBeInTheDocument();
  });

  it("renders sparse-data copy when no source claims are attached", async () => {
    const user = userEvent.setup();

    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1, {
            confidence: {
              level: "medium",
              score: 55,
              summary: "Medium confidence",
              reasons: [],
            },
            sources: {
              forecastModel: false,
              tide: false,
              buoy: false,
              cam: false,
              userReport: false,
              localSpotIntel: false,
            },
            dataNotes: ["No forecast model row is attached to this window"],
          }),
        ]}
      />
    );

    expect(screen.getByText("Medium - sparse data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /why this call/i }));

    expect(screen.getByText("No source claims are attached.")).toBeInTheDocument();
  });

  it("renders an empty state when no recommendations are available", () => {
    render(<BestSurfWindows recommendations={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No recommended surf windows are available yet."
    );
  });

  it("tracks one deduped surf-window impression per visible recommendation", async () => {
    render(
      <BestSurfWindows
        recommendations={[makeRecommendation(1), makeRecommendation(2)]}
        surface="component_test"
      />
    );

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("surf_window_impression", {
        beachId: "beach-1",
        metadata: expect.objectContaining({
          surface: "component_test",
          beach_id: "beach-1",
          beach_slug: "ocean-beach",
          beach_name: "Ocean Beach",
          window_id: "beach-1-2026-06-03T14-00-00-000Z",
          rank: 1,
          score: 83,
          verdict: "Worth it",
        }),
        debounceMs: 0,
      });
    });

    const impressionCalls = mockTrack.mock.calls.filter(
      ([eventType]) => eventType === "surf_window_impression"
    );
    expect(impressionCalls).toHaveLength(2);
  });
});
