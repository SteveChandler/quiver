import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachReviewSummary } from "@/components/beach/beach-review-summary";
import * as reviewActions from "@/actions/beach-review-actions";
import * as authContext from "@/context/auth-context";

// Mock dependencies
jest.mock("@/actions/beach-review-actions");
jest.mock("@/context/auth-context");
jest.mock("@/components/ui/star-rating", () => ({
  StarRating: ({ rating }: any) => (
    <div data-testid="star-rating">{rating} stars</div>
  ),
}));
jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: any) => (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      {value}%
    </div>
  ),
}));

const mockGetBeachReviewStats = jest.mocked(reviewActions.getBeachReviewStats);
const mockUseAuth = jest.mocked(authContext.useAuth);

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
  },
};

const mockStatsWithReviews = {
  total_reviews: 10,
  average_overall: 4.2,
  average_wave_quality: 4.5,
  average_crowd_density: 3.8,
  average_parking: 3.2,
  average_accessibility: 4.0,
};

const mockStatsEmpty = {
  total_reviews: 0,
  average_overall: 0,
  average_wave_quality: 0,
  average_crowd_density: 0,
  average_parking: 0,
  average_accessibility: 0,
};

describe("BeachReviewSummary", () => {
  const defaultProps = {
    beachId: "beach-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: jest.fn(),
    });
  });

  describe("Loading state", () => {
    it("should show loading spinner while fetching stats", async () => {
      let resolveStats: (value: any) => void;
      const statsPromise = new Promise((resolve) => {
        resolveStats = resolve;
      });
      mockGetBeachReviewStats.mockReturnValue(statsPromise);

      render(<BeachReviewSummary {...defaultProps} />);

      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Resolve the promise
      resolveStats!({ success: true, data: mockStatsWithReviews });
    });
  });

  describe("Empty state", () => {
    it("should show empty state when no reviews exist", async () => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsEmpty,
      });

      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("No reviews yet")).toBeInTheDocument();
        expect(
          screen.getByText("Be the first to review this beach!")
        ).toBeInTheDocument();
      });
    });

    it("should show write review button in empty state when user is authenticated", async () => {
      const onWriteReview = jest.fn();

      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsEmpty,
      });

      render(
        <BeachReviewSummary {...defaultProps} onWriteReview={onWriteReview} />
      );

      await waitFor(() => {
        expect(screen.getByText("Write the First Review")).toBeInTheDocument();
      });

      const writeButton = screen.getByRole("button", {
        name: "Write the First Review",
      });
      await userEvent.setup().click(writeButton);

      expect(onWriteReview).toHaveBeenCalled();
    });

    it("should not show write review button when user is not authenticated", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });

      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsEmpty,
      });

      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("No reviews yet")).toBeInTheDocument();
        expect(
          screen.queryByText("Write the First Review")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Reviews display", () => {
    beforeEach(() => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsWithReviews,
      });
    });

    it("should display overall rating and review count", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("4.2")).toBeInTheDocument();
        expect(screen.getByText("Based on 10 reviews")).toBeInTheDocument();
      });
    });

    it("should display rating breakdown for each category", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Wave Quality")).toBeInTheDocument();
        expect(screen.getByText("4.5")).toBeInTheDocument();

        expect(screen.getByText("Crowd Level")).toBeInTheDocument();
        expect(screen.getByText("3.8")).toBeInTheDocument();

        expect(screen.getByText("Parking")).toBeInTheDocument();
        expect(screen.getByText("3.2")).toBeInTheDocument();

        expect(screen.getByText("Accessibility")).toBeInTheDocument();
        expect(screen.getByText("4.0")).toBeInTheDocument();
      });
    });

    it("should display star ratings for each category", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        // Should have star rating displays for overall and each category
        const starRatings = screen.getAllByTestId(/star-rating/i);
        expect(starRatings.length).toBeGreaterThan(0);
      });
    });

    it("should display progress bars for each category", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        // Progress bars should show percentage of rating (value/5 * 100)
        const progressBars = document.querySelectorAll('[role="progressbar"]');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it("should display rating distribution section", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Rating Distribution")).toBeInTheDocument();

        // Should show 5-star to 1-star distribution
        for (let rating = 5; rating >= 1; rating--) {
          expect(screen.getByText(rating.toString())).toBeInTheDocument();
        }
      });
    });
  });

  describe("Write review functionality", () => {
    beforeEach(() => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsWithReviews,
      });
    });

    it("should show write review button in header when authenticated", async () => {
      const onWriteReview = jest.fn();

      render(
        <BeachReviewSummary {...defaultProps} onWriteReview={onWriteReview} />
      );

      await waitFor(() => {
        expect(screen.getByText("Write Review")).toBeInTheDocument();
      });

      const writeButton = screen.getByRole("button", { name: "Write Review" });
      await userEvent.setup().click(writeButton);

      expect(onWriteReview).toHaveBeenCalled();
    });

    it("should not show write review button when user is not authenticated", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Write Review")).not.toBeInTheDocument();
      });
    });

    it("should not show write review button when callback is not provided", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Write Review")).not.toBeInTheDocument();
      });
    });
  });

  describe("Data refresh", () => {
    it("should refresh stats when refreshTrigger changes", async () => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsWithReviews,
      });

      const { rerender } = render(
        <BeachReviewSummary {...defaultProps} refreshTrigger={0} />
      );

      await waitFor(() => {
        expect(mockGetBeachReviewStats).toHaveBeenCalledTimes(1);
      });

      // Change refresh trigger
      rerender(<BeachReviewSummary {...defaultProps} refreshTrigger={1} />);

      await waitFor(() => {
        expect(mockGetBeachReviewStats).toHaveBeenCalledTimes(2);
      });
    });

    it("should refresh stats when beachId changes", async () => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsWithReviews,
      });

      const { rerender } = render(<BeachReviewSummary beachId="beach-1" />);

      await waitFor(() => {
        expect(mockGetBeachReviewStats).toHaveBeenCalledWith("beach-1");
      });

      // Change beach ID
      rerender(<BeachReviewSummary beachId="beach-2" />);

      await waitFor(() => {
        expect(mockGetBeachReviewStats).toHaveBeenCalledWith("beach-2");
      });
    });
  });

  describe("Error handling", () => {
    it("should handle API errors gracefully", async () => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: false,
        error: "Failed to fetch stats",
      });

      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        // Component should not crash and might show empty state
        expect(screen.queryByText("4.2")).not.toBeInTheDocument();
      });
    });

    it("should handle network errors", async () => {
      mockGetBeachReviewStats.mockRejectedValue(new Error("Network error"));

      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        // Component should not crash
        expect(screen.queryByText("4.2")).not.toBeInTheDocument();
      });
    });
  });

  describe("Single review handling", () => {
    it("should show singular 'review' text for one review", async () => {
      const singleReviewStats = {
        ...mockStatsWithReviews,
        total_reviews: 1,
      };

      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: singleReviewStats,
      });

      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Based on 1 review")).toBeInTheDocument();
      });
    });

    it("should show plural 'reviews' text for multiple reviews", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Based on 10 reviews")).toBeInTheDocument();
      });
    });
  });

  describe("Rating calculations", () => {
    it("should display rounded ratings correctly", async () => {
      const preciseStats = {
        total_reviews: 3,
        average_overall: 4.67,
        average_wave_quality: 3.33,
        average_crowd_density: 2.17,
        average_parking: 4.83,
        average_accessibility: 1.5,
      };

      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: preciseStats,
      });

      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("4.7")).toBeInTheDocument(); // Rounded to 1 decimal
        expect(screen.getByText("3.3")).toBeInTheDocument();
        expect(screen.getByText("2.2")).toBeInTheDocument();
        expect(screen.getByText("4.8")).toBeInTheDocument();
        expect(screen.getByText("1.5")).toBeInTheDocument();
      });
    });

    it("should display correct progress bar values", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        // Wave quality 4.5/5 = 90%
        const progressBars = document.querySelectorAll('[role="progressbar"]');

        // Find progress bar for wave quality (90%)
        const waveQualityProgress = Array.from(progressBars).find(
          (bar) => bar.getAttribute("aria-valuenow") === "90"
        );
        expect(waveQualityProgress).toBeTruthy();
      });
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsWithReviews,
      });
    });

    it("should have proper heading structure", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Reviews & Ratings")).toBeInTheDocument();
        expect(screen.getByText("Rating Breakdown")).toBeInTheDocument();
        expect(screen.getByText("Rating Distribution")).toBeInTheDocument();
      });
    });

    it("should have proper button accessibility", async () => {
      const onWriteReview = jest.fn();

      render(
        <BeachReviewSummary {...defaultProps} onWriteReview={onWriteReview} />
      );

      await waitFor(() => {
        const writeButton = screen.getByRole("button", {
          name: "Write Review",
        });
        expect(writeButton).toBeInTheDocument();
        expect(writeButton).toHaveAttribute("type", "button");
      });
    });

    it("should have proper progress bar labels", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        const progressBars = document.querySelectorAll('[role="progressbar"]');
        progressBars.forEach((bar) => {
          expect(bar).toHaveAttribute("aria-valuemin", "0");
          expect(bar).toHaveAttribute("aria-valuemax", "100");
          expect(bar).toHaveAttribute("aria-valuenow");
        });
      });
    });
  });

  describe("Icons and visual elements", () => {
    beforeEach(() => {
      mockGetBeachReviewStats.mockResolvedValue({
        success: true,
        data: mockStatsWithReviews,
      });
    });

    it("should render category icons", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        // Should have icons for each category
        const icons = document.querySelectorAll("svg");
        expect(icons.length).toBeGreaterThan(4); // At least one for each category
      });
    });

    it("should render star icons", async () => {
      render(<BeachReviewSummary {...defaultProps} />);

      await waitFor(() => {
        // Should have star icons in rating distribution
        const starIcons = document.querySelectorAll(
          'svg[class*="star"], svg[class*="Star"]'
        );
        expect(starIcons.length).toBeGreaterThan(0);
      });
    });
  });
});
