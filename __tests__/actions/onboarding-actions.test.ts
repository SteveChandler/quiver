import { saveOnboardingData } from "@/actions/onboarding-actions";

// Mock analytics
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

// Mock gamification actions
jest.mock("@/lib/gamification-actions", () => ({
  trackXP: jest.fn().mockResolvedValue({ success: true, data: { xp_gained: 100 } }),
}));

// Track last operations for assertions
let lastProfileUpdate: any = null;
let lastReferralInsert: any = null;
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
              eq: (column: string, value: any) => {
                // Simulate constraint violations
                if (data.display_name === 'duplicate') {
                  return Promise.resolve({
                    error: { message: 'duplicate key value violates unique constraint "profiles_display_name_key"', code: '23505' }
                  });
                }
                if (data.preferred_wave_size === 'invalid') {
                  return Promise.resolve({
                    error: { message: 'new row for relation "profiles" violates check constraint "profiles_preferred_wave_size_check"', code: '23514' }
                  });
                }
                return Promise.resolve({ data: {}, error: null });
              }
            };
          },
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: 'referrer-123', referral_code: 'SURF2024' },
                error: null
              })
            })
          })
        };
      }

      if (table === 'referrals') {
        return {
          insert: (data: any) => {
            lastReferralInsert = data;
            // Simulate referrals table doesn't exist
            return Promise.resolve({
              error: { message: 'relation "referrals" does not exist', code: '42P01' }
            });
          }
        };
      }

      return {};
    }
  };

  return {
    withAuthenticatedAction: (fn: any) => {
      return fn({ id: "user-123" }, mockSupabase).then(
        (data: any) => ({ success: true, ...data }),
        (error: any) => ({ success: false, error: error.message })
      );
    },
  };
});

describe("saveOnboardingData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastProfileUpdate = null;
    lastReferralInsert = null;
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

    it("should handle NULL values for optional fields", async () => {
      const onboardingData = {
        fullName: "Jane Doe",
        displayName: "jane_surfer",
        // All optional fields omitted
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.preferred_wave_size).toBe(null);
      expect(lastProfileUpdate.preferred_break_type).toBe(null);
      expect(lastProfileUpdate.crowd_preference).toBe(null);
      expect(lastProfileUpdate.home_beach_id).toBe(null);
      expect(lastProfileUpdate.experience_level).toBe(null);
    });

    it("should default notification preferences when not provided", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
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
        displayName: "duplicate", // This triggers the constraint violation
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('duplicate key value');
    });

    it("should reject invalid enum values", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        preferredWaveSize: "invalid" as any, // This triggers the check constraint
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('check constraint');
    });
  });

  describe("XP Awarding", () => {
    it("should award 100 XP for onboarding completion", async () => {
      const { trackXP } = require("@/lib/gamification-actions");

      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(trackXP).toHaveBeenCalledWith('onboarding_completed', 'user-123');
    });

    it("should not fail if XP tracking fails", async () => {
      const { trackXP } = require("@/lib/gamification-actions");
      trackXP.mockRejectedValueOnce(new Error("XP system unavailable"));

      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
      };

      // Should still succeed even if XP tracking fails
      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
    });
  });

  describe("Referral Processing", () => {
    it("should process referral code if provided", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        referralCode: "SURF2024",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      // Referral insert attempted (even though table doesn't exist)
      expect(lastReferralInsert).toBeDefined();
    });

    it("should not fail if referral table doesn't exist", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        referralCode: "SURF2024",
      };

      // Should still succeed even if referrals table doesn't exist
      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
    });

    it("should skip referral processing if no code provided", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        // No referralCode
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastReferralInsert).toBe(null);
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
        referralCode: "SURF2024",
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
        used_referral: true,
        push_enabled: true,
        email_enabled: false,
      });
    });

    it("should track with default values when optional fields omitted", async () => {
      const { track } = require("@/lib/analytics");

      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(track).toHaveBeenCalledWith('onboarding_completed', {
        user_id: 'user-123',
        has_home_beach: false,
        experience_level: undefined,
        surf_styles_count: 0,
        used_referral: false,
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
        preferredWaveSize: "any" as const,
        preferredBreakType: "any" as const,
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.preferred_wave_size).toBe("any");
      expect(lastProfileUpdate.preferred_break_type).toBe("any");
    });

    it("should handle minimal onboarding data", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.full_name).toBe("Test User");
      expect(lastProfileUpdate.display_name).toBe("test_user");
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
        referralCode: "SURF2024",
        pushEnabled: true,
        emailEnabled: true,
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      // homeBeachName should not be saved (display only)
      expect(lastProfileUpdate.home_beach_name).toBe(undefined);
    });
  });
});
