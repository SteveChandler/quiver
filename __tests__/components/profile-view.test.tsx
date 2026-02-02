import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProfileView } from "@/components/profile-view";
import { useAuth } from "@/context/auth-context";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { data as gateway } from "@/lib/data/client";
import type { UserSurfPreferences } from "@/lib/services/preference-learning-service";

// Mock dependencies
jest.mock("@/context/auth-context");
jest.mock("@/hooks/use-user-preferences");
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
  getAttributionForAnalytics: jest.fn(() => ({})),
}));

import { track } from "@/lib/analytics";

jest.mock("@/lib/data/client", () => ({
  data: {
    users: {
      profile: {
        get: jest.fn(),
      },
      sessions: {
        list: jest.fn(),
      },
    },
    boards: {
      list: jest.fn(),
    },
  },
}));

// Mock lazy-loaded components
jest.mock("@/components/favorite-beaches", () => ({
  FavoriteBeaches: () => <div data-testid="favorite-beaches">Favorite Beaches</div>,
}));
jest.mock("@/components/profile/boards-manager", () => ({
  BoardsManager: () => <div data-testid="boards-manager">Boards Manager</div>,
}));
jest.mock("@/components/profile/user-comments", () => ({
  UserComments: () => <div data-testid="user-comments">User Comments</div>,
}));
jest.mock("@/components/journal/journal-view", () => ({
  JournalView: () => <div data-testid="journal-view">Journal View</div>,
}));
jest.mock("@/components/edit-profile-modal", () => ({
  EditProfileModal: () => <div data-testid="edit-profile-modal">Edit Profile Modal</div>,
}));
jest.mock("@/components/profile/surf-profile-section", () => ({
  SurfProfileSection: () => <div data-testid="surf-profile-section">Surf Profile Section</div>,
}));
jest.mock("@/components/user-stats", () => ({
  UserStats: () => <div data-testid="user-stats">User Stats</div>,
}));

// Mock next/navigation
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};
let mockSearchParamsGet = jest.fn().mockReturnValue("sessions");
let mockSearchParamsToString = jest.fn().mockReturnValue("tab=sessions");
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsGet(key),
    toString: () => mockSearchParamsToString(),
  }),
}));

describe("ProfileView - Surf Style Card", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  };

  const mockProfile = {
    id: "user-123",
    full_name: "Test User",
    bio: "Test bio",
    location: "San Francisco",
    experience_level: "Intermediate",
    avatar_url: null,
    home_beach_id: null,
    instagram: null,
  };

  const mockHighConfidencePreferences: UserSurfPreferences = {
    wave_min_ft: 3,
    wave_max_ft: 6,
    wave_period_min_s: 10,
    wave_period_max_s: 14,
    max_wind_mph: 15,
    preferred_wind_directions: [0, 90],
    preferred_tide_statuses: ["rising", "high"],
    confidence: 0.8,
    sample_size: 12,
  };

  const mockLowConfidencePreferences: UserSurfPreferences = {
    wave_min_ft: 2,
    wave_max_ft: 5,
    wave_period_min_s: 8,
    wave_period_max_s: 12,
    max_wind_mph: 12,
    preferred_wind_directions: null,
    preferred_tide_statuses: null,
    confidence: 0.3,
    sample_size: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (track as jest.Mock).mockClear();
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockSearchParamsGet = jest.fn().mockReturnValue("sessions");
    mockSearchParamsToString = jest.fn().mockReturnValue("tab=sessions");

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      refreshSession: jest.fn(),
    });

    (gateway.users.profile.get as jest.Mock).mockResolvedValue(mockProfile);
    (gateway.users.sessions.list as jest.Mock).mockResolvedValue([]);
    (gateway.boards.list as jest.Mock).mockResolvedValue([]);
  });

  describe("High Confidence Surf Style", () => {
    it("should show surf style summary when confidence > 0.5", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: mockHighConfidencePreferences,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
      });

      expect(screen.getByText("3-6ft waves")).toBeInTheDocument();
      expect(screen.getByText("Based on 12 sessions")).toBeInTheDocument();
    });

    it("should apply glass morphism styling to surf style card", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: mockHighConfidencePreferences,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
      });

      const surfStyleCard = screen.getByText("Your Surf Style").closest("div");
      expect(surfStyleCard).toHaveClass("bg-white/10");
      expect(surfStyleCard).toHaveClass("backdrop-blur");
      expect(surfStyleCard).toHaveClass("rounded-lg");
    });
  });

  describe("Low Confidence Progress Bar", () => {
    it("should show progress bar when confidence <= 0.5", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: mockLowConfidencePreferences,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
      });

      expect(screen.getByText(/Log 3 more sessions/i)).toBeInTheDocument();
      expect(screen.getByText(/unlock personalized recommendations/i)).toBeInTheDocument();
    });

    it("should calculate correct progress bar width", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: mockLowConfidencePreferences,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
      });

      // 2 sessions out of 5 = 40%
      const progressBar = container.querySelector(".bg-white.rounded-full.transition-all");
      expect(progressBar).toHaveStyle({ width: "40%" });
    });

    it("should not show negative sessions remaining", async () => {
      const preferencesWithHighSessions: UserSurfPreferences = {
        ...mockLowConfidencePreferences,
        sample_size: 10, // More than 5 sessions
      };

      (useUserPreferences as jest.Mock).mockReturnValue({
        data: preferencesWithHighSessions,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
      });

      // Should show 0 more sessions, not negative
      expect(screen.queryByText(/Log -/)).not.toBeInTheDocument();
    });

    it("should cap progress bar at 100%", async () => {
      const preferencesWithHighSessions: UserSurfPreferences = {
        ...mockLowConfidencePreferences,
        sample_size: 10, // More than 5 sessions
      };

      (useUserPreferences as jest.Mock).mockReturnValue({
        data: preferencesWithHighSessions,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
      });

      const progressBar = container.querySelector(".bg-white.rounded-full.transition-all");
      expect(progressBar).toHaveStyle({ width: "100%" });
    });
  });

  describe("No Preferences State", () => {
    it("should hide surf style section when preferences is null", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Test User's Profile")).toBeInTheDocument();
      });

      expect(screen.queryByText("Your Surf Style")).not.toBeInTheDocument();
    });
  });

  describe("Missing Wave Range", () => {
    it("should show fallback text when wave ranges are missing", async () => {
      const preferencesWithoutWaves: UserSurfPreferences = {
        ...mockHighConfidencePreferences,
        wave_min_ft: null,
        wave_max_ft: null,
      };

      (useUserPreferences as jest.Mock).mockReturnValue({
        data: preferencesWithoutWaves,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
      });

      expect(screen.getByText("Learning your preferences...")).toBeInTheDocument();
    });
  });

  describe("Analytics Tracking", () => {
    it("tracks surf_profile_viewed when high confidence preferences shown", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: mockHighConfidencePreferences,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(track).toHaveBeenCalledWith("surf_profile_viewed", {
          confidence: 0.8,
          sample_size: 12,
        });
      });
    });

    it("tracks surf_profile_progress_shown when low confidence preferences shown", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: mockLowConfidencePreferences,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(track).toHaveBeenCalledWith("surf_profile_progress_shown", {
          sessions_needed: 3,
        });
      });
    });

    it("does not track when preferences is null", async () => {
      (useUserPreferences as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByText("Test User's Profile")).toBeInTheDocument();
      });

      expect(track).not.toHaveBeenCalledWith(
        "surf_profile_viewed",
        expect.anything()
      );
      expect(track).not.toHaveBeenCalledWith(
        "surf_profile_progress_shown",
        expect.anything()
      );
    });
  });

  describe("URL Parameter Handling", () => {
    it("opens edit modal when ?edit=true is present", async () => {
      mockSearchParamsGet = jest.fn((key: string) => {
        if (key === "edit") return "true";
        if (key === "tab") return "sessions";
        return null;
      });

      (useUserPreferences as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByTestId("edit-profile-modal")).toBeInTheDocument();
      });
    });

    it("opens edit modal and sets scroll flag when ?openSettings=true", async () => {
      mockSearchParamsGet = jest.fn((key: string) => {
        if (key === "openSettings") return "true";
        if (key === "tab") return "sessions";
        return null;
      });
      mockSearchParamsToString = jest.fn().mockReturnValue("openSettings=true&tab=sessions");

      (useUserPreferences as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(screen.getByTestId("edit-profile-modal")).toBeInTheDocument();
      });
    });

    it("cleans up openSettings param from URL after modal opens", async () => {
      mockSearchParamsGet = jest.fn((key: string) => {
        if (key === "openSettings") return "true";
        if (key === "tab") return "sessions";
        return null;
      });
      mockSearchParamsToString = jest.fn().mockReturnValue("openSettings=true&tab=sessions");

      (useUserPreferences as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          "/profile?tab=sessions",
          { scroll: false }
        );
      });
    });

    it("navigates to /profile when openSettings is the only param", async () => {
      mockSearchParamsGet = jest.fn((key: string) => {
        if (key === "openSettings") return "true";
        return null;
      });
      mockSearchParamsToString = jest.fn().mockReturnValue("openSettings=true");

      (useUserPreferences as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ProfileView />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          "/profile",
          { scroll: false }
        );
      });
    });
  });
});
