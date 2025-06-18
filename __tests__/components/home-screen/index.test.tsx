import { render, screen, waitFor } from "@testing-library/react";
import { HomeScreen } from "@/components/home-screen";
import * as authContext from "@/context/auth-context";
import * as profileActions from "@/actions/profile-actions";
import type { Profile } from "@/types/database";

// Mock dependencies
jest.mock("@/context/auth-context");
jest.mock("@/actions/profile-actions");

// Mock child components
jest.mock("@/components/home-screen/forecast-tab", () => ({
  ForecastTab: ({ profile }: { profile?: Profile | null }) => (
    <div data-testid="forecast-tab">
      <div data-testid="forecast-profile">
        {profile ? "Profile loaded" : "No profile"}
      </div>
      <div data-testid="profile-id">{profile?.id || "none"}</div>
      <div data-testid="default-beach-id">
        {profile?.default_beach_id || "none"}
      </div>
    </div>
  ),
}));

jest.mock("@/components/home-screen/nearby-tab", () => ({
  NearbyTab: () => <div data-testid="nearby-tab">Nearby Tab</div>,
}));

jest.mock("@/components/home-screen/community-tab", () => ({
  CommunityTab: () => <div data-testid="community-tab">Community Tab</div>,
}));

const mockAuthContext = jest.mocked(authContext);
const mockProfileActions = jest.mocked(profileActions);

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
  },
};

const mockProfile: Profile = {
  id: "user-1",
  full_name: "Test User",
  avatar_url: null,
  bio: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  default_beach_id: "beach-ocean",
  favorite_spot: "Ocean Beach",
};

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth context mock
    mockAuthContext.useAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: jest.fn(),
    });

    // Default profile action mock
    mockProfileActions.getProfile.mockResolvedValue({
      success: true,
      data: mockProfile,
    });
  });

  describe("Guest user (no authentication)", () => {
    it("should render without profile data for guest users", () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
        "No profile"
      );
      expect(screen.getByTestId("profile-id")).toHaveTextContent("none");
      expect(screen.getByTestId("default-beach-id")).toHaveTextContent("none");
    });

    it("should not call getProfile for guest users", () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      expect(mockProfileActions.getProfile).not.toHaveBeenCalled();
    });
  });

  describe("Authenticated user", () => {
    it("should load and pass profile data to ForecastTab", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      await waitFor(() => {
        expect(mockProfileActions.getProfile).toHaveBeenCalledWith("user-1");
      });

      await waitFor(() => {
        expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
          "Profile loaded"
        );
        expect(screen.getByTestId("profile-id")).toHaveTextContent("user-1");
        expect(screen.getByTestId("default-beach-id")).toHaveTextContent(
          "beach-ocean"
        );
      });
    });

    it("should handle profile loading failure gracefully", async () => {
      mockProfileActions.getProfile.mockResolvedValue({
        success: false,
        error: "Profile not found",
      });

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      await waitFor(() => {
        expect(mockProfileActions.getProfile).toHaveBeenCalledWith("user-1");
      });

      // Should still render with no profile
      expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
        "No profile"
      );
      expect(screen.getByTestId("profile-id")).toHaveTextContent("none");
    });

    it("should handle profile loading timeout", async () => {
      let resolveProfile: (value: any) => void;
      const profilePromise = new Promise((resolve) => {
        resolveProfile = resolve;
      });
      mockProfileActions.getProfile.mockReturnValue(profilePromise);

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      // Should show no profile initially
      expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
        "No profile"
      );

      // Resolve after timeout (simulating slow network)
      setTimeout(() => {
        resolveProfile!({
          success: true,
          data: mockProfile,
        });
      }, 100);

      await waitFor(() => {
        expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
          "Profile loaded"
        );
      });
    });
  });

  describe("Profile without favorite beach", () => {
    const profileWithoutFavorite: Profile = {
      ...mockProfile,
      default_beach_id: null,
      favorite_spot: null,
    };

    it("should pass profile with null favorite beach fields", async () => {
      mockProfileActions.getProfile.mockResolvedValue({
        success: true,
        data: profileWithoutFavorite,
      });

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      await waitFor(() => {
        expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
          "Profile loaded"
        );
        expect(screen.getByTestId("profile-id")).toHaveTextContent("user-1");
        expect(screen.getByTestId("default-beach-id")).toHaveTextContent(
          "none"
        );
      });
    });
  });

  describe("Auth state changes", () => {
    it("should clear profile when user logs out", async () => {
      // Start with authenticated user
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      const { rerender } = render(<HomeScreen />);

      await waitFor(() => {
        expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
          "Profile loaded"
        );
      });

      // Simulate user logout
      mockAuthContext.useAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });

      rerender(<HomeScreen />);

      expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
        "No profile"
      );
      expect(screen.getByTestId("profile-id")).toHaveTextContent("none");
    });

    it("should load profile when user logs in", async () => {
      // Start with guest user
      mockAuthContext.useAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });

      const { rerender } = render(<HomeScreen />);

      expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
        "No profile"
      );

      // Simulate user login
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      rerender(<HomeScreen />);

      await waitFor(() => {
        expect(mockProfileActions.getProfile).toHaveBeenCalledWith("user-1");
      });

      await waitFor(() => {
        expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
          "Profile loaded"
        );
      });
    });
  });

  describe("Tab navigation", () => {
    it("should render all tabs", () => {
      render(<HomeScreen />);

      // Check for tab triggers
      expect(
        screen.getByRole("tab", { name: /forecast/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /nearby/i })).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /community/i })
      ).toBeInTheDocument();
    });

    it("should have forecast tab selected by default", () => {
      render(<HomeScreen />);

      const forecastTab = screen.getByRole("tab", { name: /forecast/i });
      expect(forecastTab).toHaveAttribute("data-state", "active");
    });
  });

  describe("Error handling", () => {
    it("should handle getProfile network error", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      mockProfileActions.getProfile.mockRejectedValue(
        new Error("Network error")
      );

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "HomeScreen: Error loading profile:",
          expect.any(Error)
        );
      });

      // Should still render with no profile
      expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
        "No profile"
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle malformed profile data", async () => {
      mockProfileActions.getProfile.mockResolvedValue({
        success: true,
        data: null, // Malformed data
      });

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<HomeScreen />);

      await waitFor(() => {
        expect(mockProfileActions.getProfile).toHaveBeenCalledWith("user-1");
      });

      // Should handle null data gracefully
      expect(screen.getByTestId("forecast-profile")).toHaveTextContent(
        "No profile"
      );
    });
  });
});
