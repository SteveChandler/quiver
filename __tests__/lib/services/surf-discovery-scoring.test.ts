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
}));

jest.mock("@/lib/utils/timezone-utils", () => ({
  getTimezoneFromCoords: jest.fn(() => "UTC"),
  getLocalHour: jest.fn((d: Date) => d.getUTCHours()),
  isNightHour: jest.fn((h: number) => h >= 21 || h < 6),
}));

jest.mock("@/lib/services/preference-learning-service", () => ({
  getUserSurfPreferences: jest.fn(() => Promise.resolve(null)),
}));

// Minimal, table-aware supabase mock used by discoverSurfSpots
jest.mock("@/lib/supabase/server", () => {
  // Shared state across all client instances (discoverSurfSpots creates multiple).
  const state = {
    profileData: null as any,
    favoritesData: [] as any[],
    affinityData: [] as any[],
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

  const createSupabaseServiceRoleClient = jest.fn(() => ({
    from(table: string) {
      return {
        select() {
          if (table === "profiles") {
            return {
              eq() {
                return {
                  single: async () => ({ data: state.profileData, error: null }),
                };
              },
            };
          }

          if (table === "favorite_beaches") {
            return {
              eq() {
                return {
                  order: async () => ({ data: state.favoritesData, error: null }),
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

          // Default: empty
          return {
            eq() {
              return {
                single: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  }));

  return {
    createSupabaseServiceRoleClient,
    __setMockProfile,
    __setMockFavorites,
    __setMockAffinity,
  };
});

function mkForecast(atIso: string, patch: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  const d = new Date(atIso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 19);

  return {
    id: patch.id ?? `${date}-${time}`,
    beach_id: patch.beach_id ?? "beach-1",
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

    const { __setMockProfile, __setMockFavorites, __setMockAffinity } = require("@/lib/supabase/server");

    // Default: single home beach candidate, no favorites/affinity
    __setMockProfile({
      id: "user-1",
      home_beach_id: "beach-1",
      home_beach: {
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
    });
    __setMockFavorites([]);
    __setMockAffinity([]);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("scores the same forecast entry as the selected best window", async () => {
    const { getFreshForecastFromCache } = require("@/lib/utils/forecast-service-utils");

    // forecasts[0] is intentionally worse than the later forecast
    const a = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "1",
      wave_period: "8s",
      wind_speed: "20",
      confidence_score: 60,
      wind_direction: "SW",
    });
    const b = mkForecast("2025-01-20T14:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      confidence_score: 75,
      wind_direction: "NW",
    });

    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [a, b],
      metadata: { cached: true, stale: false, missing: false, reason: null },
    });

    const result = await discoverSurfSpots("user-1", { maxResults: 1 });

    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    // Window should be built from the better (later) forecast
    expect(rec.window.start.toISOString()).toBe("2025-01-20T14:00:00.000Z");

    // And the returned/scored forecast should match the window timestamp
    expect(`${rec.forecast.forecast_date}T${rec.forecast.forecast_time}Z`).toBe(
      "2025-01-20T14:00:00Z"
    );

    // Subscores should reflect the later forecast (wave_height 4 => default waveHeightFit=20)
    expect(rec.subscores.waveHeightFit).toBe(20);
  });

  it("uses wind_direction_deg for wind alignment scoring", async () => {
    const { getFreshForecastFromCache } = require("@/lib/utils/forecast-service-utils");

    // Configure beach wind metadata
    const { __setMockProfile } = require("@/lib/supabase/server");
    __setMockProfile({
      id: "user-1",
      home_beach_id: "beach-1",
      home_beach: {
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
    });

    const f = mkForecast("2025-01-20T13:00:00Z", {
      wind_speed: "10",
      wind_direction: null,
      wind_direction_deg: 225,
    });

    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [f],
      metadata: { cached: true, stale: false, missing: false, reason: null },
    });

    const result = await discoverSurfSpots("user-1", { maxResults: 1 });
    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    expect(rec.subscores.windAlignment).toBe(20);
  });

  it("normalizes conditions so 100 is achievable without wind/tide beach metadata", async () => {
    const { getFreshForecastFromCache } = require("@/lib/utils/forecast-service-utils");
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

    const f = mkForecast("2025-01-20T13:00:00Z", {
      wave_height: "4",
      wave_period: "12s",
      wind_speed: "6",
      wind_direction: "NW",
    });

    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [f],
      metadata: { cached: true, stale: false, missing: false, reason: null },
    });

    const result = await discoverSurfSpots("user-1", { maxResults: 1 });
    assertHasRecommendation(result, consoleErrorSpy.mock.calls);
    const rec = result.recommendations[0];

    expect(rec.score).toBe(100);
  });
});

