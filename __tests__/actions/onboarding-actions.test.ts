import { saveOnboardingData } from "@/actions/onboarding-actions";

// Mock gamification actions
jest.mock("@/lib/gamification", () => ({
  trackXP: jest.fn().mockResolvedValue({ success: true, data: { xp_gained: 100 } }),
}));

// Mock the seed helper so we can assert it's invoked with the right params.
// Defaults to a no-op success; individual tests can override to simulate errors.
const mockSeedDefaultRuleForUser = jest.fn();
jest.mock("@/lib/alerts/seed-default-rule", () => ({
  seedDefaultRuleForUser: (...args: unknown[]) => mockSeedDefaultRuleForUser(...args),
}));

// Track last operations for assertions
let lastProfileUpdate: any = null;
let lastXPTrackCalls: any[] = [];
let lastUserEventInsert: any = null;
let allUserEventInserts: any[] = [];

// Mock server action utils
jest.mock("@/lib/server-action-utils", () => {
  const mockSupabase = {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          update: (data: any) => {
            // Only capture the main profile update (not referral_code updates)
            if (!('referral_code' in data)) {
              lastProfileUpdate = data;
            }
            const eqResult = {
              // For update().eq() used without select (e.g. referral_code update)
              then: (resolve: any) => resolve({ error: null }),
              select: () => ({
                single: () => {
                  // Simulate constraint violations
                  if (data.display_name === 'duplicate') {
                    return Promise.resolve({
                      data: null,
                      error: { message: 'duplicate key value violates unique constraint "profiles_display_name_key"', code: '23505' }
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
            };
            return { eq: (_column: string, _value: any) => eqResult };
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
              // Used by getOrCreateReferralCode to check if profile has a referral_code
              single: () => Promise.resolve({
                data: { referral_code: null },
                error: null
              }),
            })
          })
        };
      }

      if (table === 'referrals') {
        return {
          select: (_columns?: string) => ({
            eq: (_column: string, _value: any) => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: (_data: any) => Promise.resolve({ error: null }),
        };
      }

      if (table === 'user_events') {
        return {
          insert: (row: any) => {
            lastUserEventInsert = row;
            allUserEventInserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      return {};
    },
    rpc: (fn: string, _args?: any) => {
      if (fn === 'generate_referral_code') {
        return Promise.resolve({ data: 'ABC123', error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
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
    lastUserEventInsert = null;
    allUserEventInserts = [];
    mockSeedDefaultRuleForUser.mockReset();
    mockSeedDefaultRuleForUser.mockResolvedValue({
      seeded: true,
      ruleId: "rule-1",
      presetType: "mellow_session",
    });
  });

  describe("Profile Updates", () => {
    it("should save all required and optional fields to profiles", async () => {
      const onboardingData = {
        fullName: "John Doe",
        displayName: "surfer_john",
        homeBeachId: "beach-123",
        experienceLevel: "intermediate" as const,
        surfStyles: ["shortboard", "longboard"],
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
        notif_push_enabled: true,
        notif_email_enabled: false,
        onboarding_completed_at: expect.any(String),
      });
    });

    // preferredTime → preferred_session_time mapping tests removed in
    // plan E2. Onboarding no longer captures time-bucket; Oracle's
    // SessionTimeSelector owns `profiles.preferred_session_time`
    // exclusively now. The regression guard is: saveOnboardingData
    // does NOT write `preferred_session_time` even when a legacy
    // `preferredTime` field is passed in (the profile upsert simply
    // ignores it).
    it("does not write preferred_session_time even if a legacy preferredTime is passed", async () => {
      // `preferredTime` is kept on the store interface as a legacy
      // field (for backwards-compat with persisted localStorage from
      // older onboarding versions), but the server action ignores it.
      await saveOnboardingData({
        homeBeachId: "beach-123",
        preferredTime: "dawn",
      });

      expect(lastProfileUpdate.preferred_session_time).toBeUndefined();
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
      expect(lastProfileUpdate.home_beach_id).toBe("beach-123");
      expect(lastProfileUpdate.experience_level).toBeUndefined();
    });

    it("should not set notification preferences when not provided", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        // pushEnabled and emailEnabled not provided
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastProfileUpdate.notif_push_enabled).toBeUndefined();
      expect(lastProfileUpdate.notif_email_enabled).toBeUndefined();
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
      // eslint-disable-next-line jest/no-restricted-matchers -- asserting presence; specific shape checked on next line
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
    it("should insert a server-confirmed onboarding_step 'completed' event into user_events", async () => {
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

      // lib/analytics.track() was a no-op on the server; we now insert directly
      // into user_events. Reuses the existing 'onboarding_step' event type because
      // the user_events_event_type_check constraint doesn't include 'onboarding_completed'.
      // See project_server_analytics_noop.md for background.
      expect(lastUserEventInsert).toEqual({
        user_id: 'user-123',
        event_type: 'onboarding_step',
        metadata: {
          step: 'completed',
          step_name: 'completed',
          source: 'server',
          has_home_beach: true,
          experience_level: 'intermediate',
          preferred_time: null,
          surf_styles_count: 2,
          push_enabled: true,
          email_enabled: false,
        },
      });
    });

    it("should insert event with default values when optional fields are omitted", async () => {
      const onboardingData = {
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
      };

      const result = await saveOnboardingData(onboardingData);

      expect(result.success).toBe(true);
      expect(lastUserEventInsert).toEqual({
        user_id: 'user-123',
        event_type: 'onboarding_step',
        metadata: {
          step: 'completed',
          step_name: 'completed',
          source: 'server',
          has_home_beach: true,
          experience_level: null,
          preferred_time: null,
          surf_styles_count: 0,
          push_enabled: false,
          email_enabled: true, // Default true when not provided
        },
      });
    });
  });

  describe("Default Alert Rule Seeding", () => {
    it("invokes seedDefaultRuleForUser with experienceLevel and beach from onboarding data", async () => {
      await saveOnboardingData({
        fullName: "Test User",
        displayName: "test_user",
        homeBeachId: "beach-123",
        experienceLevel: "beginner" as const,
        emailEnabled: true,
        pushEnabled: false,
      });

      expect(mockSeedDefaultRuleForUser).toHaveBeenCalledTimes(1);
      const call = mockSeedDefaultRuleForUser.mock.calls[0][0];
      expect(call.userId).toBe("user-123");
      expect(call.beachId).toBe("beach-123");
      expect(call.experienceLevel).toBe("beginner");
      expect(call.notifyEmail).toBe(true);
      expect(call.notifyPush).toBe(false);
    });

    it("passes null experienceLevel through when not provided (helper handles skip)", async () => {
      await saveOnboardingData({
        homeBeachId: "beach-123",
      });

      expect(mockSeedDefaultRuleForUser).toHaveBeenCalledTimes(1);
      expect(mockSeedDefaultRuleForUser.mock.calls[0][0].experienceLevel).toBeNull();
    });

    it("logs an alert_rule_seeded user_events row with the seed result", async () => {
      mockSeedDefaultRuleForUser.mockResolvedValueOnce({
        seeded: true,
        ruleId: "rule-xyz",
        presetType: "clean_groundswell",
      });

      await saveOnboardingData({
        homeBeachId: "beach-123",
        experienceLevel: "expert" as const,
      });

      const seededEvent = allUserEventInserts.find(
        (e) => e.metadata?.step === "alert_rule_seeded"
      );
      expect(seededEvent).toMatchObject({
        event_type: "onboarding_step",
        metadata: {
          step: "alert_rule_seeded",
          step_name: "alert_rule_seeded",
          source: "server",
          seeded: true,
          ruleId: "rule-xyz",
          presetType: "clean_groundswell",
        },
      });
    });

    it("does not fail onboarding when the seed helper throws", async () => {
      mockSeedDefaultRuleForUser.mockRejectedValueOnce(new Error("boom"));

      const result = await saveOnboardingData({
        homeBeachId: "beach-123",
        experienceLevel: "intermediate" as const,
      });

      expect(result.success).toBe(true);
    });

    it("does not fail onboarding when the seed helper returns an error result", async () => {
      mockSeedDefaultRuleForUser.mockResolvedValueOnce({
        seeded: false,
        reason: "error",
        error: "db down",
      });

      const result = await saveOnboardingData({
        homeBeachId: "beach-123",
        experienceLevel: "beginner" as const,
      });

      expect(result.success).toBe(true);
      const seededEvent = allUserEventInserts.find(
        (e) => e.metadata?.step === "alert_rule_seeded"
      );
      expect(seededEvent.metadata.reason).toBe("error");
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
      expect(lastProfileUpdate.surf_styles).toBeUndefined();
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
      /* eslint-disable jest/no-conditional-expect -- narrowing result type; assertions only run when profile shape is present */
      if (result.success && "profile" in result && result.profile) {
        const profile = result.profile as { id: string; full_name: string; display_name: string; home_beach_id: string };
        expect(profile.id).toBe("user-123");
        expect(profile.full_name).toBe("Test User");
        expect(profile.display_name).toBe("test_user");
        expect(profile.home_beach_id).toBe("beach-123");
      }
      /* eslint-enable jest/no-conditional-expect */
    });
  });
});
