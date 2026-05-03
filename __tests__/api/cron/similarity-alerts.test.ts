/**
 * @jest-environment node
 *
 * Tests for /api/cron/similarity-alerts — Plan V4 user-iter rewrite.
 *
 * Coverage:
 *  1. Kill switch — ALERTS_DELIVERY_ENABLED unset returns skipped:true with
 *     no DB calls beyond the auth check.
 *  2. Eligible-user CTE — free user / expired Pro user are NOT iterated;
 *     active Pro WITH home_beach IS iterated.
 *  3. Anchor rule preference — auto_created_at NOT NULL beats older user-
 *     created (NULL) row even when MIN(id) would pick the other.
 *  4. Anchor rule deterministic tie-break — when both rows are auto-created,
 *     the one with MIN(id) wins.
 *  5. Dedup hit (try_insert_similarity_alert returns inserted=false) is
 *     treated as success, not error.
 *  6. last_matched_at bump — fires on real insert, NOT on dedup hit.
 *  7. 03:00 picks rejected — even high-score slots in the user-local night
 *     window do not produce an insert.
 */

if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
}

// ---- Mocks (must be declared before importing the route) ----

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn(
    (_route: string, handler: (req: Request) => Promise<Response>) => handler,
  ),
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
    }),
  ),
}));

import { GET } from "@/app/api/cron/similarity-alerts/route";

// ---- Fixtures ----

const USER_PRO = "00000000-0000-0000-0000-0000000000a1";
const USER_FREE = "00000000-0000-0000-0000-0000000000a2";
const USER_EXPIRED = "00000000-0000-0000-0000-0000000000a3";
const USER_ANCHOR = "00000000-0000-0000-0000-0000000000a4";
const RULE_AUTO_NEW = "00000000-0000-0000-0000-0000000000b1"; // bigger id
const RULE_USER_OLD = "00000000-0000-0000-0000-0000000000b0"; // smaller id, NULL auto
const RULE_AUTO_A = "00000000-0000-0000-0000-0000000000c0"; // both auto, MIN id
const RULE_AUTO_B = "00000000-0000-0000-0000-0000000000c1"; // both auto, larger id
const HOME_BEACH = "00000000-0000-0000-0000-0000000000d1";

interface Store {
  alertRules: any[];
  favoriteBeaches: any[];
  beaches: any[];
  beachWaterQuality: any[];
  forecasts: any[];
  ruleUpdates: { id: string; last_matched_at: string }[];
}

const store: Store = {
  alertRules: [],
  favoriteBeaches: [],
  beaches: [],
  beachWaterQuality: [],
  forecasts: [],
  ruleUpdates: [],
};

function chainOk(rows: any[]) {
  // Generic fluent chain that resolves to { data: rows, error: null } at any
  // point along the .eq/.in/.gte/.lte/.order/.limit/.maybeSingle path.
  const chain: any = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.in = passthrough;
  chain.gte = passthrough;
  chain.lte = passthrough;
  chain.order = passthrough;
  chain.limit = passthrough;
  chain.then = (resolve: any) => resolve({ data: rows, error: null });
  chain.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  chain.single = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  return chain;
}

function fromImpl(table: string) {
  switch (table) {
    case "alert_rules": {
      const chain: any = chainOk(store.alertRules);
      chain.update = (vals: any) => ({
        eq: (_col: string, val: string) => {
          store.ruleUpdates.push({ id: val, ...vals });
          return Promise.resolve({ error: null });
        },
      });
      return chain;
    }
    case "favorite_beaches":
      return chainOk(store.favoriteBeaches);
    case "beaches":
      return chainOk(store.beaches);
    case "beach_water_quality":
      return chainOk(store.beachWaterQuality);
    case "enhanced_forecasts":
      return chainOk(store.forecasts);
    case "cron_runs":
      // Observability is mocked at module scope; this should never be hit.
      return chainOk([]);
    default:
      return chainOk([]);
  }
}

function rpcImpl(name: string, _args: any) {
  // Tests override per-case via mockRpc.mockImplementationOnce when needed.
  if (name === "get_nearby_beaches") {
    return Promise.resolve({ data: [], error: null });
  }
  if (name === "compute_user_match_score_batch") {
    return Promise.resolve({ data: [], error: null });
  }
  if (name === "try_insert_similarity_alert") {
    return Promise.resolve({
      data: [{ inserted: true, alert_queue_id: "00000000-0000-0000-0000-0000000000ff" }],
      error: null,
    });
  }
  return Promise.resolve({ data: null, error: null });
}

function makeReq(): Request {
  return new Request("http://localhost/api/cron/similarity-alerts", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

function seedActiveProUser(opts?: {
  withFavorite?: boolean;
  forecastsForBeach?: string;
}) {
  store.alertRules.push({
    id: RULE_AUTO_NEW,
    user_id: USER_PRO,
    auto_created_at: "2026-05-03T00:00:00Z",
    profiles: {
      id: USER_PRO,
      home_beach_id: HOME_BEACH,
      timezone: "America/Los_Angeles",
      user_entitlements: {
        is_pro: true,
        is_trialing: false,
        billing_issue: false,
        expires_at: null,
      },
    },
  });
  store.beaches.push({
    id: HOME_BEACH,
    name: "Home Break",
    slug: "home-break",
    center_lat: 33.6,
    center_lng: -118.0,
    timezone: "America/Los_Angeles",
  });

  if (opts?.forecastsForBeach) {
    // 18:00 UTC == 11:00 AM PT (daytime, valid)
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  store.alertRules = [];
  store.favoriteBeaches = [];
  store.beaches = [];
  store.beachWaterQuality = [];
  store.forecasts = [];
  store.ruleUpdates = [];

  process.env.CRON_SECRET = "test-cron-secret";
  process.env.ALERTS_DELIVERY_ENABLED = "true";
  delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;

  mockFrom.mockImplementation(fromImpl);
  mockRpc.mockImplementation(rpcImpl);
});

afterEach(() => {
  delete process.env.ALERTS_DELIVERY_ENABLED;
  delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;
});

describe("similarity-alerts cron — Plan V4", () => {
  it("1. kill switch: ALERTS_DELIVERY_ENABLED unset → skipped:true, no DB calls", async () => {
    delete process.env.ALERTS_DELIVERY_ENABLED;
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      skipped: true,
      reason: "delivery_disabled",
      enqueued: 0,
      evaluated: 0,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("2. eligible-user CTE: free + expired-Pro filtered out; active Pro iterated", async () => {
    // Free user — no entitlement row at all (just preset_type rule)
    store.alertRules.push({
      id: "free-rule-1",
      user_id: USER_FREE,
      auto_created_at: null,
      profiles: {
        id: USER_FREE,
        home_beach_id: HOME_BEACH,
        timezone: "America/Los_Angeles",
        user_entitlements: null,
      },
    });
    // Expired Pro — expires_at past, NOT billing_issue
    store.alertRules.push({
      id: "expired-rule-1",
      user_id: USER_EXPIRED,
      auto_created_at: "2026-01-01T00:00:00Z",
      profiles: {
        id: USER_EXPIRED,
        home_beach_id: HOME_BEACH,
        timezone: "America/Los_Angeles",
        user_entitlements: {
          is_pro: true,
          is_trialing: false,
          billing_issue: false,
          expires_at: "2026-01-15T00:00:00Z", // long past
        },
      },
    });
    // Active Pro
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    // Score the active user's beach above threshold
    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: {
                state: "ready",
                score: 8.5,
                label: "GOOD",
                reason_bullets: ["Solid groundswell"],
              },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, _args);
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    // Only the Pro user is iterated.
    expect(body.evaluated).toBe(1);
    expect(body.enqueued).toBe(1);

    // Verify try_insert_similarity_alert was called with the Pro user id.
    const insertCalls = mockRpc.mock.calls.filter(
      (c: any[]) => c[0] === "try_insert_similarity_alert",
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0][1]).toMatchObject({ p_user_id: USER_PRO });
  });

  it("3. anchor preference: auto_created_at NOT NULL beats user-created (older id)", async () => {
    // Two rules, same user. The user-created one has MIN(id) but NULL
    // auto_created_at — anchor must pick the auto one anyway.
    store.alertRules.push({
      id: RULE_USER_OLD, // ...b0 (min id)
      user_id: USER_ANCHOR,
      auto_created_at: null,
      profiles: {
        id: USER_ANCHOR,
        home_beach_id: HOME_BEACH,
        timezone: "America/Los_Angeles",
        user_entitlements: {
          is_pro: true,
          is_trialing: false,
          billing_issue: false,
          expires_at: null,
        },
      },
    });
    store.alertRules.push({
      id: RULE_AUTO_NEW, // ...b1 (larger id)
      user_id: USER_ANCHOR,
      auto_created_at: "2026-05-03T00:00:00Z",
      profiles: {
        id: USER_ANCHOR,
        home_beach_id: HOME_BEACH,
        timezone: "America/Los_Angeles",
        user_entitlements: {
          is_pro: true,
          is_trialing: false,
          billing_issue: false,
          expires_at: null,
        },
      },
    });
    store.beaches.push({
      id: HOME_BEACH,
      name: "Home Break",
      slug: "home-break",
      center_lat: 33.6,
      center_lng: -118.0,
      timezone: "America/Los_Angeles",
    });
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });

    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 8.5, label: "GOOD" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, _args);
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const insertCalls = mockRpc.mock.calls.filter(
      (c: any[]) => c[0] === "try_insert_similarity_alert",
    );
    expect(insertCalls).toHaveLength(1);
    // Anchor must be the auto-created one even though it has the LARGER id.
    expect(insertCalls[0][1].p_rule_id).toBe(RULE_AUTO_NEW);
  });

  it("4. anchor deterministic: two auto-created rules → MIN(id) wins", async () => {
    store.alertRules.push({
      id: RULE_AUTO_B, // larger id
      user_id: USER_ANCHOR,
      auto_created_at: "2026-05-03T00:00:00Z",
      profiles: {
        id: USER_ANCHOR,
        home_beach_id: HOME_BEACH,
        timezone: "America/Los_Angeles",
        user_entitlements: {
          is_pro: true,
          is_trialing: false,
          billing_issue: false,
          expires_at: null,
        },
      },
    });
    store.alertRules.push({
      id: RULE_AUTO_A, // smaller id
      user_id: USER_ANCHOR,
      auto_created_at: "2026-05-02T00:00:00Z",
      profiles: {
        id: USER_ANCHOR,
        home_beach_id: HOME_BEACH,
        timezone: "America/Los_Angeles",
        user_entitlements: {
          is_pro: true,
          is_trialing: false,
          billing_issue: false,
          expires_at: null,
        },
      },
    });
    store.beaches.push({
      id: HOME_BEACH,
      name: "Home Break",
      slug: "home-break",
      center_lat: 33.6,
      center_lng: -118.0,
      timezone: "America/Los_Angeles",
    });
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });

    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 8.5, label: "GOOD" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, _args);
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const insertCalls = mockRpc.mock.calls.filter(
      (c: any[]) => c[0] === "try_insert_similarity_alert",
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0][1].p_rule_id).toBe(RULE_AUTO_A); // MIN(id)
  });

  it("5. dedup hit: try_insert returns inserted=false → counted as success, not error", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 8.5, label: "GOOD" },
            },
          ],
          error: null,
        });
      }
      if (name === "try_insert_similarity_alert") {
        return Promise.resolve({
          data: [{ inserted: false, alert_queue_id: null }],
          error: null,
        });
      }
      return rpcImpl(name, _args);
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBe(0);
    expect(body.dedupSkipped).toBe(1);
    expect(body.enqueued).toBe(0);
    // last_matched_at must NOT be bumped on dedup hit
    expect(store.ruleUpdates).toHaveLength(0);
  });

  it("6. last_matched_at bumped on real insert", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 8.5, label: "GOOD" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, _args); // default = inserted: true
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enqueued).toBe(1);
    expect(store.ruleUpdates).toHaveLength(1);
    expect(store.ruleUpdates[0].id).toBe(RULE_AUTO_NEW);
    expect(typeof store.ruleUpdates[0].last_matched_at).toBe("string");
  });

  it("7. 03:00 picks rejected: only above-threshold slot is at 3am local → no insert", async () => {
    seedActiveProUser();
    // 10:00 UTC == 03:00 PT — should be rejected by daylight pre-filter (and
    // the picker, defense in depth). Either way: no insert.
    store.forecasts.push({
      forecast_at: "2026-05-04T10:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });

    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T10:00:00Z",
              result: { state: "ready", score: 9.5, label: "EPIC" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, _args);
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enqueued).toBe(0);
    const insertCalls = mockRpc.mock.calls.filter(
      (c: any[]) => c[0] === "try_insert_similarity_alert",
    );
    expect(insertCalls).toHaveLength(0);
  });
});
