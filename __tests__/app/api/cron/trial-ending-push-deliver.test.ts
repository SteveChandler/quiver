/**
 * Unit tests for Day-12 Trial-Ending Push Cron Job API
 *
 * Test coverage:
 * - Auth gating (CRON_SECRET bearer token)
 * - Empty pipeline (no trialing users)
 * - Idempotency skip (already-pushed user ignored)
 * - Push disabled skip
 * - No device token skip
 * - Happy path: sends push + writes log row
 * - Multiple devices per user: one log row, one push-call fan-out
 */

import { GET } from "@/app/api/cron/trial-ending-push-deliver/route";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

// ============================================================================
// Mocks
// ============================================================================

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error,
        details,
        timestamp: new Date().toISOString(),
      })
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

// Supabase chain mock — each .from() table exposes a fresh builder with the
// needed terminators. Route call order:
//   1. user_entitlements  .select().eq().gte().lte()            ← lte terminator
//   2. trial_ending_push_log  .select().in()                    ← in terminator
//   3. profiles  .select().in()                                 ← in terminator
//   4. user_devices  .select().in()                             ← in terminator
//   5. trial_ending_push_log  .insert()                         ← insert terminator
const tableState: Record<
  string,
  {
    select?: { data: unknown[]; error: { message: string } | null };
    insert?: { error: { message: string } | null };
  }
> = {};

const mockInsert = jest.fn();

function buildQuery(table: string) {
  const row = tableState[table] ?? {};
  const resolved = {
    data: row.select?.data ?? [],
    error: row.select?.error ?? null,
  };
  const builder: Record<string, unknown> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.gte = jest.fn(() => builder);
  builder.lte = jest.fn(() => Promise.resolve(resolved));
  builder.in = jest.fn(() => Promise.resolve(resolved));
  builder.insert = jest.fn((payload: unknown) => {
    // cron_runs comes from withObservedCron, not the handler — exclude it
    // from the spy so existing assertions about handler-level inserts hold.
    if (table !== "cron_runs") mockInsert(table, payload);
    return Promise.resolve({
      error: row.insert?.error ?? null,
    });
  });
  return builder;
}

const mockFrom = jest.fn((table: string) => buildQuery(table));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
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
  url = "http://localhost/api/cron/trial-ending-push-deliver"
) =>
  ({
    url,
    headers: {
      get: jest.fn((name: string) => headers[name] ?? null),
    },
    json: jest.fn(() => Promise.resolve({})),
  }) as unknown as NextRequest;

function resetTables() {
  for (const k of Object.keys(tableState)) delete tableState[k];
}

function seed(table: string, data: unknown[]) {
  tableState[table] = { ...(tableState[table] ?? {}), select: { data, error: null } };
}

// ============================================================================
// Tests
// ============================================================================

describe("Trial-Ending Push Cron", () => {
  const routeSource = readFileSync(
    "app/api/cron/trial-ending-push-deliver/route.ts",
    "utf8"
  );
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    resetTables();
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "evt-mock",
    });

    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(true);

    const apiUtils = require("@/lib/middleware/api-wrappers");
    apiUtils.createSuccessResponse.mockImplementation((data: unknown, status = 200) => ({
      json: jest.fn(() =>
        Promise.resolve({ success: true, data, timestamp: new Date().toISOString() })
      ),
      status,
    }));
    apiUtils.createErrorResponse.mockImplementation(
      (error: unknown, details: unknown, status = 500) => ({
        json: jest.fn(() =>
          Promise.resolve({ success: false, error, details, timestamp: new Date().toISOString() })
        ),
        status,
      })
    );
    apiUtils.handleApiError.mockImplementation((error: unknown) => ({
      json: jest.fn(() =>
        Promise.resolve({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        })
      ),
      status: 500,
    }));
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

    it("accepts Bearer cron token", async () => {
      seed("user_entitlements", []);
      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Empty pipeline", () => {
    it("returns empty summary when no users are in the Day-12 window", async () => {
      seed("user_entitlements", []);
      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.candidates).toBe(0);
      expect(data.data.summary.sent).toBe(0);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
    });
  });

  describe("Idempotency", () => {
    it("skips users that already have a trial_ending_push_log row", async () => {
      const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      seed("user_entitlements", [{ user_id: "u-1", trial_ends_at: trialEndsAt }]);
      seed("trial_ending_push_log", [{ user_id: "u-1" }]);

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.alreadySent).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("Preference / token filters", () => {
    it("skips users with push notifications disabled", async () => {
      const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      seed("user_entitlements", [{ user_id: "u-2", trial_ends_at: trialEndsAt }]);
      seed("trial_ending_push_log", []);
      seed("profiles", [{ id: "u-2", notif_push_enabled: false }]);

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.noPushPref).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("skips users with no device tokens (and does NOT write log row)", async () => {
      const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      seed("user_entitlements", [{ user_id: "u-3", trial_ends_at: trialEndsAt }]);
      seed("trial_ending_push_log", []);
      seed("profiles", [{ id: "u-3", notif_push_enabled: true }]);
      seed("user_devices", []);

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.noDeviceToken).toBe(1);
      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("Happy path (Phase 3e: enqueues via notifications pipeline)", () => {
    it("enqueues a trial_ending event and writes one log row per candidate", async () => {
      const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      seed("user_entitlements", [{ user_id: "u-4", trial_ends_at: trialEndsAt }]);
      seed("trial_ending_push_log", []);
      seed("profiles", [{ id: "u-4", notif_push_enabled: true }]);
      seed("user_devices", [{ user_id: "u-4", device_token: "token-abc" }]);

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.candidates).toBe(1);
      expect(data.data.summary.skipped).toEqual({
        noPushPref: 0,
        noDeviceToken: 0,
        alreadySent: 0,
        sendFailed: 0,
        logFailed: 0,
      });

      // Phase 3e: cron no longer calls FCM directly.
      expect(mockSendPushNotifications).not.toHaveBeenCalled();

      expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
      expect(mockEnqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "trial_ending",
          recipientUserId: "u-4",
          dedupeKey: `trial_ending:u-4:${trialEndsAt}`,
          payload: expect.objectContaining({
            title: "Trial ends in 2 days",
            trial_ends_at: trialEndsAt,
          }),
        })
      );

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const [table, payload] = mockInsert.mock.calls[0];
      expect(table).toBe("trial_ending_push_log");
      expect(payload).toMatchObject({
        user_id: "u-4",
        trial_ends_at: trialEndsAt,
        meta: { device_count: 1, method: "enqueued_via_pipeline" },
      });
    });

    it("logs once per user even when the user has multiple device tokens", async () => {
      const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      seed("user_entitlements", [{ user_id: "u-5", trial_ends_at: trialEndsAt }]);
      seed("trial_ending_push_log", []);
      seed("profiles", [{ id: "u-5", notif_push_enabled: true }]);
      seed("user_devices", [
        { user_id: "u-5", device_token: "ios-token" },
        { user_id: "u-5", device_token: "android-token" },
      ]);

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);

      expect(mockSendPushNotifications).not.toHaveBeenCalled();
      expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const [, payload] = mockInsert.mock.calls[0];
      expect(payload.meta.device_count).toBe(2);
    });
  });
});
