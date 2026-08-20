import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WhyThisCall } from "@/components/session-intelligence";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

function makeRecommendation(
  overrides: Partial<SurfWindowRecommendation> = {}
): SurfWindowRecommendation {
  return {
    windowId: "beach-1-2026-06-03T14-00-00-000Z",
    rank: 1,
    beach: {
      id: "beach-1",
      name: "Ocean Beach",
      slug: "ocean-beach",
      city: "San Diego",
      state: "CA",
      country: "USA",
      region: "Southern California",
      lat: 32.75,
      lon: -117.25,
      photoUrl: null,
    },
    startIso: "2026-06-03T14:00:00.000Z",
    endIso: "2026-06-03T16:30:00.000Z",
    peakIso: "2026-06-03T15:00:00.000Z",
    timezone: "America/Los_Angeles",
    forecastAt: "2026-06-03T14:00:00.000Z",
    localTimeLabel: "7:00-9:30 AM",
    score: 82,
    verdict: "Worth it",
    headline: "7:00-9:30 AM looks worth it at Ocean Beach",
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
      reasons: ["Forecast model row is present", "Buoy source evidence is present"],
    },
    sources: {
      forecastModel: true,
      tide: true,
      buoy: true,
      cam: false,
      userReport: false,
      localSpotIntel: true,
    },
    appDeepLink: "/app/spot/ocean-beach?window=beach-1-2026-06-03T14-00-00-000Z",
    universalLink:
      "https://www.quiversurf.app/app/spot/ocean-beach?window=beach-1-2026-06-03T14-00-00-000Z",
    canonicalWebUrl: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
    ...overrides,
  };
}

describe("WhyThisCall", () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it("expands an accessible explanation disclosure", async () => {
    const user = userEvent.setup();

    render(<WhyThisCall recommendation={makeRecommendation()} />);

    await user.click(
      screen.getByRole("button", {
        name: "Why this call for Ocean Beach 7:00-9:30 AM",
      })
    );

    expect(screen.getAllByRole("region").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Positive signals" })).toBeInTheDocument();
    expect(screen.getByText("Good wave size")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watchouts" })).toBeInTheDocument();
    expect(screen.getByText("Morning crowd may build")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confidence" })).toBeInTheDocument();
    expect(screen.getByText("Forecast model row is present")).toBeInTheDocument();
  });

  it("renders source chips only for available sources", async () => {
    const user = userEvent.setup();

    render(
      <WhyThisCall
        recommendation={makeRecommendation({
          sources: {
            forecastModel: true,
            tide: false,
            buoy: false,
            cam: false,
            userReport: false,
            localSpotIntel: false,
          },
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: /why this call/i }));

    expect(screen.getByText("model")).toBeInTheDocument();
    expect(screen.queryByText("tide")).not.toBeInTheDocument();
    expect(screen.queryByText("buoy")).not.toBeInTheDocument();
    expect(screen.queryByText("cam")).not.toBeInTheDocument();
    expect(screen.queryByText("user report")).not.toBeInTheDocument();
  });

  it("handles empty watchouts without dropping the section", async () => {
    const user = userEvent.setup();

    render(<WhyThisCall recommendation={makeRecommendation({ watchouts: [] })} />);

    await user.click(screen.getByRole("button", { name: /why this call/i }));

    expect(screen.getByRole("heading", { name: "Watchouts" })).toBeInTheDocument();
    expect(
      screen.getByText("No major watchouts attached to this window.")
    ).toBeInTheDocument();
  });

  it("tracks why-this-call opens with surf-window context", async () => {
    const user = userEvent.setup();

    render(
      <WhyThisCall
        recommendation={makeRecommendation()}
        surface="spot_page"
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Why this call for Ocean Beach 7:00-9:30 AM",
      })
    );

    expect(mockTrack).toHaveBeenCalledWith("why_this_call_opened", {
      beachId: "beach-1",
      metadata: expect.objectContaining({
        surface: "spot_page",
        beach_id: "beach-1",
        beach_slug: "ocean-beach",
        beach_name: "Ocean Beach",
        window_id: "beach-1-2026-06-03T14-00-00-000Z",
        rank: 1,
        score: 82,
        verdict: "Worth it",
      }),
      debounceMs: 0,
    });
  });
});
