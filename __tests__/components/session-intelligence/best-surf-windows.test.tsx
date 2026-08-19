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
      photoUrl: null,
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
    expect(screen.getByRole("heading", { name: "Ocean Beach" })).toBeInTheDocument();
    expect(screen.getByText("San Diego, CA")).toBeInTheDocument();
    expect(
      screen.queryByText("7:00-9:30 AM looks worth it at Ocean Beach")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Worth it")).toBeInTheDocument();
    expect(screen.getByText("4 ft at 12s from W")).toBeInTheDocument();
    expect(screen.getByText("5 NE (offshore)")).toBeInTheDocument();
    expect(screen.getByText("Rising, 3.5 ft")).toBeInTheDocument();
    expect(screen.getByText("longboard")).toBeInTheDocument();
    const card = screen.getByTestId("surf-window-card");
    expect(card.querySelector('[data-zine-sticker="spot-swell-match"]')).toBeInTheDocument();
    expect(card.querySelector('[data-zine-sticker="spot-wind-read"]')).toBeInTheDocument();
    expect(card.querySelector('[data-zine-sticker="spot-tide-window"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Take it with you" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /why this call/i })).toBeInTheDocument();
  });

  it("renders the zine variant as a complete paper editorial entry", () => {
    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1, {
            beach: {
              ...makeRecommendation(1).beach,
              photoUrl: "https://example.com/ocean-beach.jpg",
            },
          }),
        ]}
        variant="zine"
      />
    );

    const section = screen.getByTestId("best-surf-windows");
    const entry = screen.getByTestId("surf-window-card");

    expect(section).toHaveAttribute("data-variant", "zine");
    expect(entry).toHaveAttribute("data-variant", "zine");
    expect(entry.className).toContain("bg-[#FBF6E8]");
    expect(entry.className).not.toMatch(/#252D6B|#2D357D|#1a2051/i);
    expect(section.innerHTML).not.toMatch(/#252D6B|#2D357D|#1a2051/i);
    expect(
      screen.getByText("7:00-9:30 AM looks worth it at Ocean Beach")
    ).toBeVisible();
    expect(screen.getByText("4 ft at 12s from W")).toBeVisible();
    expect(screen.getByText("5 NE (offshore)")).toBeVisible();
    expect(screen.getByText("Rising, 3.5 ft")).toBeVisible();
    expect(screen.getByText("longboard")).toBeVisible();
    expect(screen.getByAltText(/surf photo of ocean beach/i)).toBeVisible();
    expect(entry.querySelector(".halftone-photo")).toBeInTheDocument();
    expect(screen.getByTestId("surf-window-web-cta")).toBeVisible();
    expect(screen.getByTestId("app-deep-link-cta")).toBeVisible();
    expect(screen.getByRole("button", { name: /why this call/i })).toBeVisible();
  });

  it("renders a beach photo when one is available", () => {
    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1, {
            beach: {
              ...makeRecommendation(1).beach,
              photoUrl: "https://example.com/ocean-beach.jpg",
            },
          }),
        ]}
      />
    );

    const thumb = screen.getByAltText(/surf photo of ocean beach/i);
    expect(thumb).toHaveAttribute(
      "src",
      expect.stringContaining("ocean-beach.jpg")
    );
    expect(screen.queryByAltText(/map view of ocean beach/i)).not.toBeInTheDocument();
  });

  it("does not render a card-level map when no photo exists", () => {
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "test-mapbox-token";
    try {
      render(<BestSurfWindows recommendations={[makeRecommendation(1)]} />);

      expect(screen.queryByAltText(/map view of ocean beach/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Map")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Ocean Beach" })).toBeInTheDocument();
    } finally {
      delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    }
  });

  it("renders no map thumbnail and does not crash when coordinates are missing", () => {
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "test-mapbox-token";
    try {
      render(
        <BestSurfWindows
          recommendations={[
            makeRecommendation(1, {
              beach: {
                ...makeRecommendation(1).beach,
                lat: null,
                lon: null,
              },
            }),
          ]}
        />
      );

      expect(screen.queryByAltText(/map view/i)).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Ocean Beach" })).toBeInTheDocument();
    } finally {
      delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    }
  });

  it("links the title and a visible primary CTA to the canonical web URL", () => {
    render(<BestSurfWindows recommendations={[makeRecommendation(1)]} />);

    const titleLink = screen.getByRole("link", { name: "Ocean Beach" });
    expect(titleLink).toHaveAttribute(
      "href",
      "https://www.quiversurf.app/ca/san-diego/ocean-beach"
    );
    expect(screen.getByTestId("surf-window-web-cta")).toHaveAttribute(
      "href",
      "https://www.quiversurf.app/ca/san-diego/ocean-beach"
    );
  });

  it("renders no beach-detail anchor when canonicalWebUrl is null", () => {
    render(
      <BestSurfWindows
        recommendations={[makeRecommendation(1, { canonicalWebUrl: null })]}
      />
    );

    expect(screen.queryByTestId("surf-window-web-cta")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ocean Beach" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ocean Beach" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link).not.toHaveAttribute("href", expect.stringContaining("/beach/unknown"));
    }
  });

  it("keeps the app deep link as a ghost secondary CTA", () => {
    render(<BestSurfWindows recommendations={[makeRecommendation(1)]} />);

    const appCta = screen.getByTestId("app-deep-link-cta");
    expect(appCta).toBeInTheDocument();
    expect(appCta).toHaveTextContent("Take it with you");
    expect(appCta).toHaveAttribute("href", expect.stringMatching(/window=/));
  });

  it("gives only the rank-1 card the featured treatment", () => {
    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1),
          makeRecommendation(2),
          makeRecommendation(3),
        ]}
      />
    );

    const cards = screen.getAllByTestId("surf-window-card");
    expect(cards[0].className).toContain("md:col-span-2");
    expect(cards[1].className).not.toContain("md:col-span-2");
    expect(cards[2].className).not.toContain("md:col-span-2");
  });

  it("can keep rank 1 as a feature card and collapse the rest into ranked rows", () => {
    render(
      <BestSurfWindows
        recommendations={[
          makeRecommendation(1),
          makeRecommendation(2),
          makeRecommendation(3),
        ]}
        layout="feature-list"
      />
    );

    const cards = screen.getAllByTestId("surf-window-card");
    expect(cards).toHaveLength(3);
    expect(cards[0].className).not.toContain("md:col-span-2");
    expect(cards[1]).toHaveAttribute("data-layout", "compact-row");
    expect(cards[2]).toHaveAttribute("data-layout", "compact-row");
    expect(screen.getByRole("heading", { name: "Beach 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Beach 2 forecast" })).toHaveAttribute(
      "href",
      "https://www.quiversurf.app/ca/san-diego/ocean-beach"
    );
    expect(screen.getAllByTestId("app-deep-link-cta")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /why this call/i })).toHaveLength(1);
  });

  it("hides the source-confidence badge until Why-this-call is expanded", async () => {
    const user = userEvent.setup();

    render(<BestSurfWindows recommendations={[makeRecommendation(1)]} />);

    expect(screen.queryByText(/high.*buoy/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /why this call/i }));

    expect(screen.getByText(/high.*buoy/i)).toBeInTheDocument();
  });

  it("suppresses the inner header when hideHeader is set", () => {
    render(
      <BestSurfWindows
        recommendations={[makeRecommendation(1)]}
        hideHeader
        subtitle="Should not render"
      />
    );

    expect(
      screen.queryByRole("heading", { name: "Best surf windows" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
    expect(screen.getByTestId("best-surf-windows")).toHaveAttribute(
      "aria-label",
      "Best surf windows"
    );
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
    expect(screen.queryByText("Beach 4")).not.toBeInTheDocument();
  });

  it("works with missing tide, buoy, cam, and user-report data", async () => {
    const user = userEvent.setup();

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

    await user.click(screen.getByRole("button", { name: /why this call/i }));

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

    await user.click(screen.getByRole("button", { name: /why this call/i }));

    expect(screen.getByText("Model only")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /why this call/i }));

    expect(screen.getByText("Medium - sparse data")).toBeInTheDocument();
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
