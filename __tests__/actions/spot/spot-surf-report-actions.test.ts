/**
 * @jest-environment node
 */

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { CalibrationVersion } from "@/lib/services/forecast/calibration-v5";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

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

jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: jest.fn(() => null),
}));

const mockEvaluateMajorEventHoldCandidates = jest.fn();
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) =>
    mockEvaluateMajorEventHoldCandidates(...args),
}));

jest.mock("@/lib/domains/scoring/discovery-adapter", () => {
  const actual = jest.requireActual("@/lib/domains/scoring/discovery-adapter");
  return {
    ...actual,
    calculatePreferenceAdjustment: jest.fn(() => ({ adjustment: 0, reason: null, warning: null })),
    checkSkillCeiling: jest.fn(actual.checkSkillCeiling),
    checkSkillFloor: jest.fn(actual.checkSkillFloor),
    checkBoardFit: jest.fn(actual.checkBoardFit),
  };
});

jest.mock("@/lib/domains/user-preferences", () => ({
  parseSkillLevel: jest.fn(() => null),
  getSkillLevelOrDefault: jest.fn((skillLevel: string | null | undefined) => skillLevel ?? "beginner"),
}));

const mockRideabilityBand = {
  ideal: { min: 2, max: 4 },
  acceptable: { min: 1, max: 5 },
  prefersClean: false,
  powerBias: 0.4,
};
const mockIntermediateShortboardRideabilityBand = {
  ideal: { min: 3, max: 5 },
  acceptable: { min: 2.5, max: 7 },
  prefersClean: false,
  powerBias: 0.6,
};
const mockAdvancedShortboardRideabilityBand = {
  ideal: { min: 4, max: 7 },
  acceptable: { min: 3, max: 9 },
  prefersClean: false,
  powerBias: 0.7,
};
const mockBeginnerShortboardRideabilityBand = {
  ideal: { min: 1, max: 3 },
  acceptable: { min: 0.5, max: 4 },
  prefersClean: false,
  powerBias: 0.4,
};
jest.mock("@/lib/domains/rideability", () => ({
  ...jest.requireActual("@/lib/domains/rideability"),
  getRideabilityBand: jest.fn((skillLevel: string, boardClass: string | null) =>
    boardClass === "shortboard"
      ? skillLevel === "beginner"
        ? mockBeginnerShortboardRideabilityBand
        : skillLevel === "advanced"
          ? mockAdvancedShortboardRideabilityBand
          : mockIntermediateShortboardRideabilityBand
      : mockRideabilityBand
  ),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

jest.mock("@/lib/services/forecast/calibration-v5", () => {
  const actual = jest.requireActual("@/lib/services/forecast/calibration-v5");
  return {
    ...actual,
    getActiveCalibration: jest.fn(),
  };
});

// Track call count for formatDateInTimezone to return different values
let formatDateCallCount = 0;
const mockCachedSurfReportCalls: unknown[][] = [];
const surfCallBoundarySequence: string[] = [];
let mockCachedSurfReportOverride: unknown;
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
  unstable_cache: jest.fn((fn: (...args: unknown[]) => unknown) => (
    ...args: unknown[]
  ) => {
    mockCachedSurfReportCalls.push(args);
    surfCallBoundarySequence.push("cache");
    if (mockCachedSurfReportOverride !== undefined) {
      return mockCachedSurfReportOverride;
    }
    return fn(...args);
  }),
}));

// Mock the window-selector to capture what parameters are passed
const mockSelectBestWindow = jest.fn();
jest.mock("@/lib/services/discovery/window-selector", () => ({
  selectBestWindow: (...args: any[]) => mockSelectBestWindow(...args),
}));

describe("spot-surf-report-actions", () => {
  const originalV51DisplayOverrideEnabled = process.env.V51_DISPLAY_OVERRIDE_ENABLED;
  const beachId = "11111111-1111-4111-8111-111111111111";

  const mockBeach = {
    id: beachId,
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
      beach_id: beachId,
      forecast_at: "2024-01-15T14:00Z",
      forecast_date: "2024-01-15",
      forecast_time: "14:00",
      wave_height: "4",
      wave_period: "12",
      confidence_score: 80,
    },
  ];

  const calibration: CalibrationVersion = {
    version: "v5_c.20260511_0630",
    knots: {
      "<0.5m": { om_anchor: 0.4, obs: 0.787, n: 1155 },
      "0.5-1.0m": { om_anchor: 0.803, obs: 0.803, n: 17999 },
      "1.0-1.5m": { om_anchor: 1.097, obs: 1.097, n: 8134 },
      "1.5m+": { om_anchor: 1.628, obs: 1.628, n: 2840 },
    },
    g_dir: {
      "S/SW": { g: -0.093, n: 6296 },
      W: { g: -0.097, n: 9475 },
      NW: { g: 0.231, n: 3670 },
      OTHER: { g: -0.01, n: 10687 },
    },
    guardrails: {
      passthrough_cells: [{ direction_bucket: "W", om_bucket: "0.5-1.0m" }],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    delete process.env.V51_DISPLAY_OVERRIDE_ENABLED;
    formatDateCallCount = 0;
    mockCachedSurfReportCalls.length = 0;
    surfCallBoundarySequence.length = 0;
    mockCachedSurfReportOverride = undefined;
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) => {
        surfCallBoundarySequence.push("evaluate");
        return candidates.map(({ candidateId }) => ({
          candidateId,
          evaluation: {
            outcome: "allow",
            holdIds: [],
            holdEpoch: "surf-call-test-epoch",
          },
          recommendationAvailability: {
            state: "available",
            holdEpoch: "surf-call-test-epoch",
          },
        }));
      },
    );
  });

  afterAll(() => {
    if (originalV51DisplayOverrideEnabled === undefined) {
      delete process.env.V51_DISPLAY_OVERRIDE_ENABLED;
      return;
    }
    process.env.V51_DISPLAY_OVERRIDE_ENABLED = originalV51DisplayOverrideEnabled;
  });

  describe("getSpotSurfReport", () => {
    async function setupBoardAwareScenario(options: {
      profileSkill?: string | null;
      waveHeight?: string;
      windowScore?: number;
      forecastRows?: Partial<EnhancedForecastEntity>[];
    } = {}): Promise<void> {
      const {
        profileSkill = "advanced",
        waveHeight = "2",
        windowScore = 80,
        forecastRows,
      } = options;
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getUserSurfPreferences } = await import("@/lib/services/preference-learning-service");
      const { getProfileExperienceLevel } = await import("@/lib/profile/skill-level");

      (getProfileExperienceLevel as jest.Mock).mockResolvedValue(profileSkill);
      (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-board-fit" } } }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: profileSkill ? { experience_level: profileSkill } : null,
                error: null,
              }),
            })),
          })),
        })),
      });
      (getUserSurfPreferences as jest.Mock).mockResolvedValue(null);

      (getBatchSunTimes as jest.Mock).mockResolvedValue(new Map([
        [
          beachId,
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]));

      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                lt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(async () => ({
                      data: forecastRows ?? [
                        {
                          ...mockForecasts[0],
                          wave_height: waveHeight,
                          wave_period: "12s",
                          wind_speed: "3 mph",
                          wind_direction: "E",
                          wind_direction_deg: 90,
                        },
                      ],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      mockSelectBestWindow.mockReturnValue({
        start: new Date("2024-01-15T22:00:00Z"),
        end: new Date("2024-01-16T00:00:00Z"),
        score: windowScore,
        waveHeight,
        wavePeriod: "12s",
        confidence: 80,
        peakTime: new Date("2024-01-15T23:00:00Z"),
      });
    }

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
          beachId,
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
        [beachId],
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

    it("keeps today's hourly rows when the best recommendation falls tomorrow", async () => {
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
          beachId,
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]);
      (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

      const todayAndTomorrowForecasts = [
        mockForecasts[0],
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
                      data: todayAndTomorrowForecasts,
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
      expect(result?.hourlyForecastDay).toBe("today");
      expect(result?.hourlyForecasts).toEqual([
        expect.objectContaining({ forecast_at: "2024-01-15T14:00Z" }),
      ]);
      expect(result?.hourlyForecasts).not.toEqual([
        expect.objectContaining({ forecast_at: "2024-01-16T14:00Z" }),
      ]);
    });

    it("keeps today's hourly rows when neither day has a viable window", async () => {
      await setupBoardAwareScenario();
      mockSelectBestWindow.mockReturnValue(null);
      const { getSpotSurfReportPublic } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      const result = await getSpotSurfReportPublic(mockBeach);

      expect(result?.isTomorrow).toBe(false);
      expect(result?.hourlyForecastDay).toBe("today");
      expect(result?.hourlyForecasts).toEqual([
        expect.objectContaining({ forecast_at: "2024-01-15T14:00Z" }),
      ]);
      expect(result?.report.recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: "no-positive-surf-call",
      });
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
          beachId,
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

    it("uses supplied auth context for native bearer-backed surf reports", async () => {
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getUserSurfPreferences } = await import("@/lib/services/preference-learning-service");
      const { getProfileExperienceLevel } = await import("@/lib/profile/skill-level");

      const mockUserId = "native-user-456";
      const profileQuery = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { experience_level: "intermediate" },
          error: null,
        }),
      };
      profileQuery.select.mockReturnValue(profileQuery);
      profileQuery.eq.mockReturnValue(profileQuery);

      const suppliedSupabase = {
        from: jest.fn((table: string) => {
          if (table === "profiles") return profileQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;
      const suppliedUser = { id: mockUserId } as User;
      const mockUserPrefs = {
        wave_min_ft: 2,
        wave_max_ft: 5,
        wave_period_min_s: 9,
        wave_period_max_s: 16,
        max_wind_mph: 12,
        preferred_wind_directions: [270],
        preferred_tide_statuses: ["rising"],
        confidence: 0.74,
        sample_size: 8,
      };

      (createSupabaseServerClient as jest.Mock).mockImplementation(() => {
        throw new Error("createSupabaseServerClient should not be called");
      });
      (getUserSurfPreferences as jest.Mock).mockResolvedValue(mockUserPrefs);
      (getProfileExperienceLevel as jest.Mock).mockResolvedValue("intermediate");
      (getBatchSunTimes as jest.Mock).mockResolvedValue(new Map([
        [
          beachId,
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]));
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
      mockSelectBestWindow.mockReturnValue({
        start: new Date("2024-01-15T22:00:00Z"),
        end: new Date("2024-01-16T00:00:00Z"),
        score: 80,
        waveHeight: "4",
        confidence: 80,
        peakTime: new Date("2024-01-15T23:00:00Z"),
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach, "longboard", {
        user: suppliedUser,
        supabase: suppliedSupabase,
      });

      expect(createSupabaseServerClient).not.toHaveBeenCalled();
      expect(getUserSurfPreferences).toHaveBeenCalledWith(mockUserId);
      expect(getProfileExperienceLevel).toHaveBeenCalledWith(suppliedSupabase, mockUserId);
      expect(mockCachedSurfReportCalls[0]?.[2]).toBe(mockUserId);
      expect(mockCachedSurfReportCalls[0]?.[4]).toBe("longboard");
    });

    it("evaluates the exact best window after the physical cache with verified profile experience", async () => {
      await setupBoardAwareScenario({ profileSkill: "advanced" });
      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      const result = await getSpotSurfReport(mockBeach, "shortboard");

      expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
        candidates: [
          {
            candidateId:
              `surf-call:${beachId}:2024-01-15T22:00:00.000Z:2024-01-16T00:00:00.000Z`,
            beachId,
            startsAt: "2024-01-15T22:00:00.000Z",
            endsAt: "2024-01-16T00:00:00.000Z",
          },
        ],
        profileExperience: "advanced",
      });
      expect(surfCallBoundarySequence).toEqual(["cache", "evaluate"]);
      expect(result?.report.recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: "surf-call-test-epoch",
      });
    });

    it("preserves a natural NO without treating its missing window as unavailable hold state", async () => {
      const naturalNoReport: SurfCallResult = {
        verdict: "NO",
        bestWindowStart: null,
        bestWindowEnd: null,
        windowMinutes: null,
        shortWindow: false,
        waveHeight: "1 ft",
        windDescription: "light onshore",
        windSpeed: "5 mph",
        windCompass: "W",
        windType: "onshore",
        tideDescription: "falling",
        tidePhase: "Falling",
        tideHeight: "2.1 ft",
        nextTideType: "Low",
        nextTideAt: "2024-01-16T23:00:00.000Z",
        whySentence: "No viable surf window today.",
        forecastConfidence: 80,
        lowForecastConfidence: false,
        score: 0,
        peakTime: null,
        trendTags: [],
        updatedAt: "2024-01-16T18:00:00.000Z",
        isCalibrated: true,
        rideableWavesPerHour: 2,
        dominantBeatIntervalS: 12,
        character: null,
        cautions: [],
        tiers: {
          beginner: {
            verdict: "NO",
            trail: "WAIT FOR SWELL",
            bestWindowStart: null,
            bestWindowEnd: null,
          },
          intermediate: {
            verdict: "NO",
            trail: "WAIT FOR SWELL",
            bestWindowStart: null,
            bestWindowEnd: null,
          },
          advanced: {
            verdict: "NO",
            trail: "TOO SMALL",
            bestWindowStart: null,
            bestWindowEnd: null,
          },
        },
        userTier: "intermediate",
        skillSource: "profile",
      };
      const forecastContext: ForecastRecommendationContext = {
        beachId,
        localDate: "2024-01-16",
        recommendationType: "marginal",
        contextType: "marginal",
        startTime: null,
        endTime: null,
        selectedWindowStart: null,
        selectedWindowEnd: null,
        displayTimeLabel: "Tomorrow",
        selectedRowTime: "2024-01-16T22:00:00.000Z",
        waveHeight: "1 ft",
        waveHeightFt: 1,
        waveHeightRangeLabel: "0-1 ft",
        swellPeriod: "12s",
        periodSec: 12,
        swellDirection: "W",
        windSpeed: "5 mph",
        windDirection: "W",
        score: null,
        confidence: 80,
        resolverUsed: "surf-call",
        source: "looking_ahead",
        timezone: "America/Los_Angeles",
      };
      mockCachedSurfReportOverride = {
        report: naturalNoReport,
        isTomorrow: true,
        forecastContext,
      };
      const { getSpotSurfReportPublic } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      const result = await getSpotSurfReportPublic(mockBeach);

      expect(mockEvaluateMajorEventHoldCandidates).not.toHaveBeenCalled();
      expect(result).toEqual({
        report: {
          ...naturalNoReport,
          recommendationAvailability: {
            state: "available",
            holdEpoch: "no-positive-surf-call",
          },
        },
        isTomorrow: true,
        forecastContext,
      });
    });

    it.each([
      ["positive verdict", "YES", null, null],
      [
        "partial window binding",
        "NO",
        "2024-01-16T19:00:00.000Z",
        null,
      ],
    ] as const)(
      "fails a %s without an exact window closed",
      async (_label, verdict, bestWindowStart, bestWindowEnd) => {
        const positiveUnboundReport: SurfCallResult = {
          verdict,
          bestWindowStart,
          bestWindowEnd,
          windowMinutes: 120,
          shortWindow: false,
          waveHeight: "4 ft",
          windDescription: "light offshore",
          windSpeed: "4 mph",
          windCompass: "E",
          windType: "offshore",
          tideDescription: "rising",
          tidePhase: "Rising",
          tideHeight: "2.4 ft",
          nextTideType: "High",
          nextTideAt: "2024-01-16T23:00:00.000Z",
          whySentence: "Paddle out during the clean window.",
          forecastConfidence: 90,
          lowForecastConfidence: false,
          score: 90,
          peakTime: "2024-01-16T20:00:00.000Z",
          trendTags: ["Clean Swell"],
          updatedAt: "2024-01-16T18:00:00.000Z",
          isCalibrated: true,
          rideableWavesPerHour: 8,
          dominantBeatIntervalS: 12,
          character: { label: "Clean", category: "medium-clean" },
          cautions: [],
          tiers: null,
          userTier: null,
          skillSource: null,
        };
        mockCachedSurfReportOverride = {
          report: positiveUnboundReport,
          isTomorrow: false,
          forecastContext: null,
        };
        const { getSpotSurfReportPublic } = await import(
          "@/actions/spot/spot-surf-report-actions"
        );

        const result = await getSpotSurfReportPublic(mockBeach);

        expect(result?.report).toMatchObject({
          verdict: "NO",
          bestWindowStart: null,
          bestWindowEnd: null,
          score: 0,
          whySentence: "",
          recommendationAvailability: {
            state: "none",
            reasonCode: "hold_state_unavailable",
          },
        });
      },
    );

    it("fails malformed hold decisions closed while preserving physical surf fields", async () => {
      await setupBoardAwareScenario({ profileSkill: "intermediate" });
      mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([]);
      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      const result = await getSpotSurfReport(mockBeach);

      expect(result?.report.verdict).toBe("NO");
      expect(result?.report.bestWindowStart).toBeNull();
      expect(result?.report.bestWindowEnd).toBeNull();
      expect(result?.report.waveHeight).toBe("2");
      expect(result?.forecastContext).toBeNull();
      expect(result?.report.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
    });

    it("uses null hold experience and tier for public surf calls", async () => {
      await setupBoardAwareScenario({ profileSkill: "advanced" });
      const { getSpotSurfReportPublic } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );

      const result = await getSpotSurfReportPublic(mockBeach);

      expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ profileExperience: null }),
      );
      expect(result?.report.userTier).toBeNull();
      expect(result?.report.tiers).toBeNull();
      expect(result?.hourlyForecasts).toEqual([
        expect.objectContaining({
          forecast_at: "2024-01-15T14:00Z",
          wave_height: "2",
          wind_speed: "3 mph",
          wind_direction: "E",
        }),
      ]);
      expect(result?.hourlyForecastDay).toBe("today");
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
          beachId,
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
      const result = await getSpotSurfReport(mockBeach);

      // Verify getUserSurfPreferences was NOT called for anonymous users
      expect(getUserSurfPreferences).not.toHaveBeenCalled();

      // Verify selectBestWindow was called with null userPrefs
      expect(mockSelectBestWindow).toHaveBeenCalled();
      const callArgs = mockSelectBestWindow.mock.calls[0][0];
      expect(callArgs.userPrefs).toBeNull();
      expect(result?.report.userTier).toBeNull();
      expect(result?.report.skillSource).toBeNull();
    });

    it("keeps absent boardClass behavior unchanged", async () => {
      await setupBoardAwareScenario();

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      expect(result?.report.score).toBe(74);
      expect(result?.report.whySentence).not.toContain("Board fit:");
    });

    it("scores a clean 2 ft-ish day higher for longboard with a sweet-spot note", async () => {
      await setupBoardAwareScenario();

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const noBoard = await getSpotSurfReport(mockBeach);
      const longboard = await getSpotSurfReport(mockBeach, "longboard");

      expect(longboard?.report.score).toBeGreaterThan(noBoard?.report.score ?? 0);
      expect(longboard?.report.whySentence).toContain(
        "Board fit: in the sweet spot for your longboard."
      );
    });

    it("scores the same 2 ft-ish day lower for shortboard with a too-small note", async () => {
      await setupBoardAwareScenario();

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const noBoard = await getSpotSurfReport(mockBeach);
      const shortboard = await getSpotSurfReport(mockBeach, "shortboard");

      expect(shortboard?.report.score).toBeLessThan(noBoard?.report.score ?? 0);
      expect(shortboard?.report.whySentence).toContain(
        "Board fit: too small for your shortboard."
      );
    });

    it("uses the shortboard-implied intermediate prior when profile skill is missing", async () => {
      await setupBoardAwareScenario({
        profileSkill: null,
        waveHeight: "4.5",
        windowScore: 70,
      });
      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach, "shortboard");
      const { checkBoardFit, checkSkillCeiling, checkSkillFloor } =
        jest.requireMock("@/lib/domains/scoring/discovery-adapter");
      const { getRideabilityBand } = jest.requireMock("@/lib/domains/rideability");

      expect(getRideabilityBand).toHaveBeenCalledWith("intermediate", "shortboard");
      expect(checkSkillCeiling).toHaveBeenCalledWith(4.5, "intermediate");
      expect(checkSkillFloor).toHaveBeenCalledWith(4.5, "intermediate");
      expect(checkBoardFit).toHaveBeenCalledWith(4.5, "intermediate", "shortboard");
      expect(result?.report.userTier).toBeNull();
      expect(result?.report.tiers).toBeNull();
      expect(result?.report.skillSource).toBe("board_prior");
      expect(result?.report.score).toBeGreaterThan(70);
      expect(result?.report.whySentence).toContain(
        "Board fit: in the sweet spot for your shortboard."
      );
    });

    it("keeps profile skill ahead of the board-implied prior when boardClass is present", async () => {
      await setupBoardAwareScenario({
        profileSkill: "advanced",
        waveHeight: "4.5",
        windowScore: 70,
      });
      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach, "shortboard");
      const { checkBoardFit, checkSkillCeiling, checkSkillFloor } =
        jest.requireMock("@/lib/domains/scoring/discovery-adapter");
      const { getRideabilityBand } = jest.requireMock("@/lib/domains/rideability");

      expect(getRideabilityBand).toHaveBeenCalledWith("advanced", "shortboard");
      expect(checkSkillCeiling).toHaveBeenCalledWith(4.5, "advanced");
      expect(checkSkillFloor).toHaveBeenCalledWith(4.5, "advanced");
      expect(checkBoardFit).toHaveBeenCalledWith(4.5, "advanced", "shortboard");
      expect(result?.report.userTier).toBe("advanced");
      expect(result?.report.skillSource).toBe("profile");
    });

    it("uses the intermediate default for logged-in users missing both profile skill and board", async () => {
      await setupBoardAwareScenario({
        profileSkill: null,
        waveHeight: "1.5",
        windowScore: 80,
      });
      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);
      const { checkSkillFloor } =
        jest.requireMock("@/lib/domains/scoring/discovery-adapter");

      expect(checkSkillFloor).toHaveBeenCalledWith(1.5, "intermediate");
      expect(result?.report.userTier).toBeNull();
      expect(result?.report.tiers).toBeNull();
      expect(result?.report.skillSource).toBe("default");
      expect(result?.report.score).toBeLessThan(80);
    });

    it("passes boardClass as a distinct cached argument", async () => {
      await setupBoardAwareScenario();

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach, "longboard");
      await getSpotSurfReport(mockBeach, "shortboard");

      expect(mockCachedSurfReportCalls.map((args) => args[4])).toEqual([
        "longboard",
        "shortboard",
      ]);
    });

    it("passes a rideability band to window selection when boardClass is present", async () => {
      await setupBoardAwareScenario();

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach, "longboard");

      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          rideabilityBand: mockRideabilityBand,
        })
      );
    });

    it("passes null rideability band to window selection when boardClass is absent", async () => {
      await setupBoardAwareScenario();

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      await getSpotSurfReport(mockBeach);

      expect(mockSelectBestWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          rideabilityBand: null,
        })
      );
    });

    it("keeps forecastContext on raw heights while the v5.1 display rollout is disabled", async () => {
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getActiveCalibration } = await import("@/lib/services/forecast/calibration-v5");

      (getActiveCalibration as jest.Mock).mockResolvedValue(calibration);
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

      const mockSunTimesCache = new Map([
        [
          beachId,
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]);
      (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

      const pbPointForecasts: Partial<EnhancedForecastEntity>[] = [
        {
          ...mockForecasts[0],
          wave_height: "2 ft",
          wave_height_om: 1.22,
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
                      data: pbPointForecasts,
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      mockSelectBestWindow.mockImplementation(({ forecasts }) => {
        const sourceForecast = forecasts[0];
        return {
          start: new Date("2024-01-15T22:00:00Z"),
          end: new Date("2024-01-16T00:00:00Z"),
          score: 82,
          waveHeight: sourceForecast.wave_height,
          wavePeriod: sourceForecast.swell_1_period,
          peakTime: new Date(sourceForecast.forecast_at),
          sourceForecast,
        };
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);

      expect(mockSelectBestWindow).toHaveBeenCalled();
      expect(mockSelectBestWindow.mock.calls[0][0].forecasts[0].wave_height).toBe("2 ft");
      expect(result?.report.recommendationAvailability.state).toBe("available");
      expect(result?.forecastContext?.waveHeight).toBe("2 ft");
      expect(result?.forecastContext?.waveHeightRangeLabel).toBe("1-2 ft");
    });

    // ------------------------------------------------------------------------
    // Verdict translator integration — PR 3
    //
    // The verdict comes from the discovery engine's recommendationLabel
    // mapping (via `verdictFromRecommendationLabel`). These tests pin the
    // boundaries (>=70 'Worth it' → 'YES', >=40 'Maybe' → 'MAYBE',
    // <40 'Skip' → 'NO') so a future engine retune doesn't silently
    // shift the native verdict.
    // ------------------------------------------------------------------------

    async function runWithWindowScore(score: number): Promise<{ verdict: string | undefined }> {
      const { createSupabaseServerClient, createSupabaseServiceRoleClient } = await import(
        "@/lib/supabase/server"
      );
      const { getBatchSunTimes } = await import("@/lib/services/discovery");
      const { getUserSurfPreferences } = await import("@/lib/services/preference-learning-service");

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

      const mockSunTimesCache = new Map([
        [
          beachId,
          {
            sunrises: [new Date("2024-01-15T14:47:00Z")],
            sunsets: [new Date("2024-01-16T01:00:00Z")],
          },
        ],
      ]);
      (getBatchSunTimes as jest.Mock).mockResolvedValue(mockSunTimesCache);

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

      // Window must be long enough to clear the MINIMUM_VIABLE_WINDOW_MINUTES
      // and SHORT_WINDOW_THRESHOLD_MINUTES gates so verdict isn't downgraded
      // by window-duration heuristics.
      mockSelectBestWindow.mockReturnValue({
        start: new Date("2024-01-15T22:00:00Z"),
        end: new Date("2024-01-16T00:00:00Z"), // 2 hours
        score,
        waveHeight: "4",
        confidence: 80,
        peakTime: new Date("2024-01-15T23:00:00Z"),
      });

      const { getSpotSurfReport } = await import(
        "@/actions/spot/spot-surf-report-actions"
      );
      const result = await getSpotSurfReport(mockBeach);
      return { verdict: result?.report.verdict };
    }

    it("verdict mapping: 'Worth it' (score >= 70) → 'YES'", async () => {
      const { verdict } = await runWithWindowScore(85);
      expect(verdict).toBe('YES');
    });

    it("verdict mapping: 'Maybe' (40 <= score < 70) → 'MAYBE'", async () => {
      const { verdict } = await runWithWindowScore(55);
      expect(verdict).toBe('MAYBE');
    });

    it("verdict mapping: 'Skip' (score < 40) → 'NO'", async () => {
      const { verdict } = await runWithWindowScore(20);
      expect(verdict).toBe('NO');
    });
  });
});
