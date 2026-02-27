import React from "react";
import { render, screen } from "@testing-library/react";
import { BeachCard } from "@/components/beach-card";

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

// Mock MapImage to avoid mapbox canvas dependency
jest.mock("@/components/map-image", () => ({
  MapImage: (props: any) => <img src={props.src} alt={props.alt} />,
}));

// Mock the forecast preview hook
jest.mock("@/hooks/use-forecast-preview", () => ({
  useForecastPreview: () => ({
    forecastPreview: null,
    loading: false,
    error: null,
  }),
}));

const defaultProps = {
  id: "beach-abc",
  name: "Ocean Beach",
  distance: "2 mi",
  rating: 4.2,
  reviewCount: 80,
  imageUrl: "/test.jpg",
  slug: "ocean-beach",
  city: "san-diego",
  state: "ca",
};

describe("BeachCard - MatchScoreTeaser integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows MatchScoreTeaser when user is not authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<BeachCard {...defaultProps} />);

    expect(screen.getByTestId("match-score-teaser")).toBeInTheDocument();
    expect(screen.queryByTestId("personalized-badge")).not.toBeInTheDocument();
  });

  it("passes beachId to MatchScoreTeaser", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<BeachCard {...defaultProps} />);

    expect(screen.getByTestId("match-score-teaser")).toHaveAttribute(
      "data-beach-id",
      "beach-abc"
    );
  });

  it("shows PersonalizedBadge when user is authenticated and has a personalized score", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });

    render(
      <BeachCard
        {...defaultProps}
        personalized={true}
        personalizedScore={88}
      />
    );

    expect(screen.getByTestId("personalized-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("match-score-teaser")).not.toBeInTheDocument();
  });

  it("shows nothing when user is authenticated but has no personalized score yet", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });

    render(<BeachCard {...defaultProps} personalized={false} />);

    expect(screen.queryByTestId("personalized-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-score-teaser")).not.toBeInTheDocument();
  });
});
