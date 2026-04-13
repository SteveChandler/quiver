/**
 * Tests for PreferencesQuickGlance component
 *
 * Validates:
 * - Display of 5 key preference badges
 * - Handling of set vs unset values
 * - Learned wave range display (confidence > 0.5)
 * - Edit button functionality
 * - Accessibility
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";
import "@testing-library/jest-dom";
import { PreferencesQuickGlance } from "@/components/profile/preferences-quick-glance";
import type { ProfilePageProfile, ProfilePagePreferences } from "@/types/profile-page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("PreferencesQuickGlance", () => {
  const mockProfile: ProfilePageProfile = {
    id: "user-123",
    full_name: "Test Surfer",
    avatar_url: null,
    bio: null,
    location: "San Diego",
    instagram: null,
    home_beach_id: "beach-1",
    experience_level: "intermediate",
    surf_styles: ["shortboard", "longboard"],
    homeBeachName: "La Jolla Shores",
    notif_reminders: null,
    notif_forecast_alerts: null,
    digest_session_invites: null,
    inapp_session_invites: null,
    email_session_invites: null,
    allow_implicit_tracking: null,
  };

  const mockPreferencesWithLearned: ProfilePagePreferences = {
    learned: {
      wave_min_ft: 3,
      wave_max_ft: 6,
      wave_period_min_s: 10,
      wave_period_max_s: 14,
      max_wind_mph: 12,
      preferred_wind_directions: [0, 45],
      preferred_tide_statuses: ["rising"],
      confidence: 0.75,
      sample_size: 15,
    },
    onboarding: {
      experience_level: "intermediate",
      surf_styles: ["shortboard", "longboard"],
    },
  };

  const mockPreferencesWithoutLearned: ProfilePagePreferences = {
    learned: null,
    onboarding: {
      experience_level: "intermediate",
    },
  };

  const mockPreferencesLowConfidence: ProfilePagePreferences = {
    learned: {
      wave_min_ft: 2,
      wave_max_ft: 4,
      wave_period_min_s: null,
      wave_period_max_s: null,
      max_wind_mph: null,
      preferred_wind_directions: null,
      preferred_tide_statuses: null,
      confidence: 0.3, // Below 0.5 threshold
      sample_size: 3,
    },
    onboarding: {},
  };

  beforeEach(() => {
    mockPush.mockClear();
  });

  describe("Badge Display", () => {
    it("should display experience level with emoji", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      expect(screen.getByText(/Intermediate/i)).toBeInTheDocument();
    });

    it("should display surf styles", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      // Should show shortboard and longboard
      expect(screen.getByText(/Shortboard.*Longboard/i)).toBeInTheDocument();
    });
  });

  describe("Learned Wave Range", () => {
    it("should display learned wave range when confidence > 0.5", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      expect(screen.getByText(/3-6ft.*learned/i)).toBeInTheDocument();
    });

    it("should show 'Log 5+ sessions' when no learned preferences", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithoutLearned}
        />
      );

      expect(screen.getByText(/Log 5\+ sessions/i)).toBeInTheDocument();
    });

    it("should show 'Log 5+ sessions' when confidence is below threshold", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesLowConfidence}
        />
      );

      expect(screen.getByText(/Log 5\+ sessions/i)).toBeInTheDocument();
    });
  });

  describe("Unset Values", () => {
    it("should show 'not set' for missing experience level", () => {
      const profileWithoutExperience = {
        ...mockProfile,
        experience_level: null,
      };

      render(
        <PreferencesQuickGlance
          profile={profileWithoutExperience}
          preferences={mockPreferencesWithoutLearned}
        />
      );

      expect(screen.getByText(/Level not set/i)).toBeInTheDocument();
    });

    it("should show 'not set' for empty surf styles", () => {
      const profileWithoutStyles = {
        ...mockProfile,
        surf_styles: [],
      };

      render(
        <PreferencesQuickGlance
          profile={profileWithoutStyles}
          preferences={mockPreferencesWithoutLearned}
        />
      );

      expect(screen.getByText(/Style not set/i)).toBeInTheDocument();
    });

  });

  describe("Edit Button", () => {
    it("should render edit button", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      const editButton = screen.getByRole("button", { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it("should navigate to surf-profile tab on edit click", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      expect(mockPush).toHaveBeenCalledWith("/profile?tab=surf-profile");
    });
  });

  describe("Accessibility", () => {
    it("should have role='group' with aria-label", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      const container = screen.getByRole("group");
      expect(container).toHaveAttribute(
        "aria-label",
        "Surf preferences summary"
      );
    });

    it("should have aria-labels on badges", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      // Check a few badges have aria-labels
      expect(screen.getByLabelText(/Experience:/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Style:/i)).toBeInTheDocument();
    });
  });

  describe("Surf Styles Display", () => {
    it("should show +N indicator for more than 2 styles", () => {
      const profileWithManyStyles = {
        ...mockProfile,
        surf_styles: ["shortboard", "longboard", "fish", "funboard"],
      };

      render(
        <PreferencesQuickGlance
          profile={profileWithManyStyles}
          preferences={mockPreferencesWithLearned}
        />
      );

      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it("should not show +N indicator for 2 or fewer styles", () => {
      render(
        <PreferencesQuickGlance
          profile={mockProfile}
          preferences={mockPreferencesWithLearned}
        />
      );

      expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
    });
  });
});
