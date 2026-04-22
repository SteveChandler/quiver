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
 * The sibling evaluator at /api/cron/similarity-alert-evaluate documents the
 * same issue at its top-of-file @ts-nocheck comment for a different join path
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

jest.mock("@/lib/api-utils", () => ({
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does NOT throw PGRST200 on the alert_queue -> profiles embedding", async () => {
    // Simulate the prod PostgREST behavior: when the query includes
    // `profiles!inner(...)` but no FK exists from alert_queue.user_id ->
    // profiles.id, PostgREST returns error code PGRST200. The supabase-js
    // client surfaces that as { data: null, error } — and the route's
    // `if (queueError) throw queueError` path then returns HTTP 500 with
    // `processed: 0`. That is exactly what the prod invocation produced.
    mockFrom.mockImplementation((table: string) => {
      if (table === "alert_queue") {
        return {
          select: () => ({
            eq: () => ({
              lte: () => ({
                order: () =>
                  Promise.resolve({
                    data: null,
                    error: {
                      code: "PGRST200",
                      message:
                        "Could not find a relationship between 'alert_queue' and 'profiles' in the schema cache",
                      details:
                        "Searched for a foreign key relationship between 'alert_queue' and 'profiles' in the schema 'public', but no matches were found.",
                    },
                  }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = new Request(
      "http://localhost/api/cron/condition-alert-deliver",
      { headers: { authorization: "Bearer test" } },
    );
    const res = await GET(req);

    // Clear the known fatal-error console.error the route emits pre-fix.
    // Done BEFORE the assertion so the afterEach guard doesn't double-fail.
    // Once the fix lands and the route no longer 500s, this call becomes a
    // no-op (the tracked array is empty).
    expectConsoleErrors([/\[condition-alert-deliver\] Fatal error/]);

    // EXPECTED (post-fix): 200 with a no-op "No items due" or a resolved
    // delivery. ACTUAL (pre-fix): 500 with { error: "Internal error" }.
    expect(res.status).not.toBe(500);
  });
});
