import React from "react";
import { render, screen } from "@testing-library/react";
import { BeachDiscoveryCard } from "@/components/discover/beach-discovery-card";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock FavoriteButton to avoid its internal dependencies (auth, fetch, etc.)
jest.mock("@/components/favorite-button", () => ({
  FavoriteButton: (props: any) => (
    <button
      data-testid="favorite-button"
      data-beach-id={props.beachId}
      data-beach-name={props.beachName}
      aria-label="Add to favorites"
    />
  ),
}));

// Mock the personalization hook used by BeachDiscoveryCard
jest.mock("@/hooks/use-beach-personalization", () => ({
  useBeachPersonalization: jest.fn().mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// Mock analytics to avoid side effects
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

describe("BeachDiscoveryCard - FavoriteButton integration", () => {
  const mockBeach = {
    id: "beach-xyz",
    name: "Pipeline",
    slug: "pipeline",
    description: "Famous surf spot",
    center_lat: 21.6644,
    center_lng: -158.0531,
    country: "USA",
    region: "Hawaii",
    spot_id: "spot-1",
    primary_swell_window_min: 270,
    primary_swell_window_max: 315,
    photo_url: null,
    photo_attribution: null,
    ideal_wind_direction: "E",
    ideal_tide: "Mid",
    difficulty: "expert",
    break_type: "reef",
    best_seasons: ["winter"],
    hazards: ["shallow reef"],
    facilities: [],
    camping: false,
    parking: null,
    crowd_level: "very-crowded",
    timezone: "Pacific/Honolulu",
    created_at: new Date().toISOString(),
  } as any;

  const mockRecommendation: SurfDiscoveryRecommendation = {
    beach: mockBeach,
    forecast: {} as EnhancedForecastEntity,
    score: 85,
    matchQuality: "excellent",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 10,
      affinityBonus: 10,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    window: {
      start: new Date("2025-01-16T00:00:00Z"),
      end: new Date("2025-01-16T03:00:00Z"),
      tide: "Rising",
      wind: "10 mph E",
      waveHeight: "4-5 ft",
      wavePeriod: "12s",
      dataSource: "CDIP",
      confidence: 85,
      timezone: "America/Los_Angeles",
    },
    summary: "Excellent match at Pipeline - 4-5 ft with 10 mph E.",
    reasons: ["Good swell direction"],
    warnings: [],
    generated_at: new Date().toISOString(),
  };

  it("renders FavoriteButton on discovery card", () => {
    render(
      <BeachDiscoveryCard
        recommendation={mockRecommendation}
        rank={1}
        onPlanSession={jest.fn()}
      />
    );

    const favoriteButton = screen.getByTestId("favorite-button");
    expect(favoriteButton).toBeInTheDocument();
  });

  it("passes correct beachId to FavoriteButton", () => {
    render(
      <BeachDiscoveryCard
        recommendation={mockRecommendation}
        rank={1}
        onPlanSession={jest.fn()}
      />
    );

    const favoriteButton = screen.getByTestId("favorite-button");
    expect(favoriteButton).toHaveAttribute("data-beach-id", "beach-xyz");
  });

  it("passes correct beachName to FavoriteButton", () => {
    render(
      <BeachDiscoveryCard
        recommendation={mockRecommendation}
        rank={1}
        onPlanSession={jest.fn()}
      />
    );

    const favoriteButton = screen.getByTestId("favorite-button");
    expect(favoriteButton).toHaveAttribute("data-beach-name", "Pipeline");
  });
});
