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

const mockCacheInputs: unknown[][] = [];
let mockRequestCache = new Map<string, unknown>();
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: string[]) => unknown) => (...args: string[]) => {
    mockCacheInputs.push(args);
    const key = JSON.stringify(args);
    if (!mockRequestCache.has(key)) mockRequestCache.set(key, fn(...args));
    return mockRequestCache.get(key);
  },
}));
const mockConnection = jest.fn().mockResolvedValue(undefined);
jest.mock("next/server", () => ({ connection: () => mockConnection() }));

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

  function setupDatabase(
    rows: Partial<EnhancedForecastEntity>[] = [forecast],
    error: { message: string; code: string } | null = null,
  ): { gte: jest.Mock; lt: jest.Mock } {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: rows, error }),
    };
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({ from: jest.fn(() => query) });
    return query;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheInputs.length = 0;
    mockRequestCache = new Map();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T18:00:00Z"));
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

  afterEach(() => jest.useRealTimers());

  it("deduplicates one render but reads the next revision and clock on the next request", async () => {
    setupDatabase([{ ...forecast, forecast_at: "2024-01-15T23:00:00Z", updated_at: "2024-01-15T17:00:00Z" }]);
    const { getSpotSurfReportPublic } = await import("@/lib/services/spot-surf-report-service");
    const first = await getSpotSurfReportPublic(beach);
    setupDatabase([{ ...forecast, forecast_at: "2024-01-15T23:00:00Z", updated_at: "2024-01-15T18:01:00Z" }]);
    jest.setSystemTime(new Date("2024-01-15T18:02:00Z"));
    const sameRequest = await getSpotSurfReportPublic({ ...beach, description: "other projection" } as Beach);
    expect(sameRequest?.forecastContext).toEqual(first?.forecastContext);
    expect(mockApplyV51DisplayOverrideToForecasts).toHaveBeenCalledTimes(1);

    mockRequestCache = new Map(); // React discards its memoization between requests.
    const nextRequest = await getSpotSurfReportPublic(beach);
    expect(nextRequest?.forecastContext?.sourceDataUpdatedAt).toBe("2024-01-15T18:01:00Z");
    expect(first?.forecastContext?.sourceDataUpdatedAt).toBe("2024-01-15T17:00:00Z");
    expect(nextRequest?.report.updatedAt).toBe("2024-01-15T18:02:00.000Z");
    expect(first?.report.updatedAt).toBe("2024-01-15T18:00:00.000Z");
    expect(mockApplyV51DisplayOverrideToForecasts).toHaveBeenCalledTimes(2);
  });

  it("does not retain a successful report through source failure or cache that failure after recovery", async () => {
    const { getSpotSurfReportPublic } = await import("@/lib/services/spot-surf-report-service");
    setupDatabase();
    expect((await getSpotSurfReportPublic(beach))?.forecastContext).toEqual(expect.objectContaining({ beachId }));
    mockRequestCache = new Map();
    setupDatabase([], { message: "Source unavailable", code: "503" });
    const failed = await getSpotSurfReportPublic(beach);
    expect(failed?.forecastContext).toBeNull();
    expect(failed?.hourlyForecasts).toEqual([]);
    expect(failed?.report.bestWindowStart).toBeNull();
    mockRequestCache = new Map();
    setupDatabase([{ ...forecast, forecast_at: "2024-01-15T23:00:00Z", updated_at: "2024-01-15T18:03:00Z" }]);
    expect((await getSpotSurfReportPublic(beach))?.forecastContext?.sourceDataUpdatedAt).toBe("2024-01-15T18:03:00Z");
  });

  it("advances the beach-local date after midnight on the next request", async () => {
    setupDatabase([
      { ...forecast, forecast_at: "2024-01-15T23:00:00Z" },
      { ...forecast, forecast_at: "2024-01-16T10:00:00Z" },
    ]);
    mockSelectBestWindow.mockReturnValue(null);
    const { getSpotSurfReportPublic } = await import("@/lib/services/spot-surf-report-service");
    jest.setSystemTime(new Date("2024-01-16T07:59:00Z"));
    const { getBatchSunTimes } = require("@/lib/services/discovery");
    expect((await getSpotSurfReportPublic(beach))?.hourlyForecasts).toEqual([expect.objectContaining({ forecast_at: "2024-01-15T23:00:00Z" })]);
    expect(getBatchSunTimes).toHaveBeenLastCalledWith([beachId], ["2024-01-15", "2024-01-16"]);
    mockRequestCache = new Map();
    jest.setSystemTime(new Date("2024-01-16T08:01:00Z"));
    const nextDay = await getSpotSurfReportPublic(beach);
    expect(getBatchSunTimes).toHaveBeenLastCalledWith([beachId], ["2024-01-16", "2024-01-17"]);
    expect(nextDay?.hourlyForecasts).toEqual([expect.objectContaining({ forecast_at: "2024-01-16T10:00:00Z" })]);
  });

  it.each([
    ["2024-01-15T18:00:00Z", "2024-01-15", "2024-01-16", "2024-01-15T08:00:00.000Z", "2024-01-17T08:00:00.000Z"],
    ["2026-11-01T07:30:00Z", "2026-11-01", "2026-11-02", "2026-11-01T07:00:00.000Z", "2026-11-03T08:00:00.000Z"],
    ["2026-03-08T07:30:00Z", "2026-03-07", "2026-03-08", "2026-03-07T08:00:00.000Z", "2026-03-09T07:00:00.000Z"],
  ])("reads both complete beach-local days, including DST boundaries, at %s", async (clock, today, tomorrow, start, end) => {
    jest.setSystemTime(new Date(clock));
    const query = setupDatabase([]);
    const { getSpotSurfReportPublic } = await import("@/lib/services/spot-surf-report-service");
    const { getBatchSunTimes } = require("@/lib/services/discovery");
    await getSpotSurfReportPublic(beach);
    expect(getBatchSunTimes).toHaveBeenLastCalledWith([beachId], [today, tomorrow]);
    expect(query.gte).toHaveBeenCalledWith("forecast_at", start);
    expect(query.lt).toHaveBeenCalledWith("forecast_at", end);
  });

  it("lets Next interrupt static generation instead of caching a fallback", async () => {
    const { getSpotSurfReportPublic } = await import("@/lib/services/spot-surf-report-service");
    const interruption = new Error("Dynamic server usage");
    mockConnection.mockRejectedValueOnce(interruption);
    await expect(getSpotSurfReportPublic(beach)).rejects.toBe(interruption);
    expect(mockCacheInputs).toEqual([]);
  });

  it("returns null without a beach id", async () => {
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    await expect(getSpotSurfReportPublic({ ...beach, id: undefined } as unknown as Beach)).resolves.toBeNull();
  });

  it("builds the public report during the request", async () => {
    setupDatabase();
    const { getSpotSurfReportPublic } = await import(
      "@/lib/services/spot-surf-report-service"
    );

    const result = await getSpotSurfReportPublic(beach);

    expect(result).not.toBeNull();
    expect(result?.report.userTier).toBeNull();
    expect(result?.report.skillSource).toBeNull();
    expect(result?.report.isCalibrated).toBe(true);
    expect(mockConnection).toHaveBeenCalledTimes(1);
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

    expect(JSON.parse(mockCacheInputs[0][0] as string)).toEqual(expect.objectContaining({
        id: beachId,
        max_wind_any_mph: 18,
        swell_window_min_deg: 300,
        shoaling_factors: { "0": 0.8, "90": 1.1 },
      }));
    expect(JSON.parse(mockCacheInputs[0][0] as string)).not.toHaveProperty("description");
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
