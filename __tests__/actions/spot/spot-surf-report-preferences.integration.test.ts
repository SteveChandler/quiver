/**
 * @jest-environment node
 *
 * Integration tests for personalized surf verdicts based on user preferences.
 *
 * These tests verify the full integration between:
 * - User authentication (getUser)
 * - Preference fetching (getUserSurfPreferences)
 * - Caching (per-user cache keys)
 * - Scoring (selectBestWindow with userPrefs)
 *
 * Key scenarios:
 * - Preference fetch failures should gracefully degrade
 * - Cache keys should be stable and include all scoring-relevant fields
 * - Different users should get independent cached results
 * - Low-confidence preferences should be handled appropriately
 */

import type { Beach } from "@/types/database";
import type { UserSurfPreferences } from "@/lib/services/preference-learning-service";

// Mock server modules
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/discovery", () => ({
  getBatchSunTimes: jest.fn(),
}));

jest.mock("@/lib/services/preference-learning-service", () => ({
  getUserSurfPreferences: jest.fn(),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

let formatDateCallCount = 0;
jest.mock("@/lib/utils/date-formatting", () => ({
  formatDateInTimezone: jest.fn(() => {
    formatDateCallCount++;
    return formatDateCallCount % 2 === 1 ? "2024-01-15" : "2024-01-16";
  }),
}));

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn) => fn),
}));

const mockSelectBestWindow = jest.fn();
jest.mock("@/lib/services/discovery/window-selector", () => ({
  selectBestWindow: (...args: any[]) => mockSelectBestWindow(...args),
}));

describe("Spot Surf Report Preferences Integration", () => {
  const mockBeach: Beach = {
    id: "beach-123",
    slug: "test-beach",
    name: "Test Beach",
    lat: 33.8,
    lon: -118.4,
    state: "California",
    city: "Los Angeles",
    description: "A test beach",
  } as Beach;

  const mockForecasts = [
    {
      id: "forecast-1",
      beach_id: "beach-123",
      forecast_at: "2024-01-15T14:00Z",
      forecast_date: "2024-01-15",
      forecast_time: "14:00",
      wave_height: "4",
      wave_period: "12",
      confidence_score: 80,
    },
  ];

  const mockSunTimesCache = new Map([
    [
      "beach-123",
      {
        sunrises: [new Date("2024-01-15T14:47:00Z")],
        sunsets: [new Date("2024-01-16T01:00:00Z")],
      },
    ],
  ]);

  // Standard mock user preferences
  const mockUserPrefs: UserSurfPreferences = {
    wave_min_ft: 3,
    wave_max_ft: 6,
    wave_period_min_s: 10,
    wave_period_max_s: 16,
    max_wind_mph: 15,
    preferred_wind_directions: [0, 315],
    preferred_tide_statuses: ["rising", "high"],
    confidence: 0.85,
    sample_size: 15,
  };

  function setupMocks(options: {
    user?: { id: string } | null;
    userPrefs?: UserSurfPreferences | null;
    prefsError?: Error;
    authError?: Error;
  } = {}) {
    const {
      user = null,
      userPrefs = null,
      prefsError,
      authError,
    } = options;

    const { createSupabaseServerClient, createSupabaseServiceRoleClient } =
      require("@/lib/supabase/server");
    const { getBatchSunTimes } = require("@/lib/services/discovery");
    const { getUserSurfPreferences } = require("@/lib/services/preference-learning-service");

    // Setup auth mock
    if (authError) {
      (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockRejectedValue(authError),
        },
      });
    } else {
      (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user } }),
        },
      });
    }

    // Setup preference fetch mock
    if (prefsError) {
      (getUserSurfPreferences as jest.Mock).mockRejectedValue(prefsError);
    } else {
      (getUserSurfPreferences as jest.Mock).mockResolvedValue(userPrefs);
    }

    // Setup sun times
    (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

    // Setup database mock
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(async () => ({
                      data: mockForecasts,
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    });

    // Setup selectBestWindow mock
    mockSelectBestWindow.mockReturnValue({
      start: new Date("2024-01-15T22:00:00Z"),
      end: new Date("2024-01-16T01:00:00Z"),
      score: 80,
      peakTime: new Date("2024-01-15T23:00:00Z"),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    formatDateCallCount = 0;
  });

  describe("Error Handling", () => {
    it("gracefully handles getUserSurfPreferences timeout", async () => {
      setupMocks({
        user: { id: "user-123" },
        prefsError: new Error("Database timeout after 5000ms"),
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      // Should NOT throw - should gracefully degrade
      const result = await getSpotSurfReport(mockBeach);

      // Should return a result (using null/default preferences)
      expect(result).not.toBeNull();
      expect(result?.report).toBeDefined();
    });

    it("gracefully handles getUserSurfPreferences returning corrupted data", async () => {
      const corruptedPrefs = {
        wave_min_ft: "not-a-number", // Invalid type
        wave_max_ft: null,
        confidence: -1, // Invalid negative
        sample_size: undefined,
      } as unknown as UserSurfPreferences;

      setupMocks({
        user: { id: "user-123" },
        userPrefs: corruptedPrefs,
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      // Should NOT crash
      const result = await getSpotSurfReport(mockBeach);
      expect(result).toBeDefined();
    });

    it("gracefully handles auth.getUser failure", async () => {
      setupMocks({
        authError: new Error("Auth service unavailable"),
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      // Should return null on auth error (caught by outer try/catch)
      const result = await getSpotSurfReport(mockBeach);
      expect(result).toBeNull();
    });
  });

  describe("Cache Key Stability", () => {
    it("generates different cache keys for different user preferences", async () => {
      // This test verifies the getPrefsKey function indirectly
      // by checking that selectBestWindow receives the correct userPrefs

      const prefsA: UserSurfPreferences = {
        ...mockUserPrefs,
        wave_min_ft: 2,
        wave_max_ft: 4,
      };

      const prefsB: UserSurfPreferences = {
        ...mockUserPrefs,
        wave_min_ft: 5,
        wave_max_ft: 8,
      };

      // Test with prefs A
      setupMocks({ user: { id: "user-a" }, userPrefs: prefsA });
      const { getSpotSurfReport: getReportA } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getReportA(mockBeach);
      const callArgsA = mockSelectBestWindow.mock.calls[0][0];

      jest.clearAllMocks();
      jest.resetModules();
      formatDateCallCount = 0;

      // Test with prefs B
      setupMocks({ user: { id: "user-b" }, userPrefs: prefsB });
      const { getSpotSurfReport: getReportB } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getReportB(mockBeach);
      const callArgsB = mockSelectBestWindow.mock.calls[0][0];

      // Verify different preferences were passed
      expect(callArgsA.userPrefs.wave_min_ft).toBe(2);
      expect(callArgsA.userPrefs.wave_max_ft).toBe(4);
      expect(callArgsB.userPrefs.wave_min_ft).toBe(5);
      expect(callArgsB.userPrefs.wave_max_ft).toBe(8);
    });

    it("generates 'default' cache key for anonymous users", async () => {
      setupMocks({ user: null });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach);

      // For anonymous users, userPrefs should be null
      const callArgs = mockSelectBestWindow.mock.calls[0][0];
      expect(callArgs.userPrefs).toBeNull();
    });

    it("generates 'default' cache key for users without preferences", async () => {
      setupMocks({
        user: { id: "new-user-123" },
        userPrefs: null, // New user, no preferences yet
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach);

      // For users without preferences, userPrefs should be null
      const callArgs = mockSelectBestWindow.mock.calls[0][0];
      expect(callArgs.userPrefs).toBeNull();
    });
  });

  describe("Multi-User Cache Isolation", () => {
    it("different users get independent scoring with their own preferences", async () => {
      // User A prefers small waves (2-4 ft)
      const prefsSmallWaves: UserSurfPreferences = {
        ...mockUserPrefs,
        wave_min_ft: 2,
        wave_max_ft: 4,
        confidence: 0.9,
        sample_size: 20,
      };

      // User B prefers big waves (6-10 ft)
      const prefsBigWaves: UserSurfPreferences = {
        ...mockUserPrefs,
        wave_min_ft: 6,
        wave_max_ft: 10,
        confidence: 0.85,
        sample_size: 15,
      };

      // Test User A
      setupMocks({ user: { id: "small-wave-surfer" }, userPrefs: prefsSmallWaves });
      const { getSpotSurfReport: getReportA } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getReportA(mockBeach);

      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrefs: expect.objectContaining({
            wave_min_ft: 2,
            wave_max_ft: 4,
          }),
        })
      );

      jest.clearAllMocks();
      jest.resetModules();
      formatDateCallCount = 0;

      // Test User B
      setupMocks({ user: { id: "big-wave-surfer" }, userPrefs: prefsBigWaves });
      const { getSpotSurfReport: getReportB } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getReportB(mockBeach);

      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrefs: expect.objectContaining({
            wave_min_ft: 6,
            wave_max_ft: 10,
          }),
        })
      );
    });
  });

  describe("Preference Data Quality", () => {
    it("handles preferences with null fields", async () => {
      const partialPrefs: UserSurfPreferences = {
        wave_min_ft: 3,
        wave_max_ft: null, // Partially set
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: 15,
        preferred_wind_directions: null,
        preferred_tide_statuses: null,
        confidence: 0.5,
        sample_size: 8,
      };

      setupMocks({ user: { id: "user-123" }, userPrefs: partialPrefs });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      // Should still work with partial preferences
      expect(result).not.toBeNull();
      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrefs: expect.objectContaining({
            wave_min_ft: 3,
            wave_max_ft: null,
          }),
        })
      );
    });

    it("handles preferences with extreme values", async () => {
      const extremePrefs: UserSurfPreferences = {
        wave_min_ft: 15, // Very big waves
        wave_max_ft: 25,
        wave_period_min_s: 18,
        wave_period_max_s: 25,
        max_wind_mph: 5, // Very strict wind tolerance
        preferred_wind_directions: [90], // Only offshore
        preferred_tide_statuses: ["low"], // Only low tide
        confidence: 0.95,
        sample_size: 50,
      };

      setupMocks({ user: { id: "extreme-surfer" }, userPrefs: extremePrefs });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      // Should handle extreme preferences without crashing
      expect(result).not.toBeNull();
      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrefs: expect.objectContaining({
            wave_min_ft: 15,
            wave_max_ft: 25,
          }),
        })
      );
    });

    it("handles low-confidence preferences", async () => {
      const lowConfidencePrefs: UserSurfPreferences = {
        ...mockUserPrefs,
        confidence: 0.15, // Below typical threshold
        sample_size: 3, // Very few sessions
      };

      setupMocks({ user: { id: "new-surfer" }, userPrefs: lowConfidencePrefs });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      // Should still pass preferences to scorer (scorer decides how to weight them)
      expect(result).not.toBeNull();
      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrefs: expect.objectContaining({
            confidence: 0.15,
            sample_size: 3,
          }),
        })
      );
    });
  });

  describe("Full Integration Flow", () => {
    it("complete flow: auth -> prefs -> cache -> score -> result", async () => {
      const userId = "integration-test-user";
      const userPrefs: UserSurfPreferences = {
        wave_min_ft: 3,
        wave_max_ft: 6,
        wave_period_min_s: 10,
        wave_period_max_s: 16,
        max_wind_mph: 12,
        preferred_wind_directions: [45, 90],
        preferred_tide_statuses: ["rising"],
        confidence: 0.8,
        sample_size: 12,
      };

      setupMocks({ user: { id: userId }, userPrefs });

      const { getUserSurfPreferences } = require("@/lib/services/preference-learning-service");

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      // Verify full flow executed correctly
      // 1. Auth was checked
      const { createSupabaseServerClient } = require("@/lib/supabase/server");
      expect(createSupabaseServerClient).toHaveBeenCalled();

      // 2. Preferences were fetched for the authenticated user
      expect(getUserSurfPreferences).toHaveBeenCalledWith(userId);

      // 3. Window selector was called with user preferences
      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          beach: mockBeach,
          userPrefs: userPrefs,
        })
      );

      // 4. Result was returned
      expect(result).not.toBeNull();
      expect(result?.report).toBeDefined();
      expect(result?.isTomorrow).toBe(false);
    });

    it("flow for anonymous user: no auth -> null prefs -> default scoring", async () => {
      setupMocks({ user: null });

      const { getUserSurfPreferences } = require("@/lib/services/preference-learning-service");

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      // Preferences should NOT be fetched for anonymous users
      expect(getUserSurfPreferences).not.toHaveBeenCalled();

      // Window selector should receive null userPrefs
      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrefs: null,
        })
      );

      // Result should still be returned (using default scoring)
      expect(result).not.toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid sequential calls for same user", async () => {
      setupMocks({ user: { id: "user-123" }, userPrefs: mockUserPrefs });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      // Simulate rapid calls (would hit cache in production)
      const results = await Promise.all([
        getSpotSurfReport(mockBeach),
        getSpotSurfReport(mockBeach),
        getSpotSurfReport(mockBeach),
      ]);

      // All should return valid results
      expect(results.every((r) => r !== null)).toBe(true);
    });

    it("handles user with empty preference arrays", async () => {
      const emptyArrayPrefs: UserSurfPreferences = {
        ...mockUserPrefs,
        preferred_wind_directions: [],
        preferred_tide_statuses: [],
      };

      setupMocks({ user: { id: "user-123" }, userPrefs: emptyArrayPrefs });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      expect(result).not.toBeNull();
      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrefs: expect.objectContaining({
            preferred_wind_directions: [],
            preferred_tide_statuses: [],
          }),
        })
      );
    });

    it("handles beach with missing coordinates", async () => {
      const beachNoCoords = {
        ...mockBeach,
        lat: null,
        lon: null,
      } as unknown as Beach;

      setupMocks({ user: { id: "user-123" }, userPrefs: mockUserPrefs });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(beachNoCoords);

      // Should use default timezone and still work
      expect(result).not.toBeNull();
    });
  });
});
