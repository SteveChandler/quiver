import React from "react";
import { render, screen } from "@testing-library/react";
import { BeachDiscoveryCard } from "@/components/discover/beach-discovery-card";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/context/auth-context";

// Mock MatchScoreTeaser
jest.mock("@/components/recommendations/match-score-teaser", () => ({
  MatchScoreTeaser: (props: any) => (
    <div data-testid="match-score-teaser" data-beach-id={props.beachId} />
  ),
}));

// Mock PersonalizedBadge
jest.mock("@/components/recommendations/PersonalizedBadge", () => ({
  PersonalizedBadge: (props: any) => (
    <div data-testid="personalized-badge" data-score={props.score} />
  ),
}));

// Mock FavoriteButton to avoid its internal dependencies
jest.mock("@/components/favorite-button", () => ({
  FavoriteButton: (props: any) => (
    <button
      data-testid="favorite-button"
      data-beach-id={props.beachId}
      aria-label="Add to favorites"
    />
  ),
}));

// Mock the personalization hook
jest.mock("@/hooks/use-beach-personalization", () => ({
  useBeachPersonalization: jest.fn(),
}));

import { useBeachPersonalization } from "@/hooks/use-beach-personalization";

// Mock analytics to avoid side effects
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

const mockBeach = {
  id: "beach-1",
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
  similarity: null,
  generated_at: new Date().toISOString(),
};

describe("BeachDiscoveryCard - MatchScoreTeaser integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows MatchScoreTeaser when user is not authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    (useBeachPersonalization as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <BeachDiscoveryCard
        recommendation={mockRecommendation}
        rank={1}
        onLogSession={jest.fn()}
      />
    );

    expect(screen.getByTestId("match-score-teaser")).toBeInTheDocument();
    expect(screen.queryByTestId("personalized-badge")).not.toBeInTheDocument();
  });

  it("passes beachId to MatchScoreTeaser", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    (useBeachPersonalization as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <BeachDiscoveryCard
        recommendation={mockRecommendation}
        rank={1}
        onLogSession={jest.fn()}
      />
    );

    expect(screen.getByTestId("match-score-teaser")).toHaveAttribute(
      "data-beach-id",
      "beach-1"
    );
  });

  it("shows PersonalizedBadge when user is authenticated and has a personalized score", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
    (useBeachPersonalization as jest.Mock).mockReturnValue({
      data: {
        score: 92,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 10,
          learnedPrefs: 5,
          affinity: 2,
        },
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <BeachDiscoveryCard
        recommendation={mockRecommendation}
        rank={1}
        onLogSession={jest.fn()}
      />
    );

    expect(screen.getByTestId("personalized-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("match-score-teaser")).not.toBeInTheDocument();
  });

  it("shows nothing when user is authenticated but has no personalized score yet", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
    (useBeachPersonalization as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <BeachDiscoveryCard
        recommendation={mockRecommendation}
        rank={1}
        onLogSession={jest.fn()}
      />
    );

    expect(screen.queryByTestId("personalized-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-score-teaser")).not.toBeInTheDocument();
  });
});
