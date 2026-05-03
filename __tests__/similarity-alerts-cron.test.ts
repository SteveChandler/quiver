/**
 * @jest-environment node
 *
 * Tests for the /api/cron/similarity-alerts route.
 *
 * This hourly cron scans subscribed similarity_match alert_rules, scores the
 * next 72h of forecasts against each rule's user via compute_user_match_score,
 * and enqueues alerts when score >= 7. Frequency caps: 1 alert per beach per
 * 48h, max 3 per user per 24h.
 */

// Mock Supabase client BEFORE importing the route.
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

describe("Cron: similarity-alerts", () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalEnabled = process.env.ALERTS_DELIVERY_ENABLED;
  const originalAllowlist = process.env.ALERTS_DELIVERY_USER_ALLOWLIST;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    // Phase 2 hardening: cron now gates on ALERTS_DELIVERY_ENABLED. The per-rule
    // tests below exercise the score/queue path, so flip the gate ON here.
    // The kill-switch's own behavior is covered by a dedicated test.
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
    if (originalEnabled === undefined) {
      delete process.env.ALERTS_DELIVERY_ENABLED;
    } else {
      process.env.ALERTS_DELIVERY_ENABLED = originalEnabled;
    }
    if (originalAllowlist === undefined) {
      delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;
    } else {
      process.env.ALERTS_DELIVERY_USER_ALLOWLIST = originalAllowlist;
    }
  });

  it("returns 401 when no CRON_SECRET auth is provided", async () => {
    const req = new Request("http://localhost/api/cron/similarity-alerts");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns skipped:true and touches no DB when ALERTS_DELIVERY_ENABLED!==true", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "false";
    const req = new Request("http://localhost/api/cron/similarity-alerts", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      skipped: true,
      reason: "delivery_disabled",
      enqueued: 0,
      evaluated: 0,
    });
    // Critical: kill switch returns BEFORE the rule loop runs. The
    // withObservedCron wrapper still touches cron_runs (expected, that's
    // observability), but _GET itself must NOT load alert_rules / score
    // forecasts / write alert_queue while delivery is paused — otherwise the
    // queue would accrue rows that get marked sent without delivering.
    const ruleLoopTables = mockFrom.mock.calls
      .map((call) => call[0])
      .filter((t) => t !== "cron_runs");
    expect(ruleLoopTables).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 200 with enqueued:0 when authorized but no rules exist", async () => {
    // alert_rules query: return empty
    mockFrom.mockImplementation((table: string) => {
      if (table === "alert_rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const req = new Request("http://localhost/api/cron/similarity-alerts", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enqueued: 0 });
  });

  it("skips a rule when an alert was queued for that beach in the last 48h", async () => {
    const rule = {
      id: "rule-1",
      user_id: "user-1",
      beach_id: "beach-1",
      preset_type: "similarity_match",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "alert_rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({ data: [rule], error: null }),
            }),
          }),
        };
      }
      if (table === "alert_queue") {
        // First call is the per-beach 48h frequency cap — return count > 0
        // so the rule is skipped without reaching the RPC or forecast queries.
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () =>
                    Promise.resolve({ count: 1, data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ data: null, error: null }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () =>
                  Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      };
    });

    const req = new Request("http://localhost/api/cron/similarity-alerts", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enqueued: 0, skipped: 1 });
    // RPC must not have been called once the 48h cap short-circuited.
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
