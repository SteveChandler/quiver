/**
 * TDD tests for session CTA link on BeachCard (Task 8B)
 *
 * Validates:
 * - "Log a session here" link renders on the beach card
 * - Non-authenticated users clicking it opens UnifiedAuthModal with correct props
 * - Authenticated users see a link to /sessions/new
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BeachCard } from "@/components/beach-card";

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/context/auth-context";

// Mock UnifiedAuthModal to capture props
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div
        data-testid="auth-modal"
        data-source={props.source}
        data-mode={props.mode}
        data-context-title={props.contextMessage?.title}
        data-context-description={props.contextMessage?.description}
      />
    ) : null,
}));

// Mock FavoriteButton to avoid auth dependencies
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

// Mock PersonalizedBadge
jest.mock("@/components/recommendations/PersonalizedBadge", () => ({
  PersonalizedBadge: (props: any) => (
    <div data-testid="personalized-badge" data-score={props.score} />
  ),
}));

// Mock MatchScoreTeaser
jest.mock("@/components/recommendations/match-score-teaser", () => ({
  MatchScoreTeaser: (props: any) => (
    <div data-testid="match-score-teaser" data-beach-id={props.beachId} />
  ),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/ca/san-diego/ocean-beach",
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

describe("BeachCard - session link (Task 8B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders 'Log a session here' link on beach card", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<BeachCard {...defaultProps} />);

    expect(screen.getByText(/log a session here/i)).toBeInTheDocument();
  });

  it("opens auth modal for non-authenticated users clicking session link", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<BeachCard {...defaultProps} />);

    const sessionLink = screen.getByText(/log a session here/i);
    fireEvent.click(sessionLink);

    const modal = screen.getByTestId("auth-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-source", "session-log-cta");
    expect(modal).toHaveAttribute("data-mode", "signup");
  });

  it("passes correct context message to auth modal", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<BeachCard {...defaultProps} />);

    fireEvent.click(screen.getByText(/log a session here/i));

    const modal = screen.getByTestId("auth-modal");
    expect(modal).toHaveAttribute("data-context-title", "Track Your Sessions");
    expect(modal).toHaveAttribute(
      "data-context-description",
      `Track your sessions at ${defaultProps.name} and see conditions explained clearly`
    );
  });

  it("renders a link to /sessions/new for authenticated users", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });

    render(<BeachCard {...defaultProps} />);

    const sessionLink = screen.getByText(/log a session here/i);
    expect(sessionLink.closest("a")).toHaveAttribute(
      "href",
      `/sessions/new?beach=${defaultProps.id}`
    );
  });

  it("does not open auth modal for authenticated users clicking session link", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });

    render(<BeachCard {...defaultProps} />);

    // No modal should appear without clicking
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();

    // After clicking the link (it's an anchor, no modal interaction needed)
    const sessionLink = screen.getByText(/log a session here/i);
    fireEvent.click(sessionLink);

    // Modal should still not be open
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
  });
});
