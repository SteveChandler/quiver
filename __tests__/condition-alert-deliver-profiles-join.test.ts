/**
 * @jest-environment node
 *
 * Regression test for the condition-alert-deliver cron's embedded join against
 * the `profiles` table.
 *
 * GAP VERIFIED 2026-04-21 by Wave 1 / Agent 4 end-to-end verification on
 * dev.quiversurf.app: the delivery cron 500s on its very first query because
 * PostgREST cannot resolve `alert_queue -> profiles` as an embedded join.
 *
 *   PGRST200: "Searched for a foreign key relationship between 'alert_queue'
 *             and 'profiles' in the schema 'public', but no matches were found."
 *
 * `alert_queue.user_id` FKs to `auth.users(id)` (see migration
 * 20260408163000_add_condition_alerts.sql), not `profiles(id)`. PostgREST
 * cannot follow the two-hop auth.users -> profiles chain through a single
 * `profiles!inner(...)` embedding.
 *
 * This blocks delivery for EVERY alert type (not just similarity_match) — the
 * pipeline has never successfully written a row to `alert_deliveries` (zero
 * rows in prod as of 2026-04-21).
 *
 * The sibling evaluator at /api/cron/similarity-alerts documents the same
 * issue at its top-of-file @ts-nocheck comment for a different join path
 * (alert_rules -> profiles) — that one works at runtime because alert_rules
 * DOES have a user_id FK that PostgREST can follow. alert_queue doesn't have
 * the same escape hatch.
 *
 * Fix options (left to the fix agent):
 *   1. Drop the embedded profiles join and fetch profiles in a separate query
 *      keyed by the set of user_ids in rawItems.
 *   2. Add an explicit FK `alert_queue.user_id -> profiles.id` (works because
 *      profiles.id is a 1:1 mirror of auth.users.id; requires a migration).
 *   3. Use the PostgREST `profiles!alert_queue_user_id_fkey(...)` disambiguator
 *      once the FK exists.
 *
 * Until then, this test fails with the current code — proving the gap.
 */

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      from: (...args: unknown[]) => mockFrom(...args),
    }),
  ),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/mailer/client", () => ({
  resend: { emails: { send: jest.fn() } },
  MAIL_FROM: "test@test.com",
  MAIL_REPLY_TO: "test@test.com",
  getBaseUrl: () => "https://test.quiversurf.app",
}));

jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: () => ({ logDelivery: jest.fn() }),
}));

jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: () => ({ throttle: jest.fn() }),
}));

jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotifications: jest.fn(),
}));

import { GET } from "@/app/api/cron/condition-alert-deliver/route";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

describe("condition-alert-deliver: profiles embedded join resolves at runtime", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("does NOT throw PGRST200 on the alert_queue -> profiles embedding", async () => {
    // Post-fix behavior: the route no longer embeds `profiles!inner(...)` in
    // the alert_queue SELECT, so PostgREST no longer returns PGRST200. This
    // mock models the fixed code path — an empty alert_queue returns a
    // successful { data: [], error: null } response, and the route exits
    // cleanly with a 200 "No items due". Pre-fix, the same query shape
    // (with the profiles embed) would 500 on PGRST200.
    //
    // We assert the negative: the route must NOT return 500.
    const alertQueueSelectSpy = jest.fn((_columns: string) => ({
      eq: () => ({
        lte: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }));
    mockFrom.mockImplementation((table: string) => {
      if (table === "alert_queue") {
        return { select: alertQueueSelectSpy };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === "cron_runs") {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    const req = new Request(
      "http://localhost/api/cron/condition-alert-deliver",
      { headers: { authorization: "Bearer test" } },
    );
    const res = await GET(req);

    // Drain any fatal-error console.error the route may have emitted (this
    // becomes a no-op once the fix is in place).
    expectConsoleErrors([/\[condition-alert-deliver\] Fatal error/]);

    // EXPECTED (post-fix): 200 with a no-op "No items due" or a resolved
    // delivery. ACTUAL (pre-fix): 500 with { error: "Internal error" }.
    expect(res.status).not.toBe(500);

    // Regression guard: the alert_queue SELECT must not embed `profiles(...)`.
    // If a future refactor re-introduces the bad embed, this fails loudly.
    expect(alertQueueSelectSpy).toHaveBeenCalled();
    const selectArg = String(alertQueueSelectSpy.mock.calls[0]?.[0] ?? "");
    expect(selectArg).not.toMatch(/profiles\s*!/);
  });
});
