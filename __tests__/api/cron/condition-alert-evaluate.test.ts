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
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

// ---- Mocks ----

jest.mock("@/lib/api-utils", () => ({
  validateCronRequest: jest.fn(() => true),
}));

// withCronObservability: pass through to the handler without touching cron_runs table.
jest.mock("@/lib/cron/observability", () => ({
  withCronObservability: jest.fn(async (_route: string, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

// Mock window-finder + sunrise + timezone-utils so we control matching behaviour.
const mockFindMatchingWindows = jest.fn();
const mockFilterToDaylight = jest.fn((hours: any[]) => hours); // pass-through by default
const mockGetDaylightWindow = jest.fn(() => ({
  sunrise: new Date("2026-04-26T13:00:00Z"),
  sunset: new Date("2026-04-27T02:00:00Z"),
}));
const mockGetUtcDayBounds = jest.fn(() => ({
  start: "2026-04-26T00:00:00.000Z",
  end: "2026-04-27T00:00:00.000Z",
}));
const mockResolveEntitlement = jest.fn(() => "free" as const);

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

// ---- Store + mock Supabase ----

const USER_A = "00000000-0000-0000-0000-000000000001";
const RULE_1 = "00000000-0000-0000-0000-0000000000a1";
const BEACH_1 = "00000000-0000-0000-0000-0000000000b1";

interface Store {
  rules: any[];
  profiles: any[];
  beaches: any[];
  entitlements: any[];
  deliveries: any[]; // alert_deliveries
  forecasts: any[]; // enhanced_forecasts
  queueUpserts: any[];
  ruleUpdates: { id: string; last_matched_at: string }[];
}

const store: Store = {
  rules: [],
  profiles: [],
  beaches: [],
  entitlements: [],
  deliveries: [],
  forecasts: [],
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
    select: jest.fn(() => chain),
    eq: jest.fn((_col: string, val: any) => { chain._filters[_col] = val; return chain; }),
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
      resolve({ data: rowsResolver(), error: null })
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
      return makeChain(() => store.deliveries);
    case "enhanced_forecasts":
      return makeChain(() => store.forecasts);
    case "alert_queue":
      return makeChain(() => [], (row) => store.queueUpserts.push(row));
    default:
      return makeChain(() => []);
  }
}

const mockSupabase = { from: jest.fn(mockFrom) };

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

function seedMatchingWindow() {
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
      best_score: 0.9,
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
  jest.clearAllMocks();
  store.rules = [];
  store.profiles = [];
  store.beaches = [];
  store.entitlements = [];
  store.deliveries = [];
  store.forecasts = [];
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

  // Reset the mockSupabase.from implementation so per-test seeds are isolated.
  mockSupabase.from.mockImplementation(mockFrom);
});

// ---- Tests ----

describe("condition-alert-evaluate — A4.2 flat queries", () => {
  it("1. happy path: 1 rule + matching forecast window => upserts 1 alert_queue row", async () => {
    seedRule();
    seedProfile();
    seedBeach();
    seedForecast();
    seedMatchingWindow();

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
    });

    // last_matched_at must be stamped
    expect(store.ruleUpdates).toHaveLength(1);
    expect(store.ruleUpdates[0].id).toBe(RULE_1);
    expect(store.ruleUpdates[0].last_matched_at).toBeDefined();
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

  it("3. missing profile: rule exists but profile lookup returns empty => errors++ and route does not crash", async () => {
    seedRule();
    // No profile seeded — profilesById.get(USER_A) will be undefined.
    seedBeach();

    const res = await GET(makeRequest());

    // The route logs console.error for the missing-profile case — declare that
    // intentional so the afterEach guard doesn't fail the test.
    expectConsoleErrors([/No profile found for user/]);

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
});
