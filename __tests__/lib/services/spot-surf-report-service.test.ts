/**
 * @jest-environment node
 */

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

jest.mock("server-only", () => ({}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/discovery", () => ({
  getBatchSunTimes: jest.fn(),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

let formatDateCallCount = 0;
jest.mock("@/lib/utils/date-time", () => ({
  formatDateInTimezone: jest.fn(() => {
    formatDateCallCount += 1;
    return formatDateCallCount % 2 === 1 ? "2024-01-15" : "2024-01-16";
  }),
}));

const mockCacheInputs: unknown[][] = [];
let mockCacheConfig: unknown[] | null = null;
const mockUnstableCache = jest.fn(
  (fn: (...args: unknown[]) => unknown, ...config: unknown[]) => {
    mockCacheConfig = config;
    return (...args: unknown[]) => {
      mockCacheInputs.push(args);
      return fn(...args);
    };
  },
);
jest.mock("next/cache", () => ({ unstable_cache: mockUnstableCache }));

const mockSelectBestWindow = jest.fn();
jest.mock("@/lib/services/discovery/window-selector", () => ({
  selectBestWindow: (...args: unknown[]) => mockSelectBestWindow(...args),
}));

const mockEvaluateMajorEventHoldCandidates = jest.fn();
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) =>
    mockEvaluateMajorEventHoldCandidates(...args),
}));

const mockApplyV51DisplayOverrideToForecasts = jest.fn(
  async (
    forecasts: EnhancedForecastEntity[],
    _options: { enabled?: boolean },
  ) =>
    forecasts.map((item) => ({ ...item, wave_height: "6 ft" })),
);
jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: (
    forecasts: EnhancedForecastEntity[],
    options: { enabled?: boolean },
  ) => mockApplyV51DisplayOverrideToForecasts(forecasts, options),
}));

describe("spot surf report service", () => {
  const beachId = "11111111-1111-4111-8111-111111111111";
  const beach = {
    id: beachId,
    slug: "test-beach",
    name: "Test Beach",
    lat: 33.8,
    lon: -118.4,
    state: "California",
    city: "Los Angeles",
    max_wind_onshore_mph: 12,
    max_wind_any_mph: 18,
    swell_window_min_deg: 300,
    swell_window_max_deg: 45,
    shoaling_factors: { "0": 0.8, "90": 1.1 },
  } as unknown as Beach;
  const forecast: Partial<EnhancedForecastEntity> = {
    id: "forecast-1",
    beach_id: beachId,
    forecast_at: "2024-01-15T14:00Z",
    forecast_date: "2024-01-15",
    forecast_time: "14:00",
    wave_height: "4",
    wave_period: "12",
    swell_1_height: "4",
    swell_1_period: "12s",
    confidence_score: 80,
  };

  function setupDatabase(rows: Partial<EnhancedForecastEntity>[] = [forecast]): void {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lt: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue({ data: rows, error: null }),
                })),
              })),
            })),
          })),
        })),
      })),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheInputs.length = 0;
    formatDateCallCount = 0;
    const { getBatchSunTimes } = require("@/lib/services/discovery");
    (getBatchSunTimes as jest.Mock).mockResolvedValue(new Map([
      [beachId, { sunrises: [], sunsets: [new Date("2024-01-16T01:00:00Z")] }],
    ]));
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        candidates.map(({ candidateId }) => ({
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
        })),
    );
    mockSelectBestWindow.mockReturnValue({
      start: new Date("2024-01-15T22:00:00Z"),
      end: new Date("2024-01-16T00:00:00Z"),
      score: 80,
      waveHeight: "4",
      peakTime: new Date("2024-01-15T23:00:00Z"),
    });
  });

  it("returns null without a beach id", async () => {
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    await expect(getSpotSurfReportPublic({ ...beach, id: undefined } as unknown as Beach)).resolves.toBeNull();
  });

  it("builds the public report from the cached forecast path", async () => {
    setupDatabase();
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

    expect(result).not.toBeNull();
    expect(result?.report.userTier).toBeNull();
    expect(result?.report.skillSource).toBeNull();
    expect(result?.report.isCalibrated).toBe(true);
    expect(mockCacheConfig).toEqual([["spot-surf-report"], { revalidate: 900 }]);
    expect(result?.hourlyForecasts).toEqual([
      expect.objectContaining({ forecast_at: forecast.forecast_at }),
    ]);
    expect(mockSelectBestWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrefs: null,
        userSkillLevel: null,
        beach: expect.objectContaining({
          max_wind_onshore_mph: 12,
          max_wind_any_mph: 18,
          swell_window_min_deg: 300,
          swell_window_max_deg: 45,
          shoaling_factors: { "0": 0.8, "90": 1.1 },
        }),
      }),
    );
  });

  it("uses canonical beach input for cache keys", async () => {
    setupDatabase();
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    await getSpotSurfReportPublic({
      ...beach,
      description: "ignored projection field",
    } as unknown as Beach);

    expect(mockCacheInputs[0]).toEqual([
      beachId,
      expect.objectContaining({
        id: beachId,
        max_wind_any_mph: 18,
        swell_window_min_deg: 300,
        shoaling_factors: { "0": 0.8, "90": 1.1 },
      }),
    ]);
    expect(mockCacheInputs[0]?.[1]).not.toHaveProperty("description");
  });

  it("applies the V5 display projection before selecting a window", async () => {
    setupDatabase();
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    await getSpotSurfReportPublic(beach);

    expect(mockApplyV51DisplayOverrideToForecasts).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ wave_height: "4" })]),
      { enabled: true },
    );
    expect(mockSelectBestWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        forecasts: expect.arrayContaining([
          expect.objectContaining({ wave_height: "6 ft" }),
        ]),
      }),
    );
  });

  it("passes sun times to recommendation selection and applies the hold boundary", async () => {
    setupDatabase();
    const { getBatchSunTimes } = require("@/lib/services/discovery");
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const sunTimes = await getBatchSunTimes([beachId], ["2024-01-15", "2024-01-16"]);
    const result = await getSpotSurfReportPublic(beach);

    expect(mockSelectBestWindow).toHaveBeenCalledWith(
      expect.objectContaining({ sunTimesCache: sunTimes }),
    );
    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith(
      {
        candidates: [
          {
            candidateId:
              `surf-call:${beachId}:2024-01-15T22:00:00.000Z:2024-01-16T00:00:00.000Z`,
            beachId,
            startsAt: "2024-01-15T22:00:00.000Z",
            endsAt: "2024-01-16T00:00:00.000Z",
          },
        ],
        profileExperience: null,
      },
    );
    expect(result?.report.userTier).toBeNull();
    expect(result?.report.tiers).toBeNull();
    expect(result?.report.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: "surf-call-test-epoch",
    });
  });

  it("sanitizes a blocked hold through the real service adapter", async () => {
    setupDatabase();
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        candidates.map(({ candidateId }) => ({
          candidateId,
          evaluation: {
            outcome: "explicit_none",
            reasonCode: "major_event_hold",
            holdIds: ["hold-1"],
            expiresAt: "2024-01-16T01:00:00.000Z",
            holdEpoch: "blocked-surf-call-test-epoch",
          },
          recommendationAvailability: {
            state: "none",
            reasonCode: "major_event_hold",
            expiresAt: "2024-01-16T01:00:00.000Z",
            holdEpoch: "blocked-surf-call-test-epoch",
          },
        })),
    );
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

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
      profileExperience: null,
    });
    expect(result?.report).toMatchObject({
      verdict: "NO",
      bestWindowStart: null,
      bestWindowEnd: null,
      score: 0,
      userTier: null,
      tiers: null,
      recommendationAvailability: {
        state: "none",
        reasonCode: "major_event_hold",
        holdEpoch: "blocked-surf-call-test-epoch",
      },
    });
    expect(result?.forecastContext).toBeNull();
  });

  it("keeps today's physical hourly rows when the recommendation falls tomorrow", async () => {
    setupDatabase([
      forecast,
      { ...forecast, forecast_at: "2024-01-16T14:00Z", forecast_date: "2024-01-16" },
    ]);
    mockSelectBestWindow
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        start: new Date("2024-01-16T18:00:00Z"),
        end: new Date("2024-01-16T21:00:00Z"),
        score: 75,
        waveHeight: "4",
      });
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

    expect(result?.isTomorrow).toBe(true);
    expect(result?.hourlyForecastDay).toBe("today");
    expect(result?.hourlyForecasts).toEqual([
      expect.objectContaining({ forecast_at: "2024-01-15T14:00Z" }),
    ]);
  });

  it("returns a safe available NO when there is no positive surf window", async () => {
    setupDatabase();
    mockSelectBestWindow.mockReturnValue(null);
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

    expect(result?.report.verdict).toBe("NO");
    expect(result?.report.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: "no-positive-surf-call",
    });
  });

  it("fails closed when the major-event hold decision is unavailable", async () => {
    setupDatabase();
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([]);
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

    expect(result?.report).toMatchObject({
      verdict: "NO",
      bestWindowStart: null,
      bestWindowEnd: null,
      score: 0,
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
      },
    });
    expect(result?.forecastContext).toBeNull();
  });

  it("returns a safe empty report for forecast database errors", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lt: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: "forecast unavailable", code: "PGRST000" },
                  }),
                })),
              })),
            })),
          })),
        })),
      })),
    });
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

    expect(result).toMatchObject({
      isTomorrow: false,
      hourlyForecasts: [],
      hourlyForecastDay: "today",
      forecastContext: null,
      report: { recommendationAvailability: { state: "available" } },
    });
  });

  it("returns a safe empty report when forecasts are absent", async () => {
    setupDatabase([]);
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

    expect(result).toMatchObject({
      isTomorrow: false,
      hourlyForecasts: [],
      hourlyForecastDay: "today",
      forecastContext: null,
      report: { recommendationAvailability: { state: "available" } },
    });
  });
});
