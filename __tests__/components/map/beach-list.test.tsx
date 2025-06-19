import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachList } from "@/components/map/beach-list";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import {
  createMockBeaches,
  createMockReviewStats,
  createMockUseMultipleBeachReviews,
  mockMapUtils,
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
}));

// Mock BeachCard component
jest.mock("@/components/beach-card", () => ({
  BeachCard: ({
    name,
    rating,
    reviewCount,
    onViewDetails,
  }: {
    name: string;
    rating: number;
    reviewCount: number;
    onViewDetails: () => void;
  }) => (
    <div data-testid={`beach-card-${name}`}>
      <h3>{name}</h3>
      <span data-testid="rating">{rating}</span>
      <span data-testid="review-count">{reviewCount}</span>
      <button onClick={onViewDetails}>View Details</button>
    </div>
  ),
}));

// Mock skeleton component
jest.mock("@/components/skeletons/beach-card-skeleton", () => ({
  BeachCardListSkeleton: ({ count }: { count: number }) => (
    <div data-testid="beach-card-skeleton">{count} loading cards</div>
  ),
}));

const mockBeaches = createMockBeaches(2);

const defaultProps = {
  filteredBeaches: mockBeaches,
  searchQuery: "",
  userLocation: { lat: 32.7157, lng: -117.1611 },
  usingDefaultLocation: false,
  loading: false,
  onBeachSelect: jest.fn(),
  onClearSearch: jest.fn(),
  onGetUserLocation: jest.fn(),
  onLoadBeaches: jest.fn(),
  getDistanceFromUser: jest.fn(() => "2.5 miles"),
};

describe("BeachList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading state", () => {
    it("should show skeleton when loading", () => {
      render(<BeachList {...defaultProps} loading={true} />);

      expect(screen.getByTestId("beach-card-skeleton")).toBeInTheDocument();
      expect(screen.getByText("6 loading cards")).toBeInTheDocument();
    });
  });

  describe("Review data integration", () => {
    it("should fetch and display real review data for beaches", async () => {
      const beachIds = mockBeaches.map((b) => b.id);
      const mockReviewStats = createMockReviewStats(beachIds);

      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({ reviewStats: mockReviewStats })
      );

      render(<BeachList {...defaultProps} />);

      await waitFor(() => {
        // Check that the hook was called with correct beach IDs
        assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, beachIds);
      });

      // Verify beach cards show real review data
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
    });

    it("should show zero rating and review count when no reviews exist", async () => {
      const beachIds = mockBeaches.map((b) => b.id);
      const mockReviewStats = beachIds.reduce(
        (acc, id) => ({
          ...acc,
          [id]: {
            total_reviews: 0,
            average_overall: 0,
            average_wave_quality: 0,
            average_crowd_density: 0,
            average_parking: 0,
            average_accessibility: 0,
          },
        }),
        {}
      );

      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({ reviewStats: mockReviewStats })
      );

      render(<BeachList {...defaultProps} />);

      await waitFor(() => {
        assertBeachCardRendered("Ocean Beach", 0, 0);
        assertBeachCardRendered("Mission Beach", 0, 0);
      });
    });

    it("should handle review stats loading state", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews({ loading: true })
      );

      render(<BeachList {...defaultProps} />);

      // Even when reviews are loading, beaches should still render with default values
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

      render(<BeachList {...defaultProps} />);

      // Beaches should still render even if review stats fail to load
      await waitFor(() => {
        expect(
          screen.getByTestId("beach-card-Ocean Beach")
        ).toBeInTheDocument();
        expect(
          screen.getByTestId("beach-card-Mission Beach")
        ).toBeInTheDocument();

        // Should show zero values when stats are unavailable
        assertBeachCardRendered("Ocean Beach", 0, 0);
      });
    });
  });

  describe("Empty states", () => {
    it("should show no beaches found when search returns empty", () => {
      render(
        <BeachList
          {...defaultProps}
          filteredBeaches={[]}
          searchQuery="nonexistent"
        />
      );

      expect(screen.getByText("No beaches found")).toBeInTheDocument();
      expect(
        screen.getByText('No beaches match "nonexistent"')
      ).toBeInTheDocument();
      expect(screen.getByText("Clear Search")).toBeInTheDocument();
    });

    it("should show location prompt when no location is set", () => {
      render(
        <BeachList {...defaultProps} filteredBeaches={[]} userLocation={null} />
      );

      expect(screen.getByText("No location set")).toBeInTheDocument();
      expect(
        screen.getByText("We need your location to find nearby beaches")
      ).toBeInTheDocument();
      expect(screen.getByText("Get My Location")).toBeInTheDocument();
    });

    it("should show general no beaches message when location is set but no beaches found", () => {
      render(<BeachList {...defaultProps} filteredBeaches={[]} />);

      expect(screen.getByText("No beaches found")).toBeInTheDocument();
      expect(
        screen.getByText("No beaches found in your area")
      ).toBeInTheDocument();
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should call onClearSearch when clear search button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <BeachList {...defaultProps} filteredBeaches={[]} searchQuery="test" />
      );

      const clearSearchButton = screen.getByText("Clear Search");
      await user.click(clearSearchButton);

      expect(defaultProps.onClearSearch).toHaveBeenCalledTimes(1);
    });

    it("should call onGetUserLocation when get location button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <BeachList {...defaultProps} filteredBeaches={[]} userLocation={null} />
      );

      const getLocationButton = screen.getByText("Get My Location");
      await user.click(getLocationButton);

      expect(defaultProps.onGetUserLocation).toHaveBeenCalledTimes(1);
    });

    it("should call onLoadBeaches when try again button is clicked", async () => {
      const user = userEvent.setup();

      render(<BeachList {...defaultProps} filteredBeaches={[]} />);

      const tryAgainButton = screen.getByText("Try Again");
      await user.click(tryAgainButton);

      expect(defaultProps.onLoadBeaches).toHaveBeenCalledTimes(1);
    });

    it("should call onBeachSelect when beach view details is clicked", async () => {
      const user = userEvent.setup();

      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<BeachList {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId("beach-card-Ocean Beach")
        ).toBeInTheDocument();
      });

      const viewDetailsButton = screen.getAllByText("View Details")[0];
      await user.click(viewDetailsButton);

      expect(defaultProps.onBeachSelect).toHaveBeenCalledWith(mockBeaches[0]);
    });
  });

  describe("Distance display", () => {
    it("should show calculated distance when user location is available", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<BeachList {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.getDistanceFromUser).toHaveBeenCalledWith(
          32.7503,
          -117.2534
        );
        expect(defaultProps.getDistanceFromUser).toHaveBeenCalledWith(
          32.7641,
          -117.253
        );
      });
    });

    it("should show location text when user location is not available", async () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      render(<BeachList {...defaultProps} userLocation={null} />);

      // Beach cards should still render with location text instead of distance
      await waitFor(() => {
        expect(
          screen.getByTestId("beach-card-Ocean Beach")
        ).toBeInTheDocument();
        expect(
          screen.getByTestId("beach-card-Mission Beach")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Performance", () => {
    it("should only call useMultipleBeachReviews once per render with correct beach IDs", () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      const { rerender } = render(<BeachList {...defaultProps} />);

      expect(mockUseMultipleBeachReviews).toHaveBeenCalledTimes(1);
      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, [
        "beach-1",
        "beach-2",
      ]);

      // Re-render with same props shouldn't cause additional calls
      rerender(<BeachList {...defaultProps} />);

      expect(mockUseMultipleBeachReviews).toHaveBeenCalledTimes(2); // React strict mode causes double calls
    });

    it("should update hook call when filtered beaches change", () => {
      mockUseMultipleBeachReviews.mockReturnValue(
        createMockUseMultipleBeachReviews()
      );

      const { rerender } = render(<BeachList {...defaultProps} />);

      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, [
        "beach-1",
        "beach-2",
      ]);

      // Change filtered beaches
      const newBeaches = [mockBeaches[0]]; // Only first beach
      rerender(<BeachList {...defaultProps} filteredBeaches={newBeaches} />);

      assertHookCalledWithBeachIds(mockUseMultipleBeachReviews, ["beach-1"]);
    });
  });
});
