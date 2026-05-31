/**
 * Unit tests for Day-7 First-Session-Nudge Push Cron Job API
 *
 * Coverage:
 * - Auth gating (CRON_SECRET / x-vercel-cron)
 * - Empty pipeline (no signups in window)
 * - Idempotency skip (already-logged row)
 * - Session cap (>=3 sessions filtered out)
 * - Unconfirmed email (invisible cohort) skipped
 * - Push disabled skipped
 * - No device token skipped (NOT logged)
 * - Each of the 5 cohorts resolves to the correct title/body
 * - Multi-device fan-out: one log row, N push deliveries
 * - Firing cohort + failing confidence lookup falls back to free_home
 */

import { GET } from "@/app/api/cron/first-session-nudge-push/route";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";

// ============================================================================
// Mocks
// ============================================================================

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: jest.fn(() =>
      Promise.resolve({ success: true, data, timestamp: new Date().toISOString() })
    ),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: jest.fn(() =>
      Promise.resolve({ success: false, error, details, timestamp: new Date().toISOString() })
    ),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      })
    ),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

// ----------------------------------------------------------------------------
// Supabase chain mock
// ----------------------------------------------------------------------------
//
// Route call order per .from():
//   1. profiles          .select().gte().lt()                          ← lt terminator (signup window)
//   2. activation_push_log  .select().in().eq()                        ← eq terminator
//   3. sessions          .select().in()                                ← in terminator
//   4. profiles          .select().in()                                ← in terminator (push prefs)
//   5. user_devices      .select().in()                                ← in terminator
//   6. user_entitlements .select().in()                                ← in terminator
//   7. beaches           .select().in()                                ← in terminator
//   8. enhanced_forecasts .select().eq().gte().lt().gte().order().limit().maybeSingle()  ← maybeSingle
//   9. activation_push_log  .insert()                                  ← insert terminator
//
// profiles is called twice — once with gte/lt (window), once with in
// (push-prefs). The builder terminates on whichever method the caller
// awaits, so we return different resolved rows based on the terminator.

interface TableRows {
  window?: unknown[]; // profiles.gte().lt() — signup window
  in?: unknown[]; // generic .in() terminator (with optional post-.eq() filtering)
  maybeSingle?: unknown | null;
}

const tableState: Record<string, TableRows & { insertError?: { message: string } | null }> = {};

const mockInsert = jest.fn();

// Thenable chain builder. Every filter method returns the same builder; the
// resolved value is picked based on which "mode" the chain is in:
//   - .lt() puts the builder into WINDOW mode (resolves with `window` data)
//   - .maybeSingle() resolves with `maybeSingle` data
//   - default is IN mode (resolves with `in` data)
// Awaiting the builder at any point resolves with the current-mode data so
// terminal methods (.eq() after .in(), .in() after .eq()) work transparently.
function buildQuery(table: string) {
  const row = tableState[table] ?? {};
  const windowResolved = { data: row.window ?? [], error: null };
  const inResolved = { data: row.in ?? [], error: null };
  const maybeSingleResolved = { data: row.maybeSingle ?? null, error: null };

  let mode: "window" | "in" | "maybeSingle" = "in";

  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.gte = jest.fn(chain);
  builder.lte = jest.fn(chain);
  builder.lt = jest.fn(() => {
    mode = "window";
    return builder;
  });
  builder.order = jest.fn(chain);
  builder.limit = jest.fn(chain);
  builder.in = jest.fn(chain);
  builder.maybeSingle = jest.fn(() => {
    mode = "maybeSingle";
    return builder;
  });
  builder.then = (onFulfilled: (v: unknown) => unknown) => {
    const resolved =
      mode === "window"
        ? windowResolved
        : mode === "maybeSingle"
          ? maybeSingleResolved
          : inResolved;
    return Promise.resolve(resolved).then(onFulfilled);
  };
  builder.insert = jest.fn((payload: unknown) => {
    // cron_runs comes from withObservedCron, not the handler — exclude it
    // from the spy so existing assertions about handler-level inserts hold.
    if (table !== "cron_runs") mockInsert(table, payload);
    return Promise.resolve({ error: row.insertError ?? null });
  });
  return builder;
}

const mockFrom = jest.fn((table: string) => buildQuery(table));

const mockGetUserById = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        getUserById: (id: string) => mockGetUserById(id),
      },
    },
  })),
}));

// Phase 3e: route uses enqueueNotification, not sendPushNotifications.
// Retain the FCM mock as a defensive guard so any future regression is caught.
const mockSendPushNotifications = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotifications: (...args: unknown[]) => mockSendPushNotifications(...args),
}));

const mockEnqueueNotification = jest.fn();
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

// ============================================================================
// Helpers
// ============================================================================

const mockRequest = (
  headers: Record<string, string> = {},
  url = "http://localhost/api/cron/first-session-nudge-push"
) =>
  ({
    url,
    headers: { get: jest.fn((name: string) => headers[name] ?? null) },
    json: jest.fn(() => Promise.resolve({})),
  }) as unknown as NextRequest;

function reset() {
  for (const k of Object.keys(tableState)) delete tableState[k];
  mockGetUserById.mockReset();
}

function seedWindow(table: string, data: unknown[]) {
  tableState[table] = { ...(tableState[table] ?? {}), window: data };
}
function seedIn(table: string, data: unknown[]) {
  tableState[table] = { ...(tableState[table] ?? {}), in: data };
}
function seedMaybeSingle(table: string, data: unknown | null) {
  tableState[table] = { ...(tableState[table] ?? {}), maybeSingle: data };
}

/** Build a fully-confirmed auth user for getUserById mock. */
function confirmedAuthUser(id: string) {
  return {
    data: {
      user: {
        id,
        email: `${id}@example.com`,
        email_confirmed_at: new Date().toISOString(),
      },
    },
    error: null,
  };
}

function unconfirmedAuthUser(id: string) {
  return {
    data: {
      user: {
        id,
        email: `${id}@example.com`,
        email_confirmed_at: null,
      },
    },
    error: null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("First-Session-Nudge Push Cron", () => {
  const routeSource = readFileSync(
    "app/api/cron/first-session-nudge-push/route.ts",
    "utf8"
  );
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    reset();
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "evt-mock",
    });
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  describe("Authentication", () => {
    it("rejects invalid cron requests with 401", async () => {
      const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
      validateCronRequest.mockReturnValue(false);

      const response = await GET(mockRequest({ authorization: "Bearer bad" }));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
      expect(response.status).toBe(401);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
    });

    it("accepts x-vercel-cron header", async () => {
      seedWindow("profiles", []);
      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Empty pipeline", () => {
    it("returns empty summary when no signups are in the Day-7 window", async () => {
      seedWindow("profiles", []);
      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.total).toBe(0);
      expect(data.data.summary.sent).toBe(0);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("Idempotency", () => {
    it("skips users that already have an activation_push_log row", async () => {
      seedWindow("profiles", [
        { id: "u-1", first_name: "Steve", home_beach_id: null },
      ]);
      seedIn("activation_push_log", [{ user_id: "u-1" }]);

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.already_logged).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("Session cap", () => {
    it("filters out users with 3+ logged sessions", async () => {
      seedWindow("profiles", [
        { id: "u-cap", first_name: null, home_beach_id: null },
      ]);
      seedIn("activation_push_log", []);
      seedIn("sessions", [
        { user_id: "u-cap" },
        { user_id: "u-cap" },
        { user_id: "u-cap" },
      ]);

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.at_3_sessions).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
    });

    it("keeps users with exactly 2 sessions (under threshold)", async () => {
      seedWindow("profiles", [
        { id: "u-2sess", first_name: null, home_beach_id: null },
      ]);
      seedIn("activation_push_log", []);
      seedIn("sessions", [{ user_id: "u-2sess" }, { user_id: "u-2sess" }]);
      mockGetUserById.mockImplementation((id: string) => confirmedAuthUser(id));
      seedIn("profiles", [{ id: "u-2sess", notif_push_enabled: true }]);
      seedIn("user_devices", [{ user_id: "u-2sess", device_token: "tok" }]);
      seedIn("user_entitlements", []);

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.skipped.at_3_sessions).toBe(0);
    });
  });

  describe("Invisible cohort", () => {
    it("skips users with no email_confirmed_at", async () => {
      seedWindow("profiles", [
        { id: "u-ghost", first_name: null, home_beach_id: null },
      ]);
      seedIn("activation_push_log", []);
      seedIn("sessions", []);
      mockGetUserById.mockImplementation((id: string) => unconfirmedAuthUser(id));

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.no_email_confirmed).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
    });
  });

  describe("Push prefs / token filters", () => {
    it("skips users with push notifications disabled", async () => {
      seedWindow("profiles", [
        { id: "u-nop", first_name: null, home_beach_id: null },
      ]);
      seedIn("activation_push_log", []);
      seedIn("sessions", []);
      mockGetUserById.mockImplementation((id: string) => confirmedAuthUser(id));
      seedIn("profiles", [{ id: "u-nop", notif_push_enabled: false }]);

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.push_disabled).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("skips users with no device tokens AND does NOT write a log row", async () => {
      seedWindow("profiles", [
        { id: "u-notok", first_name: null, home_beach_id: null },
      ]);
      seedIn("activation_push_log", []);
      seedIn("sessions", []);
      mockGetUserById.mockImplementation((id: string) => confirmedAuthUser(id));
      seedIn("profiles", [{ id: "u-notok", notif_push_enabled: true }]);
      seedIn("user_devices", []);
      seedIn("user_entitlements", []);

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.no_token).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("Cohort resolution", () => {
    const setupBase = (
      userId: string,
      overrides: {
        home_beach_id?: string | null;
        entitlement?: { is_pro: boolean; is_trialing: boolean } | null;
        beachName?: string;
        firingScore?: number | null;
      } = {}
    ) => {
      const { home_beach_id = null, entitlement = null, beachName, firingScore } = overrides;
      seedWindow("profiles", [
        { id: userId, first_name: "Steve", home_beach_id },
      ]);
      seedIn("activation_push_log", []);
      seedIn("sessions", []);
      mockGetUserById.mockImplementation((id: string) => confirmedAuthUser(id));
      seedIn("profiles", [{ id: userId, notif_push_enabled: true }]);
      seedIn("user_devices", [{ user_id: userId, device_token: "tok-1" }]);
      seedIn("user_entitlements", entitlement ? [{ user_id: userId, ...entitlement }] : []);
      if (home_beach_id && beachName) {
        seedIn("beaches", [{ id: home_beach_id, name: beachName }]);
      }
      if (firingScore !== undefined) {
        seedMaybeSingle(
          "enhanced_forecasts",
          firingScore === null ? null : { confidence_score: firingScore }
        );
      }
    };

    it("trialing_home → 'Unlock your Quiver' + beach name in body (Phase 3e: enqueued)", async () => {
      setupBase("u-th", {
        home_beach_id: "beach-1",
        entitlement: { is_pro: true, is_trialing: true },
        beachName: "Swami's",
      });

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.cohorts.trialing_home).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();

      expect(mockEnqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "log_session_nudge",
          recipientUserId: "u-th",
          entityType: "beach",
          entityId: "beach-1",
          payload: expect.objectContaining({
            cohort: "trialing_home",
            title: "Unlock your Quiver",
            body: "Log today's session at Swami's — 7 days left in your trial",
            beach_id: "beach-1",
          }),
        })
      );
    });

    it("trialing_no_home → 'Set your home break'", async () => {
      setupBase("u-tn", {
        home_beach_id: null,
        entitlement: { is_pro: true, is_trialing: true },
      });

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.data.summary.cohorts.trialing_no_home).toBe(1);
      const call = mockEnqueueNotification.mock.calls[0][0];
      expect(call.payload.title).toBe("Set your home break");
      expect(call.payload.body).toBe(
        "Pick a spot and log a session — 7 days left in your trial"
      );
      expect(call.payload.beach_id).toBeNull();
    });

    it("free_home_firing → '✨ {beach} is looking good' when confidence>=70", async () => {
      setupBase("u-fhf", {
        home_beach_id: "beach-2",
        entitlement: { is_pro: false, is_trialing: false },
        beachName: "Blacks",
        firingScore: 82,
      });

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.data.summary.cohorts.free_home_firing).toBe(1);
      const call = mockEnqueueNotification.mock.calls[0][0];
      expect(call.payload.title).toBe("✨ Blacks is looking good");
      expect(call.payload.body).toBe(
        "Check today's forecast and log your session to start building your score"
      );
    });

    it("free_home (no-ent) → 'How was this week?' when no entitlement row exists", async () => {
      setupBase("u-fh", {
        home_beach_id: "beach-3",
        entitlement: null, // no row at all = free
        beachName: "Trestles",
        firingScore: null, // no firing row
      });

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.data.summary.cohorts.free_home).toBe(1);
      const call = mockEnqueueNotification.mock.calls[0][0];
      expect(call.payload.title).toBe("How was this week?");
      expect(call.payload.body).toBe(
        "Log a session at Trestles to start building your personalized forecast"
      );
    });

    it("free_no_home → 'Been out this week?'", async () => {
      setupBase("u-fnh", {
        home_beach_id: null,
        entitlement: { is_pro: false, is_trialing: false },
      });

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.data.summary.cohorts.free_no_home).toBe(1);
      const call = mockEnqueueNotification.mock.calls[0][0];
      expect(call.payload.title).toBe("Been out this week?");
      expect(call.payload.body).toBe("Set your home break and log a session to start");
      expect(call.payload.beach_id).toBeNull();
    });
  });

  describe("Multi-device fan-out (Phase 3e: enqueue once, worker handles fan-out)", () => {
    it("logs once per user even when the user has multiple device tokens", async () => {
      seedWindow("profiles", [
        { id: "u-multi", first_name: null, home_beach_id: null },
      ]);
      seedIn("activation_push_log", []);
      seedIn("sessions", []);
      mockGetUserById.mockImplementation((id: string) => confirmedAuthUser(id));
      seedIn("profiles", [{ id: "u-multi", notif_push_enabled: true }]);
      seedIn("user_devices", [
        { user_id: "u-multi", device_token: "ios-tok" },
        { user_id: "u-multi", device_token: "android-tok" },
      ]);
      seedIn("user_entitlements", []);

      const response = await GET(mockRequest({ "x-vercel-cron": "1" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);
      // Phase 3e: cron enqueues once; the worker fans out across devices.
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const [table, payload] = mockInsert.mock.calls[0];
      expect(table).toBe("activation_push_log");
      expect(payload).toMatchObject({
        user_id: "u-multi",
        nudge_type: "first_session_day7",
        metadata: expect.objectContaining({
          cohort: "free_no_home",
          device_count: 2,
          method: "enqueued_via_pipeline",
        }),
      });
    });
  });
});
