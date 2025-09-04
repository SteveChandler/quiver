import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
// Load component dynamically after mocks are applied
const loadUserStats = () => require("@/components/user-stats").UserStats;

// Create a jest mock implementation
const mockGetUserStats = jest.fn();

// Mock the profile actions - need to mock before importing
jest.mock("@/actions/profile-actions", () => ({
  getUserStats: (...args: any[]) => mockGetUserStats(...args),
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

describe("UserStats Refresh Integration", () => {
  const mockUserId = "user-123";

  beforeEach(() => {
    mockGetUserStats.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should refresh stats when refreshToken changes", async () => {
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

    // First render - initial load
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

    expect(mockGetUserStats).toHaveBeenCalledTimes(1);
    expect(mockGetUserStats).toHaveBeenCalledWith(mockUserId);

    // Second render - refresh with updated stats
    mockGetUserStats.mockResolvedValueOnce({
      success: true,
      data: updatedStats,
    });

    rerender(<UserStats userId={mockUserId} refreshToken={1} />);

    await waitFor(() => {
      expect(screen.getByTestId("home-break-value")).toHaveTextContent(
        "New Beach"
      );
    });

    expect(mockGetUserStats).toHaveBeenCalledTimes(2);
  });

  it("should not refresh with same refreshToken", async () => {
    const stats = {
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
      data: stats,
    });

    const { rerender } = render(
      <UserStats userId={mockUserId} refreshToken={1} />
    );

    await waitFor(() => {
      expect(screen.getByTestId("home-break-value")).toHaveTextContent("Beach");
    });

    expect(mockGetUserStats).toHaveBeenCalledTimes(1);

    // Rerender with same refreshToken
    rerender(<UserStats userId={mockUserId} refreshToken={1} />);

    // Should not trigger another call
    expect(mockGetUserStats).toHaveBeenCalledTimes(1);
  });

  it("should show loading state during refresh", async () => {
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

    // First render - quick resolve
    mockGetUserStats.mockResolvedValueOnce({
      success: true,
      data: initialStats,
    });

    const UserStats = loadUserStats();
    const { rerender } = render(<UserStats userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByTestId("home-break-value")).toHaveTextContent("Beach");
    });

    // Second render - slow response to see loading state
    let slowResolve: (value: any) => void;
    const slowPromise = new Promise((resolve) => {
      slowResolve = resolve;
    });

    mockGetUserStats.mockReturnValueOnce(slowPromise);

    rerender(<UserStats userId={mockUserId} refreshToken={1} />);

    // Should show loading spinner
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

    // Resolve the slow promise
    slowResolve!({
      success: true,
      data: {
        ...initialStats,
        homeBeachName: "Updated Beach",
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("home-break-value")).toHaveTextContent(
        "Updated Beach"
      );
    });
  });

  it("should work without refreshToken (backward compatibility)", async () => {
    const stats = {
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
      data: stats,
    });

    // Should work without refreshToken prop
    const UserStats = loadUserStats();
    render(<UserStats userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByTestId("home-break-value")).toHaveTextContent("Beach");
    });

    expect(mockGetUserStats).toHaveBeenCalledTimes(1);
  });

  it("should handle errors during refresh gracefully", async () => {
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

    // First render - success
    mockGetUserStats.mockResolvedValueOnce({
      success: true,
      data: initialStats,
    });

    const UserStats = loadUserStats();
    const { rerender } = render(<UserStats userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByTestId("home-break-value")).toHaveTextContent("Beach");
    });

    // Second render - failure
    mockGetUserStats.mockRejectedValueOnce(new Error("Refresh failed"));

    rerender(<UserStats userId={mockUserId} refreshToken={1} />);

    await waitFor(() => {
      expect(screen.getByText("Stats unavailable")).toBeInTheDocument();
    });

    expect(mockGetUserStats).toHaveBeenCalledTimes(2);
  });
});
