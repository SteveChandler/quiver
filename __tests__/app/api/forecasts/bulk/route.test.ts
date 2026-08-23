/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchHourlySwellTimelineRows,
  GET,
} from "@/app/api/forecasts/bulk/route";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { getBatchSunTimes } from "@/lib/services/discovery";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import { scoreWindowConditionScore } from "@/lib/services/discovery/window-selector/window-scorer";
import { resolveTodayHeadline } from "@/lib/services/forecast/today-headline";
import {
  createMockRequest,
  createMockSupabaseClient,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

interface BulkForecastResponse {
  forecasts: Record<string, number | undefined>;
  displayForecasts: Record<
    string,
    | {
        label: string;
        minFt: number;
        maxFt: number;
        forecastAt: string;
        context: "today_headline" | "selected_hour";
      }
    | undefined
  >;
  waterTemps: Record<string, string | undefined>;
  isCalibrated: Record<string, boolean>;
  conditionScores: Record<string, number | undefined>;
  conditionSummaries: Record<string, "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH" | "UNKNOWN">;
  swellPartitions: Record<string, unknown>;
  swellPartitionTimeline: Record<string, unknown[]>;
  hourlySwellTimeline?: {
    timestamps: string[];
    partitionsByBeach: Record<string, Array<unknown | null>>;
    hasMore: boolean;
    nextStart: string | null;
  };
  recommendationAvailability?: {
    state: "available" | "none";
    reasonCode?: "major_event_hold" | "hold_state_unavailable";
    expiresAt?: string;
    holdEpoch: string;
  };
}

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type ForecastRow = {
  beach_id: string;
  forecast_date: string;
  forecast_time: string;
  forecast_at: string;
  wave_height: string | null;
  wave_period: string | null;
  wave_direction: string | null;
  wave_height_om: number | null;
  wave_direction_om: number | null;
  swell_direction_om: number | null;
  swell_1_height: string | null;
  swell_1_period: string | null;
  swell_1_direction: string | null;
  swell_2_height: string | null;
  swell_2_period: string | null;
  swell_2_direction: string | null;
  wind_wave_height: string | null;
  wind_wave_period: string | null;
  wind_wave_direction: string | null;
  wind_speed: string | null;
  wind_direction: string | null;
  wind_direction_deg: number | null;
  water_temp: string | null;
  tide_height: string | null;
  tide_status: string | null;
  confidence_score: number | null;
  data_source: string | null;
};

type BeachRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  region: string | null;
  timezone: string | null;
  lat: number;
  lon: number;
  shoaling_factors: unknown;
  swell_window_min_deg: number | null;
  swell_window_max_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  wind_onshore_bad_kt: number | null;
  wind_cross_shore_ok_kt: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  tide_direction_sensitivity: string | null;
  skill_level: string | null;
  break_type: string | null;
  cdip_station: string | null;
  cdip_eligible: boolean | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  swell_access_factors: unknown;
  wind_exposure_factors: unknown;
  preference_model: unknown;
  features: unknown;
  hazards: unknown;
  average_rating: number | null;
  review_count: number | null;
};

const mockSupabaseClient = createMockSupabaseClient();
const STABLE_TEST_NOW = new Date("2026-07-07T18:00:00.000Z");
const BOUND_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const BOUND_BEACH_ID_TWO = "22222222-2222-4222-8222-222222222222";
const BOUND_BEACH_ID_THREE = "33333333-3333-4333-8333-333333333333";
const BOUND_BEACH_ID_FOUR = "44444444-4444-4444-8444-444444444444";
const NO_STORE = "private, no-store, no-cache, must-revalidate";
const mockEvaluateMajorEventHoldCandidates = jest.fn();

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(
    async (forecasts: ForecastRow[]) => forecasts,
  ),
}));

jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: jest.fn(async () => null),
}));

jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) =>
    mockEvaluateMajorEventHoldCandidates(input),
}));

jest.mock("@/lib/services/discovery", () => ({
  getBatchSunTimes: jest.fn(async () => new Map()),
}));

function mockDisplayForForecast(
  forecast: ForecastRow,
  context: "today_headline" | "selected_hour",
) {
  const value = forecast.wave_height;
  if (value == null) return null;
  if (value.trim().toLowerCase() === "flat") {
    return {
      label: "Flat",
      minFt: 0,
      maxFt: 0,
      forecastAt: forecast.forecast_at,
      context,
    };
  }
  const rangeMatch = value.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const minFt = Math.floor(Number(rangeMatch[1]));
    const maxFt = Math.ceil(Number(rangeMatch[2]));
    return {
      label: minFt === maxFt ? `${minFt}ft` : `${minFt}-${maxFt}ft`,
      minFt,
      maxFt,
      forecastAt: forecast.forecast_at,
      context,
    };
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  const minFt = Math.floor(parsed);
  const maxFt = Math.ceil(parsed);
  return {
    label: minFt === maxFt ? `${minFt}ft` : `${minFt}-${maxFt}ft`,
    minFt,
    maxFt,
    forecastAt: forecast.forecast_at,
    context,
  };
}

jest.mock("@/lib/services/forecast/today-headline", () => ({
  resolveTodayHeadline: jest.fn(
    ({ forecasts }: { forecasts: ForecastRow[] }) => {
      const forecast = forecasts[0];
      if (!forecast) return null;
      const display = mockDisplayForForecast(forecast, "today_headline");
      if (!display) return null;
      return {
        display,
        window: {
          start: new Date(forecast.forecast_at),
          end: new Date(
            new Date(forecast.forecast_at).getTime() + 60 * 60 * 1000,
          ),
          waveHeight: forecast.wave_height,
          sourceForecast: forecast,
        },
      };
    },
  ),
  resolveSelectedHourDisplay: jest.fn((forecast: ForecastRow | null) =>
    forecast ? mockDisplayForForecast(forecast, "selected_hour") : null,
  ),
}));

jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => ({
  scoreWindowConditionScore: jest.fn(() => 72),
}));

jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    ...actual,
    createSuccessResponse: jest.fn((data: unknown) => {
      return new Response(
        JSON.stringify({
          success: true,
          data,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }),
    handleApiError: jest.fn((_error: unknown, message: string) => {
      return new Response(
        JSON.stringify({
          success: false,
          error: message,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }),
  };
});

function forecastRow(
  beachId: string,
  waveHeight: string | null,
  offsetHours = 1,
): ForecastRow {
  const forecastAt = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  return {
    beach_id: beachId,
    forecast_at: forecastAt.toISOString(),
    forecast_date: forecastAt.toISOString().split("T")[0],
    forecast_time: forecastAt.toISOString().slice(11, 19),
    wave_height: waveHeight,
    wave_period: "12s",
    wave_direction: "W",
    wave_height_om: null,
    wave_direction_om: null,
    swell_direction_om: null,
    swell_1_height: waveHeight,
    swell_1_period: "12s",
    swell_1_direction: null,
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wind_speed: "6 mph",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_height: "2.5 ft",
    tide_status: "Rising",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    water_temp: null,
  };
}

function majorEventDecision(
  candidateId: string,
  state: "allow" | "blocked" | "unavailable" = "allow",
) {
  const holdEpoch = `${state}-epoch`;
  if (state === "allow") {
    return {
      candidateId,
      evaluation: { outcome: "allow", holdIds: [], holdEpoch },
      recommendationAvailability: { state: "available", holdEpoch },
    };
  }
  if (state === "unavailable") {
    return {
      candidateId,
      evaluation: {
        outcome: "explicit_none",
        reasonCode: "hold_state_unavailable",
        holdIds: [],
        holdEpoch,
      },
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch,
      },
    };
  }
  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
      holdIds: ["internal-hold-id"],
      expiresAt: "2026-07-08T00:00:00.000Z",
      holdEpoch,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-08T00:00:00.000Z",
      holdEpoch,
    },
  };
}

function hourlyTimelineRows(): ForecastRow[] {
  return Array.from({ length: 43 }, (_, offsetHours) => ({
    ...forecastRow("beach-1", String(offsetHours), offsetHours),
    swell_1_direction: "W",
    swell_1_period: "10s",
  }));
}

function hourlyTimelineRow(
  beachId: string,
  waveHeight: string,
  forecastAt: string,
): ForecastRow {
  return {
    ...forecastRow(beachId, waveHeight, 0),
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: forecastAt.slice(11, 19),
    swell_1_direction: "W",
    swell_1_period: "10s",
  };
}

let hourlyTimelineRequestSequence = 0;

function createHourlyTimelineRequest(url: string) {
  hourlyTimelineRequestSequence += 1;
  return createMockRequest("GET", url, {
    headers: {
      "x-forwarded-for": `203.0.${hourlyTimelineRequestSequence}.1`,
    },
  });
}

function beachRow(id: string, overrides: Partial<BeachRow> = {}): BeachRow {
  return {
    id,
    name: `Beach ${id}`,
    slug: `beach-${id}`,
    city: "San Diego",
    state: "CA",
    country: "USA",
    region: "Southern California",
    timezone: "America/Los_Angeles",
    lat: 32.75,
    lon: -117.25,
    shoaling_factors: null,
    swell_window_min_deg: null,
    swell_window_max_deg: null,
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    wind_onshore_bad_kt: null,
    wind_cross_shore_ok_kt: null,
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    preferred_tide_direction: null,
    tide_direction_sensitivity: null,
    skill_level: null,
    break_type: null,
    cdip_station: null,
    cdip_eligible: null,
    swell_window_center_deg: null,
    swell_window_halfwidth_deg: null,
    swell_access_factors: null,
    wind_exposure_factors: null,
    preference_model: null,
    features: null,
    hazards: null,
    average_rating: null,
    review_count: null,
    ...overrides,
  };
}

function queryChain<T>(result: QueryResult<T>) {
  let rangeFrom = 0;
  let rangeTo = Number.POSITIVE_INFINITY;
  let includedForecastAts: Set<string> | null = null;
  const chain: any = {
    select: jest.fn(),
    in: jest.fn((column: string, values: unknown[]) => {
      if (column === "forecast_at") {
        includedForecastAts = new Set(values.filter((value): value is string => typeof value === "string"));
      }
      return chain;
    }),
    gte: jest.fn(),
    lt: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    range: jest.fn((from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return chain;
    }),
    then: jest.fn((onResolve: (value: QueryResult<T>) => unknown) => {
      const data = Array.isArray(result.data)
        ? result.data
            .filter((row) => {
              if (!includedForecastAts || !row || typeof row !== "object") return true;
              const forecastAt = (row as { forecast_at?: unknown }).forecast_at;
              return typeof forecastAt !== "string" || includedForecastAts.has(forecastAt);
            })
            .slice(rangeFrom, rangeTo + 1) as T
        : result.data;
      return Promise.resolve(onResolve({ data, error: result.error }));
    }),
  };

  chain.select.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lt.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);

  return chain;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function mockBulkQueries(
  options: {
    forecastRows?: ForecastRow[] | null;
    hourlyTimelineRows?: ForecastRow[] | null;
    hourlyTimelineError?: { message: string } | null;
    nextHourlyTimelineRows?: ForecastRow[] | null;
    nextHourlyTimelineError?: { message: string } | null;
    forecastError?: { message: string } | null;
    beachRows?: BeachRow[] | null;
    beachError?: { message: string } | null;
    extensionOnly?: boolean;
  } = {},
) {
  const forecastChain = queryChain({
    data: options.forecastRows ?? [],
    error: options.forecastError ?? null,
  });
  const hourlyTimelineChain = queryChain({
    data: options.hourlyTimelineRows ?? [],
    error: options.hourlyTimelineError ?? null,
  });
  const nextHourlyTimelineChain = queryChain({
    data: options.nextHourlyTimelineRows ?? [],
    error: options.nextHourlyTimelineError ?? null,
  });
  const derivedBeachRows =
    options.beachRows === undefined
      ? Array.from(
          new Set((options.forecastRows ?? []).map((row) => row.beach_id)),
        ).map((id) => beachRow(id))
      : options.beachRows;
  const beachChain = queryChain({
    data: derivedBeachRows ?? [],
    error: options.beachError ?? null,
  });
  const enhancedForecastChains = options.extensionOnly
    ? [hourlyTimelineChain, nextHourlyTimelineChain]
    : [
        forecastChain,
        ...(options.hourlyTimelineRows !== undefined
          ? [hourlyTimelineChain, nextHourlyTimelineChain]
          : []),
      ];
  let enhancedForecastCalls = 0;
  mockSupabaseClient.from = jest.fn((table: string) => {
    if (table === "enhanced_forecasts") {
      const chain = enhancedForecastChains[enhancedForecastCalls] ?? forecastChain;
      enhancedForecastCalls += 1;
      return chain;
    }
    if (table === "beaches") return beachChain;
    return queryChain({ data: null, error: null });
  }) as any;

  return {
    forecastChain,
    hourlyTimelineChain,
    nextHourlyTimelineChain,
    beachChain,
  };
}

describe("/api/forecasts/bulk", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.useFakeTimers({ now: STABLE_TEST_NOW });
    jest.clearAllMocks();
    (scoreWindowConditionScore as jest.Mock).mockReturnValue(72);
    (resolveTodayHeadline as jest.Mock).mockClear();
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        Promise.resolve(
          candidates.map(({ candidateId }) => majorEventDecision(candidateId)),
        ),
    );
    mockSupabaseClient.from = jest.fn(() =>
      queryChain({ data: null, error: null }),
    ) as any;
  });

  it("chunks hourly timeline rows by beach to avoid the PostgREST row cap", async () => {
    const beachIds = Array.from({ length: 20 }, (_, index) => `beach-${index}`);
    const { hourlyTimelineChain, nextHourlyTimelineChain } = mockBulkQueries({
      extensionOnly: true,
    });

    const result = await fetchHourlySwellTimelineRows(
      mockSupabaseClient as never,
      beachIds,
      new Date("2026-07-10T20:00:00.000Z"),
      new Date("2026-07-11T20:00:00.000Z"),
    );

    expect(result).toEqual({ data: [], error: null });
    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
    expect(hourlyTimelineChain.in).toHaveBeenCalledWith(
      "beach_id",
      beachIds.slice(0, 10),
    );
    expect(nextHourlyTimelineChain.in).toHaveBeenCalledWith(
      "beach_id",
      beachIds.slice(10),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup?.();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/forecasts/bulk/route.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
    expect(source).toMatch(/optional:\s*true/);
  });

  it("returns all empty maps when beachIds is missing or empty", async () => {
    for (const url of [
      "http://localhost:3000/api/forecasts/bulk",
      "http://localhost:3000/api/forecasts/bulk?beachIds=",
      "http://localhost:3000/api/forecasts/bulk?beachIds=   ",
    ]) {
      const response = await GET(createMockRequest("GET", url));
      const data = await expectSuccessResponse<BulkForecastResponse>(
        response,
        200,
      );

      expect(data.data).toEqual({
        forecasts: {},
        displayForecasts: {},
        waterTemps: {},
        isCalibrated: {},
        conditionScores: {},
        conditionSummaries: {},
        swellPartitions: {},
        swellPartitionTimeline: {},
        recommendationAvailability: {
          state: "none",
          reasonCode: "hold_state_unavailable",
          holdEpoch: "hold-state-unavailable",
        },
      });
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("allows anonymous requests through optional auth", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow(BOUND_BEACH_ID, "2.4")],
      beachRows: [beachRow(BOUND_BEACH_ID)],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        `http://localhost:3000/api/forecasts/bulk?beachIds=${BOUND_BEACH_ID}`,
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.forecasts).toEqual({ [BOUND_BEACH_ID]: 2.4 });
    expect(data.data.conditionSummaries).toEqual({
      [BOUND_BEACH_ID]: "GOOD",
    });
  });

  it("fetches current forecasts from enhanced_forecasts for a single beach", async () => {
    const { forecastChain } = mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "1.2")],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(mockSupabaseClient.from).toHaveBeenCalledWith("enhanced_forecasts");
    expect(forecastChain.in).toHaveBeenCalledWith("beach_id", ["beach-1"]);
    expect(data.data.forecasts["beach-1"]).toBe(1.2);
  });

  it("starts hourly timeline and beach metadata reads before the main forecast resolves", async () => {
    const forecastRead = deferred<QueryResult<ForecastRow[]>>();
    let timelineReadStarted = false;
    let beachReadStarted = false;
    const forecastChain = queryChain<ForecastRow[]>({
      data: null,
      error: null,
    });
    forecastChain.then.mockImplementation(
      (onResolve: (value: QueryResult<ForecastRow[]>) => unknown) =>
        forecastRead.promise.then(onResolve),
    );
    const timelineChain = queryChain<ForecastRow[]>({
      data: [],
      error: null,
    });
    timelineChain.then.mockImplementation(
      (onResolve: (value: QueryResult<ForecastRow[]>) => unknown) => {
        timelineReadStarted = true;
        return Promise.resolve(onResolve({ data: [], error: null }));
      },
    );
    const beachChain = queryChain<BeachRow[]>({
      data: [beachRow("beach-1")],
      error: null,
    });
    beachChain.then.mockImplementation(
      (onResolve: (value: QueryResult<BeachRow[]>) => unknown) => {
        beachReadStarted = true;
        return Promise.resolve(onResolve({ data: [beachRow("beach-1")], error: null }));
      },
    );
    let enhancedForecastCalls = 0;
    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === "enhanced_forecasts") {
        enhancedForecastCalls += 1;
        return enhancedForecastCalls === 1 ? forecastChain : timelineChain;
      }
      if (table === "beaches") return beachChain;
      return queryChain({ data: null, error: null });
    }) as any;

    const responsePromise = GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly",
      ),
    );
    let readsStartedBeforeForecastResolved = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (timelineReadStarted && beachReadStarted) {
        readsStartedBeforeForecastResolved = true;
        break;
      }
      await Promise.resolve();
    }

    forecastRead.resolve({
      data: [forecastRow("beach-1", "1.2")],
      error: null,
    });
    await responsePromise;

    expect(readsStartedBeforeForecastResolved).toBe(true);
  });

  it("starts the hourly timeline continuation read before timeline rows resolve", async () => {
    const timelineRowsRead = deferred<QueryResult<ForecastRow[]>>();
    let continuationReadStarted = false;
    const timelineChain = queryChain<ForecastRow[]>({ data: [], error: null });
    timelineChain.then.mockImplementation(
      (onResolve: (value: QueryResult<ForecastRow[]>) => unknown) =>
        timelineRowsRead.promise.then(onResolve),
    );
    const continuationChain = queryChain<ForecastRow[]>({ data: [], error: null });
    continuationChain.then.mockImplementation(
      (onResolve: (value: QueryResult<ForecastRow[]>) => unknown) => {
        continuationReadStarted = true;
        return Promise.resolve(onResolve({ data: [], error: null }));
      },
    );
    let enhancedForecastCalls = 0;
    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === "enhanced_forecasts") {
        enhancedForecastCalls += 1;
        return enhancedForecastCalls === 1 ? timelineChain : continuationChain;
      }
      return queryChain({ data: null, error: null });
    }) as any;

    const responsePromise = GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=2",
      ),
    );
    let continuationStartedBeforeRowsResolved = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (continuationReadStarted) {
        continuationStartedBeforeRowsResolved = true;
        break;
      }
      await Promise.resolve();
    }

    timelineRowsRead.resolve({ data: [], error: null });
    await responsePromise;

    expect(continuationStartedBeforeRowsResolved).toBe(true);
  });

  it("fetches forecasts for multiple beaches", async () => {
    const { forecastChain } = mockBulkQueries({
      forecastRows: [
        forecastRow("beach-1", "2.5"),
        forecastRow("beach-2", "3.2"),
        forecastRow("beach-3", "1.8"),
      ],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2,beach-3",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(forecastChain.in).toHaveBeenCalledWith("beach_id", [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);
    expect(data.data.forecasts).toEqual({
      "beach-1": 2.5,
      "beach-2": 3.2,
      "beach-3": 1.8,
    });
  });

  it("returns the canonical today headline display instead of recomputing from the first row", async () => {
    const currentRow = forecastRow("beach-1", "1.9", 1);
    const headlineRow = forecastRow("beach-1", "2.7", 10);
    (resolveTodayHeadline as jest.Mock).mockImplementationOnce(
      ({ forecasts }: { forecasts: ForecastRow[] }) => {
        const forecast =
          forecasts.find((row) => row.wave_height === "2.7") ?? headlineRow;
        const display = mockDisplayForForecast(forecast, "today_headline");
        return {
          display,
          window: {
            start: new Date(forecast.forecast_at),
            end: new Date(
              new Date(forecast.forecast_at).getTime() + 60 * 60 * 1000,
            ),
            waveHeight: forecast.wave_height,
            sourceForecast: forecast,
          },
        };
      },
    );
    mockBulkQueries({
      forecastRows: [currentRow, headlineRow],
      beachRows: [beachRow("beach-1")],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.displayForecasts["beach-1"]).toMatchObject({
      label: "2-3ft",
      minFt: 2,
      maxFt: 3,
      forecastAt: headlineRow.forecast_at,
      context: "today_headline",
    });
    expect(data.data.forecasts).toEqual({ "beach-1": 2.7 });
  });

  it("falls back to the row nearest now when no today headline window remains (after sunset)", async () => {
    // Evening: selectBestWindow finds no remaining daylight window, so
    // resolveTodayHeadline returns null. Markers and the spot sheet must still
    // get current conditions rather than an empty map and SURF UNKNOWN.
    const eveningRow = forecastRow(BOUND_BEACH_ID, "2.1", 1);
    const tomorrowRow = forecastRow(BOUND_BEACH_ID, "2.8", 12);
    (resolveTodayHeadline as jest.Mock).mockImplementationOnce(() => null);
    mockBulkQueries({
      forecastRows: [eveningRow, tomorrowRow],
      beachRows: [beachRow(BOUND_BEACH_ID)],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        `http://localhost:3000/api/forecasts/bulk?beachIds=${BOUND_BEACH_ID}`,
        { headers: { "x-forwarded-for": "203.0.113.242" } },
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.displayForecasts[BOUND_BEACH_ID]).toMatchObject({
      forecastAt: eveningRow.forecast_at,
    });
    expect(data.data.forecasts).toEqual({ [BOUND_BEACH_ID]: 2.1 });
    // The fallback row is scored too (mock scorer returns 72 → GOOD), so the
    // marker keeps a verdict instead of falling to UNKNOWN.
    expect(data.data.conditionSummaries[BOUND_BEACH_ID]).toBe("GOOD");
  });

  it("limits, trims, and filters beach IDs before querying", async () => {
    const beachIds = Array.from({ length: 60 }, (_, i) => `beach-${i}`);
    const { forecastChain } = mockBulkQueries();

    await GET(
      createMockRequest(
        "GET",
        `http://localhost:3000/api/forecasts/bulk?beachIds= ${beachIds.join(" , ")} ,,`,
      ),
    );

    expect(forecastChain.in).toHaveBeenCalledWith(
      "beach_id",
      beachIds.slice(0, 50),
    );
  });

  it("returns a 500 error when the forecast query fails", async () => {
    mockBulkQueries({
      forecastRows: null,
      forecastError: { message: "Database connection failed" },
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to fetch bulk forecasts");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching bulk forecasts:",
        { message: "Database connection failed" },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("returns empty maps when no forecast rows match", async () => {
    mockBulkQueries();

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data).toEqual({
      forecasts: {},
      displayForecasts: {},
      waterTemps: {},
      isCalibrated: {},
      conditionScores: {},
      conditionSummaries: {
        "beach-1": "UNKNOWN",
        "beach-2": "UNKNOWN",
      },
      swellPartitions: {},
      swellPartitionTimeline: {},
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch: "hold-state-unavailable",
      },
    });
  });

  it("omits beaches with null or non-numeric wave_height", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-1", null),
        forecastRow("beach-2", "knee high"),
      ],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.forecasts).toEqual({});
    expect(data.data.displayForecasts).toEqual({});
  });

  it("parses v5.1 display ranges without dropping the beach", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "3-4ft")],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.forecasts).toEqual({ "beach-1": 3 });
    expect(data.data.displayForecasts["beach-1"]).toMatchObject({
      label: "3-4ft",
      context: "today_headline",
    });
  });

  it("returns a five-step swell partition timeline from nearest forecast rows", async () => {
    mockBulkQueries({
      forecastRows: hourlyTimelineRows(),
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.swellPartitionTimeline["beach-1"]).toHaveLength(5);
    expect(data.data.swellPartitionTimeline["beach-1"][0]).toMatchObject({
      s1Dir: 270,
      s1PeriodS: 10,
      s1HeightFt: 0,
      windDir: 90,
    });
    expect(data.data.swellPartitionTimeline["beach-1"][1]).toMatchObject({
      s1Dir: 270,
      s1PeriodS: 10,
      s1HeightFt: 3,
      windDir: 90,
    });
    expect(data.data.swellPartitionTimeline["beach-1"][2]).toMatchObject({
      s1Dir: 270,
      s1PeriodS: 10,
      s1HeightFt: 6,
      windDir: 90,
    });
    expect(data.data.swellPartitionTimeline["beach-1"][4]).toMatchObject({
      s1HeightFt: 12,
    });
  });

  it("returns a complete default 48-hour timeline from nearby forecast samples", async () => {
    const rows = [
      hourlyTimelineRow("beach-1", "2", "2026-07-07T20:15:00.000Z"),
      hourlyTimelineRow("beach-1", "3", "2026-07-07T21:00:00.000Z"),
    ];
    const { hourlyTimelineChain } = mockBulkQueries({
      forecastRows: rows,
      hourlyTimelineRows: rows,
    });

    const hourlyResponse = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly",
      ),
    );
    const hourlyData = await expectSuccessResponse<BulkForecastResponse>(
      hourlyResponse,
      200,
    );

    expect(hourlyTimelineChain.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-07T15:00:00.000Z",
    );
    expect(hourlyTimelineChain.lt).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-09T21:00:00.000Z",
    );
    expect(hourlyTimelineChain.order).toHaveBeenCalledWith("forecast_at", {
      ascending: true,
    });
    const timeline = hourlyData.data.hourlySwellTimeline;
    expect(timeline?.timestamps).toHaveLength(48);
    expect(timeline?.timestamps[0]).toBe("2026-07-07T18:00:00.000Z");
    expect(timeline?.timestamps.at(-1)).toBe("2026-07-09T17:00:00.000Z");
    expect(timeline?.partitionsByBeach["beach-1"]).toHaveLength(48);
    expect(timeline?.partitionsByBeach["beach-1"].slice(0, 5)).toEqual([
      null,
      null,
      null,
      expect.objectContaining({ s1HeightFt: 3 }),
      null,
    ]);
    expect(timeline).toMatchObject({ hasMore: false, nextStart: null });
    expect(hourlyData.data.swellPartitionTimeline["beach-1"]).toHaveLength(43);
  });

  it("aligns requested beaches, clamps the window, and keeps a contiguous cursor", async () => {
    const windowRows = [
      hourlyTimelineRow("beach-1", "2", "2026-07-10T18:00:00.000Z"),
      hourlyTimelineRow("beach-1", "2", "2026-07-10T21:00:00.000Z"),
      hourlyTimelineRow("beach-2", "3", "2026-07-10T21:00:00.000Z"),
    ];
    const nextRow = hourlyTimelineRow(
      "beach-1",
      "4",
      "2026-07-24T21:00:00.000Z",
    );
    const { hourlyTimelineChain, nextHourlyTimelineChain } = mockBulkQueries({
      hourlyTimelineRows: windowRows,
      nextHourlyTimelineRows: [nextRow],
      extensionOnly: true,
    });

    const hourlyResponse = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=999",
      ),
    );
    const hourlyData = await expectSuccessResponse<BulkForecastResponse>(
      hourlyResponse,
      200,
    );

    expect(hourlyTimelineChain.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-10T17:00:00.000Z",
    );
    expect(hourlyTimelineChain.lt).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-24T23:00:00.000Z",
    );
    expect(nextHourlyTimelineChain.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-24T20:00:00.000Z",
    );
    expect(nextHourlyTimelineChain.order).toHaveBeenCalledWith("forecast_at", {
      ascending: true,
    });
    expect(nextHourlyTimelineChain.limit).toHaveBeenCalledWith(1);
    const maximumWindowAnchors = hourlyTimelineChain.in.mock.calls.find(
      ([column]: [string]) => column === "forecast_at",
    )?.[1] as string[];
    expect(maximumWindowAnchors).toHaveLength(114);
    expect(maximumWindowAnchors.length * 8).toBe(912);
    const timeline = hourlyData.data.hourlySwellTimeline;
    expect(timeline?.timestamps).toHaveLength(14 * 24);
    expect(timeline?.timestamps[0]).toBe("2026-07-10T20:00:00.000Z");
    expect(timeline?.timestamps.at(-1)).toBe("2026-07-24T19:00:00.000Z");
    expect(timeline?.partitionsByBeach["beach-1"]).toHaveLength(14 * 24);
    expect(timeline?.partitionsByBeach["beach-2"]).toHaveLength(14 * 24);
    expect(timeline?.partitionsByBeach["beach-1"].slice(0, 3)).toEqual([
      expect.objectContaining({ s1HeightFt: 2 }),
      expect.objectContaining({ s1HeightFt: 2 }),
      null,
    ]);
    expect(timeline?.partitionsByBeach["beach-2"].slice(0, 4)).toEqual([
      null,
      expect.objectContaining({ s1HeightFt: 3 }),
      null,
      null,
    ]);
    expect(timeline).toMatchObject({
      hasMore: true,
      nextStart: "2026-07-24T20:00:00.000Z",
    });
  });

  it("keeps long forecast gaps visible instead of skipping calendar hours", async () => {
    const windowRows = [
      hourlyTimelineRow("beach-1", "2", "2026-07-10T21:00:00.000Z"),
      hourlyTimelineRow("beach-1", "4", "2026-07-11T03:00:00.000Z"),
    ];
    mockBulkQueries({
      hourlyTimelineRows: windowRows,
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=8",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
    const timeline = data.data.hourlySwellTimeline;

    expect(timeline?.timestamps).toEqual([
      "2026-07-10T20:00:00.000Z",
      "2026-07-10T21:00:00.000Z",
      "2026-07-10T22:00:00.000Z",
      "2026-07-10T23:00:00.000Z",
      "2026-07-11T00:00:00.000Z",
      "2026-07-11T01:00:00.000Z",
      "2026-07-11T02:00:00.000Z",
      "2026-07-11T03:00:00.000Z",
    ]);
    expect(timeline?.partitionsByBeach["beach-1"]).toEqual([
      null,
      expect.objectContaining({ s1HeightFt: 2 }),
      null,
      null,
      null,
      null,
      null,
      expect.objectContaining({ s1HeightFt: 4 }),
    ]);
  });

  it("uses an explicit hourly start and respects the requested timeline window", async () => {
    const windowRows = [
      hourlyTimelineRow("beach-1", "2", "2026-07-10T18:00:00.000Z"),
      hourlyTimelineRow("beach-1", "3", "2026-07-10T21:00:00.000Z"),
    ];
    const { hourlyTimelineChain } = mockBulkQueries({
      hourlyTimelineRows: windowRows,
      nextHourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "4", "2026-07-11T00:00:00.000Z"),
      ],
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(hourlyTimelineChain.lt).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-11T01:00:00.000Z",
    );
    expect(data.data.hourlySwellTimeline).toEqual({
      timestamps: ["2026-07-10T20:00:00.000Z", "2026-07-10T21:00:00.000Z"],
      partitionsByBeach: {
        "beach-1": [
          expect.objectContaining({ s1HeightFt: 2.6666666666666665 }),
          expect.objectContaining({ s1HeightFt: 3 }),
        ],
      },
      hasMore: true,
      nextStart: "2026-07-10T22:00:00.000Z",
    });
  });

  it("uses a three-hour query halo to interpolate both timeline boundaries", async () => {
    const { hourlyTimelineChain } = mockBulkQueries({
      hourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "2", "2026-07-10T18:00:00.000Z"),
        hourlyTimelineRow("beach-1", "4", "2026-07-10T21:00:00.000Z"),
      ],
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(hourlyTimelineChain.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-10T17:00:00.000Z",
    );
    expect(hourlyTimelineChain.lt).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-11T01:00:00.000Z",
    );
    const partitions = data.data.hourlySwellTimeline?.partitionsByBeach["beach-1"] as
      | Array<{ s1HeightFt?: number } | null>
      | undefined;
    expect(partitions?.[0]?.s1HeightFt).toBeCloseTo(3.3333, 3);
    expect(partitions?.[1]?.s1HeightFt).toBeCloseTo(4, 3);
  });

  it("bounds a ten-day timeline to eight beaches and three-hour anchors", async () => {
    const beachIds = Array.from({ length: 20 }, (_, index) => `beach-${index}`);
    const startMs = Date.parse("2026-07-10T20:00:00.000Z");
    const timelineBeachIds = beachIds.slice(0, 8);
    const rows = Array.from({ length: 82 }, (_, anchorIndex) =>
      timelineBeachIds.map((beachId, beachIndex) => hourlyTimelineRow(
        beachId,
        String(beachIndex + 1),
        new Date(startMs - 2 * 60 * 60 * 1000 + anchorIndex * 3 * 60 * 60 * 1000).toISOString(),
      )),
    ).flat();
    const { hourlyTimelineChain } = mockBulkQueries({
      hourlyTimelineRows: rows,
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        `http://localhost:3000/api/forecasts/bulk?beachIds=${beachIds.join(",")}&timeline=hourly&timelineBeachIds=${timelineBeachIds.join(",")}&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=241`,
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
    const timeline = data.data.hourlySwellTimeline;
    const forecastAtCall = hourlyTimelineChain.in.mock.calls.find(
      ([column]: [string]) => column === "forecast_at",
    );
    const anchorTimestamps = forecastAtCall?.[1] as string[];

    expect(hourlyTimelineChain.range).not.toHaveBeenCalled();
    expect(anchorTimestamps).toHaveLength(82);
    expect(anchorTimestamps.every((timestamp, index) =>
      index === 0 || Date.parse(timestamp) - Date.parse(anchorTimestamps[index - 1]) === 3 * 60 * 60 * 1000,
    )).toBe(true);
    expect(anchorTimestamps.length * timelineBeachIds.length).toBeLessThan(1_000);
    expect(hourlyTimelineChain.order).toHaveBeenCalledWith("beach_id", {
      ascending: true,
    });
    expect(timeline?.timestamps).toHaveLength(241);
    expect(Object.keys(timeline?.partitionsByBeach ?? {})).toEqual(timelineBeachIds);
    expect(timeline?.partitionsByBeach).not.toHaveProperty("beach-8");
  });

  it("uses only the hourly window and next-row queries for an extension", async () => {
    const {
      hourlyTimelineChain,
      nextHourlyTimelineChain,
      beachChain,
    } = mockBulkQueries({
      hourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "2", "2026-07-10T20:00:00.000Z"),
      ],
      nextHourlyTimelineRows: [],
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(Object.keys(data.data)).toEqual([
      "hourlySwellTimeline",
      "recommendationAvailability",
    ]);
    expect(data.data.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "hold-state-unavailable",
    });
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
    expect(mockSupabaseClient.from).toHaveBeenNthCalledWith(
      1,
      "enhanced_forecasts",
    );
    expect(mockSupabaseClient.from).toHaveBeenNthCalledWith(
      2,
      "enhanced_forecasts",
    );
    expect(hourlyTimelineChain.select).toHaveBeenCalledTimes(1);
    expect(nextHourlyTimelineChain.select).toHaveBeenCalledWith("forecast_at");
    expect(getProfileExperienceLevel).not.toHaveBeenCalled();
    expect(applyV51DisplayOverrideToForecasts).not.toHaveBeenCalled();
    expect(resolveTodayHeadline).not.toHaveBeenCalled();
    expect(getBatchSunTimes).not.toHaveBeenCalled();
    expect(scoreWindowConditionScore).not.toHaveBeenCalled();
    expect(beachChain.select).not.toHaveBeenCalled();
  });

  it("supports a validated timeline-only hourly request without forecast enrichment", async () => {
    const { hourlyTimelineChain, nextHourlyTimelineChain, beachChain } = mockBulkQueries({
      hourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "2", "2026-07-10T20:00:00.000Z"),
      ],
      nextHourlyTimelineRows: [],
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineOnly=true&timelineHours=336",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data).toEqual(expect.objectContaining({
      forecasts: {},
      displayForecasts: {},
      waterTemps: {},
      isCalibrated: {},
      conditionScores: {},
      conditionSummaries: {},
      swellPartitions: {},
      swellPartitionTimeline: {},
      hourlySwellTimeline: expect.any(Object),
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch: "hold-state-unavailable",
      },
    }));
    expect(data.data.hourlySwellTimeline?.timestamps).toHaveLength(336);
    expect(hourlyTimelineChain.select).toHaveBeenCalledTimes(1);
    expect(nextHourlyTimelineChain.select).toHaveBeenCalledWith("forecast_at");
    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
    expect(getProfileExperienceLevel).not.toHaveBeenCalled();
    expect(mockEvaluateMajorEventHoldCandidates).not.toHaveBeenCalled();
    expect(beachChain.select).not.toHaveBeenCalled();
  });

  it("rejects timeline-only requests without hourly timeline mode", async () => {
    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timelineOnly=true",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "timelineOnly requires timeline=hourly",
    });
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("keeps the main forecast error when auxiliary reads reject", async () => {
    const forecastChain = queryChain<ForecastRow[]>({
      data: null,
      error: { message: "Database connection failed" },
    });
    const timelineRowsChain = queryChain<ForecastRow[]>({ data: [], error: null });
    timelineRowsChain.then.mockImplementation(
      (_onResolve: unknown, onReject: (error: Error) => void) => {
        onReject(new Error("Timeline transport failed"));
        return Promise.resolve();
      },
    );
    const continuationChain = queryChain<ForecastRow[]>({ data: [], error: null });
    const beachChain = queryChain<BeachRow[]>({ data: [], error: null });
    beachChain.then.mockImplementation(
      (_onResolve: unknown, onReject: (error: Error) => void) => {
        onReject(new Error("Beach transport failed"));
        return Promise.resolve();
      },
    );
    let enhancedForecastCalls = 0;
    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === "enhanced_forecasts") {
        enhancedForecastCalls += 1;
        return [forecastChain, timelineRowsChain, continuationChain][enhancedForecastCalls - 1];
      }
      if (table === "beaches") return beachChain;
      return queryChain({ data: null, error: null });
    }) as any;

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("Failed to fetch bulk forecasts");
  });

  it("continues at the requested window end when the next row is later", async () => {
    const windowRows = [
      hourlyTimelineRow("beach-1", "2", "2026-07-10T20:00:00.000Z"),
    ];
    mockBulkQueries({
      hourlyTimelineRows: windowRows,
      nextHourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "4", "2026-07-11T00:00:00.000Z"),
      ],
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.hourlySwellTimeline).toEqual({
      timestamps: ["2026-07-10T20:00:00.000Z", "2026-07-10T21:00:00.000Z"],
      partitionsByBeach: {
        "beach-1": [
          null,
          null,
        ],
      },
      hasMore: true,
      nextStart: "2026-07-10T22:00:00.000Z",
    });
  });

  it.each([
    ["short gap", "2026-07-11T00:00:00.000Z"],
    ["multi-hour gap", "2026-07-11T06:00:00.000Z"],
  ])("keeps a contiguous cursor across a %s", async (_label, laterRow) => {
    mockBulkQueries({
      hourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "2", "2026-07-10T20:00:00.000Z"),
      ],
      nextHourlyTimelineRows: [hourlyTimelineRow("beach-1", "4", laterRow)],
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.hourlySwellTimeline).toMatchObject({
      timestamps: ["2026-07-10T20:00:00.000Z", "2026-07-10T21:00:00.000Z"],
      hasMore: true,
      nextStart: "2026-07-10T22:00:00.000Z",
    });
  });

  it("reports exhaustion when no later stored row exists", async () => {
    mockBulkQueries({
      hourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "2", "2026-07-10T20:00:00.000Z"),
      ],
      nextHourlyTimelineRows: [],
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=2",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.hourlySwellTimeline).toMatchObject({
      hasMore: false,
      nextStart: null,
    });
  });

  it("clamps hourly windows below one hour", async () => {
    const { hourlyTimelineChain } = mockBulkQueries({
      hourlyTimelineRows: [
        hourlyTimelineRow("beach-1", "2", "2026-07-10T20:00:00.000Z"),
      ],
      extensionOnly: true,
    });

    await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20:00:00.000Z&timelineHours=0",
      ),
    );

    expect(hourlyTimelineChain.lt).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-11T00:00:00.000Z",
    );
  });

  it("rejects an explicit malformed hourly timeline start", async () => {
    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=not-an-iso-date",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        success: false,
        error: "timelineStart must be an ISO-8601 timestamp with timezone",
      }),
    );
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("requires an explicit bounded timeline sample for larger marker sets", async () => {
    const beachIds = Array.from({ length: 9 }, (_, index) => `beach-${index}`);
    const response = await GET(
      createHourlyTimelineRequest(
        `http://localhost:3000/api/forecasts/bulk?beachIds=${beachIds.join(",")}&timeline=hourly`,
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: "timelineBeachIds is required when beachIds includes more than 8 beaches",
    }));
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "more than eight timeline beaches",
      timelineBeachIds: Array.from({ length: 9 }, (_, index) => `beach-${index}`),
      error: "timelineBeachIds supports at most 8 beaches",
    },
    {
      label: "a timeline beach outside the marker set",
      timelineBeachIds: ["beach-0", "other-beach"],
      error: "timelineBeachIds must be a subset of beachIds",
    },
  ])("rejects $label", async ({ timelineBeachIds, error }) => {
    const beachIds = Array.from({ length: 9 }, (_, index) => `beach-${index}`);
    const response = await GET(
      createHourlyTimelineRequest(
        `http://localhost:3000/api/forecasts/bulk?beachIds=${beachIds.join(",")}&timeline=hourly&timelineBeachIds=${timelineBeachIds.join(",")}`,
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({ error }));
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("rejects partial, decimal, and exponent timelineHours values", async () => {
    for (const timelineHours of ["2hours", "1.5", "2e1"]) {
      const response = await GET(
        createHourlyTimelineRequest(
          `http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineHours=${timelineHours}`,
        ),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          success: false,
          error: "timelineHours must be a whole integer",
        }),
      );
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("rejects locale and timezone-less timelineStart values", async () => {
    for (const timelineStart of [
      "July 10, 2026 20:00:00 UTC",
      "2026-07-10T20:00:00",
    ]) {
      const response = await GET(
        createHourlyTimelineRequest(
          `http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=${encodeURIComponent(timelineStart)}`,
        ),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          success: false,
          error: "timelineStart must be an ISO-8601 timestamp with timezone",
        }),
      );
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("accepts an hour-aligned ISO timelineStart with a numeric timezone offset", async () => {
    const rows = [
      hourlyTimelineRow("beach-1", "2", "2026-07-11T03:00:00.000Z"),
    ];
    const { hourlyTimelineChain } = mockBulkQueries({
      hourlyTimelineRows: rows,
      extensionOnly: true,
    });

    const response = await GET(
      createHourlyTimelineRequest(
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=2026-07-10T20%3A00%3A00-07%3A00&timelineHours=1",
      ),
    );

    expect(response.status).toBe(200);
    expect(hourlyTimelineChain.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-11T00:00:00.000Z",
    );
    expect(hourlyTimelineChain.lt).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-11T07:00:00.000Z",
    );
  });

  it("rejects timelineStart values with minute, second, or millisecond offsets", async () => {
    for (const timelineStart of [
      "2026-07-10T20:01:00.000Z",
      "2026-07-10T20:00:01.000Z",
      "2026-07-10T20:00:00.001Z",
    ]) {
      const response = await GET(
        createHourlyTimelineRequest(
          `http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly&timelineStart=${timelineStart}`,
        ),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          success: false,
          error: "timelineStart must be aligned to an hour",
        }),
      );
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("returns a 500 response when the hourly timeline query fails", async () => {
    mockBulkQueries({
      hourlyTimelineRows: null,
      hourlyTimelineError: { message: "timeline query failed" },
    });
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        createHourlyTimelineRequest(
          "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1&timeline=hourly",
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual(
        expect.objectContaining({
          success: false,
          error: "Failed to fetch hourly swell timeline",
        }),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching hourly swell timeline:",
        { message: "timeline query failed" },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("preserves flat v5.1 display as zero", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "Flat")],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.forecasts).toEqual({ "beach-1": 0 });
    expect(data.data.displayForecasts["beach-1"]).toMatchObject({
      label: "Flat",
      context: "today_headline",
    });
  });

  it("returns water temps from the nearest future enhanced forecast row", async () => {
    const nearestRow = forecastRow("beach-1", "2.5");
    nearestRow.water_temp = "64";
    mockBulkQueries({
      forecastRows: [nearestRow],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.waterTemps).toEqual({ "beach-1": "64" });
    expect(
      (mockSupabaseClient.from as jest.Mock).mock.calls.filter(
        ([table]) => table === "enhanced_forecasts",
      ),
    ).toHaveLength(1);
  });

  it("returns condition scores and native summaries for scored current rows", async () => {
    (scoreWindowConditionScore as jest.Mock)
      .mockReturnValueOnce(71)
      .mockReturnValueOnce(40)
      .mockReturnValueOnce(39);
    mockBulkQueries({
      forecastRows: [
        forecastRow(BOUND_BEACH_ID, "3.5"),
        forecastRow(BOUND_BEACH_ID_TWO, "2.5"),
        forecastRow(BOUND_BEACH_ID_THREE, "1.2"),
      ],
      beachRows: [
        beachRow(BOUND_BEACH_ID),
        beachRow(BOUND_BEACH_ID_TWO),
        beachRow(BOUND_BEACH_ID_THREE),
      ],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        `http://localhost:3000/api/forecasts/bulk?beachIds=${BOUND_BEACH_ID},${BOUND_BEACH_ID_TWO},${BOUND_BEACH_ID_THREE},${BOUND_BEACH_ID_FOUR}`,
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.conditionScores).toEqual({
      [BOUND_BEACH_ID]: 71,
      [BOUND_BEACH_ID_TWO]: 40,
      [BOUND_BEACH_ID_THREE]: 39,
    });
    expect(data.data.conditionSummaries).toEqual({
      [BOUND_BEACH_ID]: "GOOD",
      [BOUND_BEACH_ID_TWO]: "RIDEABLE",
      [BOUND_BEACH_ID_THREE]: "MEH",
      [BOUND_BEACH_ID_FOUR]: "UNKNOWN",
    });
  });

  it("binds policy to the selected score forecast and sanitizes after physical computation", async () => {
    const currentRow = forecastRow(BOUND_BEACH_ID, "1.9", 1);
    const selectedScoreRow = forecastRow(BOUND_BEACH_ID, "3.7", 10);
    (resolveTodayHeadline as jest.Mock).mockImplementationOnce(() => ({
      display: mockDisplayForForecast(selectedScoreRow, "today_headline"),
      window: {
        start: new Date(selectedScoreRow.forecast_at),
        end: new Date(
          Date.parse(selectedScoreRow.forecast_at) + 60 * 60 * 1000,
        ),
        waveHeight: selectedScoreRow.wave_height,
        sourceForecast: selectedScoreRow,
      },
    }));
    mockBulkQueries({
      forecastRows: [currentRow, selectedScoreRow],
      beachRows: [beachRow(BOUND_BEACH_ID)],
    });
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
      ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        Promise.resolve(
          candidates.map(({ candidateId }) =>
            majorEventDecision(candidateId, "blocked"),
          ),
        ),
    );

    const response = await GET(
      createMockRequest(
        "GET",
        `http://localhost:3000/api/forecasts/bulk?beachIds=${BOUND_BEACH_ID}`,
        { headers: { "x-forwarded-for": "203.0.113.240" } },
      ),
    );
    const body = await expectSuccessResponse<any>(response, 200);
    const expectedEnd = new Date(
      Date.parse(selectedScoreRow.forecast_at) + 3 * 60 * 60 * 1000,
    ).toISOString();

    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: [
        {
          candidateId: `bulk-forecast:${BOUND_BEACH_ID}:${selectedScoreRow.forecast_at}`,
          beachId: BOUND_BEACH_ID,
          startsAt: selectedScoreRow.forecast_at,
          endsAt: expectedEnd,
        },
      ],
      profileExperience: null,
    });
    expect(body.data.forecasts).toEqual({ [BOUND_BEACH_ID]: 3.7 });
    expect(body.data.displayForecasts[BOUND_BEACH_ID]).toMatchObject({
      forecastAt: selectedScoreRow.forecast_at,
    });
    expect(body.data.conditionScores).toEqual({});
    expect(body.data.conditionSummaries).toEqual({
      [BOUND_BEACH_ID]: "UNKNOWN",
    });
    expect(body.data.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
    expect(JSON.stringify(body)).not.toMatch(
      /internal-hold-id|holdIds|evaluation/,
    );
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("fails unresolved policy closed while retaining physical forecast fields", async () => {
    const row = forecastRow(BOUND_BEACH_ID, "2.5", 2);
    mockBulkQueries({
      forecastRows: [row],
      beachRows: [beachRow(BOUND_BEACH_ID)],
    });
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
      ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        Promise.resolve(
          candidates.map(({ candidateId }) =>
            majorEventDecision(candidateId, "unavailable"),
          ),
        ),
    );

    const response = await GET(
      createMockRequest(
        "GET",
        `http://localhost:3000/api/forecasts/bulk?beachIds=${BOUND_BEACH_ID}`,
        { headers: { "x-forwarded-for": "203.0.113.241" } },
      ),
    );
    const body = await expectSuccessResponse<any>(response, 200);

    expect(body.data.forecasts).toEqual({ [BOUND_BEACH_ID]: 2.5 });
    expect(body.data.conditionScores).toEqual({});
    expect(body.data.conditionSummaries[BOUND_BEACH_ID]).toBe("UNKNOWN");
    expect(body.data.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
  });

  it("keeps wave-height data when condition scoring fails", async () => {
    (scoreWindowConditionScore as jest.Mock).mockImplementation(() => {
      throw new Error("scoring unavailable");
    });
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "2.5")],
      beachRows: [beachRow("beach-1")],
    });
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
        ),
      );
      const data = await expectSuccessResponse<BulkForecastResponse>(
        response,
        200,
      );

      expect(data.data.forecasts).toEqual({ "beach-1": 2.5 });
      expect(data.data.conditionScores).toEqual({});
      expect(data.data.conditionSummaries).toEqual({ "beach-1": "UNKNOWN" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to score bulk forecast condition:",
        expect.objectContaining({ beachId: "beach-1" }),
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("returns calibration status for beaches with shoaling_factors", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-a", "2.5"),
        forecastRow("beach-b", "3.1"),
      ],
      beachRows: [
        beachRow("beach-a", { shoaling_factors: { "270": 1.05 } }),
        beachRow("beach-b", { shoaling_factors: null }),
      ],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-a,beach-b",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(
      response,
      200,
    );

    expect(data.data.isCalibrated).toEqual({
      "beach-a": true,
      "beach-b": false,
    });
  });

  it("keeps forecast data when the calibration query fails", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "2.5")],
      beachRows: null,
      beachError: { message: "rls denied" },
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        createMockRequest(
          "GET",
          "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
        ),
      );
      const data = await expectSuccessResponse<BulkForecastResponse>(
        response,
        200,
      );

      expect(data.data.forecasts).toEqual({ "beach-1": 2.5 });
      expect(data.data.isCalibrated).toEqual({});
      expect(data.data.conditionSummaries).toEqual({ "beach-1": "UNKNOWN" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching beach calibration status:",
        { message: "rls denied" },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
