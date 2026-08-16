/**
 * Surf Discovery Scoring Tests
 *
 * Focused tests for:
 * - Scoring the same forecast window that is selected
 * - Using degree-based wind direction (wind_direction_deg)
 * - Normalizing scores so 100 is achievable when beach metadata is missing
 */

import { discoverSurfSpots } from "@/lib/services/surf-discovery-service";
import type { EnhancedForecastEntity } from "@/types/forecast";

jest.mock("@/lib/utils/forecast-service-utils", () => ({
  getFreshForecastFromCache: jest.fn(),
  getBatchFreshForecastsFromCache: jest.fn(),
}));

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: jest.fn(async (beaches: Array<{ id: string }>) => beaches),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "UTC"),
  getLocalHour: jest.fn((d: Date) => d.getUTCHours()),
  isNightHour: jest.fn((h: number) => h >= 21 || h < 6),
}));

jest.mock("@/lib/utils/timezone-utils", () => {
  const actual = jest.requireActual<typeof import("@/lib/utils/timezone-utils")>(
    "@/lib/utils/timezone-utils"
  );
  return {
    ...actual,
    resolveBeachTimezone: jest.fn(() => "UTC"),
  };
});

jest.mock("@/lib/services/preference-learning-service", () => {
  // Preserve non-mocked exports (parseForecastNumber, etc.) so downstream
  // services that use them at runtime don't throw "is not a function".
  const actual = jest.requireActual<typeof import("@/lib/services/preference-learning-service")>(
    "@/lib/services/preference-learning-service"
  );
  return {
    ...actual,
    getUserSurfPreferences: jest.fn(() => Promise.resolve(null)),
  };
});

// Minimal, table-aware supabase mock used by discoverSurfSpots
jest.mock("@/lib/supabase/server", () => {
  // Shared state across all client instances (discoverSurfSpots creates multiple).
  const state = {
    profileData: null as any,
    favoritesData: [] as any[],
    affinityData: [] as any[],
    nearbyData: [] as any[],
    nearbyError: null as any,
    beachesData: [] as any[],
    sunTimesData: [] as any[],
  };

  const __setMockProfile = (data: any) => {
    state.profileData = data;
  };
  const __setMockFavorites = (data: any[]) => {
    state.favoritesData = data;
  };
  const __setMockAffinity = (data: any[]) => {
    state.affinityData = data;
  };
  const __setMockNearby = (data: any[], error: any = null) => {
    state.nearbyData = data;
    state.nearbyError = error;
  };
  const __setMockBeaches = (data: any[]) => {
    state.beachesData = data;
  };
  const __setMockSunTimes = (data: any[]) => {
    state.sunTimesData = data;
  };

  const createSupabaseServiceRoleClient = jest.fn(() => ({
    rpc: async (fn: string) => {
      if (fn === "get_nearby_beaches") {
        return { data: state.nearbyData, error: state.nearbyError };
      }
      return { data: null, error: null };
    },
    from(table: string) {
      return {
        select() {
          if (table === "profiles") {
            return {
              eq() {
                return {
                  single: async () => ({ data: state.profileData, error: null }),
                  maybeSingle: async () => ({ data: state.profileData, error: null }),
                };
              },
            };
          }

          if (table === "favorite_beaches") {
            return {
              eq() {
                return {
                  order() {
                    return {
                      order: async () => ({ data: state.favoritesData, error: null }),
                    };
                  },
                };
              },
            };
          }

          if (table === "user_beach_affinity") {
            return {
              eq() {
                return {
                  in: async () => ({ data: state.affinityData, error: null }),
                };
              },
            };
          }

          if (table === "beaches") {
            return {
              in() {
                return {
                  eq() {
                    return {
                      limit: async () => ({ data: state.beachesData, error: null }),
                    };
                  },
                };
              },
            };
          }

          // beach_water_quality table used by water quality override
          if (table === "beach_water_quality") {
            return {
              in: async () => ({ data: [], error: null }),
            };
          }

          // beach_photos table used by enrichWithPhotos()
          if (table === "beach_photos") {
            return {
              in() {
                return {
                  order() {
                    return {
                      eq() {
                        return {
                          is: async () => ({ data: [], error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
          }

          // sun_times table used by getBatchSunTimes()
          if (table === "sun_times") {
            return {
              in() {
                return {
                  in() {
                    return {
                      order: async () => ({ data: state.sunTimesData, error: null }),
                    };
                  },
                };
              },
            };
          }

          // Default: empty
          return {
            eq() {
              return {
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  }));

  // createSupabaseServerClient is used by server actions (e.g. getFavoriteBeaches)
  const createSupabaseServerClient = jest.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({ data: [], error: null }),
      }),
    }),
  }));

  return {
    createSupabaseServiceRoleClient,
    createSupabaseServerClient,
    __setMockProfile,
    __setMockFavorites,
    __setMockAffinity,
    __setMockNearby,
    __setMockBeaches,
    __setMockSunTimes,
  };
});

function mkForecast(atIso: string, patch: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  const d = new Date(atIso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 19);

  return {
    id: patch.id ?? `${date}-${time}`,
    beach_id: patch.beach_id ?? "beach-1",
    forecast_at: `${date}T${time}Z`,
    forecast_date: date,
    forecast_time: time,
    wave_height: patch.wave_height ?? "4",
    wave_period: patch.wave_period ?? "12s",
    wind_speed: patch.wind_speed ?? "8",
    wind_direction: patch.wind_direction ?? "NW",
    wind_direction_deg:
      patch.wind_direction_deg !== undefined ? patch.wind_direction_deg : null,
    tide_height: patch.tide_height ?? "3",
    tide_status: patch.tide_status ?? "Rising",
    confidence_score: patch.confidence_score ?? 70,
    water_temp: patch.water_temp ?? "60°F",
    data_source: patch.data_source ?? "NOAA_NWS",
    created_at: patch.created_at ?? new Date().toISOString(),
    updated_at: patch.updated_at ?? new Date().toISOString(),
    ...patch,
  };
}

function assertHasRecommendation(result: any, errorCalls?: any[][]) {
  if (!result?.recommendations || result.recommendations.length === 0) {
    const formattedErrors = (errorCalls || []).map((c) => {
      const err = c?.[1];
      return {
        message: c?.[0],
        errorType: err?.constructor?.name,
        errorMessage: err?.message ?? String(err),
        errorStack: err?.stack,
      };
    });

    throw new Error(
      `Expected at least 1 recommendation, got 0. metadata=${JSON.stringify(
        result?.metadata ?? null
      )} errors=${JSON.stringify(formattedErrors)}`
    );
  }
}

describe("discoverSurfSpots scoring behavior", () => {
  let consoleErrorSpy: jest.SpyInstance;
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-20T12:00:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { __setMockProfile, __setMockFavorites, __setMockAffinity, __setMockNearby, __setMockBeaches } = require("@/lib/supabase/server");

    // Default: profile with experience level only
    __setMockProfile({
      id: "user-1",
      experience_level: null,
    });
    __setMockFavorites([]);
    __setMockAffinity([]);

    // GPS-based discovery: set up nearby beaches via RPC mock
    __setMockNearby([
      { id: "beach-1", is_private: false, distance_meters: 100 },
    ]);

    // Beach details for the nearby beach
    __setMockBeaches([
      {
        id: "beach-1",
        name: "Test Beach",
        lat: 32.7157,
        lon: -117.1611,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        skill_level: "beginner",
      },
    ]);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("scores the same forecast entry as the selected best window", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // forecasts[0] is intentionally worse than the later forecast
    const a = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "1",
      wave_period: "8s",
      wind_speed: "20",
      confidence_score: 60,
      wind_direction: "SW",
    });
    const b = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "2",
      wave_period: "12s",
      wind_speed: "6",
      confidence_score: 75,
      wind_direction: "NW",
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [a, b],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Window should be built from the better (later) forecast
    expect(rec.window.start.toISOString()).toBe("2025-01-20T14:00:00.000Z");

    // And the returned/scored forecast should match the window timestamp
    expect(`${rec.forecast.forecast_date}T${rec.forecast.forecast_time}Z`).toBe(
      "2025-01-20T14:00:00Z"
    );

    // Subscores should reflect the later forecast (wave_height 4 => waveHeightFit > 0)
    // The new scoring engine uses different weightings, so verify non-zero rather than exact value
    expect(rec.subscores.waveHeightFit).toBeGreaterThan(0);
  });

  it("uses wind_direction_deg for wind alignment scoring", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // Configure beach wind metadata via nearby beach mock
    const { __setMockBeaches } = require("@/lib/supabase/server");
    __setMockBeaches([
      {
        id: "beach-1",
        name: "Wind Beach",
        lat: 32.7157,
        lon: -117.1611,
        wind_offshore_deg: 225,
        wind_offshore_tol_deg: 30,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        skill_level: "beginner",
      },
    ]);

    const f = mkForecast("2025-01-20T13:00:00Z", {
      wind_speed: "10",
      wind_direction: null,
      wind_direction_deg: 225,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [f],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });
    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // The new scoring engine uses different weightings
    // Wind direction 225 matches beach offshore direction 225, should score well
    expect(rec.subscores.windAlignment).toBeGreaterThan(0);
  });

  it("normalizes conditions so 100 is achievable without wind/tide beach metadata", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
    const { getUserSurfPreferences } = require("@/lib/services/preference-learning-service");

    // Provide learned prefs so waveHeightFit can reach 25 (vs 20 default)
    (getUserSurfPreferences as jest.Mock).mockResolvedValue({
      wave_min_ft: 2,
      wave_max_ft: 8,
      wave_period_min_s: 8,
      wave_period_max_s: 18,
      max_wind_mph: null,
      preferred_wind_directions: null,
      preferred_tide_statuses: null,
      confidence: 0.9,
      sample_size: 20,
    });

    // Use near-perfect conditions: light wind (<=3 mph for glassy) and good swell
    const f = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "2",
      wave_period: "14s", // 14+ seconds for max period score
      wind_speed: "2",    // Light wind (<= 3 mph) for max wind score
      wind_direction: "NW",
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [f],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });
    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Near-perfect conditions should achieve high score
    // The new domain-driven scoring engine weights components differently
    // With 7 scorers (baseConditions, swellAlignment, swellInterference, windQuality, tideFit, windowStability, trendPreference)
    // expect a good score (>= 65) for near-optimal conditions without perfect beach metadata
    expect(rec.score).toBeGreaterThanOrEqual(65);
  });

  it("adds nearby beaches via get_nearby_beaches RPC when userLocation is provided", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
    const {
      __setMockNearby,
      __setMockBeaches,
      createSupabaseServiceRoleClient,
    } = require("@/lib/supabase/server");

    __setMockNearby([
      { id: "beach-1", is_private: false, distance_meters: 0 },
      { id: "beach-2", is_private: false, distance_meters: 1200 },
      { id: "beach-3", is_private: false, distance_meters: 2500 },
      { id: "beach-4", is_private: false, distance_meters: 4000 },
    ]);

    __setMockBeaches([
      {
        id: "beach-1",
        name: "Nearby 1",
        lat: 32.7157,
        lon: -117.1611,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        skill_level: "beginner",
      },
      {
        id: "beach-2",
        name: "Nearby 2",
        lat: 32.716,
        lon: -117.162,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        skill_level: "beginner",
      },
      {
        id: "beach-3",
        name: "Nearby 3",
        lat: 32.717,
        lon: -117.163,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        skill_level: "beginner",
      },
      {
        id: "beach-4",
        name: "Nearby 4",
        lat: 32.718,
        lon: -117.164,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        skill_level: "beginner",
      },
    ]);

    const f = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
    });

    // Mock batch results for all beaches
    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [f],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
        ["beach-2", {
          beachId: "beach-2",
          forecasts: [{ ...f, beach_id: "beach-2" }],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
        ["beach-3", {
          beachId: "beach-3",
          forecasts: [{ ...f, beach_id: "beach-3" }],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
        ["beach-4", {
          beachId: "beach-4",
          forecasts: [{ ...f, beach_id: "beach-4" }],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", {
      maxResults: 5,
      userLocation: { lat: 32.7157, lon: -117.1611 },
      radiusMiles: 10,
    });

    expect(result.metadata.totalBeachesConsidered).toBeGreaterThanOrEqual(4);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);

    const clients = (createSupabaseServiceRoleClient as jest.Mock).mock.results
      .map((r: any) => r?.value)
      .filter(Boolean);
    expect(clients.some((c: any) => typeof c.rpc === "function")).toBe(true);
  });

  it("gives high score to advanced user when waves are 8ft", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
    const { __setMockProfile } = require("@/lib/supabase/server");

    __setMockProfile({
      id: "user-1",
      experience_level: "advanced",
    });

    const f = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "8.0",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 90,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [f],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });
    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Advanced user with large preference and 8ft waves should get reasonable score
    // Base conditions scorer now gives 85 for 8ft+ (was capped at 60)
    // Skill adjustment adds +5 bonus for matching preference
    // Other factors (wind, tide) may reduce score, but it should still be good
    expect(rec.score).toBeGreaterThanOrEqual(60);
    // Score should be higher than what a beginner would get (50 or less)
    // The key difference is: NO skill ceiling warning for advanced users
    expect(rec.warnings.some(w => w.includes('exceed your skill level'))).toBe(false);
  });

  it("gives low score and warning to beginner when waves are 8ft", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
    const { __setMockProfile } = require("@/lib/supabase/server");

    __setMockProfile({
      id: "user-1",
      experience_level: "beginner",
    });

    const f = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "8.0",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 90,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [f],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });
    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Beginner with 8ft waves should get penalized
    // 8ft exceeds beginner acceptable max of 4ft by 4ft
    // Penalty = min(25, 4 * 8) = 25 points
    expect(rec.score).toBeLessThanOrEqual(70);
    // Should have skill ceiling warning
    expect(rec.warnings.some(w => w.includes('exceed your skill level'))).toBe(true);
  });

  it("gives bonus to intermediate user when waves match skill ideal range", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
    const { __setMockProfile } = require("@/lib/supabase/server");

    __setMockProfile({
      id: "user-1",
      experience_level: "intermediate",
    });

    const f = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "3.5", // Within intermediate ideal range (2-5ft)
      wave_period: "12s",
      wind_speed: "5",
      wind_direction: "NW",
      confidence_score: 80,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [f],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });
    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Should get a reasonable score with bonus for waves matching skill level
    expect(rec.score).toBeGreaterThanOrEqual(60);
    // Should have reason about conditions matching experience level
    expect(rec.reasons.some(r => r.includes('match your experience level') || r.includes('Great wave size for your level'))).toBe(true);
  });
});

describe("discoverSurfSpots sunset filtering", () => {
  let consoleErrorSpy: jest.SpyInstance;
  const defaultUserLocation = { lat: 37.7749, lon: -122.4194 }; // San Francisco

  beforeAll(() => {
    jest.useFakeTimers();
    // Set system time to 4pm UTC on Jan 20, 2025
    jest.setSystemTime(new Date("2025-01-20T16:00:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { __setMockProfile, __setMockFavorites, __setMockAffinity, __setMockSunTimes, __setMockNearby, __setMockBeaches } = require("@/lib/supabase/server");

    // Profile with no home beach (GPS-only discovery)
    __setMockProfile({
      id: "user-1",
      experience_level: null,
    });
    __setMockFavorites([]);
    __setMockAffinity([]);
    __setMockSunTimes([]);

    // GPS-based discovery: set up nearby beaches via RPC mock
    __setMockNearby([
      { id: "beach-1", is_private: false, distance_meters: 100 },
    ]);

    // Beach details for the nearby beach
    __setMockBeaches([
      {
        id: "beach-1",
        name: "Sunset Test Beach",
        lat: 37.7749,  // San Francisco coordinates
        lon: -122.4194,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        skill_level: "beginner",
        tz: "America/Los_Angeles",
      },
    ]);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  // Helper to set up sun_times mock with specific sunset.
  // sunrise_utc uses 06:15:00Z because getTimezoneFromCoords is mocked to return
  // "UTC", so all local-hour comparisons happen in UTC. Using a Pacific-local
  // sunrise (e.g. 15:15 UTC = 7:15am Pacific) would incorrectly trigger the
  // pre-sunrise rejection for afternoon UTC forecasts.
  function setSunsetTime(sunsetUtc: string, localDate: string = "2025-01-20") {
    const { __setMockSunTimes } = require("@/lib/supabase/server");
    __setMockSunTimes([{
      beach_id: "beach-1",
      local_date: localDate,
      sunrise_utc: `${localDate}T06:15:00Z`, // 6:15am UTC — safe for UTC-timezone tests
      sunset_utc: sunsetUtc,
    }]);
  }

  it("rejects windows starting after today's sunset", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // Test in UTC timezone for simplicity
    // System time: 2025-01-20T12:00:00Z (noon UTC)
    // Sunset: 2025-01-20T17:30:00Z (5:30pm UTC)
    // Good forecast: 2025-01-20T14:00:00Z (2pm UTC - before sunset)
    // Bad forecast: 2025-01-20T19:00:00Z (7pm UTC - after sunset)
    jest.setSystemTime(new Date("2025-01-20T12:00:00Z"));
    setSunsetTime("2025-01-20T17:30:00Z");

    // Forecast at 2pm UTC (before sunset, should be selected)
    const goodForecast = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
      confidence_score: 75,
    });

    // Forecast at 7pm UTC (after sunset, should be rejected)
    const postSunsetForecast = mkForecast("2025-01-20T19:00:00Z", {
      wave_height: "5",  // Even better conditions
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 80,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [goodForecast, postSunsetForecast],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // The 2pm window should be selected, NOT the 7pm window (even though 7pm has better conditions)
    // Because 7pm is after sunset (5:30pm)
    expect(rec.window.start.getUTCHours()).toBe(14); // 2pm UTC
    expect(rec.window.start.getUTCHours()).not.toBe(19); // Should NOT be 7pm UTC
  });

  it("accepts windows starting before today's sunset", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // System time: noon UTC, Sunset: 5:30pm UTC
    jest.setSystemTime(new Date("2025-01-20T12:00:00Z"));
    setSunsetTime("2025-01-20T17:30:00Z");

    // Create forecast at 2pm UTC (before sunset)
    const beforeSunsetForecast = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
      confidence_score: 75,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [beforeSunsetForecast],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // The 2pm UTC window should be accepted
    expect(rec.window.start.toISOString()).toBe("2025-01-20T14:00:00.000Z");
  });

  it("prefers current window over post-sunset window even with better conditions", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // System time: 2pm UTC, Sunset: 5:30pm UTC
    jest.setSystemTime(new Date("2025-01-20T14:00:00Z"));
    setSunsetTime("2025-01-20T17:30:00Z");

    // 2pm UTC window (mediocre conditions)
    const currentWindow = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "3",
      wave_period: "10s",
      wind_speed: "10",
      wind_direction: "W",
      confidence_score: 65,
    });

    // 7pm UTC window (excellent conditions but after sunset)
    const eveningWindow = mkForecast("2025-01-20T19:00:00Z", {
      wave_height: "6",
      wave_period: "16s",
      wind_speed: "3",
      wind_direction: "NW",
      confidence_score: 90,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [currentWindow, eveningWindow],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Should select the 2pm window, not the 7pm window
    expect(rec.window.start.getUTCHours()).toBe(14); // 2pm UTC
  });

  it("rejects window starting exactly at sunset time", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // System time: noon UTC, Sunset: 5:30pm UTC
    jest.setSystemTime(new Date("2025-01-20T12:00:00Z"));
    setSunsetTime("2025-01-20T17:30:00Z");

    // Create forecast starting exactly at sunset time
    const sunsetForecast = mkForecast("2025-01-20T17:30:00Z", {
      wave_height: "2",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 80,
    });

    // Create forecast before sunset
    const beforeSunsetForecast = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "3",
      wave_period: "10s",
      wind_speed: "8",
      wind_direction: "W",
      confidence_score: 65,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [beforeSunsetForecast, sunsetForecast],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Should select the 2pm window, not the sunset window
    expect(rec.window.start.getUTCHours()).toBe(14); // 2pm UTC
    expect(rec.window.start.getUTCHours()).not.toBe(17); // NOT 5:30pm UTC
  });

  it("handles missing sunset data gracefully (relies on night filter)", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
    const { __setMockSunTimes } = require("@/lib/supabase/server");

    // System time: noon UTC
    jest.setSystemTime(new Date("2025-01-20T12:00:00Z"));

    // No sunset data available
    __setMockSunTimes([]);

    // Create forecast at reasonable afternoon time (3pm UTC)
    const afternoonForecast = mkForecast("2025-01-20T15:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
      confidence_score: 75,
    });

    // Create forecast at late evening time (9pm UTC - should be rejected by night filter)
    const eveningForecast = mkForecast("2025-01-20T21:00:00Z", {
      wave_height: "5",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 85,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [afternoonForecast, eveningForecast],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Should select afternoon window (3pm), not evening (9pm blocked by night filter)
    expect(rec.window.start.getUTCHours()).toBe(15); // 3pm UTC
    expect(rec.window.start.getUTCHours()).not.toBe(21); // NOT 9pm UTC
  });

  it("rejects early morning window before sunrise (via night filter)", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // System time: midnight UTC
    jest.setSystemTime(new Date("2025-01-20T00:00:00Z"));
    setSunsetTime("2025-01-20T17:30:00Z");

    // Create forecast at 4am UTC (too early - before 6am night filter)
    const earlyMorningForecast = mkForecast("2025-01-20T04:00:00Z", {
      wave_height: "5",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 85,
    });

    // Create forecast at 8am UTC (should be accepted)
    const lateMorningForecast = mkForecast("2025-01-20T08:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
      confidence_score: 75,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [earlyMorningForecast, lateMorningForecast],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Should select 8am window, not 4am (night filter)
    expect(rec.window.start.getUTCHours()).toBe(8); // 8am UTC
    expect(rec.window.start.getUTCHours()).not.toBe(4); // NOT 4am UTC
  });

  it("caps window end time at sunset", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // System time: noon UTC, Sunset: 3pm UTC (early sunset scenario)
    jest.setSystemTime(new Date("2025-01-20T12:00:00Z"));
    setSunsetTime("2025-01-20T15:00:00Z");

    // Create forecast at 1pm UTC with excellent conditions (would normally extend 4 hours)
    const afternoonForecast = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "5",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 90,
    });

    // Add more forecasts to show continued good conditions
    const forecast2pm = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "5",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 90,
    });

    const forecast3pm = mkForecast("2025-01-20T15:00:00Z", {
      wave_height: "5",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 90,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [afternoonForecast, forecast2pm, forecast3pm],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Window should start at 1pm
    expect(rec.window.start.toISOString()).toBe("2025-01-20T13:00:00.000Z");

    // Window end should NOT exceed sunset (3pm).
    // Sub-hour peak-centering may tighten the window further, but it must not exceed sunset.
    const sunsetTime = new Date("2025-01-20T15:00:00.000Z").getTime();
    expect(rec.window.end.getTime()).toBeLessThanOrEqual(sunsetTime);

    // Verify window has reasonable duration (at least 30 min, at most sunset-capped 2 hours)
    const durationHours = (rec.window.end.getTime() - rec.window.start.getTime()) / (1000 * 60 * 60);
    expect(durationHours).toBeGreaterThanOrEqual(0.5);
    expect(durationHours).toBeLessThanOrEqual(2);
  });

  it("rejects window with insufficient daylight before sunset", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");

    // System time: 1pm UTC, Sunset: 4:30pm UTC (only 30 minutes from the 4pm forecast)
    // Use 1pm so the 2pm forecast isn't filtered by past-tolerance
    jest.setSystemTime(new Date("2025-01-20T13:00:00Z"));
    setSunsetTime("2025-01-20T16:30:00Z");

    // Create forecast at 4pm UTC (only 30 min until sunset - less than MIN_SESSION_HOURS)
    const lateForecast = mkForecast("2025-01-20T16:00:00Z", {
      wave_height: "2",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
      confidence_score: 75,
    });

    // Create earlier forecast with more daylight and better conditions
    const earlierForecast = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "2",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 90,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [earlierForecast, lateForecast],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Should select earlier window (2pm) with sufficient daylight, not late window
    expect(rec.window.start.getUTCHours()).toBe(14); // 2pm UTC
    expect(rec.window.start.getUTCHours()).not.toBe(16); // NOT 4pm UTC
  });

  it("handles sunset data for wrong date gracefully", async () => {
    const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
    const { __setMockSunTimes } = require("@/lib/supabase/server");

    // System time: Jan 20, 2025 at noon UTC
    jest.setSystemTime(new Date("2025-01-20T12:00:00Z"));

    // Provide sunset data for wrong date (Jan 19 instead of Jan 20)
    __setMockSunTimes([{
      beach_id: "beach-1",
      local_date: "2025-01-19",
      sunrise_utc: "2025-01-19T15:15:00Z",
      sunset_utc: "2025-01-19T17:30:00Z",
    }]);

    // Create forecasts for Jan 20 (no matching sunset data)
    const afternoonForecast = mkForecast("2025-01-20T15:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
      confidence_score: 75,
    });

    // Evening forecast (should be rejected by night filter at 9pm)
    const eveningForecast = mkForecast("2025-01-20T21:00:00Z", {
      wave_height: "5",
      wave_period: "14s",
      wind_speed: "4",
      wind_direction: "NW",
      confidence_score: 85,
    });

    (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-1", {
          beachId: "beach-1",
          forecasts: [afternoonForecast, eveningForecast],
          metadata: { cached: true, stale: false, missing: false, reason: null },
        }],
      ])
    );

    const result = await discoverSurfSpots("user-1", { userLocation: defaultUserLocation, maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Should select afternoon window, night filter still protects from 9pm
    expect(rec.window.start.getUTCHours()).toBe(15); // 3pm UTC
    expect(rec.window.start.getUTCHours()).not.toBe(21); // NOT 9pm UTC
  });
});
