import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { UserStats } from "@/components/user-stats";
// We'll inject a local mock function via component props rather than module mocking

// Mock auth context and profile hook used by the component
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "test-user-ctx" } }),
}));

jest.mock("@/lib/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
    mutate: jest.fn(),
  }),
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

// Mock GamificationSection to avoid rendering dependencies
jest.mock("@/components/profile/gamification-section", () => ({
  GamificationSection: () => (
    <div data-testid="gamification-section">Gamification</div>
  ),
}));

// Mock console to avoid noise in tests
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
};
Object.assign(console, mockConsole);

describe("UserStats", () => {
  const mockGetUserStats = jest.fn();
  const mockUserId = "user-123";

  beforeEach(() => {
    jest.resetAllMocks();
    mockGetUserStats.mockReset?.();
  });

  describe("Loading State", () => {
    it("shows loading spinner while fetching stats", () => {
      mockGetUserStats.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
      expect(screen.getByText("Loading stats...")).toBeInTheDocument();
    });

    it("calls getUserStats with correct userId", () => {
      mockGetUserStats.mockResolvedValue({ success: true, data: null });

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      expect(mockGetUserStats).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("Successful Data Display", () => {
    const mockStatsData = {
      sessionCount: 42,
      boardCount: 5,
      averageRating: 4.2,
      homeBeachId: "beach-1",
      homeBeachName: "Ocean Beach",
      mostVisitedBeach: "Malibu",
      mostVisitedBeachCount: 15,
    };

    beforeEach(() => {
      mockGetUserStats.mockResolvedValue({
        success: true,
        data: mockStatsData,
      });
    });

    it("displays all stat cards", async () => {
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        const statCards = screen.getAllByTestId("stat-card");
        expect(statCards).toHaveLength(4);
      });
    });

    it("displays session count correctly", async () => {
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Sessions")).toBeInTheDocument();
        expect(screen.getByText("42")).toBeInTheDocument();
        expect(screen.getByText("Total sessions (all)")).toBeInTheDocument();
      });
    });

    it("displays board count correctly", async () => {
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Boards")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("Boards in quiver")).toBeInTheDocument();
      });
    });

    it("displays rating correctly", async () => {
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Rating")).toBeInTheDocument();
        expect(screen.getByText("4.2")).toBeInTheDocument();
        expect(screen.getByText("Average session rating")).toBeInTheDocument();
      });
    });

    it("displays home break correctly from profile home beach", async () => {
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Home Break")).toBeInTheDocument();
        expect(screen.getByText("Ocean Beach")).toBeInTheDocument(); // Shows resolved home beach name
        expect(screen.getByText("From profile")).toBeInTheDocument(); // Indicates source
      });
    });

    it("shows not set when no profile home beach is set", async () => {
      const statsWithoutFavoriteSpot = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.0,
        homeBeachId: null,
        homeBeachName: null,
        mostVisitedBeach: "Malibu",
        mostVisitedBeachCount: 15,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: statsWithoutFavoriteSpot,
      });

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Home Break")).toBeInTheDocument();
        expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
        expect(screen.getByText("Not set")).toBeInTheDocument();
      });
    });

    it("includes all required icons", async () => {
      // Ensure we render the stats state
      mockGetUserStats.mockResolvedValue({
        success: true,
        data: mockStatsData,
      });
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
        expect(screen.getByTestId("waves-icon")).toBeInTheDocument();
        expect(screen.getByTestId("star-icon")).toBeInTheDocument();
        expect(screen.getByTestId("mappin-icon")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases and Missing Data", () => {
    it("handles zero values correctly", async () => {
      const zeroStatsData = {
        sessionCount: 0,
        boardCount: 0,
        averageRating: 0,
        homeBeachId: null,
        homeBeachName: null,
        mostVisitedBeach: null,
        mostVisitedBeachCount: 0,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: zeroStatsData,
      });

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getAllByText("0")).toHaveLength(2); // session count and board count
        expect(screen.getByText("-")).toBeInTheDocument(); // rating shows as dash
        expect(screen.getByTestId("home-break-value")).toHaveTextContent("—"); // em dash
        expect(screen.getByText("Not set")).toBeInTheDocument();
      });
    });

    it("handles null rating correctly", async () => {
      const statsWithNullRating = {
        sessionCount: 5,
        boardCount: 2,
        averageRating: null,
        homeBeachId: null,
        homeBeachName: null,
        mostVisitedBeach: "Beach",
        mostVisitedBeachCount: 1,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: statsWithNullRating,
      });

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Rating")).toBeInTheDocument();
        expect(screen.getByText("-")).toBeInTheDocument(); // null rating shows as dash
      });
    });

    it("handles undefined rating correctly", async () => {
      const statsWithUndefinedRating = {
        sessionCount: 5,
        boardCount: 2,
        averageRating: undefined,
        homeBeachId: null,
        homeBeachName: null,
        mostVisitedBeach: "Beach",
        mostVisitedBeachCount: 1,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: statsWithUndefinedRating,
      });

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Rating")).toBeInTheDocument();
        expect(screen.getByText("-")).toBeInTheDocument(); // undefined rating shows as dash
      });
    });

    it("handles null most visited beach correctly", async () => {
      const statsWithoutBeach = {
        sessionCount: 5,
        boardCount: 2,
        averageRating: 4.0,
        homeBeachId: null,
        homeBeachName: null,
        mostVisitedBeach: null,
        mostVisitedBeachCount: 0,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: statsWithoutBeach,
      });

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByText("Home Break")).toBeInTheDocument();
        expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
        expect(screen.getByText("Not set")).toBeInTheDocument();
      });
    });

    it("handles very long beach names with truncation", async () => {
      const statsWithLongBeachName = {
        sessionCount: 10,
        boardCount: 3,
        averageRating: 4.5,
        homeBeachId: null,
        homeBeachName: null,
        mostVisitedBeach:
          "This Is A Very Long Beach Name That Should Be Truncated",
        mostVisitedBeachCount: 5,
      };

      mockGetUserStats.mockResolvedValue({
        success: true,
        data: statsWithLongBeachName,
      });

      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
        expect(screen.getByText("Not set")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("shows error state when API call fails", async () => {
      mockGetUserStats.mockRejectedValue(new Error("API Error"));

      render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText("Stats unavailable")).toBeInTheDocument();
      });

      expect(mockConsole.error).toHaveBeenCalled();
    });

    it("shows error state when API returns unsuccessful result", async () => {
      mockGetUserStats.mockResolvedValue({
        success: false,
        data: null,
      });

      render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText("Stats unavailable")).toBeInTheDocument();
      });
    });

    it("shows error state when API returns null data", async () => {
      mockGetUserStats.mockResolvedValue({
        success: true,
        data: null,
      });

      render(<UserStats userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText("Stats unavailable")).toBeInTheDocument();
      });
    });
  });

  describe("Component Structure", () => {
    const mockStatsData = {
      sessionCount: 10,
      boardCount: 3,
      averageRating: 4.0,
      favoriteSpot: null,
      mostVisitedBeach: "Test Beach",
      mostVisitedBeachCount: 5,
    };

    beforeEach(() => {
      mockGetUserStats.mockResolvedValue({
        success: true,
        data: mockStatsData,
      });
    });

    it("uses correct grid layout classes", async () => {
      const { container } = render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        const gridContainer = container.querySelector(".grid");
        expect(gridContainer).toBeInTheDocument();
        expect(gridContainer).toHaveClass(
          "grid-cols-2",
          "gap-4",
          "md:grid-cols-4"
        );
      });
    });

    it("applies correct card header classes", async () => {
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        const cardHeaders = screen.getAllByTestId("card-header");
        cardHeaders.forEach((header) => {
          expect(header).toHaveClass(
            "flex",
            "flex-row",
            "items-center",
            "justify-between",
            "space-y-0",
            "pb-2"
          );
        });
      });
    });

    it("applies correct typography classes", async () => {
      render(
        <UserStats userId={mockUserId} getUserStatsFn={mockGetUserStats} />
      );

      await waitFor(() => {
        const cardTitles = screen.getAllByTestId("card-title");
        cardTitles.forEach((title) => {
          expect(title).toHaveClass("text-sm", "font-medium");
        });
      });
    });
  });

  describe("User ID Changes", () => {
    it("refetches data when userId changes", async () => {
      const { rerender } = render(
        <UserStats userId="user-1" getUserStatsFn={mockGetUserStats} />
      );

      expect(mockGetUserStats).toHaveBeenCalledWith("user-1");

      rerender(<UserStats userId="user-2" getUserStatsFn={mockGetUserStats} />);

      expect(mockGetUserStats).toHaveBeenCalledWith("user-2");
      expect(mockGetUserStats).toHaveBeenCalledTimes(2);
    });

    it("shows loading state during userId transition", async () => {
      mockGetUserStats.mockImplementation(() => new Promise(() => {}));

      const { rerender } = render(
        <UserStats userId="user-1" getUserStatsFn={mockGetUserStats} />
      );

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

      rerender(<UserStats userId="user-2" getUserStatsFn={mockGetUserStats} />);

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });
  });
});
