import React from "react";
import { render, screen } from "@testing-library/react";
import { BeachCard } from "@/components/beach-card";

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

// Mock MapImage to avoid mapbox canvas dependency
jest.mock("@/components/map-image", () => ({
  MapImage: (props: any) => <img src={props.src} alt={props.alt} />,
}));

// Mock the forecast preview hook used by BeachCard
jest.mock("@/hooks/use-forecast-preview", () => ({
  useForecastPreview: () => ({
    forecastPreview: null,
    loading: false,
    error: null,
  }),
}));

// Mock PersonalizedBadge to avoid its internal complexity
jest.mock("@/components/recommendations/PersonalizedBadge", () => ({
  PersonalizedBadge: (props: any) => (
    <div data-testid="personalized-badge">{props.score}</div>
  ),
}));

describe("BeachCard - FavoriteButton integration", () => {
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

  it("renders FavoriteButton on beach card", () => {
    render(<BeachCard {...defaultProps} />);

    const favoriteButton = screen.getByTestId("favorite-button");
    expect(favoriteButton).toBeInTheDocument();
  });

  it("passes correct beachId to FavoriteButton", () => {
    render(<BeachCard {...defaultProps} />);

    const favoriteButton = screen.getByTestId("favorite-button");
    expect(favoriteButton).toHaveAttribute("data-beach-id", "beach-abc");
  });

  it("passes correct beachName to FavoriteButton", () => {
    render(<BeachCard {...defaultProps} />);

    const favoriteButton = screen.getByTestId("favorite-button");
    expect(favoriteButton).toHaveAttribute("data-beach-name", "Ocean Beach");
  });
});
