import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionCard } from "@/components/session-card";
import type { SessionPhoto } from "@/components/session-card-photos";
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

jest.mock("@/hooks/use-user-follow", () => ({
  useUserFollow: jest.fn(() => ({
    following: false,
    toggleFollow: jest.fn(),
    isToggling: false,
  })),
}));

// Mock next/link
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock MapImage component
jest.mock("@/components/map-image", () => ({
  MapImage: () => <div data-testid="map-image">Map</div>,
}));

// Mock CommentsModal
jest.mock("@/components/comments-modal", () => ({
  CommentsModal: () => null,
}));

// Mock SessionShareModal and SessionShareButton
jest.mock("@/components/session/session-share-modal", () => ({
  SessionShareModal: () => null,
}));

jest.mock("@/components/session/session-share-button", () => ({
  SessionShareButton: () => null,
}));

// Mock UserAvatar
jest.mock("@/components/user-avatar", () => ({
  UserAvatar: () => <div data-testid="user-avatar">Avatar</div>,
}));

describe("SessionCard with Photos", () => {
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
    isOwner: true,
  };

  const mockPhotos: SessionPhoto[] = [
    {
      id: "photo-1",
      public_url: "https://example.com/photo1.jpg",
      caption: "First photo",
    },
    {
      id: "photo-2",
      public_url: "https://example.com/photo2.jpg",
      caption: "Second photo",
    },
    {
      id: "photo-3",
      public_url: "https://example.com/photo3.jpg",
      caption: "Third photo",
    },
  ];

  beforeEach(() => {
    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: "" };
  });

  it("should render photos when provided", () => {
    render(<SessionCard {...defaultProps} photos={mockPhotos} />);

    // Photos should be visible
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(3); // At least 3 photos
  });

  it("should hide map when photos exist", () => {
    render(<SessionCard {...defaultProps} photos={mockPhotos} />);

    // Map should not be rendered when photos exist
    const mapImage = screen.queryByTestId("map-image");
    expect(mapImage).not.toBeInTheDocument();
  });

  it("should show map when no photos provided", () => {
    render(<SessionCard {...defaultProps} />);

    // Map should be visible when no photos
    const mapImage = screen.getByTestId("map-image");
    expect(mapImage).toBeInTheDocument();
  });

  it("should show map when photos array is empty", () => {
    render(<SessionCard {...defaultProps} photos={[]} />);

    // Map should be visible when photos array is empty
    const mapImage = screen.getByTestId("map-image");
    expect(mapImage).toBeInTheDocument();
  });

  it("should navigate to session detail when photo clicked (for owner)", () => {
    render(<SessionCard {...defaultProps} photos={mockPhotos} isOwner={true} />);

    const photoGrid = screen.getByRole("button", {
      name: /view \d+ session photos/i,
    });

    fireEvent.click(photoGrid);

    // Should set window.location.href to session detail page
    expect(window.location.href).toBe("/sessions/test-session-1");
  });

  it("should not navigate when photo clicked for non-owner", () => {
    const initialHref = window.location.href;
    render(
      <SessionCard {...defaultProps} photos={mockPhotos} isOwner={false} />
    );

    const photoGrid = screen.getByRole("button", {
      name: /view \d+ session photos/i,
    });

    fireEvent.click(photoGrid);

    // Should not change location for non-owner
    expect(window.location.href).toBe(initialHref);
  });

  it("should show photo count badge", () => {
    render(<SessionCard {...defaultProps} photos={mockPhotos} />);

    // Badge should show photo count
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should display photos with correct layout for different counts", () => {
    const { rerender } = render(
      <SessionCard {...defaultProps} photos={[mockPhotos[0]]} />
    );

    // Single photo
    let images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(1);

    // Two photos
    rerender(<SessionCard {...defaultProps} photos={mockPhotos.slice(0, 2)} />);
    images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(2);

    // Three photos
    rerender(<SessionCard {...defaultProps} photos={mockPhotos} />);
    images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(3);
  });

  it("should render photos in correct position within card", () => {
    const { container } = render(
      <SessionCard {...defaultProps} photos={mockPhotos} />
    );

    // Photos should come after description/notes and before engagement buttons
    const cardContent = container.querySelector('[class*="space-y"]');
    expect(cardContent).toBeInTheDocument();

    // Check that photos section exists
    const photoSection = screen.getByRole("button", {
      name: /view \d+ session photos/i,
    });
    expect(photoSection).toBeInTheDocument();
  });

  it("should show both photos and session details", () => {
    render(<SessionCard {...defaultProps} photos={mockPhotos} />);

    // Should show all standard session info
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("Test Beach")).toBeInTheDocument();
    expect(screen.getByText("2024-01-01")).toBeInTheDocument();
    expect(screen.getByText("Great session!")).toBeInTheDocument();

    // Should also show photos
    const photoGrid = screen.getByRole("button", {
      name: /view \d+ session photos/i,
    });
    expect(photoGrid).toBeInTheDocument();
  });

  it("should maintain card layout with photos", () => {
    const { container } = render(
      <SessionCard {...defaultProps} photos={mockPhotos} />
    );

    // Card should have proper structure
    const card = container.querySelector('[class*="card"]');
    expect(card).toBeInTheDocument();
  });

  it("should apply my-3 className to photos section", () => {
    const { container } = render(
      <SessionCard {...defaultProps} photos={mockPhotos} />
    );

    // Photos section should have my-3 class for spacing
    const photoSection = screen.getByRole("button", {
      name: /view \d+ session photos/i,
    });
    const parentDiv = photoSection.closest('[class*="my-3"]');
    expect(parentDiv).toBeInTheDocument();
  });

  it("should work with session data and photos", () => {
    const sessionWithData = {
      id: "test-session-1",
      beach: { name: "Test Beach" },
      status: "completed" as const,
      rating: 4,
      session_date: "2024-01-01",
      user: { full_name: "Test User", id: "user-1" },
      wave_quality: 4,
      wave_height: "4-6 ft",
      water_temp: "68°F",
    };

    render(
      <SessionCard
        {...defaultProps}
        session={sessionWithData}
        photos={mockPhotos}
      />
    );

    // Should show both session data and photos
    expect(screen.getByText("4-6 ft")).toBeInTheDocument();
    expect(screen.getByText("68°F")).toBeInTheDocument();

    const photoGrid = screen.getByRole("button", {
      name: /view \d+ session photos/i,
    });
    expect(photoGrid).toBeInTheDocument();
  });

  it("should handle planned sessions with photos", () => {
    const plannedSession = {
      id: "planned-session",
      beach: { name: "Test Beach" },
      status: "planned" as const,
      rating: 0,
      session_date: "2024-01-02",
      user: { full_name: "Test User", id: "user-1" },
    };

    render(
      <SessionCard
        {...defaultProps}
        session={plannedSession}
        photos={mockPhotos}
      />
    );

    // Should show planned session badge
    expect(screen.getByText("Planned Session")).toBeInTheDocument();

    // Should still show photos
    const photoGrid = screen.getByRole("button", {
      name: /view \d+ session photos/i,
    });
    expect(photoGrid).toBeInTheDocument();
  });
});
