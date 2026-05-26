/** @jest-environment node */

// NextResponse.json polyfill — jsdom doesn't ship Response.json().
if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

/**
 * Unit tests for /api/alerts/rules guards on auto-managed similarity_match rules.
 *
 * Server-side rejections (Plan V4 Agent 4):
 *   - POST: 409 if a similarity_match rule already exists for this user
 *     (regardless of auto_created_at). Prevents both manual dupes and a race
 *     with the auto-enable webhook.
 *   - DELETE: 403 if rule.auto_created_at IS NOT NULL AND preset_type='similarity_match'.
 *     User-created rules continue to delete fine.
 *   - PATCH: 403 on ANY field update to an auto-managed similarity_match rule
 *     (including enabled:false). Other rules unchanged.
 *
 * Strategy: mock `withAuth` to inject user/supabase, mock the supabase chain
 * via a per-table store. Mirrors `seed-default.test.ts`.
 */

const mockUser = { id: "user-1" };

// ---- Per-test mutable state ----

interface AlertRuleRow {
  id: string;
  user_id: string;
  beach_id: string;
  name: string;
  preset_type: string | null;
  conditions: Record<string, unknown>;
  notify_email: boolean;
  notify_push: boolean;
  enabled: boolean;
  auto_created_at: string | null;
  created_at: string;
  updated_at: string;
  beaches?: { name: string; slug: string | null; timezone: string };
}

interface ProfileRow {
  home_beach_id: string | null;
}

let mockProfile: ProfileRow = { home_beach_id: "beach-home" };
let mockExistingRules: AlertRuleRow[] = [];
let mockUserEntitlementTier: "free" | "premium" = "premium";
let mockPersonalizationEligibility = {
  code: "PERSONALIZATION_UNLOCKED",
  canUsePersonalMatch: true,
  canUseRankedWindows: true,
  canCreatePersonalAlert: true,
  canDeliverPersonalAlert: true,
  source: "entitlement",
};

// Track inserts/updates/deletes so tests can assert side effects.
const insertSpy = jest.fn();
const updateSpy = jest.fn();
const deleteSpy = jest.fn();
const upsertSpy = jest.fn();

// ---- Mocks ----

jest.mock("@/lib/alerts/entitlements", () => ({
  getUserEntitlement: jest.fn(async () => mockUserEntitlementTier),
  // Always allow — we test the new guards here, not entitlement gating.
  canCreateRule: jest.fn(() => ({ allowed: true })),
}));

jest.mock("@/lib/personalization/eligibility", () => ({
  PERSONALIZATION_UNLOCKED: "PERSONALIZATION_UNLOCKED",
  PERSONALIZATION_LOCKED: "PERSONALIZATION_LOCKED",
  BILLING_ISSUE_LOCKED: "BILLING_ISSUE_LOCKED",
  ENTITLEMENT_SYNCING: "ENTITLEMENT_SYNCING",
  BETA_ACCESS_NOT_ENABLED: "BETA_ACCESS_NOT_ENABLED",
  PERSONALIZATION_DISABLED: "PERSONALIZATION_DISABLED",
  ALERT_DELIVERY_PAUSED: "ALERT_DELIVERY_PAUSED",
  getPersonalizationEligibility: jest.fn(async () => mockPersonalizationEligibility),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");

  // Build a minimal Supabase mock that supports the chains the routes use.
  function buildSupabase() {
    return {
      from(table: string) {
        if (table === "profiles") {
          return {
            select() {
              return {
                eq() {
                  return {
                    single: () =>
                      Promise.resolve({ data: mockProfile, error: null }),
                  };
                },
              };
            },
          };
        }

        if (table === "favorite_beaches") {
          return {
            upsert: (...args: unknown[]) => {
              upsertSpy(...args);
              return Promise.resolve({ data: null, error: null });
            },
          };
        }

        if (table === "alert_rules") {
          return {
            // SELECT chain — used by POST to count existing rules and by
            // DELETE/PATCH to load the rule for ownership + auto-managed check.
            select(_cols: string) {
              return {
                eq(col: string, val: string) {
                  // For POST: .eq("user_id", user.id) returns an awaitable list
                  if (col === "user_id") {
                    return {
                      then: (resolve: any) =>
                        resolve({
                          data: mockExistingRules.filter(
                            (r) => r.user_id === val
                          ),
                          error: null,
                        }),
                    };
                  }
                  // For DELETE/PATCH: .eq("id", ruleId).single()
                  if (col === "id") {
                    const rule = mockExistingRules.find((r) => r.id === val);
                    return {
                      single: () =>
                        Promise.resolve(
                          rule
                            ? { data: rule, error: null }
                            : {
                                data: null,
                                error: {
                                  code: "PGRST116",
                                  message: "Not found",
                                },
                              }
                        ),
                      // PATCH/DELETE may chain further .eq before terminal
                      eq() {
                        return {
                          single: () =>
                            Promise.resolve(
                              rule
                                ? { data: rule, error: null }
                                : {
                                    data: null,
                                    error: {
                                      code: "PGRST116",
                                      message: "Not found",
                                    },
                                  }
                            ),
                        };
                      },
                    };
                  }
                  return { then: (r: any) => r({ data: [], error: null }) };
                },
              };
            },
            insert(payload: Record<string, unknown>) {
              insertSpy(payload);
              const inserted: AlertRuleRow = {
                id: "rule-new",
                user_id: String(payload.user_id),
                beach_id: String(payload.beach_id),
                name: String(payload.name),
                preset_type: (payload.preset_type as string) ?? null,
                conditions:
                  (payload.conditions as Record<string, unknown>) ?? {},
                notify_email: payload.notify_email !== false,
                notify_push: payload.notify_push === true,
                enabled: true,
                auto_created_at: (payload.auto_created_at as string) ?? null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              mockExistingRules.push(inserted);
              return {
                select() {
                  return {
                    single: () =>
                      Promise.resolve({ data: inserted, error: null }),
                  };
                },
              };
            },
            update(payload: Record<string, unknown>) {
              updateSpy(payload);
              return {
                eq(_col1: string, val1: string) {
                  return {
                    eq(_col2: string, _val2: string) {
                      const rule = mockExistingRules.find((r) => r.id === val1);
                      if (rule) Object.assign(rule, payload);
                      return {
                        select() {
                          return {
                            single: () =>
                              Promise.resolve({ data: rule, error: null }),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
            delete() {
              return {
                eq(_col1: string, val1: string) {
                  return {
                    eq(_col2: string, _val2: string) {
                      deleteSpy(val1);
                      mockExistingRules = mockExistingRules.filter(
                        (r) => r.id !== val1
                      );
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
              };
            },
          };
        }

        return {};
      },
    };
  }

  return {
    ...actual,
    withAuth:
      (handler: any) =>
      (request: any, ctx: any = {}) => {
        const params = ctx.params ?? request?.params ?? {};
        const supabase = buildSupabase();
        return handler(request, { user: mockUser, supabase, params });
      },
  };
});

// ---- Imports must follow mocks ----
import { POST } from "@/app/api/alerts/rules/route";
import { DELETE, PATCH } from "@/app/api/alerts/rules/[ruleId]/route";

function makeReq(body?: unknown): any {
  return {
    headers: { get: () => null },
    json: async () => body ?? {},
  };
}

function userRule(overrides: Partial<AlertRuleRow> = {}): AlertRuleRow {
  return {
    id: "rule-user",
    user_id: "user-1",
    beach_id: "beach-home",
    name: "User custom rule",
    preset_type: "custom",
    conditions: {},
    notify_email: true,
    notify_push: false,
    enabled: true,
    auto_created_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function autoSimilarityRule(
  overrides: Partial<AlertRuleRow> = {}
): AlertRuleRow {
  return {
    id: "rule-auto",
    user_id: "user-1",
    beach_id: "beach-home",
    name: "Conditions like your best sessions",
    preset_type: "similarity_match",
    conditions: {},
    notify_email: false,
    notify_push: true,
    enabled: true,
    auto_created_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockProfile = { home_beach_id: "beach-home" };
  mockExistingRules = [];
  mockUserEntitlementTier = "premium";
  mockPersonalizationEligibility = {
    code: "PERSONALIZATION_UNLOCKED",
    canUsePersonalMatch: true,
    canUseRankedWindows: true,
    canCreatePersonalAlert: true,
    canDeliverPersonalAlert: true,
    source: "entitlement",
  };
  insertSpy.mockReset();
  updateSpy.mockReset();
  deleteSpy.mockReset();
  upsertSpy.mockReset();
});

// ============================================================================
// POST /api/alerts/rules
// ============================================================================

describe("POST /api/alerts/rules — duplicate similarity_match guard", () => {
  it("returns 409 when user already has a similarity_match rule", async () => {
    mockExistingRules = [autoSimilarityRule()];

    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Another similarity rule",
        preset_type: "similarity_match",
        conditions: {},
      })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: "similarity_match_already_exists",
    });
    expect(body.message).toMatch(/similarity match rule already exists/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("returns 409 even when the existing similarity rule is user-created (auto_created_at NULL)", async () => {
    // The guard is preset_type-scoped, not auto_created_at-scoped.
    mockExistingRules = [
      userRule({ id: "rule-manual", preset_type: "similarity_match" }),
    ];

    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Dupe attempt",
        preset_type: "similarity_match",
      })
    );

    expect(res.status).toBe(409);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("creates a similarity_match rule when none exists yet", async () => {
    mockExistingRules = []; // no similarity row

    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "First similarity rule",
        preset_type: "similarity_match",
        conditions: { similarity_threshold: 7.5 },
        notify_push: true,
        notify_email: false,
      })
    );

    expect(res.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][0]).toMatchObject({
      preset_type: "similarity_match",
    });
  });

  it.each([
    ["ENTITLEMENT_SYNCING", "canCreatePersonalAlert"],
    ["BETA_ACCESS_NOT_ENABLED", "canCreatePersonalAlert"],
    ["PERSONALIZATION_DISABLED", "canUsePersonalMatch"],
  ] as const)(
    "returns stable %s code for personal alert denials",
    async (code, expectedDetailKey) => {
      mockPersonalizationEligibility = {
        code,
        canUsePersonalMatch: false,
        canUseRankedWindows: false,
        canCreatePersonalAlert: false,
        canDeliverPersonalAlert: false,
        source: "none",
      };

      const res = await POST(
        makeReq({
          beach_id: "beach-home",
          name: "Similarity rule",
          preset_type: "similarity_match",
          conditions: {},
        })
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: code,
        details: {
          code,
          [expectedDetailKey]: false,
        },
      });
      expect(insertSpy).not.toHaveBeenCalled();
    },
  );

  it("does not block rule editing eligibility when alert delivery is paused", async () => {
    mockPersonalizationEligibility = {
      code: "ALERT_DELIVERY_PAUSED",
      canUsePersonalMatch: true,
      canUseRankedWindows: true,
      canCreatePersonalAlert: true,
      canDeliverPersonalAlert: false,
      source: "entitlement",
    };

    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Similarity rule",
        preset_type: "similarity_match",
        conditions: {},
      })
    );

    expect(res.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT block POSTs of other preset types when a similarity rule exists", async () => {
    mockExistingRules = [autoSimilarityRule()];

    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Custom rule",
        preset_type: "custom",
        conditions: { swell_height_min: 1, swell_height_max: 3 },
      })
    );

    expect(res.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/alerts/rules — condition alert validation", () => {
  it("rejects empty custom conditions before they can match every forecast", async () => {
    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Wildcard rule",
        preset_type: "custom",
        conditions: {},
        notify_push: true,
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one condition/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects cross-type similarity filters on condition alerts", async () => {
    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Wrong type",
        preset_type: null,
        conditions: { similarity_threshold: 7.5 },
        notify_push: true,
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Condition alerts cannot include/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid ranges and rules with no delivery channel", async () => {
    const rangeRes = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Bad range",
        preset_type: null,
        conditions: { swell_height_min: 4, swell_height_max: 2 },
        notify_push: true,
      })
    );
    expect(rangeRes.status).toBe(400);

    const channelRes = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "No channel",
        preset_type: null,
        conditions: { swell_height_min: 1 },
        notify_push: false,
        notify_email: false,
      })
    );
    expect(channelRes.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("accepts advanced condition alert controls and inserts sanitized conditions", async () => {
    const conditions = {
      swell_height_min: 1,
      swell_height_max: 3,
      swell_period_min: 8,
      wind_speed_max_kt: 5,
      wind_direction: "offshore",
      tide_height_min_ft: 0,
      tide_height_max_ft: 4,
      tide_direction: "rising",
      local_time_start: "05:00",
      local_time_end: "11:00",
      days_of_week: [0, 6],
      board_id: "board-1",
      board_label: "Log",
      max_frequency_per_week: 3,
      quiet_hours_start: 22,
      quiet_hours_end: 5,
    };

    const res = await POST(
      makeReq({
        beach_id: "beach-home",
        name: "Advanced rule",
        preset_type: null,
        conditions,
        notify_push: true,
        notify_email: false,
      })
    );

    expect(res.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][0]).toMatchObject({
      preset_type: null,
      conditions,
      notify_push: true,
      notify_email: false,
    });
  });
});

// ============================================================================
// DELETE /api/alerts/rules/[ruleId]
// ============================================================================

describe("DELETE /api/alerts/rules/[ruleId] — auto-managed guard", () => {
  it("returns 403 on auto-managed similarity_match (auto_created_at NOT NULL)", async () => {
    const rule = autoSimilarityRule({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    mockExistingRules = [rule];

    const res = await DELETE(makeReq(), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: "auto_managed_rule",
    });
    expect(body.message).toMatch(/auto-managed/i);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("deletes a user-created rule (auto_created_at NULL) normally", async () => {
    const rule = userRule({ id: "550e8400-e29b-41d4-a716-446655440001" });
    mockExistingRules = [rule];

    const res = await DELETE(makeReq(), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith(rule.id);
  });

  it("deletes a user-created similarity_match rule (auto_created_at NULL)", async () => {
    // A user who manually created their own similarity row before auto-enable
    // shipped should still be able to delete it. The guard keys on
    // auto_created_at NOT NULL, not on preset_type alone.
    const rule = userRule({
      id: "550e8400-e29b-41d4-a716-446655440002",
      preset_type: "similarity_match",
      auto_created_at: null,
    });
    mockExistingRules = [rule];

    const res = await DELETE(makeReq(), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith(rule.id);
  });
});

// ============================================================================
// PATCH /api/alerts/rules/[ruleId]
// ============================================================================

describe("PATCH /api/alerts/rules/[ruleId] — auto-managed guard", () => {
  it("returns 403 when patching enabled:false on auto-managed similarity rule", async () => {
    const rule = autoSimilarityRule({
      id: "550e8400-e29b-41d4-a716-446655440010",
    });
    mockExistingRules = [rule];

    const res = await PATCH(makeReq({ enabled: false }), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: "auto_managed_rule",
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns 403 when patching beach_id on auto-managed similarity rule", async () => {
    const rule = autoSimilarityRule({
      id: "550e8400-e29b-41d4-a716-446655440011",
    });
    mockExistingRules = [rule];

    const res = await PATCH(makeReq({ beach_id: "other-beach" }), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns 403 when patching name on auto-managed similarity rule", async () => {
    const rule = autoSimilarityRule({
      id: "550e8400-e29b-41d4-a716-446655440012",
    });
    mockExistingRules = [rule];

    const res = await PATCH(makeReq({ name: "renamed" }), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("PATCHes a user-created rule normally", async () => {
    const rule = userRule({ id: "550e8400-e29b-41d4-a716-446655440013" });
    mockExistingRules = [rule];

    const res = await PATCH(makeReq({ name: "Renamed" }), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0]).toMatchObject({ name: "Renamed" });
  });

  it("rejects empty condition updates on user-created condition rules", async () => {
    const rule = userRule({
      id: "550e8400-e29b-41d4-a716-446655440014",
      conditions: { swell_height_min: 1 },
    });
    mockExistingRules = [rule];

    const res = await PATCH(makeReq({ conditions: {} }), {
      params: { ruleId: rule.id },
    } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one condition/i);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects condition updates that disable every delivery channel", async () => {
    const rule = userRule({
      id: "550e8400-e29b-41d4-a716-446655440015",
      conditions: { swell_height_min: 1 },
      notify_email: true,
      notify_push: false,
    });
    mockExistingRules = [rule];

    const res = await PATCH(
      makeReq({ notify_email: false, notify_push: false }),
      {
        params: { ruleId: rule.id },
      } as any
    );

    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
