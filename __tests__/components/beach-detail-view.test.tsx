import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachDetailView } from "@/components/beach-detail-view";
import * as authContext from "@/context/auth-context";
import * as enhancedBeachData from "@/hooks/use-enhanced-beach-data";
import * as beachReviews from "@/hooks/use-beach-reviews";
import * as mapUtils from "@/lib/map-utils";

// Mock dependencies
jest.mock("@/context/auth-context");
jest.mock("@/hooks/use-enhanced-beach-data");
jest.mock("@/hooks/use-beach-reviews");
jest.mock("@/lib/map-utils");
jest.mock("next/link", () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock child components
jest.mock("@/components/beaches-enhanced-forecast", () => ({
  BeachesEnhancedForecast: ({ beachId, beachName }: any) => (
    <div data-testid="enhanced-forecast">
      Enhanced Forecast for {beachName} (ID: {beachId})
    </div>
  ),
}));

jest.mock("@/components/beach-detail/beach-header", () => ({
  BeachHeader: ({ beachName }: any) => (
    <div data-testid="beach-header">{beachName}</div>
  ),
}));

jest.mock("@/components/beach-detail/beach-hero", () => ({
  BeachHero: ({ beach, mapImageUrl }: any) => (
    <div data-testid="beach-hero">
      <img src={mapImageUrl} alt={`Map of ${beach.name}`} />
      {beach.name}
    </div>
  ),
}));

jest.mock("@/components/beach-detail/beach-quick-actions", () => ({
  BeachQuickActions: ({ beach, isAuthenticated }: any) => (
    <div data-testid="quick-actions">
      Quick Actions for {beach.name} - Auth: {isAuthenticated.toString()}
    </div>
  ),
}));

jest.mock("@/components/beach/beach-review-summary", () => ({
  BeachReviewSummary: ({ beachId, onWriteReview }: any) => (
    <div data-testid="review-summary">
      Review Summary for {beachId}
      {onWriteReview && <button onClick={onWriteReview}>Write Review</button>}
    </div>
  ),
}));

jest.mock("@/components/beach/beach-reviews-list", () => ({
  BeachReviewsList: ({ beachId, onEditReview }: any) => (
    <div data-testid="reviews-list">
      Reviews List for {beachId}
      {onEditReview && (
        <button onClick={() => onEditReview({ id: "test-review" })}>
          Edit Review
        </button>
      )}
    </div>
  ),
}));

jest.mock("@/components/beach/beach-review-form", () => ({
  BeachReviewForm: ({
    beachId,
    beachName,
    existingReview,
    onSuccess,
    onCancel,
    isInDialog,
  }: any) => (
    <div data-testid="review-form">
      Review Form for {beachName} ({beachId})
      {existingReview && <span>Editing: {existingReview.id}</span>}
      <span>In Dialog: {isInDialog.toString()}</span>
      <button onClick={onSuccess}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const mockUseAuth = jest.mocked(authContext.useAuth);
const mockUseEnhancedBeachData = jest.mocked(
  enhancedBeachData.useEnhancedBeachData
);
const mockUseBeachReviews = jest.mocked(beachReviews.useBeachReviews);
const mockGetStaticMapImageUrl = jest.mocked(mapUtils.getStaticMapImageUrl);

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
  },
};

const mockBeach = {
  id: "beach-1",
  name: "Test Beach",
  latitude: 32.7841,
  longitude: -117.2527,
  description: "A beautiful test beach",
  location: "San Diego, CA",
  wave_quality_rating: 4.2,
  crowd_density_rating: 3.1,
  parking_rating: 3.8,
  accessibility_rating: 4.0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockEnhancedBeachData = {
  beach: mockBeach,
  forecasts: [],
  sessions: [],
  forecastDates: [],
  loading: false,
  error: null,
  sessionsLoading: false,
};

describe("BeachDetailView", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: jest.fn(),
    });

    mockUseEnhancedBeachData.mockReturnValue(mockEnhancedBeachData);

    mockUseBeachReviews.mockReturnValue({
      reviews: [],
      loading: false,
      error: null,
      refresh: jest.fn(),
    });

    mockGetStaticMapImageUrl.mockReturnValue("https://example.com/map.jpg");
  });

  describe("Component rendering", () => {
    it("should render the beach detail view with all required sections", () => {
      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByTestId("beach-header")).toBeInTheDocument();
      expect(screen.getByTestId("beach-hero")).toBeInTheDocument();
      expect(screen.getByTestId("quick-actions")).toBeInTheDocument();
      expect(screen.getByTestId("enhanced-forecast")).toBeInTheDocument();
    });

    it("should display the correct beach name and information", () => {
      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByText("Test Beach")).toBeInTheDocument();
      expect(
        screen.getByText(/Enhanced Forecast for Test Beach/)
      ).toBeInTheDocument();
    });

    it("should pass authentication status to components", () => {
      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByText(/Auth: true/)).toBeInTheDocument();
    });
  });

  describe("Tabs functionality", () => {
    it("should render exactly 3 tabs (Reviews, Info, Gallery)", () => {
      render(<BeachDetailView id="beach-1" />);

      const reviewsTab = screen.getByRole("tab", { name: "Reviews" });
      const infoTab = screen.getByRole("tab", { name: "Info" });
      const galleryTab = screen.getByRole("tab", { name: "Gallery" });

      expect(reviewsTab).toBeInTheDocument();
      expect(infoTab).toBeInTheDocument();
      expect(galleryTab).toBeInTheDocument();

      // Should not have forecast tab or community tab
      expect(
        screen.queryByRole("tab", { name: "Forecast" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: "Community" })
      ).not.toBeInTheDocument();
    });

    it("should default to Reviews tab", () => {
      render(<BeachDetailView id="beach-1" />);

      const reviewsTab = screen.getByRole("tab", { name: "Reviews" });
      expect(reviewsTab).toHaveAttribute("data-state", "active");
    });

    it("should switch between tabs correctly", async () => {
      const user = userEvent.setup();
      render(<BeachDetailView id="beach-1" />);

      // Click Info tab
      const infoTab = screen.getByRole("tab", { name: "Info" });
      await user.click(infoTab);

      expect(infoTab).toHaveAttribute("data-state", "active");
      expect(screen.getByText("Beach Information")).toBeInTheDocument();

      // Click Gallery tab
      const galleryTab = screen.getByRole("tab", { name: "Gallery" });
      await user.click(galleryTab);

      expect(galleryTab).toHaveAttribute("data-state", "active");
      expect(screen.getByText("View All Photos")).toBeInTheDocument();
    });
  });

  describe("Reviews functionality", () => {
    it("should render review components in Reviews tab", () => {
      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByTestId("review-summary")).toBeInTheDocument();
      expect(screen.getByTestId("reviews-list")).toBeInTheDocument();
    });

    it("should open review dialog when write review is clicked", async () => {
      const user = userEvent.setup();
      render(<BeachDetailView id="beach-1" />);

      const writeReviewButton = screen.getByText("Write Review");
      await user.click(writeReviewButton);

      await waitFor(() => {
        expect(screen.getByTestId("review-form")).toBeInTheDocument();
        expect(
          screen.getByText(/Write a Review.*for.*Test Beach/)
        ).toBeInTheDocument();
      });
    });

    it("should open edit dialog when edit review is clicked", async () => {
      const user = userEvent.setup();
      render(<BeachDetailView id="beach-1" />);

      const editReviewButton = screen.getByText("Edit Review");
      await user.click(editReviewButton);

      await waitFor(() => {
        expect(screen.getByTestId("review-form")).toBeInTheDocument();
        expect(
          screen.getByText(/Edit Your Review.*for.*Test Beach/)
        ).toBeInTheDocument();
        expect(screen.getByText("Editing: test-review")).toBeInTheDocument();
      });
    });

    it("should close dialog and refresh reviews on success", async () => {
      const user = userEvent.setup();
      const mockRefresh = jest.fn();

      mockUseBeachReviews.mockReturnValue({
        reviews: [],
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<BeachDetailView id="beach-1" />);

      // Open dialog
      const writeReviewButton = screen.getByText("Write Review");
      await user.click(writeReviewButton);

      await waitFor(() => {
        expect(screen.getByTestId("review-form")).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByText("Submit");
      await user.click(submitButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe("Removed sections verification", () => {
    it("should not render BeachCommunity component", () => {
      render(<BeachDetailView id="beach-1" />);

      // Should not find any community-related elements
      expect(screen.queryByTestId("beach-community")).not.toBeInTheDocument();
      expect(screen.queryByText(/community/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/sessions/i)).not.toBeInTheDocument();
    });

    it("should not render forecast tab content", () => {
      render(<BeachDetailView id="beach-1" />);

      // Should not have forecast tab or its content
      expect(
        screen.queryByRole("tab", { name: "Forecast" })
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/forecast date/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/select date/i)).not.toBeInTheDocument();
    });
  });

  describe("Loading and error states", () => {
    it("should show loading spinner when beach data is loading", () => {
      mockUseEnhancedBeachData.mockReturnValue({
        ...mockEnhancedBeachData,
        loading: true,
      });

      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByRole("status")).toBeInTheDocument(); // Loader2 has role="status"
    });

    it("should show error message when beach is not found", () => {
      mockUseEnhancedBeachData.mockReturnValue({
        ...mockEnhancedBeachData,
        beach: null,
        error: "Beach not found",
      });

      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByText("Beach not found")).toBeInTheDocument();
      expect(screen.getByText("Back to Map")).toBeInTheDocument();
    });

    it("should show default error when no specific error is provided", () => {
      mockUseEnhancedBeachData.mockReturnValue({
        ...mockEnhancedBeachData,
        beach: null,
        error: null,
      });

      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByText("Beach not found")).toBeInTheDocument();
    });
  });

  describe("Map integration", () => {
    it("should generate correct map image URL", () => {
      render(<BeachDetailView id="beach-1" />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841,
        -117.2527,
        {
          width: 800,
          height: 400,
          zoom: 14,
        }
      );
    });

    it("should use default coordinates when beach coordinates are invalid", () => {
      const beachWithInvalidCoords = {
        ...mockBeach,
        latitude: "invalid" as any,
        longitude: "invalid" as any,
      };

      mockUseEnhancedBeachData.mockReturnValue({
        ...mockEnhancedBeachData,
        beach: beachWithInvalidCoords,
      });

      render(<BeachDetailView id="beach-1" />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7507, // Default Ocean Beach coordinates
        -117.254,
        {
          width: 800,
          height: 400,
          zoom: 14,
        }
      );
    });
  });

  describe("Info tab content", () => {
    it("should render beach information and ratings", async () => {
      const user = userEvent.setup();
      render(<BeachDetailView id="beach-1" />);

      const infoTab = screen.getByRole("tab", { name: "Info" });
      await user.click(infoTab);

      expect(screen.getByText("Beach Information")).toBeInTheDocument();
      expect(screen.getByText("A beautiful test beach")).toBeInTheDocument();
      expect(screen.getByText("Ratings & Reviews")).toBeInTheDocument();
      expect(screen.getByText("Wave Quality")).toBeInTheDocument();
      expect(screen.getByText("Crowd Density")).toBeInTheDocument();
      expect(screen.getByText("Parking")).toBeInTheDocument();
      expect(screen.getByText("Accessibility")).toBeInTheDocument();
    });
  });

  describe("Unauthenticated user", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });
    });

    it("should still render the component for unauthenticated users", () => {
      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByTestId("beach-header")).toBeInTheDocument();
      expect(screen.getByTestId("enhanced-forecast")).toBeInTheDocument();
    });

    it("should pass authentication status correctly", () => {
      render(<BeachDetailView id="beach-1" />);

      expect(screen.getByText(/Auth: false/)).toBeInTheDocument();
    });
  });
});
