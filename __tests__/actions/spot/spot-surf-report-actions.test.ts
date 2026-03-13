/**
 * @jest-environment node
 */

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

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

jest.mock("@/lib/domains/scoring/discovery-adapter", () => ({
  calculatePreferenceAdjustment: jest.fn(() => ({ adjustment: 0, reason: null, warning: null })),
  checkSkillCeiling: jest.fn(() => ({ penalty: 0, warning: null })),
}));

jest.mock("@/lib/domains/user-preferences", () => ({
  parseSkillLevel: jest.fn(() => null),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

// Track call count for formatDateInTimezone to return different values
let formatDateCallCount = 0;
jest.mock("@/lib/utils/date-time", () => ({
  formatDateInTimezone: jest.fn((date: Date) => {
    // First call is for "today", second call is for "tomorrow"
    formatDateCallCount++;
    if (formatDateCallCount % 2 === 1) {
      return "2024-01-15"; // today
    }
    return "2024-01-16"; // tomorrow
  }),
}));

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn) => fn),
}));

// Mock the window-selector to capture what parameters are passed
const mockSelectBestWindow = jest.fn();
jest.mock("@/lib/services/discovery/window-selector", () => ({
  selectBestWindow: (...args: any[]) => mockSelectBestWindow(...args),
}));

describe("spot-surf-report-actions", () => {
  const mockBeach = {
    id: "beach-123",
    slug: "test-beach",
    name: "Test Beach",
    lat: 33.8,
    lon: -118.4,
    state: "California",
    city: "Los Angeles",
    description: "A test beach",
  } as unknown as Beach;

  const mockForecasts: Partial<EnhancedForecastEntity>[] = [
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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    formatDateCallCount = 0;
  });

  describe("getSpotSurfReport", () => {
    it("fetches sun times and passes them to selectBestWindow", async () => {
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getUserSurfPreferences } = await import("@/lib/services/preference-learning-service");

      // Setup mock auth - anonymous user
      (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      });
      (getUserSurfPreferences as jest.Mock).mockResolvedValue(null);

      // Setup mock sun times cache
      const mockSunTimesCache = new Map([
        [
          "beach-123",
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")], // 5pm PST
          },
        ],
      ]);
      (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

      // Setup mock Supabase response (for service role client - database queries)
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({
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
      });

      // Setup mock selectBestWindow to return a valid window
      mockSelectBestWindow.mockReturnValue({
        start: new Date("2024-01-15T22:00:00Z"),
        end: new Date("2024-01-16T01:00:00Z"), // Capped at sunset
        score: 80,
        waveHeight: "4",
        peakTime: new Date("2024-01-15T23:00:00Z"),
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach);

      // Verify getBatchSunTimes was called with correct parameters
      expect(getBatchSunTimes).toHaveBeenCalledWith(
        ["beach-123"],
        expect.arrayContaining(["2024-01-15"])
      );

      // Verify selectBestWindow was called with sunTimesCache
      expect(mockSelectBestWindow).toHaveBeenCalled();
      const callArgs = mockSelectBestWindow.mock.calls[0][0];
      expect(callArgs.sunTimesCache).toBe(mockSunTimesCache);
    });

    it("returns null when beach has no id", async () => {
      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      const beachWithoutId = { ...mockBeach, id: undefined } as unknown as Beach;
      const result = await getSpotSurfReport(beachWithoutId);

      expect(result).toBeNull();
    });

    it("returns isTomorrow: true when falling back to tomorrow forecast", async () => {
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getUserSurfPreferences } = await import("@/lib/services/preference-learning-service");

      // Setup mock auth - anonymous user
      (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      });
      (getUserSurfPreferences as jest.Mock).mockResolvedValue(null);

      // Setup mock sun times cache
      const mockSunTimesCache = new Map([
        [
          "beach-123",
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]);
      (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

      // Setup mock Supabase response with only tomorrow's forecasts
      const tomorrowForecasts = [
        {
          ...mockForecasts[0],
          forecast_at: "2024-01-16T14:00Z",
          forecast_date: "2024-01-16",
        },
      ];
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(async () => ({
                      data: tomorrowForecasts,
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      // First call (today) returns null, second call (tomorrow) returns window
      mockSelectBestWindow
        .mockReturnValueOnce(null) // No window for today
        .mockReturnValueOnce({
          // Window for tomorrow
          start: new Date("2024-01-16T18:00:00Z"),
          end: new Date("2024-01-16T21:00:00Z"),
          score: 75,
        });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      expect(result?.isTomorrow).toBe(true);
    });

    it("passes user preferences to selectBestWindow when user is logged in", async () => {
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getUserSurfPreferences } = await import("@/lib/services/preference-learning-service");

      // Setup mock auth - logged in user
      const mockUserId = "user-123";
      (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: mockUserId } } }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      });

      // Setup mock user preferences (user prefers 3-6 ft waves)
      const mockUserPrefs = {
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
      (getUserSurfPreferences as jest.Mock).mockResolvedValue(mockUserPrefs);

      // Setup mock sun times cache
      const mockSunTimesCache = new Map([
        [
          "beach-123",
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]);
      (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

      // Setup mock Supabase response (for service role client - database queries)
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({
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
      });

      // Setup mock selectBestWindow to return a valid window
      mockSelectBestWindow.mockReturnValue({
        start: new Date("2024-01-15T22:00:00Z"),
        end: new Date("2024-01-16T01:00:00Z"),
        score: 80,
        waveHeight: "4",
        peakTime: new Date("2024-01-15T23:00:00Z"),
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach);

      // Verify getUserSurfPreferences was called with the user's ID
      expect(getUserSurfPreferences).toHaveBeenCalledWith(mockUserId);

      // Verify selectBestWindow was called with the user's preferences
      expect(mockSelectBestWindow).toHaveBeenCalled();
      const callArgs = mockSelectBestWindow.mock.calls[0][0];
      expect(callArgs.userPrefs).toEqual(mockUserPrefs);
    });

    it("passes null userPrefs for anonymous users", async () => {
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getUserSurfPreferences } = await import("@/lib/services/preference-learning-service");

      // Setup mock auth - anonymous user
      (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      });

      // Setup mock sun times cache
      const mockSunTimesCache = new Map([
        [
          "beach-123",
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]);
      (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

      // Setup mock Supabase response (for service role client - database queries)
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({
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
      });

      // Setup mock selectBestWindow to return a valid window
      mockSelectBestWindow.mockReturnValue({
        start: new Date("2024-01-15T22:00:00Z"),
        end: new Date("2024-01-16T01:00:00Z"),
        score: 80,
        waveHeight: "4",
        peakTime: new Date("2024-01-15T23:00:00Z"),
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach);

      // Verify getUserSurfPreferences was NOT called for anonymous users
      expect(getUserSurfPreferences).not.toHaveBeenCalled();

      // Verify selectBestWindow was called with null userPrefs
      expect(mockSelectBestWindow).toHaveBeenCalled();
      const callArgs = mockSelectBestWindow.mock.calls[0][0];
      expect(callArgs.userPrefs).toBeNull();
    });
  });
});
