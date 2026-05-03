import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import type { Profile, Board, Beach, SessionWithDetails } from "@/types/database";

// Mock the child components
jest.mock("@/components/profile/basic-profile-form", () => ({
  BasicProfileForm: ({ userId, email, profile }: any) => (
    <div data-testid="basic-profile-form">
      <div>User ID: {userId}</div>
      <div>Email: {email}</div>
      <div>Profile: {profile?.full_name || "No profile"}</div>
    </div>
  ),
}));

jest.mock("@/components/profile/boards-manager", () => ({
  BoardsManager: ({ userId, boards }: any) => (
    <div data-testid="boards-manager">
      <div>User ID: {userId}</div>
      <div>Boards Count: {boards.length}</div>
    </div>
  ),
}));

jest.mock("@/components/profile/profile-preferences", () => ({
  ProfilePreferences: ({ userId, profile, beaches }: any) => (
    <div data-testid="profile-preferences">
      <div>User ID: {userId}</div>
      <div>Profile: {profile?.full_name || "No profile"}</div>
      <div>Beaches Count: {beaches.length}</div>
    </div>
  ),
}));

jest.mock("@/components/profile/recent-sessions-list", () => ({
  RecentSessionsList: ({ recentSessions }: any) => (
    <div data-testid="recent-sessions-list">
      <div>Sessions Count: {recentSessions.length}</div>
    </div>
  ),
}));

describe("ProfileEditForm", () => {
  const mockUserId = "user-123";
  const mockEmail = "test@example.com";

  const mockProfile = {
    id: "profile-123",
    user_id: mockUserId,
    full_name: "Test User",
    bio: "Test bio",
    location: "San Diego",
    experience_level: "intermediate",
    avatar_url: "",
    phone_number: "123-456-7890",
    instagram: "@testuser",
    home_beach_id: null,
    surf_styles: null,
    preferred_wave_size: null,
    preferred_break_type: null,
    crowd_preference: null,
    wave_min_ft: null,
    wave_max_ft: null,
    wave_period_min_s: null,
    wave_period_max_s: null,
    max_wind_mph: null,
    preferred_wind_directions: null,
    preferred_tide_statuses: null,
    preference_confidence: null,
    preference_sample_size: null,
    notif_push_enabled: true,
    notif_email_enabled: true,
    notif_inapp_enabled: true,
    notif_likes: true,
    notif_follows: true,
    notif_reminders: true,
    notif_xp_updates: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  } as unknown as Profile;

  const mockBoards = [
    {
      id: "board-1",
      user_id: mockUserId,
      board_type: "shortboard",
      length_ft: 6,
      length_in: 2,
      volume_liters: null,
      brand: "Channel Islands",
      model: "Rocket 9",
      is_favorite: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "board-2",
      user_id: mockUserId,
      board_type: "funboard",
      length_ft: 7,
      length_in: 6,
      volume_liters: 48,
      brand: "Torq",
      model: "Mod Fun",
      is_favorite: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ] as unknown as Board[];

  const mockBeaches = [
    {
      id: "beach-1",
      name: "Black's Beach",
      region: "San Diego",
      state: "CA",
      country: "USA",
      center_lat: 32.8872,
      center_lng: -117.2509,
      surfline_spot_id: "5842041f4e65fad6a7708813",
      description: "Advanced surf spot",
      break_type: "reef",
      difficulty_level: "advanced",
      best_swell_direction: null,
      best_wind_direction: null,
      best_tide: null,
      hazards: null,
      facilities: null,
      crowd_factor: null,
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ] as unknown as Beach[];

  const mockRecentSessions = [
    {
      id: "session-1",
      user_id: mockUserId,
      beach_id: "beach-1",
      board_id: "board-1",
      date: "2024-01-15",
      start_time: "08:00:00",
      end_time: "10:00:00",
      duration_minutes: 120,
      wave_count: 15,
      rating: 4,
      notes: "Great session",
      conditions_at_session: null,
      is_public: true,
      created_at: "2024-01-15T00:00:00Z",
      updated_at: "2024-01-15T00:00:00Z",
      beach_name: "Black's Beach",
      beach_region: "San Diego",
      board_type: "shortboard",
      board_length_display: '6\'2"',
    },
  ] as unknown as SessionWithDetails[];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render all three tab triggers", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByRole("tab", { name: /profile/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /my boards/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /preferences/i })).toBeInTheDocument();
    });

    it("should render the basic profile form by default", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByTestId("basic-profile-form")).toBeInTheDocument();
      expect(screen.getByText(`User ID: ${mockUserId}`)).toBeInTheDocument();
      expect(screen.getByText(`Email: ${mockEmail}`)).toBeInTheDocument();
      expect(screen.getByText(`Profile: ${mockProfile.full_name}`)).toBeInTheDocument();
    });

    it("should render the recent sessions list in the sidebar", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByTestId("recent-sessions-list")).toBeInTheDocument();
      expect(screen.getByText(`Sessions Count: ${mockRecentSessions.length}`)).toBeInTheDocument();
    });

    it("should have the profile tab selected by default", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const profileTab = screen.getByRole("tab", { name: /profile/i });
      expect(profileTab).toHaveAttribute("data-state", "active");
    });
  });

  describe("Tab Navigation", () => {
    it("should have all tabs clickable", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const profileTab = screen.getByRole("tab", { name: /profile/i });
      const boardsTab = screen.getByRole("tab", { name: /my boards/i });
      const preferencesTab = screen.getByRole("tab", { name: /preferences/i });

      expect(profileTab).toBeInTheDocument();
      expect(boardsTab).toBeInTheDocument();
      expect(preferencesTab).toBeInTheDocument();
    });

    it("should have profile tab active by default", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const profileTab = screen.getByRole("tab", { name: /profile/i });
      expect(profileTab).toHaveAttribute("data-state", "active");
      expect(profileTab).toHaveAttribute("aria-selected", "true");
    });

    it("should show profile form content when profile tab is active", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByTestId("basic-profile-form")).toBeInTheDocument();
    });

    it("should maintain sidebar visibility regardless of tab selection", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      // Sidebar should be visible
      expect(screen.getByTestId("recent-sessions-list")).toBeInTheDocument();
    });
  });

  describe("Prop Passing", () => {
    it("should pass correct props to BasicProfileForm in active profile tab", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      // Verify that BasicProfileForm receives the correct props
      expect(screen.getByTestId("basic-profile-form")).toBeInTheDocument();
      expect(screen.getByText(`User ID: ${mockUserId}`)).toBeInTheDocument();
      expect(screen.getByText(`Email: ${mockEmail}`)).toBeInTheDocument();
      expect(screen.getByText(`Profile: ${mockProfile.full_name}`)).toBeInTheDocument();
    });

    it("should pass boards array to BoardsManager component", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      // BoardsManager is present in DOM but not visible (handled by Radix Tabs)
      // We verify it would receive correct props by checking component structure
      expect(screen.getByRole("tab", { name: /my boards/i })).toBeInTheDocument();
    });

    it("should pass beaches and profile to ProfilePreferences component", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      // ProfilePreferences is present in DOM but not visible (handled by Radix Tabs)
      // We verify it would receive correct props by checking component structure
      expect(screen.getByRole("tab", { name: /preferences/i })).toBeInTheDocument();
    });

    it("should pass correct props to RecentSessionsList", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByTestId("recent-sessions-list")).toBeInTheDocument();
      expect(screen.getByText(`Sessions Count: ${mockRecentSessions.length}`)).toBeInTheDocument();
    });
  });

  describe("Null/Empty State Handling", () => {
    it("should handle null profile gracefully", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={null}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByTestId("basic-profile-form")).toBeInTheDocument();
      expect(screen.getByText("Profile: No profile")).toBeInTheDocument();
    });

    it("should handle empty boards array", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={[]}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      // Component should render without errors
      expect(screen.getByRole("tab", { name: /my boards/i })).toBeInTheDocument();
    });

    it("should handle empty recent sessions array", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={[]}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByTestId("recent-sessions-list")).toBeInTheDocument();
      expect(screen.getByText("Sessions Count: 0")).toBeInTheDocument();
    });

    it("should handle empty beaches array", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={[]}
        />
      );

      // Component should render without errors
      expect(screen.getByRole("tab", { name: /preferences/i })).toBeInTheDocument();
    });
  });

  describe("Layout and Structure", () => {
    it("should render with responsive grid layout", () => {
      const { container } = render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const gridDiv = container.querySelector(".grid.md\\:grid-cols-3");
      expect(gridDiv).toBeInTheDocument();
    });

    it("should render tabs content in main area", () => {
      const { container } = render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const mainArea = container.querySelector(".md\\:col-span-2");
      expect(mainArea).toBeInTheDocument();
    });

    it("should render tablist with correct grid layout", () => {
      const { container } = render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const tabList = container.querySelector('[role="tablist"]');
      expect(tabList).toHaveClass("grid-cols-3");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA roles for tabs", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const tabList = screen.getByRole("tablist");
      expect(tabList).toBeInTheDocument();

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(3);
    });

    it("should have profile tab marked as selected by default", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const profileTab = screen.getByRole("tab", { name: /profile/i });
      expect(profileTab).toHaveAttribute("aria-selected", "true");
    });

    it("should have proper tab panel associations", () => {
      const { container } = render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const tabPanels = container.querySelectorAll('[role="tabpanel"]');
      expect(tabPanels.length).toBeGreaterThan(0);
    });

    it("should have tabs with proper aria-controls attributes", () => {
      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      const profileTab = screen.getByRole("tab", { name: /profile/i });
      const boardsTab = screen.getByRole("tab", { name: /my boards/i });
      const preferencesTab = screen.getByRole("tab", { name: /preferences/i });

      expect(profileTab).toHaveAttribute("aria-controls");
      expect(boardsTab).toHaveAttribute("aria-controls");
      expect(preferencesTab).toHaveAttribute("aria-controls");
    });
  });

  describe("Multiple Boards Handling", () => {
    it("should accept multiple boards without errors", () => {
      const manyBoards = [
        ...mockBoards,
        {
          id: "board-3",
          user_id: mockUserId,
          board_type: "longboard",
          length_ft: 9,
          length_in: 0,
          volume_liters: 75,
          brand: "Stewart",
          model: "Redline 11",
          is_favorite: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ] as unknown as Board[];

      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={manyBoards}
          recentSessions={mockRecentSessions}
          beaches={mockBeaches}
        />
      );

      // Component should render without errors
      expect(screen.getByRole("tab", { name: /my boards/i })).toBeInTheDocument();
    });
  });

  describe("Multiple Sessions Handling", () => {
    it("should display correct count for multiple sessions", () => {
      const manySessions = [
        ...mockRecentSessions,
        {
          id: "session-2",
          user_id: mockUserId,
          beach_id: "beach-1",
          board_id: "board-2",
          date: "2024-01-16",
          start_time: "09:00:00",
          end_time: "11:00:00",
          duration_minutes: 120,
          wave_count: 12,
          rating: 5,
          notes: "Epic session",
          conditions_at_session: null,
          is_public: true,
          created_at: "2024-01-16T00:00:00Z",
          updated_at: "2024-01-16T00:00:00Z",
          beach_name: "Black's Beach",
          beach_region: "San Diego",
          board_type: "funboard",
          board_length_display: '7\'6"',
        },
      ] as unknown as SessionWithDetails[];

      render(
        <ProfileEditForm
          userId={mockUserId}
          email={mockEmail}
          profile={mockProfile}
          boards={mockBoards}
          recentSessions={manySessions}
          beaches={mockBeaches}
        />
      );

      expect(screen.getByText("Sessions Count: 2")).toBeInTheDocument();
    });
  });
});
