import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NearbyTab } from "@/components/home-screen/nearby-tab";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import {
  createMockBeaches,
  createMockReviewStats,
  createMockUseMultipleBeachReviews,
  mockMapUtils,
  mockBeachCard,
  assertBeachCardRendered,
  assertHookCalledWithBeachIds,
} from "@/__tests__/setup/test-utils";
import type { Beach } from "@/types/database";

// Mock the hook
jest.mock("@/hooks/use-beach-reviews");
const mockUseMultipleBeachReviews =
  useMultipleBeachReviews as jest.MockedFunction<
    typeof useMultipleBeachReviews
  >;

// Mock the map utils
jest.mock("@/lib/map-utils", () => ({
  getStaticMapImageUrl: jest.fn(() => "http://example.com/map.jpg"),
  resolveBeachCoordinates: jest.fn((beach) => ({
    latitude: beach.latitude,
    longitude: beach.longitude,
  })),
}));

// Mock BeachCard component
jest.mock("@/components/beach-card", () => ({
  BeachCard: ({
    name,
    rating,
    reviewCount,
    distance,
    onViewDetails,
  }: {
    name: string;
    rating: number;
    reviewCount: number;
    distance: string;
    onViewDetails?: () => void;
  }) => (
    <div data-testid={`beach-card-${name}`}>
      <h3>{name}</h3>
      <span data-testid="rating">{rating}</span>
      <span data-testid="review-count">{reviewCount}</span>
      <span data-testid="distance">{distance}</span>
      {onViewDetails && <button onClick={onViewDetails}>View Details</button>}
    </div>
  ),
}));

// Mock loading spinner
jest.mock("lucide-react", () => ({
  Loader2: ({ className }: { className: string }) => (
    <div data-testid="loading-spinner" className={className}>
      Loading...
    </div>
  ),
}));

const mockBeaches = createMockBeaches(6);

describe("NearbyTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading state", () => {
    it("should show loading spinner when loading", () => {
      render(<NearbyTab beaches={[]} loading={true} />);

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("should show no beaches message when beaches array is empty", () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<NearbyTab beaches={[]} loading={false} />);

      expect(screen.getByText("No beaches found nearby")).toBeInTheDocument();
      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, []);
    });
  });

  describe("Beach display and review data integration", () => {
    it("should display only first 5 beaches with real review data", async () => {
      const beachIds = mockBeaches.slice(0, 5).map((b) => b.id);
      const mockReviewStats = createMockReviewStats(beachIds);

      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({ reviewStats: mockReviewStats })
      );

      render(<NearbyTab beaches={mockBeaches} loading={false} />);

      await waitFor(() => {
        // Should only call hook with first 5 beach IDs
        assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, beachIds);
      });

      // Verify only first 5 beaches are displayed
      expect(screen.getByTestId("beach-card-Ocean Beach")).toBeInTheDocument();
      expect(
        screen.getByTestId("beach-card-Mission Beach")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("beach-card-La Jolla Cove")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("beach-card-Sunset Cliffs")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("beach-card-Windansea Beach")
      ).toBeInTheDocument();

      // 6th beach should not be displayed
      expect(
        screen.queryByTestId("beach-card-Pacific Beach")
      ).not.toBeInTheDocument();

      // Verify real review data is displayed using centralized stats
      assertBeachCardRendered(
        "Ocean Beach",
        mockReviewStats["beach-1"].average_overall,
        mockReviewStats["beach-1"].total_reviews
      );
      assertBeachCardRendered(
        "Mission Beach",
        mockReviewStats["beach-2"].average_overall,
        mockReviewStats["beach-2"].total_reviews
      );
      assertBeachCardRendered(
        "La Jolla Cove",
        mockReviewStats["beach-3"].average_overall,
        mockReviewStats["beach-3"].total_reviews
      );
    });

    it("should show zero ratings and review counts for beaches with no reviews", async () => {
      const beachIds = mockBeaches.slice(0, 2).map((b) => b.id);
      const mockReviewStats = {
        "beach-1": {
          total_reviews: 0,
          average_overall: 0,
          average_wave_quality: 0,
          average_crowd_density: 0,
          average_parking: 0,
          average_accessibility: 0,
        },
        "beach-2": {
          total_reviews: 5,
          average_overall: 3.8,
          average_wave_quality: 4.0,
          average_crowd_density: 3.5,
          average_parking: 3.0,
          average_accessibility: 4.0,
        },
      };

      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({ reviewStats: mockReviewStats })
      );

      render(<NearbyTab beaches={mockBeaches.slice(0, 2)} loading={false} />);

      await waitFor(() => {
        // Beach with no reviews should show 0
        assertBeachCardRendered("Ocean Beach", 0, 0);
        // Beach with reviews should show actual data
        assertBeachCardRendered("Mission Beach", 3.8, 5);
      });
    });

    it("should handle missing review stats gracefully", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({ reviewStats: {} })
      );

      render(<NearbyTab beaches={mockBeaches.slice(0, 2)} loading={false} />);

      await waitFor(() => {
        // Should show 0 for beaches without stats
        assertBeachCardRendered("Ocean Beach", 0, 0);
        assertBeachCardRendered("Mission Beach", 0, 0);
      });
    });

    it("should handle review stats loading state", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({ loading: true })
      );

      render(<NearbyTab beaches={mockBeaches.slice(0, 2)} loading={false} />);

      // Should still render beaches even when review stats are loading
      await waitFor(() => {
        expect(
          screen.getByTestId("beach-card-Ocean Beach")
        ).toBeInTheDocument();
        expect(
          screen.getByTestId("beach-card-Mission Beach")
        ).toBeInTheDocument();
      });
    });

    it("should handle review stats error state gracefully", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({
          error: "Failed to fetch review stats",
        })
      );

      render(<NearbyTab beaches={mockBeaches.slice(0, 2)} loading={false} />);

      // Should still render beaches with default values when stats fail to load
      await waitFor(() => {
        expect(
          screen.getByTestId("beach-card-Ocean Beach")
        ).toBeInTheDocument();
        expect(
          screen.getByTestId("beach-card-Mission Beach")
        ).toBeInTheDocument();

        // Should show 0 values when stats are unavailable
        assertBeachCardRendered("Ocean Beach", 0, 0);
      });
    });
  });

  describe("Distance calculation", () => {
    it("should calculate and display distances from Ocean Beach", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<NearbyTab beaches={mockBeaches.slice(0, 3)} loading={false} />);

      await waitFor(() => {
        // All beaches should have distance displayed
        const cards = screen.getAllByTestId(/^beach-card-/);
        cards.forEach((card) => {
          const distanceElement = card.querySelector(
            '[data-testid="distance"]'
          );
          expect(distanceElement).toBeInTheDocument();
          expect(distanceElement?.textContent).toMatch(/\d+\.\d+ miles/);
        });
      });
    });

    it("should handle beaches with valid coordinates", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      const beachesWithCoords = mockBeaches.slice(0, 2);
      render(<NearbyTab beaches={beachesWithCoords} loading={false} />);

      await waitFor(() => {
        // Should display calculated distances
        const oceanBeachCard = screen.getByTestId("beach-card-Ocean Beach");
        const distanceElement = oceanBeachCard.querySelector(
          '[data-testid="distance"]'
        );
        expect(distanceElement?.textContent).toMatch(/\d+\.\d+ miles/);
      });
    });
  });

  describe("Performance optimization", () => {
    it("should only fetch stats for displayed beaches (first 5)", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<NearbyTab beaches={mockBeaches} loading={false} />);

      // Should only call hook with first 5 beach IDs, not all 6
      const expectedIds = mockBeaches.slice(0, 5).map((b) => b.id);
      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, expectedIds);

      // Should NOT include beach-6
      expect(mockUseMultipleBeachReviews).not.toHaveBeenCalledWith(
        expect.arrayContaining(["beach-6"])
      );
    });

    it("should update hook call when beaches prop changes", () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      const { rerender } = render(
        <NearbyTab beaches={mockBeaches.slice(0, 3)} loading={false} />
      );

      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, [
        "beach-1",
        "beach-2",
        "beach-3",
      ]);

      // Change beaches prop
      rerender(<NearbyTab beaches={mockBeaches.slice(0, 2)} loading={false} />);

      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, [
        "beach-1",
        "beach-2",
      ]);
    });

    it("should handle empty beaches array efficiently", () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<NearbyTab beaches={[]} loading={false} />);

      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, []);
    });
  });

  describe("Map image integration", () => {
    it("should generate map images for all displayed beaches", async () => {
      const { getStaticMapImageUrl } = require("@/lib/map-utils");

      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<NearbyTab beaches={mockBeaches.slice(0, 3)} loading={false} />);

      await waitFor(() => {
        // Should call getStaticMapImageUrl for each beach
        expect(getStaticMapImageUrl).toHaveBeenCalledTimes(3);

        // Check specific calls for first few beaches
        expect(getStaticMapImageUrl).toHaveBeenCalledWith(32.7503, -117.2534, {
          width: 300,
          height: 200,
          zoom: 15,
        });
        expect(getStaticMapImageUrl).toHaveBeenCalledWith(32.7641, -117.253, {
          width: 300,
          height: 200,
          zoom: 15,
        });
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle beaches with missing coordinate data", async () => {
      const beachesWithMissingCoords = [
        {
          ...mockBeaches[0],
          latitude: null as any,
          longitude: null as any,
        },
        mockBeaches[1],
      ];

      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<NearbyTab beaches={beachesWithMissingCoords} loading={false} />);

      // Should still render beaches even with missing coordinates
      await waitFor(() => {
        expect(
          screen.getByTestId("beach-card-Ocean Beach")
        ).toBeInTheDocument();
        expect(
          screen.getByTestId("beach-card-Mission Beach")
        ).toBeInTheDocument();
      });
    });

    it("should handle exactly 5 beaches without issues", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      const exactlyFiveBeaches = mockBeaches.slice(0, 5);
      render(<NearbyTab beaches={exactlyFiveBeaches} loading={false} />);

      await waitFor(() => {
        const expectedIds = exactlyFiveBeaches.map((b) => b.id);
        assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, expectedIds);

        // All 5 beaches should be displayed
        expect(screen.getAllByTestId(/^beach-card-/)).toHaveLength(5);
      });
    });

    it("should handle fewer than 5 beaches", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      const twoBeaches = mockBeaches.slice(0, 2);
      render(<NearbyTab beaches={twoBeaches} loading={false} />);

      await waitFor(() => {
        assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, [
          "beach-1",
          "beach-2",
        ]);

        // Only 2 beaches should be displayed
        expect(screen.getAllByTestId(/^beach-card-/)).toHaveLength(2);
      });
    });
  });
});
