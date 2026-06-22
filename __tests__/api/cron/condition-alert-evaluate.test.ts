/** @jest-environment node */

/**
 * Unit tests for condition-alert-evaluate — A4.2 flat-query rewrite.
 *
 * Covers:
 * 1. Happy path: 1 rule + matching forecast => 1 alert_queue upsert, queued >= 1.
 * 2. Empty rules: 0 rules => message "No rules to evaluate", no DB writes after rules query.
 * 3. Missing profile: rule exists but profile lookup returns empty => rule skipped,
 *    summary.errors incremented, route does not crash.
 * 4. Existing delivery for today: alert_deliveries row present => all rules for user skipped.
 *
 * Mocking strategy: per-table chain factory matching the established pattern in
 * condition-alert-deliver.test.ts. Each Supabase table gets its own chain that
 * simulates the fluent filter API and resolves from a seeded store.
 */

// Polyfill Response.json for Jest node env
if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
}

import { GET } from "@/app/api/cron/condition-alert-evaluate/route";
import { readFileSync } from "fs";

// ---- Mocks ----

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(() => true),
}));

// withCronObservability: pass through to the handler without touching cron_runs table.
jest.mock("@/lib/cron/observability", () => ({
  withCronObservability: jest.fn(async (_route: string, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

// Mock window-finder + sunrise + timezone-utils so we control matching behaviour.
// jest.fn<TReturn, TArgs extends any[]> accepts variadic args so the (...args)
// spread in the jest.mock factory below typechecks cleanly.
const mockFindMatchingWindows = jest.fn<any, any[]>();
const mockFilterToDaylight = jest.fn<any, any[]>((...args: any[]) => args[0]);
const mockGetDaylightWindow = jest.fn<any, any[]>(() => ({
  sunrise: new Date("2026-04-26T13:00:00Z"),
  sunset: new Date("2026-04-27T02:00:00Z"),
}));
const mockGetUtcDayBounds = jest.fn<any, any[]>(() => ({
  start: "2026-04-26T00:00:00.000Z",
  end: "2026-04-27T00:00:00.000Z",
}));
const mockResolveEntitlement = jest.fn<any, any[]>(() => "free" as const);
const mockSelectBestWindow = jest.fn<any, any[]>();
const mockComputeSurfCall = jest.fn<any, any[]>();
const mockSelectActionableAlertWindow = jest.fn<any, any[]>(
  (windows: any[]) => windows[0] ?? null
);

jest.mock("@/lib/alerts/window-finder", () => ({
  findMatchingWindows: (...args: any[]) => mockFindMatchingWindows(...args),
}));
jest.mock("@/lib/alerts/sunrise", () => ({
  filterToDaylight: (...args: any[]) => mockFilterToDaylight(...args),
  getDaylightWindow: (...args: any[]) => mockGetDaylightWindow(...args),
}));
jest.mock("@/lib/alerts/timezone-utils", () => ({
  getUtcDayBounds: (...args: any[]) => mockGetUtcDayBounds(...args),
}));
jest.mock("@/lib/alerts/entitlements", () => ({
  resolveEntitlement: (...args: any[]) => mockResolveEntitlement(...args),
  CAPS: {
    free: { beaches: 1, rulesPerBeach: 3, totalRules: 3 },
    premium: { beaches: 10, rulesPerBeach: 5, totalRules: 50 },
  },
}));
jest.mock("@/lib/alerts/actionable-window-selector", () => ({
  selectActionableAlertWindow: (...args: any[]) =>
    mockSelectActionableAlertWindow(...args),
}));
jest.mock("@/lib/services/discovery", () => ({
  selectBestWindow: (...args: any[]) => mockSelectBestWindow(...args),
}));
jest.mock("@/lib/utils/surf-call-logic", () => {
  const actual = jest.requireActual("@/lib/utils/surf-call-logic");
  return {
    ...actual,
    computeSurfCall: (...args: any[]) => mockComputeSurfCall(...args),
  };
});

// ---- Store + mock Supabase ----

const USER_A = "00000000-0000-0000-0000-000000000001";
const RULE_1 = "00000000-0000-0000-0000-0000000000a1";
const BEACH_1 = "00000000-0000-0000-0000-0000000000b1";
const TEST_NOW = new Date("2026-04-26T12:00:00Z");

interface Store {
  rules: any[];
  profiles: any[];
  beaches: any[];
  entitlements: any[];
  deliveries: any[]; // alert_deliveries
  deliveriesError: Error | null;
  forecasts: any[]; // enhanced_forecasts
  forecastsError: Error | null;
  queueUpserts: any[];
  ruleUpdates: { id: string; last_matched_at: string }[];
}

const store: Store = {
  rules: [],
  profiles: [],
  beaches: [],
  entitlements: [],
  deliveries: [],
  deliveriesError: null,
  forecasts: [],
  forecastsError: null,
  queueUpserts: [],
  ruleUpdates: [],
};

/**
 * Builds a minimal Supabase query chain. Supports the fluent methods used by
 * condition-alert-evaluate: select, eq, in, gte, lt, order, limit, upsert, update.
 * Resolves via `rowsResolver()` so seeding after chain creation is fine.
 */
function makeChain(rowsResolver: () => any[], onUpsert?: (row: any) => void) {
  const chain: any = {
    _filters: {} as Record<string, any>,
    _neqFilters: {} as Record<string, any>,
    select: jest.fn(() => chain),
    eq: jest.fn((_col: string, val: any) => { chain._filters[_col] = val; return chain; }),
    neq: jest.fn((_col: string, val: any) => { chain._neqFilters[_col] = val; return chain; }),
    in: jest.fn((_col: string, vals: any[]) => { chain._filters[`${_col}__in`] = vals; return chain; }),
    gte: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    upsert: jest.fn((row: any, _opts?: any) => {
      onUpsert?.(row);
      return Promise.resolve({ error: null });
    }),
    update: jest.fn((vals: any) => {
      const updateChain: any = {
        eq: jest.fn((_col: string, val: any) => {
          store.ruleUpdates.push({ id: val, ...vals });
          return Promise.resolve({ error: null });
        }),
      };
      return updateChain;
    }),
    // Promise resolution (then is the terminal for most selects)
    then: jest.fn((resolve: any) =>
      resolve({
        data: rowsResolver().filter((row) =>
          Object.entries(chain._neqFilters).every(([col, val]) => row?.[col] !== val)
        ),
        error: null,
      })
    ),
    single: jest.fn(() => Promise.resolve({ data: rowsResolver()[0] ?? null, error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: rowsResolver()[0] ?? null, error: null })),
  };
  return chain;
}

function mockFrom(table: string) {
  switch (table) {
    case "alert_rules": {
      const chain = makeChain(() => store.rules);
      // Also handle update (for last_matched_at)
      chain.update = jest.fn((vals: any) => ({
        eq: jest.fn((_col: string, val: any) => {
          store.ruleUpdates.push({ id: val, ...vals });
          return Promise.resolve({ error: null });
        }),
      }));
      return chain;
    }
    case "profiles":
      return makeChain(() => store.profiles);
    case "beaches":
      return makeChain(() => store.beaches);
    case "user_entitlements":
      return makeChain(() => store.entitlements);
    case "alert_deliveries":
      if (store.deliveriesError) {
        const chain = makeChain(() => []);
        chain.then = jest.fn((resolve: any) =>
          resolve({ data: null, error: store.deliveriesError })
        );
        return chain;
      }
      return makeChain(() => store.deliveries);
    case "enhanced_forecasts":
      if (store.forecastsError) {
        const chain = makeChain(() => []);
        chain.then = jest.fn((resolve: any) =>
          resolve({ data: null, error: store.forecastsError })
        );
        return chain;
      }
      return makeChain(() => store.forecasts);
    case "alert_queue":
      return makeChain(() => [], (row) => store.queueUpserts.push(row));
    default:
      return makeChain(() => []);
  }
}

const mockSupabase = { from: jest.fn(mockFrom) };
let consoleLogSpy: jest.SpyInstance;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// ---- Seed helpers ----

function seedRule(overrides: Partial<any> = {}) {
  store.rules.push({
    id: RULE_1,
    user_id: USER_A,
    beach_id: BEACH_1,
    name: "Test Rule",
    conditions: { swell_height_min: 2 },
    notify_email: true,
    notify_push: false,
    preset_type: "glass_off",
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  });
}

function seedProfile(overrides: Partial<any> = {}) {
  store.profiles.push({
    id: USER_A,
    home_beach_id: BEACH_1,
    notif_forecast_alerts: true,
    notif_email_enabled: true,
    notif_push_enabled: false,
    ...overrides,
  });
}

function seedBeach(overrides: Partial<any> = {}) {
  store.beaches.push({
    id: BEACH_1,
    name: "Test Beach",
    slug: "test-beach",
    lat: 34.0,
    lon: -118.5,
    timezone: "America/Los_Angeles",
    wind_offshore_deg: 270,
    wind_offshore_tol_deg: 45,
    aspect_deg: 270,
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    preferred_tide_direction: null,
    swell_window_center_deg: null,
    swell_window_halfwidth_deg: null,
    break_type: "beach",
    skill_level: "",
    ...overrides,
  });
}

function seedForecast() {
  store.forecasts.push({
    forecast_at: "2026-04-26T14:00:00Z",
    wave_height: "3.5",
    wave_period: "12s",
    swell_1_height: "3",
    swell_1_period: "12s",
    swell_1_direction: "270",
    wind_speed: "5 mph",
    wind_direction_deg: 270,
    tide_height: "2.1",
    tide_status: "rising",
  });
}

function seedMatchingWindow(bestScore = 0.9) {
  mockFindMatchingWindows.mockReturnValueOnce([
    {
      rule_id: RULE_1,
      rule_name: "Test Rule",
      beach_id: BEACH_1,
      beach_name: "Test Beach",
      beach_timezone: "America/Los_Angeles",
      window_start: "2026-04-26T14:00:00Z",
      window_end: "2026-04-26T16:00:00Z",
      best_hour: "2026-04-26T15:00:00Z",
      best_score: bestScore,
      conditions_snapshot: { wave_height: 3.5 },
      notify_email: true,
      notify_push: false,
    },
  ]);
}

function makeRequest(): Request {
  return new Request("https://quiversurf.app/api/cron/condition-alert-evaluate", {
    method: "GET",
    headers: { authorization: "Bearer dummy" },
  });
}

// ---- Reset ----

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(TEST_NOW);
  jest.clearAllMocks();
  consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  // mockReset drains any `mockReturnValueOnce` queue left over from a prior
  // test (jest.clearAllMocks does NOT clear that queue, only call records).
  mockFindMatchingWindows.mockReset();
  mockFilterToDaylight.mockReset();
  mockSelectActionableAlertWindow.mockReset();
  mockSelectBestWindow.mockReset();
  mockComputeSurfCall.mockReset();
  store.rules = [];
  store.profiles = [];
  store.beaches = [];
  store.entitlements = [];
  store.deliveries = [];
  store.deliveriesError = null;
  store.forecasts = [];
  store.forecastsError = null;
  store.queueUpserts = [];
  store.ruleUpdates = [];

  // Stable defaults — tests that need different behaviour override these.
  mockFindMatchingWindows.mockReturnValue([]);
  mockFilterToDaylight.mockImplementation((hours: any[]) => hours);
  mockGetDaylightWindow.mockReturnValue({
    sunrise: new Date("2026-04-26T13:00:00Z"),
    sunset: new Date("2026-04-27T02:00:00Z"),
  });
  mockGetUtcDayBounds.mockReturnValue({
    start: "2026-04-26T00:00:00.000Z",
    end: "2026-04-27T00:00:00.000Z",
  });
  mockResolveEntitlement.mockReturnValue("free");
  mockSelectActionableAlertWindow.mockImplementation(
    (windows: any[]) => windows[0] ?? null
  );
  mockSelectBestWindow.mockImplementation(({ forecasts }: any) => {
    const forecast = forecasts[0];
    return {
      start: new Date("2026-04-26T16:00:00Z"),
      end: new Date("2026-04-26T18:00:00Z"),
      tide: forecast?.tide_status ?? "Unknown",
      wind: forecast?.wind_speed ?? "Unknown",
      waveHeight: forecast?.wave_height ?? "Unknown",
      wavePeriod: forecast?.wave_period ?? "Unknown",
      dataSource: forecast?.data_source ?? "TEST",
      confidence: forecast?.confidence_score ?? 80,
      score: 90,
      peakTime: new Date("2026-04-26T17:00:00Z"),
      sourceForecast: forecast,
    };
  });
  mockComputeSurfCall.mockImplementation((window: any) => ({
    bestWindowStart: window?.start?.toISOString() ?? null,
    bestWindowEnd: window?.end?.toISOString() ?? null,
    peakTime: window?.peakTime?.toISOString() ?? null,
  }));

  // Reset the mockSupabase.from implementation so per-test seeds are isolated.
  mockSupabase.from.mockImplementation(mockFrom);
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  jest.useRealTimers();
});

// ---- Tests ----

describe("condition-alert-evaluate — A4.2 flat queries", () => {
  const routeSource = readFileSync("app/api/cron/condition-alert-evaluate/route.ts", "utf8");

  it("uses the API wrapper barrel for cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("1. happy path: 1 rule + matching forecast window => upserts 1 alert_queue row", async () => {
    seedRule();
    seedProfile();
    seedBeach();
    seedForecast();
    seedMatchingWindow(0.73);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.evaluated).toBe(1);
    expect(body.matched).toBe(1);
    expect(body.queued).toBeGreaterThanOrEqual(1);
    expect(body.errors).toBe(0);

    expect(store.queueUpserts).toHaveLength(1);
    expect(store.queueUpserts[0]).toMatchObject({
      user_id: USER_A,
      rule_id: RULE_1,
      beach_id: BEACH_1,
      alert_date: expect.any(String),
      window_start: "2026-04-26T14:00:00Z",
      window_end: "2026-04-26T16:00:00Z",
      best_hour: "2026-04-26T15:00:00Z",
      best_score: 0.73,
      conditions_snapshot: { wave_height: 3.5 },
    });
    expect(mockSelectBestWindow).not.toHaveBeenCalled();
    expect(mockComputeSurfCall).not.toHaveBeenCalled();

    // last_matched_at must be stamped
    expect(store.ruleUpdates).toHaveLength(1);
    expect(store.ruleUpdates[0].id).toBe(RULE_1);
    expect(typeof store.ruleUpdates[0].last_matched_at).toBe("string");
  });

  it("2. empty rules: 0 enabled rules => no DB writes after rules query, message returned", async () => {
    // No rules seeded — rules store stays empty.

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("No rules to evaluate");
    // The early-return spreads `result` which includes queued:0 — confirm it's 0.
    expect(body.queued).toBe(0);

    // No queue upserts, no rule updates
    expect(store.queueUpserts).toHaveLength(0);
    expect(store.ruleUpdates).toHaveLength(0);
  });

  it("2b. excludes similarity_match rules from the generic condition evaluator", async () => {
    seedRule({
      name: "Conditions like your best sessions",
      preset_type: "similarity_match",
      conditions: {},
    });
    seedProfile();
    seedBeach();
    seedForecast();
    seedMatchingWindow();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.evaluated).toBe(0);
    expect(body.matched).toBe(0);
    expect(body.queued).toBe(0);
    expect(mockFindMatchingWindows).not.toHaveBeenCalled();
    expect(store.queueUpserts).toHaveLength(0);
    expect(store.ruleUpdates).toHaveLength(0);
  });

  it("3. missing profile: rule exists but profile lookup returns empty => errors++ and route does not crash", async () => {
    seedRule();
    // No profile seeded — profilesById.get(USER_A) will be undefined.
    seedBeach();

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(makeRequest());
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No profile found for user")
    );
    consoleErrorSpy.mockRestore();

    expect(res.status).toBe(200);

    const body = await res.json();
    // Route should complete without crashing and increment errors for the rule
    // where no profile was found.
    expect(body.errors).toBeGreaterThanOrEqual(1);
    // No queue writes since the rule was skipped.
    expect(store.queueUpserts).toHaveLength(0);
  });

  it("4. existing delivery for today: all rules for that user are skipped", async () => {
    seedRule();
    seedProfile();
    seedBeach();
    seedForecast();
    seedMatchingWindow();

    // Pre-seed a delivery for today so the dedupe check fires.
    store.deliveries.push({
      id: "00000000-0000-0000-0000-000000000099",
      user_id: USER_A,
      alert_date: "2026-04-26",
      channel: "email",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    // evaluated stays 0 because we never enter the inner rule loop
    expect(body.queued).toBe(0);
    // No queue upserts, no rule updates
    expect(store.queueUpserts).toHaveLength(0);
    expect(store.ruleUpdates).toHaveLength(0);
  });

  it("treats alert delivery dedupe lookup failures as errors instead of queueing duplicates", async () => {
    seedRule();
    seedProfile();
    seedBeach();
    seedForecast();
    seedMatchingWindow();
    store.deliveriesError = new Error("dedupe lookup failed");

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(makeRequest());
    consoleErrorSpy.mockRestore();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBe(1);
    expect(body.queued).toBe(0);
    expect(store.queueUpserts).toHaveLength(0);
  });

  it("counts forecast lookup failures as errors instead of silently skipping alerts", async () => {
    seedRule();
    seedProfile();
    seedBeach();
    store.forecastsError = new Error("forecast lookup failed");

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(makeRequest());
    consoleErrorSpy.mockRestore();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evaluated).toBe(1);
    expect(body.errors).toBe(1);
    expect(body.queued).toBe(0);
    expect(store.queueUpserts).toHaveLength(0);
  });

  it("queues the matched condition window instead of a separate surf-call window", async () => {
    seedRule();
    seedProfile();
    seedBeach();
    seedForecast();
    mockFindMatchingWindows.mockReturnValueOnce([
      {
        rule_id: RULE_1,
        rule_name: "Test Rule",
        beach_id: BEACH_1,
        beach_name: "Test Beach",
        beach_timezone: "America/Los_Angeles",
        window_start: "2026-04-26T15:00:00Z",
        window_end: "2026-04-26T16:00:00Z",
        best_hour: "2026-04-26T15:00:00Z",
        best_score: 0.9,
        conditions_snapshot: { wave_height: 3.5, wind_speed: 5 },
        notify_email: true,
        notify_push: false,
      },
    ]);
    mockSelectBestWindow.mockReturnValueOnce({
      start: new Date("2026-04-27T00:00:00Z"),
      end: new Date("2026-04-27T01:00:00Z"),
      peakTime: new Date("2026-04-27T00:00:00Z"),
    });
    mockComputeSurfCall.mockReturnValueOnce({
      bestWindowStart: "2026-04-27T00:00:00.000Z",
      bestWindowEnd: "2026-04-27T01:00:00.000Z",
      peakTime: "2026-04-27T00:00:00.000Z",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.queued).toBe(1);
    expect(store.queueUpserts).toHaveLength(1);
    expect(store.queueUpserts[0]).toMatchObject({
      window_start: "2026-04-26T15:00:00Z",
      window_end: "2026-04-26T16:00:00Z",
      best_hour: "2026-04-26T15:00:00Z",
      best_score: 0.9,
      conditions_snapshot: { wave_height: 3.5, wind_speed: 5 },
    });
    expect(mockSelectBestWindow).not.toHaveBeenCalled();
    expect(mockComputeSurfCall).not.toHaveBeenCalled();
  });

  it("does not queue a matched window removed by daylight filtering", async () => {
    seedRule();
    seedProfile();
    seedBeach();
    seedForecast();
    mockFilterToDaylight.mockReturnValueOnce([]);
    mockFindMatchingWindows.mockReturnValueOnce([
      {
        rule_id: RULE_1,
        rule_name: "Test Rule",
        beach_id: BEACH_1,
        beach_name: "Test Beach",
        beach_timezone: "America/Los_Angeles",
        window_start: "2026-04-27T03:00:00Z",
        window_end: "2026-04-27T04:00:00Z",
        best_hour: "2026-04-27T03:00:00Z",
        best_score: 0.9,
        conditions_snapshot: { wave_height: 3.5 },
        notify_email: true,
        notify_push: false,
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.queued).toBe(0);
    expect(mockFindMatchingWindows).not.toHaveBeenCalled();
    expect(store.queueUpserts).toHaveLength(0);
  });
});

// Surfability gate: ensures rules that match user-authored conditions still get
// suppressed when the day is genuinely unsurfable (max wave below the
// break-type minimum or window shorter than 30 min). The gate uses
// getMinRideable from lib/utils/surf-call-logic, which keys off the canonical
// normalized break_type values ("beach", "reef", "point").
describe("condition-alert-evaluate — surfability gate", () => {
  /**
   * Helper: build a window covering [startISO, endISO] and seed
   * findMatchingWindows to return it. The snapshot's wave_height controls
   * the "best-scoring hour" — we test on the MAX wave across the window
   * separately by varying store.forecasts.
   */
  function seedWindow(opts: {
    startISO: string;
    endISO: string;
    snapshotWaveHeight: number;
  }) {
    mockFindMatchingWindows.mockReturnValueOnce([
      {
        rule_id: RULE_1,
        rule_name: "Test Rule",
        beach_id: BEACH_1,
        beach_name: "Test Beach",
        beach_timezone: "America/Los_Angeles",
        window_start: opts.startISO,
        window_end: opts.endISO,
        best_hour: opts.startISO,
        best_score: 0.9,
        conditions_snapshot: { wave_height: opts.snapshotWaveHeight },
        notify_email: true,
        notify_push: false,
      },
    ]);
  }

  /** Helper: seed an enhanced_forecasts row at a specific time + height. */
  function pushForecast(forecastAt: string, waveHeightFt: number) {
    store.forecasts.push({
      forecast_at: forecastAt,
      wave_height: String(waveHeightFt),
      wave_period: "10s",
      wave_direction: "W",
      swell_1_height: String(waveHeightFt),
      swell_1_period: "10s",
      swell_1_direction: "270",
      wind_speed: "5 mph",
      wind_direction_deg: 270,
      tide_height: "2.0",
      tide_status: "rising",
    });
  }

  it("uses 2.0ft minimum for legacy break_type 'reef break' (regression for the legacy keys)", async () => {
    seedRule();
    seedProfile();
    seedBeach({ break_type: "reef break" }); // legacy two-word form
    pushForecast("2026-04-26T14:00:00Z", 1.7);
    seedWindow({
      startISO: "2026-04-26T14:00:00Z",
      endISO: "2026-04-26T15:00:00Z",
      snapshotWaveHeight: 1.7,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.queued).toBe(0);
    expect(body.skipped_unsurfable).toBe(1);
  });

  it("uses 2.0ft minimum for canonical break_type 'reef' (not the 1.5ft default)", async () => {
    seedRule();
    seedProfile();
    seedBeach({ break_type: "reef" });
    // Forecast hour at 14:00Z with 1.7ft — above the 1.5ft default but below
    // the 2.0ft reef minimum. If the gate falls back to 1.5ft (the bug we
    // fixed), this would queue.
    pushForecast("2026-04-26T14:00:00Z", 1.7);
    seedWindow({
      startISO: "2026-04-26T14:00:00Z",
      endISO: "2026-04-26T15:00:00Z",
      snapshotWaveHeight: 1.7,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.queued).toBe(0);
    expect(body.skipped_unsurfable).toBe(1);
    expect(store.queueUpserts).toHaveLength(0);
  });

  it("low-wave skip: max wave below break-type minimum suppresses the window", async () => {
    seedRule();
    seedProfile();
    seedBeach({ break_type: "beach" }); // 1.5ft minimum
    pushForecast("2026-04-26T14:00:00Z", 1.0);
    pushForecast("2026-04-26T15:00:00Z", 1.2);
    seedWindow({
      startISO: "2026-04-26T14:00:00Z",
      endISO: "2026-04-26T15:00:00Z",
      snapshotWaveHeight: 1.2,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.queued).toBe(0);
    expect(body.skipped_unsurfable).toBe(1);
  });

  it("short-window skip: window shorter than 30 min suppresses regardless of wave size", async () => {
    seedRule();
    seedProfile();
    seedBeach({ break_type: "beach" });
    pushForecast("2026-04-26T14:00:00Z", 4.0);
    seedWindow({
      startISO: "2026-04-26T14:00:00Z",
      endISO: "2026-04-26T14:15:00Z", // 15 min
      snapshotWaveHeight: 4.0,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.queued).toBe(0);
    expect(body.skipped_unsurfable).toBe(1);
  });

  it("mixed window kept: best-scoring hour is below min but a later hour is rideable", async () => {
    seedRule();
    seedProfile();
    seedBeach({ break_type: "beach" }); // 1.5ft minimum
    // 14:00 = 1.2ft (clean glassy hour, scores best — would suppress under
    // the prior best-hour-only gate). 15:00 = 2.4ft (rideable).
    pushForecast("2026-04-26T14:00:00Z", 1.2);
    pushForecast("2026-04-26T15:00:00Z", 2.4);
    seedWindow({
      startISO: "2026-04-26T14:00:00Z",
      endISO: "2026-04-26T15:00:00Z",
      snapshotWaveHeight: 1.2, // best-scoring hour from window-finder
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.queued).toBeGreaterThanOrEqual(1);
    expect(body.skipped_unsurfable).toBe(0);
    expect(store.queueUpserts).toHaveLength(1);
  });

  it("range-string wave_height: uses the max of '1-2ft' (2), not parseFloat's first number (1)", async () => {
    seedRule();
    seedProfile();
    seedBeach({ break_type: "beach" }); // 1.5ft minimum
    // Raw DB row stores a range string. parseFloat("1-2ft") = 1, which would
    // false-suppress this window (1 < 1.5). The gate must extract max = 2.
    store.forecasts.push({
      forecast_at: "2026-04-26T14:00:00Z",
      wave_height: "1-2ft",
      wave_period: "10s",
      wave_direction: "W",
      swell_1_height: "1.5",
      swell_1_period: "10s",
      swell_1_direction: "270",
      wind_speed: "5 mph",
      wind_direction_deg: 270,
      tide_height: "2.0",
      tide_status: "rising",
    });
    seedWindow({
      startISO: "2026-04-26T14:00:00Z",
      endISO: "2026-04-26T15:00:00Z",
      snapshotWaveHeight: 1.5,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.queued).toBeGreaterThanOrEqual(1);
    expect(body.skipped_unsurfable).toBe(0);
  });

  it("single-hour window from findMatchingWindows is treated as 60-min, not 0-min", async () => {
    // Bypass the mock to exercise the real findMatchingWindows so the
    // window_end-as-last-hour-plus-1h semantic is end-to-end.
    mockFindMatchingWindows.mockReset();
    const realWindowFinder = jest.requireActual<typeof import("@/lib/alerts/window-finder")>(
      "@/lib/alerts/window-finder",
    );
    mockFindMatchingWindows.mockImplementation(realWindowFinder.findMatchingWindows);

    seedRule({ conditions: { swell_height_min: 2 } });
    seedProfile();
    seedBeach({ break_type: "beach" });
    // Single forecast hour that matches the rule (height >= 2). Without the
    // 60-min interval fix, the real findMatchingWindows would emit a window
    // with start === end, and the gate would suppress as too short.
    pushForecast("2026-04-26T14:00:00Z", 3.0);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.queued).toBeGreaterThanOrEqual(1);
    expect(body.skipped_unsurfable).toBe(0);
  });

  it("fail-open: when no forecast hours have wave_height, the window is kept", async () => {
    seedRule();
    seedProfile();
    seedBeach({ break_type: "beach" });
    // Push forecast hours with null wave_height — gate has no samples to judge.
    store.forecasts.push({
      forecast_at: "2026-04-26T14:00:00Z",
      wave_height: null,
      wave_period: "10s",
      wave_direction: null,
      swell_1_height: null,
      swell_1_period: "10s",
      swell_1_direction: "270",
      wind_speed: "5 mph",
      wind_direction_deg: 270,
      tide_height: "2.0",
      tide_status: "rising",
    });
    seedWindow({
      startISO: "2026-04-26T14:00:00Z",
      endISO: "2026-04-26T15:00:00Z",
      snapshotWaveHeight: 0,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.queued).toBeGreaterThanOrEqual(1);
    expect(body.skipped_unsurfable).toBe(0);
  });
});
