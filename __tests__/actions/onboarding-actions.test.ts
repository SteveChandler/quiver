import { saveOnboardingData } from "@/actions/onboarding-actions";

// Mock analytics
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

// Mock gamification actions
jest.mock("@/lib/gamification", () => ({
  trackXP: jest.fn().mockResolvedValue({ success: true, data: { xp_gained: 100 } }),
}));

// Track last operations for assertions
let lastProfileUpdate: any = null;
let lastXPTrackCalls: any[] = [];

// Mock server action utils
jest.mock("@/lib/server-action-utils", () => {
  const mockSupabase = {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          update: (data: any) => {
            lastProfileUpdate = data;
            return {
              eq: (column: string, value: any) => ({
                select: () => ({
                  single: () => {
                    // Simulate constraint violations
                    if (data.display_name === 'duplicate') {
                      return Promise.resolve({
                        data: null,
                        error: { message: 'duplicate key value violates unique constraint "profiles_display_name_key"', code: '23505' }
                      });
                    }
                    if (data.preferred_wave_size === 'invalid') {
                      return Promise.resolve({
                        data: null,
                        error: { message: 'new row for relation "profiles" violates check constraint "profiles_preferred_wave_size_check"', code: '23514' }
                      });
                    }
                    // Return updated profile data
                    return Promise.resolve({
                      data: {
                        id: 'user-123',
                        ...data,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                      error: null
                    });
                  }
                })
              })
            };
          },
          select: (columns?: string) => ({
            eq: (column: string, value: any) => ({
              neq: (column2: string, value2: any) => ({
                maybeSingle: () => {
                  // Check for duplicate display name (used in pre-save validation)
                  if (value === 'duplicate') {
                    return Promise.resolve({
                      data: { id: 'other-user-456', display_name: 'duplicate' },
                      error: null
                    });
                  }
                  // No duplicate found
                  return Promise.resolve({
                    data: null,
                    error: null
                  });
                }
              }),
            })
          })
        };
      }

      return {};
    }
  };

  return {
    withAuthenticatedAction: (fn: any) => {
      return fn({ id: "user-123" }, mockSupabase);
    },
  };
});

describe("saveOnboardingData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastProfileUpdate = null;
    lastXPTrackCalls = [];
  });

  describe("Profile Updates", () => {
    it("should save all required and optional fields to profiles", async () => {
      const onboardingData = {
        fullName: "John Doe",
        displayName: "surfer_john",
        homeBeachId: "beach-123",
        experienceLevel: "intermediate" as const,
        surfStyles: ["shortboard", "longboard"],
        preferredWaveSize: "medium" as const,
        preferredBreakType: "point" as const,
        crowdPreference: "moderate" as const,
        pushEnabled: true,
        emailEnabled: false,
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate).toEqual({
        full_name: "John Doe",
        display_name: "surfer_john",
        home_beach_id: "beach-123",
        experience_level: "intermediate",
        surf_styles: ["shortboard", "longboard"],
        preferred_wave_size: "medium",
        preferred_break_type: "point",
        crowd_preference: "moderate",
        notif_push_enabled: true,
        notif_email_enabled: false,
        onboarding_completed_at: expect.any(String),
      });
    });

    it("should handle NULL values for optional fields (home beach still required)", async () => {
      const onboardingData = {
        fullName: "Jane Doe",
        displayName: "jane_surfer",
        homeBeachId: "beach-123",
        // All other optional fields omitted
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.preferred_wave_size).toBe(null);
      expect(lastProfileUpdate.preferred_break_type).toBe(null);
      expect(lastProfileUpdate.crowd_preference).toBe(null);
      expect(lastProfileUpdate.home_beach_id).toBe("beach-123");
      expect(lastProfileUpdate.experience_level).toBe(null);
    });

    it("should default notification preferences when not provided", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        // pushEnabled and emailEnabled not provided
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.notif_push_enabled).toBe(true); // Default true
      expect(lastProfileUpdate.notif_email_enabled).toBe(true); // Default true
    });

    it("should preserve explicit false values for notifications", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        pushEnabled: false,
        emailEnabled: false,
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.notif_push_enabled).toBe(false);
      expect(lastProfileUpdate.notif_email_enabled).toBe(false);
    });

    it("should set onboarding_completed_at timestamp", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
      };

      const beforeTime = new Date().toISOString();
      const result = await saveOnboardingData(onboardingData);
      const afterTime = new Date().toISOString();

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.onboarding_completed_at).toBeDefined();
      expect(lastProfileUpdate.onboarding_completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Timestamp should be between before and after
      const timestamp = lastProfileUpdate.onboarding_completed_at;
      expect(timestamp >= beforeTime && timestamp <= afterTime).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should reject duplicate display_name", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "duplicate", // This triggers the pre-save uniqueness check
        homeBeachId: "beach-123",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Display name is already taken');
    });

    it("should reject invalid enum values", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        preferredWaveSize: "invalid" as any, // This triggers the check constraint
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('check constraint');
    });
  });

  describe("XP Awarding", () => {
    it("should award 100 XP for onboarding completion", async () => {
      const { trackXP } = require("@/lib/gamification");

      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(trackXP).toHaveBeenCalledWith('onboarding_completed', 'user-123');
    });

    it("should not fail if XP tracking fails", async () => {
      const { trackXP } = require("@/lib/gamification");
      trackXP.mockRejectedValueOnce(new Error("XP system unavailable"));

      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
      };

      // Should still succeed even if XP tracking fails
      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
    });
  });

  describe("Analytics Tracking", () => {
    it("should track onboarding_completed event with all metadata", async () => {
      const { track } = require("@/lib/analytics");

      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        experienceLevel: "intermediate" as const,
        surfStyles: ["shortboard", "longboard"],
        pushEnabled: true,
        emailEnabled: false,
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(track).toHaveBeenCalledWith('onboarding_completed', {
        user_id: 'user-123',
        has_home_beach: true,
        experience_level: 'intermediate',
        surf_styles_count: 2,
        push_enabled: true,
        email_enabled: false,
      });
    });

    it("should track with default values when optional fields omitted", async () => {
      const { track } = require("@/lib/analytics");

      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(track).toHaveBeenCalledWith('onboarding_completed', {
        user_id: 'user-123',
        has_home_beach: true,
        experience_level: undefined,
        surf_styles_count: 0,
        push_enabled: false,
        email_enabled: true, // Default true when not provided
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty surf_styles array", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        surfStyles: [],
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.surf_styles).toEqual([]);
    });

    it("should handle all preference fields as 'any'", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        preferredWaveSize: "any" as const,
        preferredBreakType: "any" as const,
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.preferred_wave_size).toBe("any");
      expect(lastProfileUpdate.preferred_break_type).toBe("any");
    });

    it("should reject minimal onboarding data when home beach is missing", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("home beach");
      expect(lastProfileUpdate).toBe(null);
    });

    it("should handle complete onboarding data", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        homeBeachName: "Ocean Beach", // Display only
        experienceLevel: "advanced" as const,
        surfStyles: ["shortboard", "fish", "gun"],
        preferredWaveSize: "large" as const,
        preferredBreakType: "reef" as const,
        crowdPreference: "solitude" as const,
        pushEnabled: true,
        emailEnabled: true,
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      // homeBeachName should not be saved (display only)
      expect(lastProfileUpdate.home_beach_name).toBe(undefined);
    });

    it("should return updated profile in success response", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      if (result.success && "profile" in result && result.profile) {
        const profile = result.profile as { id: string; full_name: string; display_name: string; home_beach_id: string };
        expect(profile.id).toBe("user-123");
        expect(profile.full_name).toBe("Test User");
        expect(profile.display_name).toBe("test_user");
        expect(profile.home_beach_id).toBe("beach-123");
      }
    });
  });
});
