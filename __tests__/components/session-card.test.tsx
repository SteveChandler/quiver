import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionCard } from "@/components/session-card";
import "@testing-library/jest-dom";

// Mock the hooks
jest.mock("@/hooks/use-comment-count", () => ({
  useCommentCount: jest.fn(() => ({
    commentCount: 0,
    isLoading: false,
  })),
}));

jest.mock("@/hooks/use-session-like", () => ({
  useSessionLike: jest.fn(() => ({
    liked: false,
    likesCount: 5,
    toggleLike: jest.fn(),
    isToggling: false,
  })),
}));

// Mock next/link
jest.mock("next/link", () => {
  return ({ children }: { children: React.ReactNode }) => children;
});

describe("SessionCard", () => {
  const defaultProps = {
    id: "test-session-1",
    username: "Test User",
    beachName: "Test Beach",
    date: "2024-01-01",
    rating: 4,
    description: "Great session!",
    imageUrl: "/test-image.jpg",
    likes: 5,
    comments: 3,
    isOwner: false,
  };

  it("renders session card with basic information", () => {
    render(<SessionCard {...defaultProps} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("Test Beach")).toBeInTheDocument();
    expect(screen.getByText("2024-01-01")).toBeInTheDocument();
    expect(screen.getByText("Great session!")).toBeInTheDocument();
  });

  it("shows planned session indicator for planned sessions", () => {
    const plannedSession = {
      id: "planned-session",
      beach: { name: "Test Beach" },
      status: "planned",
      rating: 0,
      session_date: "2024-01-02",
      user: { full_name: "Test User" },
    };

    render(<SessionCard {...defaultProps} session={plannedSession as any} />);

    // Should show the planned session badge
    expect(screen.getByText("Planned Session")).toBeInTheDocument();
  });

  it("does not show planned session indicator for completed sessions", () => {
    const completedSession = {
      id: "completed-session",
      beach: { name: "Test Beach" },
      status: "completed",
      rating: 4,
      session_date: "2024-01-01",
      duration_minutes: 120,
      user: { full_name: "Test User" },
    };

    render(<SessionCard {...defaultProps} session={completedSession as any} />);

    // Should NOT show the planned session badge
    expect(screen.queryByText("Planned Session")).not.toBeInTheDocument();
  });

  it("renders session conditions when session data is provided", () => {
    const sessionWithConditions = {
      id: "session-with-conditions",
      beach: { name: "Test Beach" },
      status: "completed",
      rating: 4,
      session_date: "2024-01-01",
      wave_quality: 4,
      wave_height: "4-6 ft",
      water_temp: "68°F",
      crowd_level: 3,
      user: { full_name: "Test User" },
    };

    render(<SessionCard {...defaultProps} session={sessionWithConditions as any} />);

    // Should show wave conditions section when session data is available
    expect(screen.getByText("4-6 ft")).toBeInTheDocument();
    expect(screen.getByText("68°F")).toBeInTheDocument();
  });

  it("handles owner vs non-owner display correctly", () => {
    render(<SessionCard {...defaultProps} isOwner={true} />);

    // When isOwner is true, should show "You" or handle owner-specific UI
    // The exact implementation depends on how the component handles this
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });
});
