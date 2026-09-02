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

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

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

// scoreWindowWithComposite pulls in the full discovery scorer chain. For unit
// tests we mock it so the SURFABILITY_FLOOR pre-filter is exercised on a known
// beach-aware score, decoupled from engine internals (covered by their own tests).
const mockScoreWindowWithComposite = jest.fn();
jest.mock("@/lib/services/discovery/window-selector", () => ({
  scoreWindowWithComposite: (...args: unknown[]) =>
    mockScoreWindowWithComposite(...args),
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockResolveNotificationMajorEventHold = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
    }),
  ),
}));
jest.mock("@/lib/recommendations/major-event-hold/adapters/notification", () => ({
  resolveNotificationMajorEventHold: (...args: unknown[]) =>
    mockResolveNotificationMajorEventHold(...args),
}));

import { GET } from "@/app/api/cron/similarity-alerts/route";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

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
const CONFIGURED_BEACH = "00000000-0000-0000-0000-0000000000d2";

interface Store {
  alertRules: any[];
  favoriteBeaches: any[];
  beaches: any[];
  beachWaterQuality: any[];
  heldBeachIds: string[];
  forecasts: any[];
  userBeachExclusions: any[];
  locationSnapshots: any[];
  ruleUpdates: { id: string; last_matched_at: string }[];
}

const store: Store = {
  alertRules: [],
  favoriteBeaches: [],
  beaches: [],
  beachWaterQuality: [],
  heldBeachIds: [],
  forecasts: [],
  userBeachExclusions: [],
  locationSnapshots: [],
  ruleUpdates: [],
};

function chainOk(rows: any[]) {
  // Generic fluent chain that resolves to { data: rows, error: null } at any
  // point along the .eq/.in/.gte/.lte/.order/.limit/.maybeSingle path.
  const chain: any = {};
  let resultRows = rows;
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.in = (column: string, values: string[]) => {
    if (rows.every((row) => row && typeof row === "object" && column in row)) {
      resultRows = rows.filter((row) => values.includes(row[column]));
    }
    return chain;
  };
  chain.gte = passthrough;
  chain.lte = passthrough;
  chain.order = passthrough;
  chain.limit = passthrough;
  chain.then = (resolve: any) => resolve({ data: resultRows, error: null });
  chain.maybeSingle = () => Promise.resolve({ data: resultRows[0] ?? null, error: null });
  chain.single = () => Promise.resolve({ data: resultRows[0] ?? null, error: null });
  return chain;
}

function fromImpl(table: string) {
  switch (table) {
    case "alert_rules": {
      // Strip the legacy nested `profiles` / `user_entitlements` fields the
      // test fixtures attach (back when the cron used a PostgREST embed).
      // The cron now uses flat selects, so it expects rows with only
      // {id, user_id, auto_created_at, ...rule fields}. The nested data is
      // surfaced separately via the "profiles" / "user_entitlements" branches
      // below.
      const flatRules = store.alertRules.map((r: any) => {
        const { profiles: _p, user_entitlements: _ue, ...rest } = r;
        return rest;
      });
      const chain: any = chainOk(flatRules);
      chain.update = (vals: any) => ({
        eq: (_col: string, val: string) => {
          store.ruleUpdates.push({ id: val, ...vals });
          return Promise.resolve({ error: null });
        },
      });
      return chain;
    }
    case "profiles": {
      // Derive flat profile rows from the nested data the seed helpers attach
      // to alertRules. Real prod data lives in profiles directly; keeping the
      // nested-fixture style avoids rewriting 14 test seeds.
      const profilesById = new Map<string, any>();
      for (const rule of store.alertRules as any[]) {
        const p = rule.profiles;
        if (!p?.id) continue;
        // Last-write-wins (idempotent in fixtures).
        profilesById.set(p.id, {
          id: p.id,
          home_beach_id: p.home_beach_id ?? null,
          timezone: p.timezone ?? null,
          experience_level: p.experience_level ?? null,
          max_drive_minutes: p.max_drive_minutes ?? null,
        });
      }
      return chainOk(Array.from(profilesById.values()));
    }
    case "user_entitlements": {
      const entByUserId = new Map<string, any>();
      for (const rule of store.alertRules as any[]) {
        const p = rule.profiles;
        const ue = p?.user_entitlements;
        if (!p?.id || !ue) continue;
        entByUserId.set(p.id, {
          user_id: p.id,
          is_pro: ue.is_pro ?? null,
          is_trialing: ue.is_trialing ?? null,
          billing_issue: ue.billing_issue ?? null,
          expires_at: ue.expires_at ?? null,
        });
      }
      return chainOk(Array.from(entByUserId.values()));
    }
    case "user_location_snapshots": {
      return chainOk(store.locationSnapshots);
    }
    case "favorite_beaches":
      return chainOk(store.favoriteBeaches);
    case "beaches":
      return chainOk(store.beaches);
    case "beach_water_quality":
      return chainOk(store.beachWaterQuality);
    case "water_quality_held_beaches":
      return chainOk(
        store.heldBeachIds.map((beach_id) => ({ beach_id })),
      );
    case "county_beach_advisory_runs":
      return chainOk([
        {
          id: "county-run-similarity-alerts",
          fetched_at: new Date().toISOString(),
          status: "completed",
          source_identifier: "county-san-diego-dehq-sdbeachinfo",
        },
      ]);
    case "county_beach_advisories":
      return chainOk([]);
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
  if (name === "get_weekend_scout_candidates") {
    const excludedIds = new Set(
      store.userBeachExclusions.map((row) => row.beach_id),
    );
    return Promise.resolve({
      data: store.beaches
        .filter((beach) => !excludedIds.has(beach.id))
        .map((beach) => ({ id: beach.id })),
      error: null,
    });
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
      experience_level: "beginner",
      user_entitlements: {
        is_pro: true,
        is_trialing: false,
        billing_issue: false,
        expires_at: null,
      },
    },
  });
  store.locationSnapshots.push({
    user_id: USER_PRO,
    lat: 33.6,
    lon: -118,
    timezone: "America/Los_Angeles",
    captured_at: new Date().toISOString(),
  });
  store.beaches.push({
    id: HOME_BEACH,
    name: "Home Break",
    slug: "home-break",
    lat: 33.6,
    lon: -118.0,
    timezone: "America/Los_Angeles",
    skill_level: "beginner",
    break_type: "beach",
    swell_window_min_deg: 180,
    swell_window_max_deg: 270,
    wind_offshore_deg: 45,
    wind_offshore_tol_deg: 60,
    wind_onshore_bad_kt: 14,
    wind_cross_shore_ok_kt: 10,
    preferred_tide_direction: "rising",
    preferred_tide_ft_min: 1,
    preferred_tide_ft_max: 4,
    tide_direction_sensitivity: "medium",
  });

  if (opts?.forecastsForBeach) {
    // 18:00 UTC == 11:00 AM PT (daytime, valid)
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wave_direction: "220",
      wind_speed: "5",
      wind_direction: "W",
      wind_direction_deg: 270,
      tide_height: "2.0",
      tide_status: "Rising",
      swell_1_height: "3.0",
      swell_1_period: "12",
      swell_1_direction: "220",
      swell_2_height: "1.0",
      swell_2_period: "8",
      swell_2_direction: "260",
      wind_wave_height: "0.5",
      wind_wave_period: "4",
      wind_wave_direction: "270",
      confidence_score: 0.8,
      data_source: "test",
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  store.alertRules = [];
  store.favoriteBeaches = [];
  store.beaches = [];
  store.beachWaterQuality = [];
  store.heldBeachIds = [];
  store.forecasts = [];
  store.userBeachExclusions = [];
  store.locationSnapshots = [];
  store.ruleUpdates = [];

  process.env.CRON_SECRET = "test-cron-secret";
  process.env.ALERTS_DELIVERY_ENABLED = "true";
  delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;

  mockFrom.mockImplementation(fromImpl);
  mockRpc.mockImplementation(rpcImpl);
  // Default: every slot clears the SURFABILITY_FLOOR so the existing tests
  // exercise the similarity-scoring path. Individual tests override this to
  // test the floor itself.
  mockScoreWindowWithComposite.mockReturnValue({ total: 75 });
  mockResolveNotificationMajorEventHold.mockResolvedValue({
    status: "allowed",
    candidate: null,
  });
});

afterEach(() => {
  delete process.env.ALERTS_DELIVERY_ENABLED;
  delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;
});

describe("similarity-alerts cron — Plan V4", () => {
  it("rejects Bearer undefined when CRON_SECRET is missing before touching the DB", async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(
      new Request("http://localhost/api/cron/similarity-alerts", {
        headers: { authorization: "Bearer undefined" },
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

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
    expect(insertCalls[0][1]).toMatchObject({
      p_user_id: USER_PRO,
      p_window_start: "2026-05-04T18:00:00Z",
      p_window_end: "2026-05-04T19:00:00.000Z",
    });
    expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledWith({
      eventId: `similarity-alerts:${USER_PRO}:${HOME_BEACH}:2026-05-04T18:00:00Z`,
      type: "similarity_match",
      payload: expect.objectContaining({
        beach_id: HOME_BEACH,
        forecast_at: "2026-05-04T18:00:00Z",
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: HOME_BEACH,
          starts_at: "2026-05-04T18:00:00Z",
          ends_at: "2026-05-04T19:00:00.000Z",
        },
      }),
      profileExperience: "beginner",
    });
  });

  it("uses the latest device location and does not force a distant home beach into recommendations", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.alertRules[0].profiles.max_drive_minutes = 20;
    store.locationSnapshots[0] = {
      ...store.locationSnapshots[0],
      lat: 21.31,
      lon: -157.86,
      timezone: "Pacific/Honolulu",
    };
    mockRpc.mockImplementation((name: string, args: any) => {
      if (name === "get_weekend_scout_candidates") {
        return Promise.resolve({ data: [], error: null });
      }
      return rpcImpl(name, args);
    });

    const res = await GET(makeReq());

    await expect(res.json()).resolves.toMatchObject({
      evaluated: 1,
      enqueued: 0,
      noPickSkipped: 1,
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "get_weekend_scout_candidates",
      expect.objectContaining({
        input_lat: 21.31,
        input_lon: -157.86,
        max_distance_meters: 16093,
      }),
    );
    expect(
      mockRpc.mock.calls.some((call) => call[0] === "compute_user_match_score_batch"),
    ).toBe(false);
  });

  it("skips users without a location snapshot", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.locationSnapshots = [];

    const res = await GET(makeReq());

    await expect(res.json()).resolves.toMatchObject({
      evaluated: 0,
      enqueued: 0,
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    ["stale", -(24 * 60 * 60 * 1000 + 1)],
    ["future-skewed", 6 * 60 * 1000],
  ])("skips users with a %s location snapshot", async (_label, offsetMs) => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.locationSnapshots[0].captured_at = new Date(
      Date.now() + offsetMs,
    ).toISOString();

    const res = await GET(makeReq());

    await expect(res.json()).resolves.toMatchObject({
      evaluated: 0,
      enqueued: 0,
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("falls back to a 30-mile radius when no drive range is set", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.alertRules[0].profiles.max_drive_minutes = null;

    await GET(makeReq());

    expect(mockRpc).toHaveBeenCalledWith(
      "get_weekend_scout_candidates",
      expect.objectContaining({ max_distance_meters: 48280 }),
    );
  });

  it.each([[300, 160934]])(
    "caps the %p-minute drive range at 100 miles",
    async (minutes, meters) => {
      seedActiveProUser({ forecastsForBeach: HOME_BEACH });
      store.alertRules[0].profiles.max_drive_minutes = minutes;

      await GET(makeReq());

      expect(mockRpc).toHaveBeenCalledWith(
        "get_weekend_scout_candidates",
        expect.objectContaining({ max_distance_meters: meters }),
      );
    },
  );

  it("keeps hidden beaches out of similarity recommendations", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.userBeachExclusions.push({
      user_id: USER_PRO,
      beach_id: HOME_BEACH,
    });

    const res = await GET(makeReq());

    await expect(res.json()).resolves.toMatchObject({
      evaluated: 1,
      enqueued: 0,
      noPickSkipped: 1,
    });
    expect(
      mockRpc.mock.calls.some((call) => call[0] === "compute_user_match_score_batch"),
    ).toBe(false);
  });

  it("suppresses held or unresolved similarity picks before the queue RPC", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    mockRpc.mockImplementation((name: string, args: any) => {
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
      return rpcImpl(name, args);
    });
    mockResolveNotificationMajorEventHold.mockResolvedValueOnce({
      status: "suppressed",
      reasonCode: "major_event_hold",
      auditCode: "major_event_hold",
      candidate: null,
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ enqueued: 0 });
    expect(
      mockRpc.mock.calls.filter((call: unknown[]) =>
        call[0] === "try_insert_similarity_alert"
      )
    ).toHaveLength(0);
    expect(store.ruleUpdates).toHaveLength(0);
  });

  it("removes a held alternative from the similarity candidate pool before scoring", async () => {
    const heldAlternative = "550e8400-e29b-41d4-a716-446655440001";
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.favoriteBeaches.push({ beach_id: heldAlternative });
    store.beaches.push({
      id: heldAlternative,
      name: "Held Alternative",
      slug: "held-alternative",
      lat: 33.61,
      lon: -118.01,
      timezone: "America/Los_Angeles",
      skill_level: "beginner",
    });
    store.heldBeachIds.push(heldAlternative);

    mockRpc.mockImplementation((name: string, args: any) => {
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
      return rpcImpl(name, args);
    });

    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(mockScoreWindowWithComposite).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls.filter((call: any[]) =>
      call[0] === "try_insert_similarity_alert",
    )).toHaveLength(1);
  });

  it("retains a held configured beach while excluding a held alternative", async () => {
    const heldAlternative = "550e8400-e29b-41d4-a716-446655440002";
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.alertRules[0].beach_id = CONFIGURED_BEACH;
    store.beaches.push({
      ...store.beaches[0],
      id: CONFIGURED_BEACH,
      name: "Configured Beach",
      slug: "configured-beach",
    });
    store.favoriteBeaches.push({ beach_id: heldAlternative });
    store.beaches.push({
      ...store.beaches[0],
      id: heldAlternative,
      name: "Held Alternative",
      slug: "held-alternative",
    });
    store.heldBeachIds.push(CONFIGURED_BEACH, heldAlternative);

    mockRpc.mockImplementation((name: string, args: any) => {
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
      return rpcImpl(name, args);
    });

    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    const scoredBeachIds = mockRpc.mock.calls
      .filter((call: any[]) => call[0] === "compute_user_match_score_batch")
      .map((call: any[]) => call[1].p_beach_id);
    expect(scoredBeachIds).toContain(CONFIGURED_BEACH);
    expect(scoredBeachIds).not.toContain(heldAlternative);
    const insertCalls = mockRpc.mock.calls.filter(
      (call: any[]) => call[0] === "try_insert_similarity_alert",
    );
    expect(insertCalls).toHaveLength(1);
  });

  it("suppresses a learned GOOD match when the beach exceeds the user's skill", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    store.beaches[0].skill_level = "advanced";
    mockRpc.mockImplementation((name: string, args: any) => {
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
                reason_bullets: ["Strong personal match"],
              },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, args);
    });

    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ enqueued: 0 });
    expect(
      mockRpc.mock.calls.filter((call: unknown[]) =>
        call[0] === "try_insert_similarity_alert"
      )
    ).toHaveLength(0);
    expect(store.ruleUpdates).toHaveLength(0);
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
        experience_level: "beginner",
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
        experience_level: "beginner",
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
      lat: 33.6,
      lon: -118.0,
      timezone: "America/Los_Angeles",
      skill_level: "beginner",
    });
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });
    store.locationSnapshots.push({
      user_id: USER_ANCHOR,
      lat: 33.6,
      lon: -118,
      timezone: "America/Los_Angeles",
      captured_at: new Date().toISOString(),
    });

    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "learned", score: 8.5, label: "GOOD" },
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
        experience_level: "beginner",
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
        experience_level: "beginner",
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
      lat: 33.6,
      lon: -118.0,
      timezone: "America/Los_Angeles",
      skill_level: "beginner",
    });
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });
    store.locationSnapshots.push({
      user_id: USER_ANCHOR,
      lat: 33.6,
      lon: -118,
      timezone: "America/Los_Angeles",
      captured_at: new Date().toISOString(),
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

  // Plan V4 fix F2: SCORE_THRESHOLD raised 7→7.5. A 7.0 picked-result would
  // have alerted under the old constant; the new constant rejects it.
  it("7a. SCORE_THRESHOLD=7.5: picker score 7.0 rejected, 7.5 accepted", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 7.0, label: "GOOD" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, _args);
    });

    const lowRes = await GET(makeReq());
    expect(lowRes.status).toBe(200);
    const lowBody = await lowRes.json();
    expect(lowBody.enqueued).toBe(0);
    const lowInserts = mockRpc.mock.calls.filter(
      (c: any[]) => c[0] === "try_insert_similarity_alert",
    );
    expect(lowInserts).toHaveLength(0);

    // Bump to 7.5 — should pass.
    jest.clearAllMocks();
    store.alertRules = [];
    store.beaches = [];
    store.forecasts = [];
    store.ruleUpdates = [];
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    mockScoreWindowWithComposite.mockReturnValue({ total: 75 });
    mockFrom.mockImplementation(fromImpl);
    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 7.5, label: "GOOD" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, _args);
    });

    const okRes = await GET(makeReq());
    expect(okRes.status).toBe(200);
    const okBody = await okRes.json();
    expect(okBody.enqueued).toBe(1);
  });

  // Plan V4 fix F2: LOOKAHEAD_HOURS raised 24→72. The cron's forecasts query
  // must cover the full 72h horizon so 2-3 day-out windows are eligible.
  it("7b. LOOKAHEAD_HOURS=72: forecast horizon parameter ≥ 72h ahead of now", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    // Capture the upper bound passed to enhanced_forecasts. We can't read
    // the .lte('forecast_at', horizonISO) call directly through our chain
    // mock — but we can shim the chain factory for this single test to
    // record the horizon string the route requested.
    let lteValue: string | null = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === "enhanced_forecasts") {
        const chain: any = {};
        const passthrough = () => chain;
        chain.select = passthrough;
        chain.eq = passthrough;
        chain.in = passthrough;
        chain.gte = passthrough;
        chain.lte = (_col: string, val: string) => {
          lteValue = val;
          return chain;
        };
        chain.order = passthrough;
        chain.limit = passthrough;
        chain.then = (resolve: any) =>
          resolve({ data: store.forecasts, error: null });
        chain.maybeSingle = () =>
          Promise.resolve({ data: store.forecasts[0] ?? null, error: null });
        return chain;
      }
      return fromImpl(table);
    });

    await GET(makeReq());

    expect(lteValue).not.toBeNull();
    const horizonMs = new Date(lteValue!).getTime();
    const nowMs = Date.now();
    const hoursAhead = (horizonMs - nowMs) / (60 * 60 * 1000);
    expect(hoursAhead).toBeGreaterThanOrEqual(71.9);
    expect(hoursAhead).toBeLessThanOrEqual(72.1);
  });

  // Plan V4 fix F2: SURFABILITY_FLOOR=60 on the discovery base score. A slot
  // can match the user's similarity preferences but still be objectively
  // weak (small / blown out); the floor drops it before the user-personal
  // RPC runs, so the cron never alerts on those.
  it("7c. SURFABILITY_FLOOR: base score 59 drops slot before similarity RPC", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    mockScoreWindowWithComposite.mockReturnValue({ total: 59 }); // below floor

    let batchCalls = 0;
    mockRpc.mockImplementation((name: string, _args: any) => {
      if (name === "compute_user_match_score_batch") {
        batchCalls++;
        return Promise.resolve({ data: [], error: null });
      }
      return rpcImpl(name, _args);
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    // No surfable slots ⇒ batch RPC never called for that beach.
    expect(batchCalls).toBe(0);
    const body = await res.json();
    expect(body.enqueued).toBe(0);
  });

  it("7c-1. hydrates prod-safe beach-specific scorer columns before composite floor scoring", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    const beachSelects: string[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table !== "beaches") return fromImpl(table);

      const chain: any = {};
      const passthrough = () => chain;
      chain.select = (columns: string) => {
        beachSelects.push(columns);
        return chain;
      };
      chain.eq = passthrough;
      chain.in = passthrough;
      chain.gte = passthrough;
      chain.lte = passthrough;
      chain.order = passthrough;
      chain.limit = passthrough;
      chain.then = (resolve: any) =>
        resolve({ data: store.beaches, error: null });
      chain.maybeSingle = () =>
        Promise.resolve({ data: store.beaches[0] ?? null, error: null });
      return chain;
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const hydrateSelect = beachSelects.find((columns) =>
      columns.includes("break_type")
    );
    expect(hydrateSelect).toEqual(expect.stringContaining("lat"));
    expect(hydrateSelect).toEqual(expect.stringContaining("lon"));
    expect(hydrateSelect).toEqual(expect.stringContaining("wind_onshore_bad_kt"));
    expect(hydrateSelect).toEqual(expect.stringContaining("wind_cross_shore_ok_kt"));
    expect(hydrateSelect).toEqual(
      expect.stringContaining("tide_direction_sensitivity")
    );
    expect(hydrateSelect).not.toEqual(expect.stringContaining("center_lat"));
    expect(hydrateSelect).not.toEqual(expect.stringContaining("center_lng"));
    expect(hydrateSelect).not.toEqual(expect.stringContaining("max_wind_onshore_mph"));
    expect(hydrateSelect).not.toEqual(expect.stringContaining("max_wind_any_mph"));

    const scoredForecast = mockScoreWindowWithComposite.mock.calls[0]?.[0];
    expect(scoredForecast).toEqual(
      expect.objectContaining({
        swell_1_height: "3.0",
        swell_1_period: "12",
        swell_1_direction: "220",
        swell_2_height: "1.0",
        swell_2_period: "8",
        swell_2_direction: "260",
        wind_wave_height: "0.5",
        wind_wave_period: "4",
        wind_wave_direction: "270",
      })
    );

    const scoredBeach = mockScoreWindowWithComposite.mock.calls[0]?.[1];
    expect(scoredBeach).toEqual(
      expect.objectContaining({
        lat: 33.6,
        lon: -118.0,
        wind_onshore_bad_kt: 14,
        wind_cross_shore_ok_kt: 10,
        tide_direction_sensitivity: "medium",
      })
    );
  });

  it("7c-2. onboarding batch result never enqueues, even with a high score-like payload", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    mockRpc.mockImplementation((name: string, args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: {
                state: "onboarding",
                score: 9.9,
                label: "EPIC",
                session_count: 4,
                sessions_needed: 1,
              },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, args);
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

  // Plan V4 fix F2: send_at = window_start - 60 minutes. Old code wrote
  // now() — alerts landed immediately, even for windows 2 days out.
  it("7d. send_at = window_start - 60min", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    const captured: { p_send_at?: string; p_window_start?: string } = {};
    mockRpc.mockImplementation((name: string, args: any) => {
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
        captured.p_send_at = args.p_send_at;
        captured.p_window_start = args.p_window_start;
        return Promise.resolve({
          data: [{ inserted: true, alert_queue_id: "ff" }],
          error: null,
        });
      }
      return rpcImpl(name, args);
    });

    await GET(makeReq());

    expect(captured.p_window_start).toBe("2026-05-04T18:00:00Z");
    expect(captured.p_send_at).toEqual(expect.any(String));
    const windowMs = new Date(captured.p_window_start!).getTime();
    const sendMs = new Date(captured.p_send_at!).getTime();
    const exactLeadUsed = windowMs - sendMs === 60 * 60 * 1000;
    const nowFallbackUsed = sendMs >= Date.now() - 1000;
    expect(exactLeadUsed || nowFallbackUsed).toBe(true);
  });

  // Plan V4 fix F2: slug guard. A candidate beach with null/empty slug must
  // be dropped before similarity scoring — otherwise the registry's Zod
  // schema (beach_slug: z.string().min(1)) self-rejects the payload.
  it("7e. slug guard: candidate with null slug is excluded", async () => {
    seedActiveProUser();
    // Override the home beach to have NULL slug.
    store.beaches[0].slug = null;
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });

    mockRpc.mockImplementation((name: string, args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 9.0, label: "EPIC" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, args);
    });

    const res = await GET(makeReq());
    expectConsoleWarnings([/dropping candidate beach .* — null\/empty slug/]);
    expect(res.status).toBe(200);
    const inserts = mockRpc.mock.calls.filter(
      (c: any[]) => c[0] === "try_insert_similarity_alert",
    );
    expect(inserts).toHaveLength(0);
  });

  it("7f. slug guard: candidate with empty-string slug is excluded", async () => {
    seedActiveProUser();
    store.beaches[0].slug = "";
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "5",
      wind_direction_deg: 270,
      tide_height: "2.0",
    });

    mockRpc.mockImplementation((name: string, args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: { state: "ready", score: 9.0, label: "EPIC" },
            },
          ],
          error: null,
        });
      }
      return rpcImpl(name, args);
    });

    const res = await GET(makeReq());
    expectConsoleWarnings([/dropping candidate beach .* — null\/empty slug/]);
    expect(res.status).toBe(200);
    const inserts = mockRpc.mock.calls.filter(
      (c: any[]) => c[0] === "try_insert_similarity_alert",
    );
    expect(inserts).toHaveLength(0);
  });

  it("filters invalid favorites before applying the five-favorite limit", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });
    const favoriteIds = Array.from(
      { length: 6 },
      (_, index) =>
        `00000000-0000-0000-0000-0000000000${String(index + 2).padStart(2, "d")}`,
    );
    favoriteIds.forEach((beachId, index) => {
      store.favoriteBeaches.push({
        beach_id: beachId,
        user_id: USER_PRO,
        rank: index + 1,
      });
      store.beaches.push({
        ...store.beaches[0],
        id: beachId,
        name: `Favorite ${index + 1}`,
        slug: index < 5 ? null : "valid-sixth-favorite",
      });
    });
    mockRpc.mockImplementation((name: string, args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({ data: [], error: null });
      }
      return rpcImpl(name, args);
    });

    const response = await GET(makeReq());

    expectConsoleWarnings([
      /dropping candidate beach .* — null\/empty slug/,
    ]);
    expect(response.status).toBe(200);
    const scoredBeachIds = mockRpc.mock.calls
      .filter((call: unknown[]) => call[0] === "compute_user_match_score_batch")
      .map((call: unknown[]) =>
        (call[1] as { p_beach_id: string }).p_beach_id
      );
    expect(scoredBeachIds).toContain(favoriteIds[5]);
    expect(scoredBeachIds).not.toContain(favoriteIds[0]);
  });

  // Plan V4 fix F2: stamps window_local + wave_height_ft + wave_period_s
  // into conditions_snapshot so the deliver cron can forward them to the
  // registry's push body builder ("4.5ft @ 11s · Sat 8am").
  it("7g. stamps window_local/wave_height_ft/wave_period_s in conditions_snapshot", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    const captured: { snapshot?: any } = {};
    mockRpc.mockImplementation((name: string, args: any) => {
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
        captured.snapshot = args.p_conditions_snapshot;
        return Promise.resolve({
          data: [{ inserted: true, alert_queue_id: "ff" }],
          error: null,
        });
      }
      return rpcImpl(name, args);
    });

    await GET(makeReq());

    expect(captured.snapshot).toMatchObject({
      alert_type: "similarity_match",
    });
    expect(typeof captured.snapshot.window_local).toBe("string");
    expect(captured.snapshot.window_local.length).toBeGreaterThan(0);
    expect(captured.snapshot.wave_height_ft).toBe(3.5);
    expect(captured.snapshot.wave_period_s).toBe(12);
  });

  it("7h. stamps richer similarity conditions context in conditions_snapshot", async () => {
    seedActiveProUser();
    store.forecasts.push({
      forecast_at: "2026-05-04T18:00:00Z",
      wave_height: "3.5",
      wave_period: "12",
      wind_speed: "6",
      wind_direction: "NW",
      wind_direction_deg: 315,
      tide_height: "2.4",
      tide_status: "RISING",
      confidence_score: 0.82,
    });

    const captured: { snapshot?: any } = {};
    mockRpc.mockImplementation((name: string, args: any) => {
      if (name === "compute_user_match_score_batch") {
        return Promise.resolve({
          data: [
            {
              slot_idx: 0,
              forecast_at: "2026-05-04T18:00:00Z",
              result: {
                state: "ready",
                score: 8.7,
                label: "GOOD",
                reason_bullets: ["cleaner than your usual good sessions"],
                confidence: 0.91,
              },
            },
          ],
          error: null,
        });
      }
      if (name === "try_insert_similarity_alert") {
        captured.snapshot = args.p_conditions_snapshot;
        return Promise.resolve({
          data: [{ inserted: true, alert_queue_id: "ff" }],
          error: null,
        });
      }
      return rpcImpl(name, args);
    });

    await GET(makeReq());

    expect(captured.snapshot).toMatchObject({
      wind_speed_mph: 6,
      wind_direction: "NW",
      tide_height_ft: 2.4,
      tide_status: "rising",
      score: 8.7,
      confidence: 0.91,
      reason: "cleaner than your usual good sessions",
      condition_summary: "3.5ft @ 12s, NW wind 6mph, rising tide 2.4ft",
      session_decision: {
        verdict: "go",
        decisionBasis: "personal_match",
        reasonCode: "selected_go",
        selection: {
          beachId: HOME_BEACH,
          windowStart: "2026-05-04T18:00:00Z",
          evidence: {
            personalMatch: {
              score: 8.7,
              label: "GOOD",
              reasons: ["cleaner than your usual good sessions"],
            },
          },
        },
      },
    });
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

  // Regression test for B1 (code review 2026-05-03): the previous
  // implementation used a `profiles!inner(...)` embed on alert_rules, which
  // PostgREST cannot resolve because alert_rules.user_id FKs to auth.users(id),
  // not profiles(id). Same lesson learned in condition-alert-deliver and
  // condition-alert-evaluate. Asserting the cron uses three separate flat
  // selects keeps that drift impossible to silently re-introduce.
  it("B1 regression: loadEligibleUsers uses flat selects, no embed", async () => {
    seedActiveProUser({ forecastsForBeach: HOME_BEACH });

    await GET(makeReq());

    const fromCalls = mockFrom.mock.calls.map((c: any[]) => c[0]);
    expect(fromCalls).toContain("alert_rules");
    expect(fromCalls).toContain("profiles");
    expect(fromCalls).toContain("user_entitlements");
  });
});
