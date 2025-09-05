import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
// Load component dynamically after mocks are applied
const loadUserStats = () => require("@/components/user-stats").UserStats;
import { getUserStats } from "@/actions/profile-actions";

// Mock the profile actions
const mockGetUserStats = jest.fn();
jest.mock("@/actions/profile-actions", () => ({
  getUserStats: mockGetUserStats,
}));

// Mock the auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
  }),
}));

// Mock the useProfile hook
jest.mock("@/lib/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: {
      id: "user-123",
      full_name: "Test User",
      home_beach_id: "beach-456",
    },
  }),
}));

// Mock the GamificationSection component
jest.mock("@/components/profile/gamification-section", () => ({
  GamificationSection: () => <div data-testid="gamification-section" />,
}));

// Mock the UI components
jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div data-testid="stat-card">{children}</div>,
  CardContent: ({ children }: any) => (
    <div data-testid="card-content">{children}</div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  ),
}));

// Mock the loading component
jest.mock("@/components/ui/loading-states", () => ({
  CenteredLoadingSpinner: ({ text }: any) => (
    <div data-testid="loading-spinner">{text}</div>
  ),
}));

// Mock Lucide icons
jest.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader2-icon" />,
  Waves: () => <div data-testid="waves-icon" />,
  MapPin: () => <div data-testid="mappin-icon" />,
  Star: () => <div data-testid="star-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
}));

describe("UserStats Refresh Behavior", () => {
  const mockUserId = "user-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Current Behavior - Baseline Tests", () => {
    it("loads initial stats correctly", async () => {
      const initialStats = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Old Beach",
        homeBeachId: "beach-123",
        homeBeachName: "Old Beach",
        mostVisitedBeach: "Old Beach",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: initialStats,
      });

      const UserStats = loadUserStats();
      render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Old Beach"
        );
      });

      expect(mockGetUserStats).toHaveBeenCalledTimes(1);
      expect(mockGetUserStats).toHaveBeenCalledWith(mockUserId);
    });

    it("does not refresh when no external trigger is provided", async () => {
      const initialStats = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Old Beach",
        homeBeachId: "beach-123",
        homeBeachName: "Old Beach",
        mostVisitedBeach: "Old Beach",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: initialStats,
      });

      const UserStats = loadUserStats();
      const { rerender } = render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Old Beach"
        );
      });

      // Rerender with the same props should not trigger a new fetch
      rerender(<UserStats userId={mockUserId} />);

      // Should still only be called once (from initial mount)
      expect(mockGetUserStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("Required Refresh Behavior - Failing Tests", () => {
    it("should refresh when refreshToken changes", async () => {
      const initialStats = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Old Beach",
        homeBeachId: "beach-123",
        homeBeachName: "Old Beach",
        mostVisitedBeach: "Old Beach",
        mostVisitedBeachCount: 5,
      };

      const updatedStats = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "New Beach",
        homeBeachId: "beach-456",
        homeBeachName: "New Beach",
        mostVisitedBeach: "New Beach",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats
        .mockResolvedValueOnce({
          success: true,
          data: initialStats,
        })
        .mockResolvedValueOnce({
          success: true,
          data: updatedStats,
        });

      const UserStats = loadUserStats();
      const { rerender } = render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Old Beach"
        );
      });

      // Rerender with refreshToken should trigger a new fetch
      rerender(<UserStats userId={mockUserId} refreshToken={1} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "New Beach"
        );
      });

      expect(mockGetUserStats).toHaveBeenCalledTimes(2);
    });

    it("should show loading state during refresh", async () => {
      const initialStats = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Old Beach",
        homeBeachId: "beach-123",
        homeBeachName: "Old Beach",
        mostVisitedBeach: "Old Beach",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats.mockResolvedValueOnce({
        success: true,
        data: initialStats,
      });

      const UserStats = loadUserStats();
      const { rerender } = render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Old Beach"
        );
      });

      // Mock a slow second request to see loading state
      mockGetUserStats.mockImplementationOnce(() => new Promise(() => {}));

      rerender(<UserStats userId={mockUserId} refreshToken={1} />);

      // Should show loading spinner during refresh
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });

    it("should handle multiple refreshToken increments", async () => {
      const stats1 = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Beach 1",
        homeBeachId: "beach-1",
        homeBeachName: "Beach 1",
        mostVisitedBeach: "Beach 1",
        mostVisitedBeachCount: 5,
      };

      const stats2 = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Beach 2",
        homeBeachId: "beach-2",
        homeBeachName: "Beach 2",
        mostVisitedBeach: "Beach 2",
        mostVisitedBeachCount: 5,
      };

      const stats3 = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Beach 3",
        homeBeachId: "beach-3",
        homeBeachName: "Beach 3",
        mostVisitedBeach: "Beach 3",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats
        .mockResolvedValueOnce({ success: true, data: stats1 })
        .mockResolvedValueOnce({ success: true, data: stats2 })
        .mockResolvedValueOnce({ success: true, data: stats3 });

      const UserStats = loadUserStats();
      const { rerender } = render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Beach 1"
        );
      });

      // First refresh
      rerender(<UserStats userId={mockUserId} refreshToken={1} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Beach 2"
        );
      });

      // Second refresh
      rerender(<UserStats userId={mockUserId} refreshToken={2} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Beach 3"
        );
      });

      expect(mockGetUserStats).toHaveBeenCalledTimes(3);
    });

    it("should not refresh with same refreshToken value", async () => {
      const initialStats = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Beach",
        homeBeachId: "beach-123",
        homeBeachName: "Beach",
        mostVisitedBeach: "Beach",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: initialStats,
      });

      const { rerender } = render(
        <UserStats userId={mockUserId} refreshToken={1} />
      );

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Beach"
        );
      });

      // Rerender with same refreshToken should not trigger new fetch
      rerender(<UserStats userId={mockUserId} refreshToken={1} />);

      expect(mockGetUserStats).toHaveBeenCalledTimes(1);
    });

    it("should handle refresh errors gracefully", async () => {
      const initialStats = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.2,
        favoriteSpot: "Beach",
        homeBeachId: "beach-123",
        homeBeachName: "Beach",
        mostVisitedBeach: "Beach",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats
        .mockResolvedValueOnce({ success: true, data: initialStats })
        .mockRejectedValueOnce(new Error("Refresh failed"));

      const { rerender } = render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent(
          "Beach"
        );
      });

      // Trigger refresh that fails
      rerender(<UserStats userId={mockUserId} refreshToken={1} />);

      await waitFor(() => {
        expect(screen.getByText("Stats unavailable")).toBeInTheDocument();
      });

      expect(mockGetUserStats).toHaveBeenCalledTimes(2);
    });
  });

  describe("RefreshToken Interface", () => {
    it("should accept refreshToken as optional prop", () => {
      mockGetUserStats.mockResolvedValue({
        success: true,
        data: {
          sessionCount: 10,
          boardCount: 3,
          averageRating: 4.2,
          favoriteSpot: "Beach",
          homeBeachId: "beach-123",
          homeBeachName: "Beach",
          mostVisitedBeach: "Beach",
          mostVisitedBeachCount: 5,
        },
      });

      // Should work without refreshToken
      const UserStats = loadUserStats();
      expect(() => render(<UserStats userId={mockUserId} />)).not.toThrow();

      // Should work with refreshToken
      expect(() =>
        render(<UserStats userId={mockUserId} refreshToken={1} />)
      ).not.toThrow();
    });
  });
});
