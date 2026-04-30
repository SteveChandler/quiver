/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ZineTab } from "@/components/beach-detail/zine/zine-tab";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

// Mock the auth context (used by OverviewReviewCTA)
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

// Mock useDataFetcher so the recent-sessions fetch doesn't fire in jsdom
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(() => ({ data: [], loading: false, error: null, refetch: jest.fn() })),
}));

// Stub WaterQualityBadge with an inert marker so we can assert it renders
// without depending on the badge's runtime data shape.
jest.mock("@/components/beach-detail/water-quality-badge", () => ({
  WaterQualityBadge: () => <div data-testid="water-quality-badge" />,
}));

// AmenitiesBadges has its own internal logic; stub it
jest.mock("@/components/beach-detail/amenities-badges", () => ({
  AmenitiesBadges: () => <div data-testid="amenities-badges" />,
}));

const mockSurfCall: SurfCallResult = {
  verdict: "YES",
  bestWindowStart: "2026-04-28T13:30:00.000Z",
  bestWindowEnd: "2026-04-28T15:00:00.000Z",
  windowMinutes: 90,
  shortWindow: false,
  waveHeight: "2-3 ft",
  windDescription: "light onshore",
  windSpeed: "0-5",
  windCompass: "SW",
  windType: "onshore",
  tideDescription: "Falling 2.5 ft",
  tidePhase: "Falling",
  tideHeight: "2.5 ft",
  nextTideType: "Low",
  nextTideAt: null,
  whySentence: "Good conditions today.",
  forecastConfidence: 0.8,
  lowForecastConfidence: false,
  score: 7.5,
  peakTime: null,
  trendTags: [],
  updatedAt: "2026-04-28T05:42:00.000Z",
  isCalibrated: false,
  rideableWavesPerHour: null,
  dominantBeatIntervalS: null,
};

describe("ZineTab", () => {
  it("renders all top-level zine sections", () => {
    const beach = createMockBeach({
      name: "Seaside Reef",
      city: "Solana Beach",
      state: "CA",
      break_type: "Reef",
      skill_level: "Intermediate",
      average_rating: 3.8,
      review_count: 26,
      hazards: ["Shallow reef at low tide", "Rip currents"],
      best_conditions_prose: "A peaky right-hander on rising tide.",
      wave_tips: "Line up with the stairway.",
      best_months: [11, 12, 1, 2, 3],
    });

    render(<ZineTab beach={beach} surfCallReport={mockSurfCall} />);

    // Hero masthead byline (multiple instances OK — masthead + salty eyebrow)
    expect(screen.getAllByText(/Field Guide/i).length).toBeGreaterThan(0);
    // Today's surf call label (CSS-uppercased; assert case-insensitively against the literal node text)
    expect(screen.getByText(/today's surf call/i)).toBeInTheDocument();
    // YES verdict stamp — the verdict word and the trail caption are now in
    // separate elements after the marquee redesign, so assert each separately.
    expect(screen.getAllByText("YES").length).toBeGreaterThan(0);
    expect(screen.getByText(/BEST AT/i)).toBeInTheDocument();
    // Main grid labels
    expect(screen.getByText(/ABOUT THIS SPOT/)).toBeInTheDocument();
    expect(screen.getByText(/LOCAL KNOWLEDGE/)).toBeInTheDocument();
    expect(screen.getByText(/HAZARDS/)).toBeInTheDocument();
    // Spot summary
    expect(screen.getByText(/BREAK TYPE:/)).toBeInTheDocument();
    expect(screen.getByText(/BEST SWELL:/)).toBeInTheDocument();
    // Footer / hero — location appears in multiple zine surfaces
    expect(screen.getAllByText(/Solana Beach, CA/i).length).toBeGreaterThan(0);
  });

  it("retains WaterQualityBadge and AmenitiesBadges when data is present (e2e regression sentinel)", () => {
    const beach = createMockBeach({ name: "Seaside Reef", city: "Solana Beach", state: "CA" });
    const waterQuality = {
      beach_id: beach.id,
      status: "good" as const,
      latest_enterococcus: null,
      latest_fecal_coliform: null,
      latest_sample_date: null,
      exceedance_count_30d: 0,
      total_samples_30d: 0,
      status_reason: null,
      status_changed_at: null,
    };
    const amenities = { has_restrooms: true } as any;
    render(<ZineTab beach={beach} waterQuality={waterQuality} amenities={amenities} />);

    expect(screen.getByTestId("water-quality-badge")).toBeInTheDocument();
    expect(screen.getByTestId("amenities-badges")).toBeInTheDocument();
  });

  it("hides utility rails when water quality + amenities are absent", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });
    render(<ZineTab beach={beach} />);

    expect(screen.queryByTestId("water-quality-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("amenities-badges")).not.toBeInTheDocument();
  });

  it("hides Hazards panel when beach.hazards is empty", () => {
    const beach = createMockBeach({ name: "Seaside Reef", hazards: [] });
    render(<ZineTab beach={beach} />);

    expect(screen.queryByText(/HAZARDS/)).not.toBeInTheDocument();
  });

  it("falls back to MAYBE verdict when surfCallReport is absent", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });
    render(<ZineTab beach={beach} />);

    expect(screen.getByText(/MAYBE/)).toBeInTheDocument();
  });

  it("renders the beginner-tier verdict + 'get your call' CTA when tiers are present and user is anonymous", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });
    const tiers = {
      beginner: {
        verdict: "YES" as const,
        trail: "BEST AT 5:00 PM",
        bestWindowStart: "2026-04-28T17:00:00.000Z",
        bestWindowEnd: "2026-04-28T18:30:00.000Z",
      },
      intermediate: {
        verdict: "MAYBE" as const,
        trail: "TRY AT 5:00 PM",
        bestWindowStart: "2026-04-28T17:00:00.000Z",
        bestWindowEnd: "2026-04-28T18:30:00.000Z",
      },
      advanced: {
        verdict: "NO" as const,
        trail: "TOO SMALL",
        bestWindowStart: null,
        bestWindowEnd: null,
      },
    };
    const tieredCall: SurfCallResult = { ...mockSurfCall, verdict: "MAYBE", tiers, userTier: null };

    render(<ZineTab beach={beach} surfCallReport={tieredCall} />);

    // Beginner verdict (YES) shown — not the intermediate baseline (MAYBE).
    expect(screen.getAllByText("YES").length).toBeGreaterThan(0);
    expect(screen.queryByText("MAYBE")).not.toBeInTheDocument();
    expect(screen.queryByText("NO")).not.toBeInTheDocument();
    // Margin scrawl primes the CTA — handwritten "for beginners — you?" pinned
    // to the verdict stamp.
    expect(screen.getByLabelText(/beginner call.*not you/i)).toBeInTheDocument();
    expect(screen.getByText(/for beginners/i)).toBeInTheDocument();
    expect(screen.getByText(/— you\?/i)).toBeInTheDocument();
    // Editorial CTA, not a button.
    const cta = screen.getByRole("link", { name: /sign in to see the surf call for your level/i });
    expect(cta).toHaveAttribute("href", "/auth?mode=signin");
    expect(cta).toHaveTextContent(/get your call/i);
  });

  it("renders the user's tier verdict and hides the CTA when authenticated", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });
    const tiers = {
      beginner: {
        verdict: "YES" as const,
        trail: "BEST AT 5:00 PM",
        bestWindowStart: "2026-04-28T17:00:00.000Z",
        bestWindowEnd: "2026-04-28T18:30:00.000Z",
      },
      intermediate: {
        verdict: "MAYBE" as const,
        trail: "TRY AT 5:00 PM",
        bestWindowStart: "2026-04-28T17:00:00.000Z",
        bestWindowEnd: "2026-04-28T18:30:00.000Z",
      },
      advanced: {
        verdict: "NO" as const,
        trail: "TOO SMALL",
        bestWindowStart: null,
        bestWindowEnd: null,
      },
    };
    const tieredCall: SurfCallResult = { ...mockSurfCall, verdict: "MAYBE", tiers, userTier: "advanced" };

    render(<ZineTab beach={beach} surfCallReport={tieredCall} />);

    // Advanced-tier verdict (NO) is rendered, not beginner (YES) or intermediate (MAYBE).
    expect(screen.getAllByText("NO").length).toBeGreaterThan(0);
    expect(screen.queryByText("YES")).not.toBeInTheDocument();
    expect(screen.queryByText("MAYBE")).not.toBeInTheDocument();
    // ✦ your call · advanced surfers margin scrawl identifies the user's tier.
    expect(screen.getByLabelText(/your call.*advanced surfers/i)).toBeInTheDocument();
    expect(screen.getByText(/your call/i)).toBeInTheDocument();
    expect(screen.getByText(/advanced surfers/i)).toBeInTheDocument();
    // No CTA for authed users.
    expect(screen.queryByText(/get your call/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/— you\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/for beginners/i)).not.toBeInTheDocument();
  });

  it("renders OverviewReviewCTA region only when onWriteReview is provided AND user is signed in", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });
    const { rerender } = render(<ZineTab beach={beach} />);
    expect(screen.queryByText(/Write a review/)).not.toBeInTheDocument();

    // Auth on, but no onWriteReview prop — still hidden
    const useAuth = require("@/context/auth-context").useAuth as jest.Mock;
    useAuth.mockReturnValue({ user: { id: "u1" } });
    rerender(<ZineTab beach={beach} />);
    expect(screen.queryByText(/Write a review/)).not.toBeInTheDocument();

    // Auth on AND onWriteReview provided — visible
    rerender(<ZineTab beach={beach} onWriteReview={jest.fn()} />);
    expect(screen.getByText(/Write a review/)).toBeInTheDocument();
  });
});
