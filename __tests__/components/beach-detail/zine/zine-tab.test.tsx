/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ZineTab } from "@/components/beach-detail/zine/zine-tab";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";

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

describe("ZineTab", () => {
  it("renders all top-level zine sections", () => {
    const beach = createMockBeach({
      name: "Seaside Reef",
      city: "Solana Beach",
      state: "CA",
      break_type: "Reef",
      skill_level: "Intermediate",
      aspect_deg: 260,
      features: ["Reef", "Stairway lineup"],
      average_rating: 3.8,
      review_count: 26,
      hazards: ["Shallow reef at low tide", "Rip currents"],
      best_conditions_prose: "A peaky right-hander on rising tide.",
      wave_tips: "Line up with the stairway.",
      best_months: [11, 12, 1, 2, 3],
    });

    render(
      <ZineTab
        beach={beach}
        surfCallReport={{
          verdict: "YES",
          bestWindowStart: "2026-04-30T12:00:00.000Z",
          waveHeight: "2-3 ft",
          windCompass: "W",
          windSpeed: 6,
          windType: "offshore",
          tidePhase: "rising",
          tideHeight: "3.1 ft",
          whySentence: "Clean and playful.",
          updatedAt: "2026-04-30T12:30:00.000Z",
        } as any}
      />,
    );

    // Hero masthead byline (multiple instances OK — masthead + salty eyebrow)
    expect(screen.getAllByText(/Field Guide/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: /today's surf call/i })).toBeInTheDocument();
    // Main grid labels
    expect(screen.getByText(/ABOUT THIS SPOT/)).toBeInTheDocument();
    expect(screen.getByText(/LOCAL KNOWLEDGE/)).toBeInTheDocument();
    expect(screen.getByText(/HAZARDS/)).toBeInTheDocument();
    // Spot summary
    expect(screen.getByText(/BREAK TYPE:/)).toBeInTheDocument();
    expect(screen.getByText(/BEST SWELL:/)).toBeInTheDocument();
    // Footer / hero — location appears in multiple zine surfaces
    expect(screen.getAllByText(/Solana Beach, CA/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("zine-map-cue-reef")).toBeInTheDocument();
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

  it("renders anonymous promo copy in Today's Surf Call when userTier is absent", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });
    render(
      <ZineTab
        beach={beach}
        surfCallReport={{
          verdict: "YES",
          bestWindowStart: "2026-04-30T12:00:00.000Z",
          waveHeight: "2-3 ft",
          windCompass: "W",
          windSpeed: 6,
          windType: "offshore",
          tidePhase: "rising",
          tideHeight: "3.1 ft",
          whySentence: "Clean and playful.",
          updatedAt: "2026-04-30T12:30:00.000Z",
          tiers: {
            beginner: { verdict: "YES", trail: "BEST AT 12:00 PM" },
            intermediate: { verdict: "YES", trail: "BEST AT 12:00 PM" },
            advanced: { verdict: "YES", trail: "BEST AT 12:00 PM" },
          },
          userTier: null,
        } as any}
      />,
    );

    expect(screen.getByText(/get your call/i)).toBeInTheDocument();
    expect(screen.getByText(/for beginners/i)).toBeInTheDocument();
  });

  it("hides Hazards panel when beach.hazards is empty", () => {
    const beach = createMockBeach({ name: "Seaside Reef", hazards: [] });
    render(<ZineTab beach={beach} />);

    expect(screen.queryByText(/HAZARDS/)).not.toBeInTheDocument();
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
