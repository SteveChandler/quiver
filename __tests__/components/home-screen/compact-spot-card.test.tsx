import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { CompactSpotCard } from "@/components/home-screen/compact-spot-card";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";

// Mock analytics
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
  getAttributionForAnalytics: jest.fn(() => ({})),
}));

import { track } from "@/lib/analytics";

/**
 * Mock recommendation factory with TypeScript-safe defaults.
 * Uses createBeachWithDefaults to avoid duplicating Beach field definitions.
 */
function createMockRecommendation(
  overrides: Partial<SurfDiscoveryRecommendation> = {}
): SurfDiscoveryRecommendation {
  return {
    beach: createBeachWithDefaults({
      id: "test-beach-1",
      name: "Ocean Beach",
      city: "San Francisco",
      state: "CA",
      country: "USA",
      lat: 37.7749,
      lon: -122.4194,
      timezone: "America/Los_Angeles",
      created_at: "2024-01-01T00:00:00Z",
      ...overrides.beach,
    }),
    window: {
      start: new Date("2024-01-20T08:00:00Z"),
      end: new Date("2024-01-20T11:00:00Z"),
      tide: "Rising",
      wind: "10 mph SW",
      waveHeight: "3-4 ft",
      wavePeriod: "12s",
      dataSource: "CDIP",
      confidence: 85,
      timezone: "America/Los_Angeles",
      ...overrides.window,
    },
    forecast: {} as any, // Not needed for these tests
    score: 85,
    matchQuality: "excellent",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 18,
      windAlignment: 18,
      tideFit: 12,
      affinityBonus: 10,
      distancePenalty: -5,
    },
    summary: "Excellent conditions at Ocean Beach",
    reasons: ["Good wave size", "Offshore wind", "Favorable tide"],
    warnings: [],
    generated_at: "2024-01-20T00:00:00Z",
    isFavorite: false,
    ...overrides,
  };
}

describe("CompactSpotCard - Favorite Heart Badge", () => {
  const mockOnTap = jest.fn();

  beforeEach(() => {
    mockOnTap.mockClear();
    (track as jest.Mock).mockClear();
  });

  it("shows heart icon when isFavorite is true", () => {
    const recommendation = createMockRecommendation({ isFavorite: true });
    render(
      <CompactSpotCard recommendation={recommendation} onTap={mockOnTap} />
    );

    const heart = screen.getByTestId("favorite-heart");
    expect(heart).toBeInTheDocument();
  });

  it("does not show heart icon when isFavorite is false", () => {
    const recommendation = createMockRecommendation({ isFavorite: false });
    render(
      <CompactSpotCard recommendation={recommendation} onTap={mockOnTap} />
    );

    const heart = screen.queryByTestId("favorite-heart");
    expect(heart).not.toBeInTheDocument();
  });

  it("does not show heart icon when isFavorite is undefined", () => {
    const recommendation = createMockRecommendation({ isFavorite: undefined });
    render(
      <CompactSpotCard recommendation={recommendation} onTap={mockOnTap} />
    );

    const heart = screen.queryByTestId("favorite-heart");
    expect(heart).not.toBeInTheDocument();
  });

  it("renders heart with correct styling (red, filled, pulsing)", () => {
    const recommendation = createMockRecommendation({ isFavorite: true });
    render(
      <CompactSpotCard recommendation={recommendation} onTap={mockOnTap} />
    );

    const heart = screen.getByTestId("favorite-heart");
    expect(heart).toHaveClass("text-red-500", "fill-red-500", "motion-safe:animate-heartbeat");
  });

  it("heart does not interfere with card click functionality", async () => {
    const user = userEvent.setup();
    const recommendation = createMockRecommendation({ isFavorite: true });
    render(
      <CompactSpotCard recommendation={recommendation} onTap={mockOnTap} />
    );

    const card = screen.getByTestId("compact-spot-card");
    await user.click(card);

    expect(mockOnTap).toHaveBeenCalledWith("test-beach-1");
  });
});

describe("CompactSpotCard - Analytics", () => {
  const mockOnTap = jest.fn();

  beforeEach(() => {
    mockOnTap.mockClear();
    (track as jest.Mock).mockClear();
  });

  it("tracks favorite_shown_in_carousel when isFavorite is true", async () => {
    const recommendation = createMockRecommendation({
      isFavorite: true,
      score: 85,
    });
    render(
      <CompactSpotCard recommendation={recommendation} onTap={mockOnTap} />
    );

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith("favorite_shown_in_carousel", {
        beach_id: "test-beach-1",
        score: 85,
      });
    });
  });

  it("does not track when isFavorite is false", async () => {
    const recommendation = createMockRecommendation({ isFavorite: false });
    render(
      <CompactSpotCard recommendation={recommendation} onTap={mockOnTap} />
    );

    // Wait a tick to ensure useEffect has run
    await waitFor(() => {
      expect(track).not.toHaveBeenCalledWith(
        "favorite_shown_in_carousel",
        expect.anything()
      );
    });
  });
});
