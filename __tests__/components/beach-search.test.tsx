import { render, screen, waitFor } from "@testing-library/react";
import { BeachSearch } from "@/components/beach-search";
import * as beachActions from "@/actions/beach-actions";
import * as authContext from "@/context/auth-context";
import * as beachSearchUtils from "@/lib/utils/beach-search-utils";
import type { Profile } from "@/types/database";

// Mock dependencies
jest.mock("@/actions/beach-actions");
jest.mock("@/context/auth-context");
jest.mock("@/lib/utils/beach-search-utils");

const mockBeachActions = jest.mocked(beachActions);
const mockAuthContext = jest.mocked(authContext);
const mockBeachSearchUtils = jest.mocked(beachSearchUtils);

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

const mockProfileWithoutFavorite: Profile = {
  id: "user-1",
  full_name: "Test User",
  avatar_url: null,
  bio: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  default_beach_id: null,
  favorite_spot: null,
};

const mockBeach = {
  id: "beach-ocean",
  name: "Ocean Beach",
  latitude: 32.7503,
  longitude: -117.2534,
  description: "Dog-friendly beach with a historic pier",
  wave_quality_rating: 3.9,
  crowd_density_rating: 4.1,
  parking_rating: 2.8,
  accessibility_rating: 3.7,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockForecast = {
  id: "forecast-1",
  beach_id: "beach-ocean",
  date: "2024-01-01",
  wave_height: "3-4 ft",
  wave_period: "12-14s",
  wind_speed: "5-10 mph",
  wind_direction: "offshore",
  conditions: "Clean waves with light offshore winds",
  rating: 8,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("BeachSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockAuthContext.useAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: jest.fn(),
    });

    mockBeachActions.getBeachById.mockResolvedValue({
      success: true,
      data: mockBeach,
    });

    mockBeachSearchUtils.searchBeachWithForecast.mockResolvedValue({
      beach: mockBeach,
      forecast: mockForecast,
    });
  });

  describe("Guest user behavior", () => {
    it("should show loading state initially", () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: undefined, // Still loading
        loading: true,
        signOut: jest.fn(),
      });

      render(<BeachSearch />);

      expect(
        screen.getByText("Loading your favorite beach...")
      ).toBeInTheDocument();
    });

    it("should default to Huntington Beach for guest users", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: false, // Guest user
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch />);

      await waitFor(() => {
        expect(
          mockBeachSearchUtils.searchBeachWithForecast
        ).toHaveBeenCalledWith("Huntington Beach");
      });
    });
  });

  describe("Authenticated user with favorite beach ID", () => {
    it("should load user's favorite beach by ID", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={mockProfile} />);

      await waitFor(() => {
        expect(mockBeachActions.getBeachById).toHaveBeenCalledWith(
          "beach-ocean"
        );
        expect(
          mockBeachSearchUtils.searchBeachWithForecast
        ).toHaveBeenCalledWith("Ocean Beach");
      });
    });

    it("should show status message when displaying favorite beach", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={mockProfile} />);

      await waitFor(() => {
        expect(
          screen.getByText(/showing your favorite beach/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Authenticated user with favorite beach name only", () => {
    const profileWithNameOnly: Profile = {
      ...mockProfile,
      default_beach_id: null,
      favorite_spot: "Ocean Beach",
    };

    it("should load favorite beach by name when no ID is set", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={profileWithNameOnly} />);

      await waitFor(() => {
        expect(
          mockBeachSearchUtils.searchBeachWithForecast
        ).toHaveBeenCalledWith("Ocean Beach");
      });
    });
  });

  describe("Authenticated user without favorite beach", () => {
    it("should default to Huntington Beach when user has no favorite", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={mockProfileWithoutFavorite} />);

      await waitFor(() => {
        expect(
          mockBeachSearchUtils.searchBeachWithForecast
        ).toHaveBeenCalledWith("Huntington Beach");
      });
    });
  });

  describe("Error handling", () => {
    it("should fall back to Huntington Beach when favorite beach ID fails", async () => {
      mockBeachActions.getBeachById.mockResolvedValue({
        success: false,
        error: "Beach not found",
      });

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={mockProfile} />);

      await waitFor(() => {
        expect(
          mockBeachSearchUtils.searchBeachWithForecast
        ).toHaveBeenCalledWith("Huntington Beach");
      });
    });

    it("should fall back to Huntington Beach when favorite beach name fails", async () => {
      mockBeachSearchUtils.searchBeachWithForecast
        .mockResolvedValueOnce({
          beach: mockBeach,
          forecast: mockForecast,
        })
        .mockRejectedValueOnce(new Error("Beach not found"));

      const profileWithNameOnly: Profile = {
        ...mockProfile,
        default_beach_id: null,
        favorite_spot: "NonExistent Beach",
      };

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={profileWithNameOnly} />);

      await waitFor(() => {
        expect(
          mockBeachSearchUtils.searchBeachWithForecast
        ).toHaveBeenLastCalledWith("Huntington Beach");
      });
    });
  });

  describe("Loading states", () => {
    it("should show loading spinner while fetching beach data", async () => {
      let resolveSearch: (value: any) => void;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });
      mockBeachSearchUtils.searchBeachWithForecast.mockReturnValue(
        searchPromise
      );

      mockAuthContext.useAuth.mockReturnValue({
        user: false, // Guest user
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch />);

      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Resolve the promise
      resolveSearch!({
        beach: mockBeach,
        forecast: mockForecast,
      });
    });

    it("should hide loading state after profile loads", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={mockProfile} />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading your favorite beach...")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Beach content display", () => {
    it("should display beach forecast when loaded", async () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      });
    });

    it("should not show content while waiting for profile", () => {
      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachSearch profile={null} />);

      expect(
        screen.getByText("Loading your favorite beach...")
      ).toBeInTheDocument();
      expect(screen.queryByText("Ocean Beach")).not.toBeInTheDocument();
    });
  });

  describe("Profile updates", () => {
    it("should update when profile changes", async () => {
      const { rerender } = render(<BeachSearch profile={null} />);

      expect(
        screen.getByText("Loading your favorite beach...")
      ).toBeInTheDocument();

      mockAuthContext.useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signOut: jest.fn(),
      });

      rerender(<BeachSearch profile={mockProfile} />);

      await waitFor(() => {
        expect(mockBeachActions.getBeachById).toHaveBeenCalledWith(
          "beach-ocean"
        );
      });
    });
  });
});
