/** @jest-environment node */

// NextResponse.json relies on the static Response.json() helper (available in newer runtimes).
// Jest's jsdom environment may not provide it, so we polyfill it for route handler tests.
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
 * Unit tests for condition-alert-deliver cron worker hardening (Task 4).
 *
 * Verifies:
 * - FORECAST_ALERT_DELIVERY_ENABLED=false reaches the send boundary and writes one
 *   alert_delivery_attempts row per (queue_id, channel) with status
 *   "shadow_withheld" — but still marks queue rows sent.
 * - ALERTS_DELIVERY_USER_ALLOWLIST set + user not in list writes
 *   "skipped_allowlist" attempt rows and skips providers.
 * - Healthy state with empty allowlist + ENABLED=true writes a "sent"
 *   attempt row alongside the existing alert_deliveries dedup row.
 *
 * Strategy: mocked Supabase via per-table chain factory. Local `supabase
 * db reset` is broken on this branch (4 unrelated migration defects); the
 * plan was amended 2026-04-26 to use mocks instead of integration tests.
 */

import { GET } from "@/app/api/cron/condition-alert-deliver/route";
import { ConsolidatedAlertEmail } from "@/lib/mailer/templates/ConsolidatedAlertEmail";
import { buildCanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { readFileSync } from "fs";

// ---- Mock API wrappers ----
jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(
    async (_options: unknown, handler: () => Promise<unknown>) => handler(),
  ),
}));

// ---- Mock mailer client ----
const mockEmailsSend = jest.fn();
jest.mock("@/lib/mailer/client", () => ({
  sendEmail: (...args: any[]) => mockEmailsSend(...args),
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  getBaseUrl: () => "https://quiversurf.app",
}));

// ---- Mock email template (avoid React rendering in jsdom) ----
jest.mock("@/lib/mailer/templates/ConsolidatedAlertEmail", () => ({
  ConsolidatedAlertEmail: jest.fn(() => "ConsolidatedAlertEmail"),
  buildConditionsLine: jest.fn(() => "wave summary"),
}));

// ---- Mock email logging + rate limiter ----
const mockLogDelivery = jest.fn();
jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: jest.fn(() => ({
    logDelivery: (...args: unknown[]) => mockLogDelivery(...args),
  })),
}));
jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: jest.fn(() => ({
    throttle: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ---- Mock push service ----
// Phase 3d: the route no longer imports sendPushNotifications, but this mock
// is retained as a defensive guard — if any path regresses to direct send,
// the test will catch the unexpected FCM call.
const mockSendPushNotifications = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotifications: (...args: any[]) => mockSendPushNotifications(...args),
}));

// ---- Mock notifications enqueue (Phase 3d push branch) ----
const mockEnqueueNotification = jest.fn();
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: any[]) => mockEnqueueNotification(...args),
}));

const mockResolveNotificationMajorEventHold = jest.fn();
jest.mock(
  "@/lib/recommendations/major-event-hold/adapters/notification",
  () => ({
    resolveNotificationMajorEventHold: (...args: unknown[]) =>
      mockResolveNotificationMajorEventHold(...args),
  }),
);

// ---- Mock email-token (deterministic) ----
jest.mock("@/lib/alerts/email-token", () => ({
  generateDisableToken: jest.fn(() => "test-disable-token"),
  generateEmailUnsubscribeToken: jest.fn(() => "test-unsubscribe-token"),
}));

// ---- Mock Supabase via per-table store ----
type AttemptRow = {
  queue_id: string;
  rule_id: string;
  user_id: string;
  channel: string;
  status: string;
  skip_reason: string | null;
};
type SeededAttemptRow = {
  queue_id: string;
  rule_id: string;
  user_id: string;
  channel: string;
  status: string;
  skip_reason?: string | null;
  attempted_at: string; // ISO
};
type DeliveryRow = {
  user_id: string;
  alert_date: string;
  channel: string;
  payload: unknown;
};
type QueueUpdate = { ids: string[]; sent: boolean };

interface MockStore {
  alertQueueRows: any[];
  alertQueueSelects: string[];
  profileRows: any[];
  existingDeliveries: DeliveryRow[];
  deliverySelectError: Error | null;
  deliveryInsertError: Error | null;
  deviceRows: { user_id: string; device_token: string }[];
  attemptInserts: AttemptRow[];
  recentAttemptsError: Error | null;
  deliveryInserts: DeliveryRow[];
  queueUpdates: QueueUpdate[];
  queueRefreshUpdates: Array<{ id: string; values: any }>;
  // Pre-existing attempt rows (for cooldown/cap throttle queries).
  // Worker reads these via SELECT on alert_delivery_attempts where status='sent'
  // and attempted_at >= sinceWeek. Inserts during the run land in attemptInserts.
  seededAttempts: SeededAttemptRow[];
  forecastRows: any[];
}

const store: MockStore = {
  alertQueueRows: [],
  alertQueueSelects: [],
  profileRows: [],
  existingDeliveries: [],
  deliverySelectError: null,
  deliveryInsertError: null,
  deviceRows: [],
  attemptInserts: [],
  recentAttemptsError: null,
  deliveryInserts: [],
  queueUpdates: [],
  queueRefreshUpdates: [],
  seededAttempts: [],
  forecastRows: [],
};

function makeChain(rowsResolver: () => any[], onTerminal?: () => void) {
  const chain: any = {
    _filters: {} as Record<string, any>,
    select: jest.fn(() => chain),
    eq: jest.fn((_col: string, _val: any) => {
      chain._filters[_col] = _val;
      return chain;
    }),
    in: jest.fn((_col: string, vals: any[]) => {
      chain._filters[_col] = { in: vals };
      return chain;
    }),
    lte: jest.fn(() => chain),
    gte: jest.fn((_col: string, _val: any) => {
      chain._filters[`${_col}__gte`] = _val;
      return chain;
    }),
    lt: jest.fn(() => chain),
    is: jest.fn(() => chain),
    not: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() =>
      Promise.resolve({ data: rowsResolver()[0] ?? null, error: null }),
    ),
    maybeSingle: jest.fn(() =>
      Promise.resolve({ data: rowsResolver()[0] ?? null, error: null }),
    ),
    then: jest.fn((resolve: any) => {
      onTerminal?.();
      return resolve({ data: rowsResolver(), error: null });
    }),
  };
  return chain;
}

function mockFrom(table: string) {
  if (table === "alert_queue") {
    const queueChain: any = makeChain(() => store.alertQueueRows);
    queueChain.select = jest.fn((columns: string) => {
      store.alertQueueSelects.push(columns);
      return queueChain;
    });
    queueChain.update = jest.fn((vals: any) => {
      const updateChain: any = {
        in: jest.fn((_col: string, ids: string[]) => {
          store.queueUpdates.push({ ids, sent: vals.sent === true });
          return Promise.resolve({ error: null });
        }),
        eq: jest.fn((_col: string, id: string) => {
          store.queueRefreshUpdates.push({ id, values: vals });
          return Promise.resolve({ error: null });
        }),
      };
      return updateChain;
    });
    return queueChain;
  }
  if (table === "profiles") {
    return makeChain(() => store.profileRows);
  }
  if (table === "alert_deliveries") {
    const chain: any = makeChain(() => {
      if (store.deliverySelectError) return [];
      const f = chain._filters;
      return store.existingDeliveries.filter(
        (d) =>
          (f.user_id == null || d.user_id === f.user_id) &&
          (f.alert_date == null || d.alert_date === f.alert_date) &&
          (f.channel == null || d.channel === f.channel),
      );
    });
    chain.then = jest.fn((resolve: any) =>
      resolve({
        data: store.deliverySelectError
          ? null
          : chain._filters &&
            store.existingDeliveries.filter(
              (d) =>
                (chain._filters.user_id == null ||
                  d.user_id === chain._filters.user_id) &&
                (chain._filters.alert_date == null ||
                  d.alert_date === chain._filters.alert_date) &&
                (chain._filters.channel == null ||
                  d.channel === chain._filters.channel),
            ),
        error: store.deliverySelectError,
      }),
    );
    chain.insert = jest.fn((row: DeliveryRow) => {
      store.deliveryInserts.push(row);
      return Promise.resolve({ error: store.deliveryInsertError });
    });
    return chain;
  }
  if (table === "user_devices") {
    return makeChain(() =>
      store.deviceRows.map((d) => ({ device_token: d.device_token })),
    );
  }
  if (table === "alert_delivery_attempts") {
    // Reads on this table are the throttle's recent-sent fetch:
    //   .select("rule_id, user_id, attempted_at")
    //   .eq("status", "sent")
    //   .gte("attempted_at", sinceWeek)
    // Filter the seeded rows accordingly so the worker exercises its real query intent.
    const chain: any = makeChain(() => {
      if (store.recentAttemptsError) return [];
      const f = chain._filters;
      return store.seededAttempts.filter((a) => {
        if (f.queue_id?.in && !f.queue_id.in.includes(a.queue_id)) return false;
        if (f.status != null && a.status !== f.status) return false;
        if (f.skip_reason != null && a.skip_reason !== f.skip_reason)
          return false;
        if (f.attempted_at__gte != null && a.attempted_at < f.attempted_at__gte)
          return false;
        return true;
      });
    });
    chain.then = jest.fn((resolve: any) =>
      resolve({
        data: store.recentAttemptsError
          ? null
          : store.seededAttempts.filter((a) => {
              const f = chain._filters;
              if (f.queue_id?.in && !f.queue_id.in.includes(a.queue_id))
                return false;
              if (f.status != null && a.status !== f.status) return false;
              if (f.skip_reason != null && a.skip_reason !== f.skip_reason)
                return false;
              if (
                f.attempted_at__gte != null &&
                a.attempted_at < f.attempted_at__gte
              )
                return false;
              return true;
            }),
        error: store.recentAttemptsError,
      }),
    );
    chain.insert = jest.fn((row: AttemptRow) => {
      store.attemptInserts.push(row);
      return Promise.resolve({ error: null });
    });
    return chain;
  }
  if (table === "enhanced_forecasts") {
    return makeChain(() => store.forecastRows);
  }
  return makeChain(() => []);
}

const mockSupabase = { from: jest.fn(mockFrom) };
let consoleLogSpy: jest.SpyInstance;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// ---- Test helpers ----
const USER_A = "00000000-0000-0000-0000-000000000001";
const USER_B = "00000000-0000-0000-0000-000000000002";
const RULE_1 = "00000000-0000-0000-0000-0000000000a1";
const BEACH_1 = "00000000-0000-0000-0000-0000000000b1";
const BEACH_2 = "00000000-0000-0000-0000-0000000000b2";
const QUEUE_1 = "00000000-0000-0000-0000-0000000000c1";
const mockConsolidatedAlertEmail = ConsolidatedAlertEmail as jest.Mock;

function seedQueueRow(overrides: Partial<any> = {}) {
  store.alertQueueRows.push({
    id: QUEUE_1,
    user_id: USER_A,
    rule_id: RULE_1,
    beach_id: BEACH_1,
    alert_date: "2026-04-26",
    send_at: "2026-04-26T05:00:00Z",
    window_start: "2026-04-26T13:00:00Z",
    window_end: "2026-04-26T15:00:00Z",
    best_hour: "2026-04-26T14:00:00Z",
    best_score: 0.8,
    conditions_snapshot: {
      wave_height: 3,
      forecast_id: "enhanced-forecast-queued",
    },
    sent: false,
    alert_rules: {
      name: "Test rule",
      preset_type: "mellow_session",
      notify_email: true,
      notify_push: true,
    },
    beaches: {
      name: "Test Beach",
      timezone: "America/Los_Angeles",
      skill_level: "beginner",
    },
    ...overrides,
  });
}

function seedProfile(overrides: Partial<any> = {}) {
  store.profileRows.push({
    id: USER_A,
    email: "tester@example.com",
    display_name: "Tester",
    notif_email_enabled: true,
    notif_push_enabled: true,
    experience_level: "beginner",
    ...overrides,
  });
}

function makeRequest(): Request {
  return new Request(
    "https://quiversurf.app/api/cron/condition-alert-deliver",
    {
      method: "GET",
      headers: { authorization: "Bearer dummy" },
    },
  );
}

function expectQueueReasonTotals(body: {
  queueMarked: number;
  queue_marked_by_reason: Record<string, number>;
}): void {
  expect(Object.keys(body.queue_marked_by_reason).sort()).toEqual(
    [
      "delivered",
      "stale",
      "below_score_floor",
      "major_event_hold",
      "canonical_safety_rejected",
      "shadow_withheld",
      "delivery_disabled",
      "allowlist_excluded",
      "cooldown",
      "user_cap",
      "channel_disabled",
      "missing_destination",
      "deduplicated",
      "no_enabled_channels",
      "mixed_deliberate_skip",
      "orphaned_profile",
      "failed_delivery",
      "invalid_payload",
      "unrecorded_consumption",
      "hold_state_unavailable_retry_exhausted",
    ].sort(),
  );
  const reasonTotal = Object.values(body.queue_marked_by_reason).reduce(
    (sum, count) => sum + count,
    0,
  );
  expect(reasonTotal).toBe(body.queueMarked);
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-04-26T17:00:00Z"));
  jest.clearAllMocks();
  consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  store.alertQueueRows = [];
  store.alertQueueSelects = [];
  store.profileRows = [];
  store.existingDeliveries = [];
  store.deliverySelectError = null;
  store.deliveryInsertError = null;
  store.deviceRows = [];
  store.attemptInserts = [];
  store.recentAttemptsError = null;
  store.deliveryInserts = [];
  store.queueUpdates = [];
  store.queueRefreshUpdates = [];
  store.seededAttempts = [];
  store.forecastRows = [];
  mockLogDelivery.mockReset().mockResolvedValue({ success: true });
  mockEmailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  mockEnqueueNotification.mockResolvedValue({
    enqueued: true,
    eventId: "evt-mock",
  });
  mockResolveNotificationMajorEventHold.mockResolvedValue({
    status: "allowed",
    candidate: null,
  });
  delete process.env.ALERTS_DELIVERY_ENABLED;
  process.env.FORECAST_ALERT_DELIVERY_ENABLED = "true";
  delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  jest.useRealTimers();
});

describe("condition-alert-deliver — kill switch + allowlist + per-attempt rows", () => {
  const routeSource = readFileSync(
    "app/api/cron/condition-alert-deliver/route.ts",
    "utf8",
  );

  it("uses the API wrapper barrel for cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
    expect(routeSource).toContain("withCronOutcome");
    expect(routeSource).toContain('unit: "notifications_sent"');
  });

  it("routes every sent=true write through the reason-accounting helper", () => {
    expect([
      ...routeSource.matchAll(/\.update\(\{ sent: true \}\)/g),
    ]).toHaveLength(1);
    expect([...routeSource.matchAll(/result\.queueMarked \+=/g)]).toHaveLength(
      1,
    );
    expect(routeSource).toContain("async function markQueueItemsConsumed");
  });

  it("default-off forecast delivery records a canonical shadow outcome and consumes the row once without sending", async () => {
    delete process.env.FORECAST_ALERT_DELIVERY_ENABLED;
    seedQueueRow({
      best_score: 95,
      alert_rules: {
        name: "Test rule",
        preset_type: "mellow_session",
        notify_email: true,
        notify_push: true,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });
    store.deviceRows.push({
      user_id: USER_A,
      device_token: "ExpoPushToken[abc]",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockSendPushNotifications).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockLogDelivery).not.toHaveBeenCalled();
    expect(mockConsolidatedAlertEmail).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);
    expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledTimes(1);

    expect(store.attemptInserts).toHaveLength(2);
    const channels = store.attemptInserts.map((a) => a.channel).sort();
    expect(channels).toEqual(["email", "push"]);
    for (const a of store.attemptInserts) {
      expect(a.status).toBe("shadow_withheld");
      expect(a.queue_id).toBe(QUEUE_1);
      expect(a.user_id).toBe(USER_A);
      expect(a.rule_id).toBe(RULE_1);
    }

    const shadowUpdate = store.queueRefreshUpdates.find(
      (update) => update.values.delivery_shadow_outcome,
    );
    expect(shadowUpdate).toEqual({
      id: QUEUE_1,
      values: {
        delivery_shadow_outcome: {
          status: "shadow_withheld",
          verdict: "go",
          reason_code: "selected_go",
          preset_type: "mellow_session",
          would_use_channels: ["email", "push"],
        },
      },
    });
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
    const body = await res.json();
    expect(body).toMatchObject({
      status: "ok",
      queueMarked: 1,
      queue_marked_by_reason: { shadow_withheld: 1 },
    });
    expectQueueReasonTotals(body);
  });

  it("Allowlist set, user not in list, ENABLED=true writes skipped_allowlist", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST =
      "73040cff-afe9-4fa0-a874-2016203fc015";
    seedQueueRow({
      user_id: USER_B,
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({
      id: USER_B,
      notif_email_enabled: true,
      notif_push_enabled: false,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockSendPushNotifications).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);

    expect(store.attemptInserts).toHaveLength(1);
    expect(store.attemptInserts[0]).toMatchObject({
      queue_id: QUEUE_1,
      user_id: USER_B,
      rule_id: RULE_1,
      channel: "email",
      status: "skipped_allowlist",
    });

    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("FORECAST_ALERT_DELIVERY_ENABLED=true restores email delivery", async () => {
    process.env.FORECAST_ALERT_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribeUrl:
          `https://quiversurf.app/api/alerts/unsubscribe-email?user_id=${USER_A}` +
          "&token=test-unsubscribe-token",
      }),
    );
    expect(mockConsolidatedAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribeUrl:
          `https://quiversurf.app/api/alerts/unsubscribe-email?user_id=${USER_A}` +
          "&token=test-unsubscribe-token",
      }),
    );
    expect(mockSendPushNotifications).not.toHaveBeenCalled();

    expect(store.deliveryInserts).toHaveLength(1);
    expect(store.deliveryInserts[0]).toMatchObject({
      user_id: USER_A,
      alert_date: "2026-04-26",
      channel: "email",
    });
    expect(mockLogDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_A,
        emailType: "conditions_alert",
        subject: expect.stringMatching(/^Test Beach: surf window /),
        meta: expect.objectContaining({
          match_count: expect.any(Number),
          beaches: expect.any(Array),
        }),
        resendMessageId: "msg-1",
      }),
    );

    expect(store.attemptInserts).toHaveLength(1);
    expect(store.attemptInserts[0]).toMatchObject({
      queue_id: QUEUE_1,
      user_id: USER_A,
      rule_id: RULE_1,
      channel: "email",
      status: "sent",
    });

    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
    expect(body.queue_marked_by_reason).toMatchObject({
      delivered: 1,
      stale: 0,
    });
    expectQueueReasonTotals(body);
  });

  it("sends email but rejects push when an expert beach has no canonical selection", async () => {
    seedQueueRow({
      best_score: 95,
      alert_rules: {
        name: "Expert beach rule",
        notify_email: true,
        notify_push: true,
      },
      beaches: {
        name: "Expert Beach",
        timezone: "America/Los_Angeles",
        skill_level: "expert",
      },
    });
    seedProfile({
      experience_level: "beginner",
      notif_email_enabled: true,
      notif_push_enabled: true,
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(store.attemptInserts).toContainEqual(
      expect.objectContaining({
        queue_id: QUEUE_1,
        channel: "email",
        status: "sent",
      }),
    );
    expect(store.attemptInserts).toContainEqual(
      expect.objectContaining({
        queue_id: QUEUE_1,
        channel: "push",
        status: "skipped_disabled",
        skip_reason: "canonical_decision:beach_skill_exceeds_user",
      }),
    );
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it.each([
    { verdict: "no", bestScore: 20 },
    { verdict: "maybe", bestScore: 50 },
  ])(
    "sends when the canonical verdict is $verdict",
    async ({ verdict, bestScore }) => {
      seedQueueRow({
        best_score: bestScore,
        alert_rules: {
          name: "Matched user rule",
          notify_email: true,
          notify_push: true,
        },
      });
      seedProfile({ notif_email_enabled: true, notif_push_enabled: true });

      const res = await GET(makeRequest());

      expect(res.status).toBe(200);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
      expect(
        mockEnqueueNotification.mock.calls[0][0].payload.session_decision
          .verdict,
      ).toBe(verdict);
      expect(store.attemptInserts).toContainEqual(
        expect.objectContaining({
          queue_id: QUEUE_1,
          channel: "email",
          status: "sent",
        }),
      );
    },
  );

  it("sends when major-event hold state is unavailable", async () => {
    seedQueueRow({
      alert_rules: {
        name: "Matched user rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });
    mockResolveNotificationMajorEventHold.mockResolvedValue({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
      auditCode: "major_event_hold",
      candidate: null,
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(store.attemptInserts).toContainEqual(
      expect.objectContaining({
        queue_id: QUEUE_1,
        channel: "email",
        status: "sent",
      }),
    );
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("consumes a real major-event hold as an explainable skip without degrading", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: { name: "Test rule", notify_email: true, notify_push: true },
    });
    seedProfile();
    mockResolveNotificationMajorEventHold.mockResolvedValue({
      status: "suppressed",
      reasonCode: "major_event_hold",
      auditCode: "major_event_hold",
      candidate: null,
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      queueMarked: 1,
      queue_marked_by_reason: { major_event_hold: 1 },
    });
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(store.attemptInserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queue_id: QUEUE_1,
          channel: "email",
          status: "skipped_disabled",
          skip_reason: "major_event_hold:major_event_hold",
        }),
        expect.objectContaining({
          queue_id: QUEUE_1,
          channel: "push",
          status: "skipped_disabled",
          skip_reason: "major_event_hold:major_event_hold",
        }),
      ]),
    );
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
    expectQueueReasonTotals(body);
  });

  it("degrades when a provider failure is consumed without delivery or a deliberate skip", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: "provider unavailable" },
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    consoleErrorSpy.mockRestore();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      queueMarked: 1,
      queue_marked_by_reason: { failed_delivery: 1 },
    });
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({
        queue_id: QUEUE_1,
        status: "failed_provider",
      }),
    ]);
    expectQueueReasonTotals(body);
    expectConsoleWarnings([/degraded queue consumption/]);
  });

  it("counts email delivery-row insert failure after send without retrying the provider action", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    store.deliveryInsertError = new Error("dedupe insert failed");
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    consoleErrorSpy.mockRestore();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.errors).toBe(1);
    expect(body.emailSent).toBe(0);
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(mockLogDelivery).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(1);
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({
        queue_id: QUEUE_1,
        user_id: USER_A,
        rule_id: RULE_1,
        channel: "email",
        status: "sent",
      }),
    ]);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("sends every matching forecast alert instead of selecting one canonical beach", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      id: "00000000-0000-0000-0000-0000000000c2",
      rule_id: "00000000-0000-0000-0000-0000000000a2",
      beach_id: "00000000-0000-0000-0000-0000000000b2",
      best_score: 0.35,
      alert_rules: {
        name: "Lower score rule",
        notify_email: true,
        notify_push: false,
      },
      beaches: {
        name: "Lower Score Beach",
        timezone: "America/Los_Angeles",
        skill_level: "beginner",
      },
    });
    seedQueueRow({
      id: "00000000-0000-0000-0000-0000000000c3",
      rule_id: "00000000-0000-0000-0000-0000000000a3",
      beach_id: "00000000-0000-0000-0000-0000000000b3",
      best_score: 0.95,
      alert_rules: {
        name: "Higher score rule",
        notify_email: true,
        notify_push: false,
      },
      beaches: {
        name: "Higher Score Beach",
        timezone: "America/Los_Angeles",
        skill_level: "beginner",
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mockEmailsSend).toHaveBeenCalledTimes(2);
    expect(store.alertQueueSelects[0]).toContain("best_score");
    expect(mockConsolidatedAlertEmail).toHaveBeenCalledTimes(2);
    expect(
      mockConsolidatedAlertEmail.mock.calls.map(
        ([props]) => props.matches[0].beach_name,
      ),
    ).toEqual(["Lower Score Beach", "Higher Score Beach"]);
    expect(body.queue_marked_by_reason).toMatchObject({
      delivered: 2,
    });
    expect(store.queueUpdates.flatMap((update) => update.ids)).toEqual([
      "00000000-0000-0000-0000-0000000000c2",
      "00000000-0000-0000-0000-0000000000c3",
    ]);
    expectQueueReasonTotals(body);
  });

  it("suppresses a queued alert whose best score is below the floor", async () => {
    seedQueueRow({
      best_score: 0.09,
      alert_rules: {
        name: "Pipes low-score rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.queue_marked_by_reason.below_score_floor).toBe(1);
    expect(body.queue_marked_by_reason.delivered).toBe(0);
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(store.attemptInserts).toHaveLength(0);
    expect(store.deliveryInserts).toHaveLength(0);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it.each([0.3, 0.64])(
    "still delivers a queued alert with best score %s at or above the floor",
    async (bestScore) => {
      seedQueueRow({
        best_score: bestScore,
        alert_rules: {
          name: "Deliverable score rule",
          notify_email: true,
          notify_push: false,
        },
      });
      seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.queue_marked_by_reason.below_score_floor).toBe(0);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(store.attemptInserts).toContainEqual(
        expect.objectContaining({
          queue_id: QUEUE_1,
          channel: "email",
          status: "sent",
        }),
      );
    },
  );

  it.each([
    { label: "null", bestScore: null },
    { label: "unparseable", bestScore: "not-a-score" },
  ])(
    "keeps a queue row with a $label best score deliverable",
    async ({ bestScore }) => {
      seedQueueRow({
        best_score: bestScore,
        alert_rules: {
          name: "Fail-open score rule",
          notify_email: true,
          notify_push: false,
        },
      });
      seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.queue_marked_by_reason.below_score_floor).toBe(0);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(store.attemptInserts).toContainEqual(
        expect.objectContaining({
          queue_id: QUEUE_1,
          channel: "email",
          status: "sent",
        }),
      );
    },
  );

  it("email-only rule, profile.email is null → skipped_no_email, no Resend call, queue still marked sent", async () => {
    // Regression for the 2026-04-27 failed_provider crash where Resend rejected
    // a null `to` field. The deliver worker must guard before the provider call.
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({
      email: null,
      notif_email_enabled: true,
      notif_push_enabled: false,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);

    expect(store.attemptInserts).toHaveLength(1);
    expect(store.attemptInserts[0]).toMatchObject({
      queue_id: QUEUE_1,
      user_id: USER_A,
      rule_id: RULE_1,
      channel: "email",
      status: "skipped_no_email",
    });

    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("existing delivery dedupes a matched forecast alert", async () => {
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });
    store.existingDeliveries.push({
      user_id: USER_A,
      alert_date: "2026-04-26",
      channel: "email",
      payload: {},
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({
        queue_id: QUEUE_1,
        channel: "email",
        status: "skipped_dedup_collision",
      }),
    ]);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("a rule with no enabled channels does not deliver", async () => {
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: false,
        notify_push: false,
      },
    });
    seedProfile();

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(store.attemptInserts).toHaveLength(0);
    expect(body.queue_marked_by_reason.no_enabled_channels).toBe(1);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("fresh forecast revalidation skips stale queued alerts that no longer match", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: {
        name: "Mellow session at your home break",
        notify_email: true,
        notify_push: false,
        conditions: {
          swell_height_min: 1.5,
          swell_height_max: 4,
          wind_speed_max_kt: 8,
        },
      },
      beaches: {
        id: BEACH_1,
        name: "Mission Beach",
        slug: "mission-beach",
        timezone: "America/Los_Angeles",
        lat: 32.7701,
        lon: -117.2525,
        wind_offshore_deg: 90,
        wind_offshore_tol_deg: 45,
        aspect_deg: 270,
        preferred_tide_ft_min: 2,
        preferred_tide_ft_max: 6,
        preferred_tide_direction: "rising",
        swell_window_center_deg: 300,
        swell_window_halfwidth_deg: 45,
        break_type: "beach",
        skill_level: "intermediate",
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });
    store.forecastRows.push({
      forecast_at: "2026-04-26T15:00:00Z",
      wave_height: "0.7 ft",
      wave_period: "8s",
      wave_direction: "W",
      swell_1_period: "8s",
      swell_1_direction: "270",
      wind_speed: "0 mph",
      wind_direction_deg: 225,
      tide_height: "2.8",
      tide_status: "Falling",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.skippedStale).toBe(1);
    expect(body.status).toBe("ok");
    expect(body.queue_marked_by_reason).toMatchObject({
      stale: 1,
      delivered: 0,
    });
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({
        queue_id: QUEUE_1,
        user_id: USER_A,
        rule_id: RULE_1,
        channel: "email",
        status: "skipped_stale_forecast",
      }),
    ]);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
    expectQueueReasonTotals(body);
  });

  it("persists refreshed alert fields and logs rendered match metadata before sending", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    jest.useFakeTimers().setSystemTime(new Date("2026-04-26T12:00:00Z"));

    try {
      seedQueueRow({
        alert_date: "2026-04-26",
        alert_rules: {
          name: "Mellow session at your home break",
          notify_email: true,
          notify_push: false,
          conditions: {
            swell_height_min: 1.5,
            swell_height_max: 4,
            wind_speed_max_kt: 8,
          },
        },
        beaches: {
          id: BEACH_1,
          name: "Mission Beach",
          slug: "mission-beach",
          timezone: "America/Los_Angeles",
          lat: 32.7701,
          lon: -117.2525,
          wind_offshore_deg: 90,
          wind_offshore_tol_deg: 45,
          aspect_deg: 270,
          preferred_tide_ft_min: 2,
          preferred_tide_ft_max: 6,
          preferred_tide_direction: "rising",
          swell_window_center_deg: 300,
          swell_window_halfwidth_deg: 45,
          break_type: "beach",
          skill_level: "intermediate",
        },
      });
      seedProfile({
        notif_email_enabled: true,
        notif_push_enabled: false,
        experience_level: "intermediate",
      });
      store.forecastRows.push(
        {
          forecast_at: "2026-04-26T15:00:00Z",
          wave_height: "2.1 ft",
          wave_period: "8s",
          wave_direction: "W",
          swell_1_height: "2.1 ft",
          swell_1_period: "8s",
          swell_1_direction: "270",
          wind_speed: "0 mph",
          wind_direction_deg: 225,
          tide_height: "2.8",
          tide_status: "Falling",
        },
        {
          forecast_at: "2026-04-26T20:00:00Z",
          wave_height: "2.1 ft",
          wave_period: "8s",
          wave_direction: "W",
          swell_1_height: "2.1 ft",
          swell_1_period: "8s",
          swell_1_direction: "270",
          wind_speed: "0 mph",
          wind_direction_deg: 225,
          tide_height: "2.8",
          tide_status: "Falling",
        },
      );

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);

      expect(store.queueRefreshUpdates).toHaveLength(1);
      expect(store.queueRefreshUpdates[0]).toMatchObject({
        id: QUEUE_1,
        values: {
          window_start: "2026-04-26T15:00:00Z",
          window_end: "2026-04-26T16:00:00.000Z",
          best_hour: "2026-04-26T15:00:00Z",
          conditions_snapshot: expect.objectContaining({ wave_height: 2.1 }),
        },
      });
      expect(store.queueRefreshUpdates[0].values.best_score).toEqual(
        expect.any(Number),
      );
      expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
      expect(store.deliveryInserts[0].payload).toMatchObject({
        match_count: 1,
        beaches: ["Mission Beach"],
        matches: [
          expect.objectContaining({
            rule_id: RULE_1,
            beach_id: BEACH_1,
            window_start: "2026-04-26T15:00:00Z",
            best_hour: "2026-04-26T15:00:00Z",
            wave_label: "2-3ft",
            snapshot_summary: "wave summary",
          }),
        ],
      });
      expect(mockLogDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            matches: [
              expect.objectContaining({
                wave_label: "2-3ft",
                snapshot_summary: "wave summary",
              }),
            ],
          }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("condition-alert-deliver — throttle (cooldown + weekly cap)", () => {
  it("fails closed when the recent sent-attempt history query fails", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    store.recentAttemptsError = new Error("attempt history failed");
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    consoleErrorSpy.mockRestore();

    expect(res.status).toBe(500);
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(store.attemptInserts).toHaveLength(0);
    expect(store.queueUpdates).toHaveLength(0);
  });

  it("rule cooldown: prior sent attempt 12h ago records skipped_cooldown and skips provider", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    // Prior 'sent' attempt 12h ago for the same rule — within the 24h cooldown window.
    store.seededAttempts.push({
      queue_id: "00000000-0000-0000-0000-0000000000ff",
      rule_id: RULE_1,
      user_id: USER_A,
      channel: "email",
      status: "sent",
      attempted_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockSendPushNotifications).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);

    expect(store.attemptInserts).toHaveLength(1);
    expect(store.attemptInserts[0]).toMatchObject({
      queue_id: QUEUE_1,
      rule_id: RULE_1,
      user_id: USER_A,
      channel: "email",
      status: "skipped_cooldown",
    });

    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("weekly cap: 10 prior sent attempts in last 7d records skipped_user_cap and skips provider", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    // 10 prior 'sent' attempts for USER_A spread across days 1..6 ago.
    // Different rule_ids so cooldown doesn't trip first; weekly cap is per-user.
    for (let i = 0; i < 10; i++) {
      const dayOffset = (i % 6) + 1; // days 1..6
      const hourJitter = i; // unique timestamps
      store.seededAttempts.push({
        queue_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        rule_id:
          `00000000-0000-0000-0000-${String(i).padStart(8, "0")}cap`.slice(
            0,
            36,
          ),
        user_id: USER_A,
        channel: "email",
        status: "sent",
        attempted_at: new Date(
          Date.now() -
            dayOffset * 24 * 60 * 60 * 1000 -
            hourJitter * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockSendPushNotifications).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);

    expect(store.attemptInserts).toHaveLength(1);
    expect(store.attemptInserts[0]).toMatchObject({
      queue_id: QUEUE_1,
      rule_id: RULE_1,
      user_id: USER_A,
      channel: "email",
      status: "skipped_user_cap",
    });

    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("user-set rule max_frequency_per_week caps that rule before provider send", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: {
        name: "Low noise rule",
        notify_email: true,
        notify_push: false,
        conditions: {
          swell_height_min: 1,
          max_frequency_per_week: 2,
        },
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    for (let i = 0; i < 2; i++) {
      store.seededAttempts.push({
        queue_id: `00000000-0000-0000-0000-0000000001${i}`,
        rule_id: RULE_1,
        user_id: USER_A,
        channel: "email",
        status: "sent",
        attempted_at: new Date(
          Date.now() - (i + 2) * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({
        queue_id: QUEUE_1,
        rule_id: RULE_1,
        user_id: USER_A,
        channel: "email",
        status: "skipped_user_cap",
        skip_reason: expect.stringContaining("cap is 2"),
      }),
    ]);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });
});

describe("condition-alert-deliver — email quiet-hours guard", () => {
  // Current local hour in the recipient's timezone (profile.timezone unset ⇒
  // DEFAULT_TIMEZONE = America/Los_Angeles, matching the push worker). Build
  // override windows relative to it so the test is deterministic at any clock.
  function ptHourNow(): number {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    const n = parseInt(h, 10);
    return n === 24 ? 0 : n;
  }

  it("shadow mode consumes a quiet-hours row without degrading the run", async () => {
    delete process.env.FORECAST_ALERT_DELIVERY_ENABLED;
    const start = ptHourNow();
    const end = (start + 1) % 24;
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        preset_type: "mellow_session",
        notify_email: true,
        notify_push: false,
        conditions: { quiet_hours_start: start, quiet_hours_end: end },
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      queueMarked: 1,
      queue_marked_by_reason: { shadow_withheld: 1 },
    });
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
    expect(store.queueRefreshUpdates).toContainEqual({
      id: QUEUE_1,
      values: {
        delivery_shadow_outcome: expect.objectContaining({
          preset_type: "mellow_session",
          would_use_channels: [],
        }),
      },
    });
    expectQueueReasonTotals(body);
  });

  it("recipient inside quiet hours: email deferred, NOT sent/deduped/marked-sent", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";

    // A 1-hour quiet window that contains the current local hour.
    const start = ptHourNow();
    const end = (start + 1) % 24;
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
        conditions: { quiet_hours_start: start, quiet_hours_end: end },
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    // Deferred: provider not called, no dedup row, no log, no attempt row.
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);
    expect(mockLogDelivery).not.toHaveBeenCalled();
    expect(store.attemptInserts).toHaveLength(0);

    // Counter incremented; emailSent untouched.
    expect(body.emailQuietHoursSkipped).toBe(1);
    expect(body.emailSent).toBe(0);

    // CRITICAL: the queue row is left due+unsent so the next hourly run retries.
    expect(store.queueUpdates).toEqual([]);
  });

  it("recipient inside DEFAULT_QUIET (no per-rule override) defers", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";

    // Pin the clock to 06:00 UTC = 23:00 PT (previous day) — inside the default
    // 22→04 window. profile.timezone is unset ⇒ DEFAULT_TIMEZONE (PT), matching
    // the push worker.
    jest.useFakeTimers().setSystemTime(new Date("2026-04-26T06:00:00Z"));
    try {
      seedQueueRow({
        send_at: "2026-04-26T05:00:00Z",
        alert_rules: {
          name: "Test rule",
          notify_email: true,
          notify_push: false,
        },
      });
      seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(mockEmailsSend).not.toHaveBeenCalled();
      expect(body.emailQuietHoursSkipped).toBe(1);
      expect(store.queueUpdates).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("recipient outside DEFAULT_QUIET (no per-rule override) sends", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";

    // 17:00 UTC = 10:00 PT — well outside the default 22→04 window.
    jest.useFakeTimers().setSystemTime(new Date("2026-04-26T17:00:00Z"));
    try {
      seedQueueRow({
        send_at: "2026-04-26T05:00:00Z",
        alert_rules: {
          name: "Test rule",
          notify_email: true,
          notify_push: false,
        },
      });
      seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(body.emailQuietHoursSkipped).toBe(0);
      expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("recipient outside quiet hours: email sends, deduped, marked sent", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";

    // A 1-hour quiet window that does NOT contain the current local hour.
    const now = ptHourNow();
    const start = (now + 2) % 24;
    const end = (now + 3) % 24;
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
        conditions: { quiet_hours_start: start, quiet_hours_end: end },
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(store.deliveryInserts).toHaveLength(1);
    expect(body.emailQuietHoursSkipped).toBe(0);
    expect(body.emailSent).toBe(1);
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({ channel: "email", status: "sent" }),
    ]);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("a quiet-hours deferral does not write a 'sent' attempt, so cooldown stays clear for the retry", async () => {
    // Verifies the retry-safety invariant directly: after a deferral there are
    // zero status='sent' rows for the rule, so the next run's cooldownDecision
    // sees no history and the real send proceeds.
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";

    const start = ptHourNow();
    const end = (start + 1) % 24;
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: true,
        notify_push: false,
        conditions: { quiet_hours_start: start, quiet_hours_end: end },
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    await GET(makeRequest());

    const sentForRule = store.attemptInserts.filter(
      (a) => a.rule_id === RULE_1 && a.status === "sent",
    );
    expect(sentForRule).toHaveLength(0);
  });
});

describe("condition-alert-deliver — orphaned queue rows", () => {
  it("marks rows sent and records failed_internal when the queued user has no profile", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      alert_rules: { name: "Test rule", notify_email: true, notify_push: true },
    });

    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("No profile found for user"),
    );
    consoleWarnSpy.mockRestore();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.queue_marked_by_reason.orphaned_profile).toBe(1);
    expectQueueReasonTotals(body);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockSendPushNotifications).not.toHaveBeenCalled();

    expect(store.attemptInserts).toHaveLength(2);
    expect(store.attemptInserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queue_id: QUEUE_1,
          user_id: USER_A,
          rule_id: RULE_1,
          channel: "email",
          status: "failed_internal",
        }),
        expect.objectContaining({
          queue_id: QUEUE_1,
          user_id: USER_A,
          rule_id: RULE_1,
          channel: "push",
          status: "failed_internal",
        }),
      ]),
    );
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });
});

describe("condition-alert-deliver — push branch enqueues via notifications pipeline (Phase 3d)", () => {
  it("enqueues a forecast_alert notification event instead of sending push directly", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: false,
        notify_push: true,
        conditions: { quiet_hours_start: 23, quiet_hours_end: 6 },
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: true });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockSendPushNotifications).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);

    const call = mockEnqueueNotification.mock.calls[0][0];
    expect(call).toMatchObject({
      type: "forecast_alert",
      recipientUserId: USER_A,
      entityType: "beach",
      entityId: BEACH_1,
      dedupeKey: `forecast_alert:${USER_A}:${BEACH_1}:2026-04-26`,
    });
    expect(call.payload).toMatchObject({
      alert_date: "2026-04-26",
      title: expect.any(String),
      body: expect.any(String),
      beach_id: BEACH_1,
      forecast_at: "2026-04-26T14:00:00Z",
      quiet_hours_start: 23,
      quiet_hours_end: 6,
      policy_context: {
        kind: "positive_session_recommendation",
        beach_id: BEACH_1,
        starts_at: "2026-04-26T13:00:00Z",
        ends_at: "2026-04-26T15:00:00Z",
      },
      // Queue-item provenance for the worker's onChannelOutcome hook to fan
      // back into alert_delivery_attempts after actual delivery (review fix
      // for cooldown burning on terminal-skipped pushes).
      queue_items: [{ queue_id: QUEUE_1, rule_id: RULE_1 }],
    });

    expect(store.deliveryInserts).toHaveLength(1);
    expect(store.deliveryInserts[0]).toMatchObject({
      user_id: USER_A,
      beach_id: BEACH_1,
      alert_date: "2026-04-26",
      channel: "push",
    });
    expect((store.deliveryInserts[0].payload as any).method).toBe(
      "enqueued_via_pipeline",
    );

    // The cron no longer pre-writes status='sent' rows to alert_delivery_attempts
    // on enqueue success — that's the job of the forecast_alert
    // onChannelOutcome hook in registry.ts after the worker reaches a terminal
    // status. So no push-channel attempt row should exist at this point.
    const pushAttempt = store.attemptInserts.find((a) => a.channel === "push");
    expect(pushAttempt).toBeUndefined();
  });

  it("uses the canonical eligible selection for distinct push provenance", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      id: "00000000-0000-0000-0000-0000000000d1",
      rule_id: "00000000-0000-0000-0000-0000000000e1",
      best_score: 0.95,
      window_start: "2026-04-26T13:00:00Z",
      window_end: "2026-04-26T15:00:00Z",
      best_hour: "2026-04-26T14:00:00Z",
      alert_rules: {
        name: "Score-first",
        notify_email: false,
        notify_push: true,
      },
      conditions_snapshot: { wave_height: 8 },
      beaches: {
        name: "Expert Point",
        timezone: "America/Los_Angeles",
        skill_level: "expert",
      },
    });
    seedQueueRow({
      id: "00000000-0000-0000-0000-0000000000d2",
      rule_id: "00000000-0000-0000-0000-0000000000e2",
      best_score: 0.7,
      beach_id: BEACH_2,
      window_start: "2026-04-26T16:00:00Z",
      window_end: "2026-04-26T18:00:00Z",
      best_hour: "2026-04-26T17:00:00Z",
      alert_rules: {
        name: "Personal-first",
        notify_email: false,
        notify_push: true,
      },
      conditions_snapshot: {
        wave_height: 2,
        forecast_id: "enhanced-forecast-mellow-cove-17z",
      },
      beaches: {
        name: "Mellow Cove",
        timezone: "America/Los_Angeles",
        skill_level: "beginner",
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: true });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const call = mockEnqueueNotification.mock.calls
      .map(([event]) => event)
      .find((event) => event.entityId === BEACH_2);
    expect(call).toEqual(expect.objectContaining({ entityId: BEACH_2 }));
    if (!call) throw new Error("Expected the Mellow Cove notification event");
    const payload = call.payload;
    const selectedCandidateId =
      "alert:00000000-0000-0000-0000-0000000000e2:" +
      `${BEACH_2}:2026-04-26T16:00:00Z`;
    expect(payload.session_decision.selection.candidateId).toBe(
      selectedCandidateId,
    );
    expect(payload.session_decision.selection.forecastRef).toEqual({
      forecastId: "enhanced-forecast-mellow-cove-17z",
      beachId: BEACH_2,
      forecastAt: "2026-04-26T17:00:00Z",
    });
    expect(payload.title).toContain("Mellow Cove");
    expect(payload.body).toContain("Mellow Cove 9 AM-11 AM");
    expect(payload.beach_id).toBe(BEACH_2);
    expect(payload.forecast_at).toBe("2026-04-26T17:00:00Z");
    expect(payload.matches[0]).toMatchObject({
      beach_id: BEACH_2,
      best_hour: "2026-04-26T17:00:00Z",
    });
    expect(payload.policy_context).toEqual({
      kind: "positive_session_recommendation",
      beach_id: BEACH_2,
      starts_at: "2026-04-26T16:00:00Z",
      ends_at: "2026-04-26T18:00:00Z",
    });
    expect(call.entityId).toBe(BEACH_2);
  });

  it("uses a stable synthetic forecast identity for queued compatibility rows", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      conditions_snapshot: { wave_height: 3 },
      alert_rules: {
        name: "Missing forecast identity",
        preset_type: "mellow_session",
        notify_email: false,
        notify_push: true,
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: true });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          session_decision: expect.objectContaining({
            selection: expect.objectContaining({
              forecastRef: expect.objectContaining({
                forecastId: `alert:${RULE_1}:${BEACH_1}:2026-04-26T13:00:00Z`,
              }),
            }),
          }),
        }),
      }),
    );
    expect(store.deliveryInserts).toHaveLength(1);
    expect(store.attemptInserts).toEqual([]);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
    expect(body).toMatchObject({
      pushSent: 1,
      queueMarked: 1,
      queue_marked_by_reason: {
        canonical_safety_rejected: 0,
        delivered: 1,
      },
    });
    expectQueueReasonTotals(body);
  });

  it("counts push delivery-row insert failure after enqueue without pre-writing a sent attempt", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    store.deliveryInsertError = new Error("dedupe insert failed");
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: false,
        notify_push: true,
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: true });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    consoleErrorSpy.mockRestore();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.errors).toBe(1);
    expect(body.pushSent).toBe(0);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(store.deliveryInserts).toHaveLength(1);
    expect(
      store.attemptInserts.find((a) => a.channel === "push"),
    ).toBeUndefined();
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("records skipped_dedup_collision when enqueue returns duplicate", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: false,
        notify_push: true,
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: true });
    mockEnqueueNotification.mockResolvedValueOnce({
      enqueued: false,
      reason: "duplicate",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(store.deliveryInserts).toHaveLength(0);

    const pushAttempt = store.attemptInserts.find((a) => a.channel === "push");
    expect(pushAttempt?.status).toBe("skipped_dedup_collision");
  });

  it("records failed_internal when enqueue returns internal_error", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: false,
        notify_push: true,
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: true });
    mockEnqueueNotification.mockResolvedValueOnce({
      enqueued: false,
      reason: "internal_error",
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("enqueue failed for user"),
      expect.objectContaining({ reason: "internal_error" }),
    );
    consoleErrorSpy.mockRestore();
    expect(res.status).toBe(503);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(store.deliveryInserts).toHaveLength(0);

    const pushAttempt = store.attemptInserts.find((a) => a.channel === "push");
    expect(pushAttempt?.status).toBe("failed_internal");
    expect(pushAttempt?.skip_reason).toContain("internal_error");
    expectConsoleWarnings([/degraded queue consumption/]);
  });

  it("does NOT enqueue when notif_push_enabled=false", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      alert_rules: {
        name: "Test rule",
        notify_email: false,
        notify_push: true,
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    const pushAttempt = store.attemptInserts.find((a) => a.channel === "push");
    expect(pushAttempt?.status).toBe("skipped_channel_disabled");
  });
});

// ─── Plan V4 — Agent 3: similarity_match partition + delivery split ─────────
// Similarity rows are stamped by try_insert_similarity_alert with
// conditions_snapshot.alert_type='similarity_match'. The cron must partition
// these out BEFORE the legacy forecast_alert consolidation and process each
// row individually via enqueueNotification — bypassing the shared cooldown +
// weekly cap (similarity has its own dedup story via the partial unique index).

const QUEUE_SIM = "00000000-0000-0000-0000-0000000000c2";
const RULE_SIM = "00000000-0000-0000-0000-0000000000a2";
const BEACH_SIM = "00000000-0000-0000-0000-0000000000b2";

function buildStoredSimilarityDecision() {
  return buildCanonicalSessionDecision({
    anchorTime: "2026-05-04T15:00:00Z",
    scope: {
      kind: "plan_next_session",
      windowStart: "2026-05-04T15:00:00Z",
      windowEnd: "2026-05-04T16:00:00.000Z",
      timezone: "America/Los_Angeles",
    },
    profileExperience: "beginner",
    recommendationAvailability: {
      state: "available",
      holdEpoch: "similarity-alert-preflight",
    },
    candidates: [
      {
        candidateId: `similarity-alert:${BEACH_SIM}:2026-05-04T15:00:00Z`,
        beachId: BEACH_SIM,
        beachName: "Ocean Beach SF",
        beachSkillLevel: "beginner",
        windowStart: "2026-05-04T15:00:00Z",
        windowEnd: "2026-05-04T16:00:00.000Z",
        timezone: "America/Los_Angeles",
        forecastId: `similarity-alert:${BEACH_SIM}:2026-05-04T15:00:00Z`,
        forecastAt: "2026-05-04T15:00:00Z",
        waveHeight: "3.5 ft",
        utilityScore: 80,
        recommendationLabel: "Worth it",
        personalMatch: {
          score: 8.5,
          label: "EPIC",
          confidence: "high",
          sessionCount: 17,
          reasons: ["Matches your best sessions"],
        },
      },
    ],
  });
}

function seedSimilarityQueueRow(overrides: Partial<any> = {}) {
  const storedDecision = buildStoredSimilarityDecision();
  store.alertQueueRows.push({
    id: QUEUE_SIM,
    user_id: USER_A,
    rule_id: RULE_SIM,
    beach_id: BEACH_SIM,
    alert_date: "2026-05-04",
    send_at: "2026-05-04T05:00:00Z",
    window_start: "2026-05-04T13:00:00Z",
    window_end: "2026-05-04T15:00:00Z",
    best_hour: "2026-05-04T14:00:00Z",
    conditions_snapshot: {
      alert_type: "similarity_match",
      score: 8.5,
      label: "EPIC",
      forecast_at: "2026-05-04T15:00:00Z",
      forecast_id: `similarity-alert:${BEACH_SIM}:2026-05-04T15:00:00Z`,
      rule_id: RULE_SIM,
      beach_id: BEACH_SIM,
      beach_slug: "ocean-beach-sf",
      beach_name: "Ocean Beach SF",
      reason: "Conditions match your top sessions",
      session_decision: storedDecision,
      // Plan V4 fix F2: extended payload fields written by the
      // similarity-alerts cron and forwarded into the notifications
      // pipeline. Tests below override / strip these to simulate legacy
      // queue rows.
      window_local: "Sat 8am",
      wave_height_ft: 3.5,
      wave_period_s: 11,
      wind_speed_mph: 8,
      wind_direction: "NW",
      tide_height_ft: 2.1,
      tide_status: "rising",
      confidence: 0.86,
      condition_summary: "3.5ft @ 11s, NW wind 8mph, rising tide 2.1ft",
      board_tip: "Bring the step-up",
    },
    sent: false,
    // notify_push/notify_email do NOT gate similarity — registry pref does.
    // We default false here to confirm the route bypasses the legacy flags.
    alert_rules: {
      name: "Similarity match",
      preset_type: "similarity_match",
      notify_email: false,
      notify_push: false,
    },
    beaches: {
      name: "Ocean Beach SF",
      timezone: "America/Los_Angeles",
      skill_level: "beginner",
    },
    ...overrides,
  });
}

describe("condition-alert-deliver — similarity_match partition + enqueue", () => {
  it("partitions similarity rows out of legacy consolidation and enqueues a similarity_match event", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";

    // One similarity row + one legacy forecast row for the same user. The
    // legacy row should still go through the forecast_alert path; the
    // similarity row should go through enqueueNotification with type=similarity_match.
    seedSimilarityQueueRow();
    seedQueueRow({
      alert_rules: {
        name: "Forecast rule",
        notify_email: false,
        notify_push: true,
      },
    });
    seedProfile({ notif_email_enabled: false, notif_push_enabled: true });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // Two enqueue calls — one forecast_alert, one similarity_match.
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    const calls = mockEnqueueNotification.mock.calls.map((c) => c[0]);
    const types = calls.map((c) => c.type).sort();
    expect(types).toEqual(["forecast_alert", "similarity_match"]);

    const simCall = calls.find((c) => c.type === "similarity_match")!;
    const storedDecision = buildStoredSimilarityDecision();
    expect(simCall).toMatchObject({
      type: "similarity_match",
      recipientUserId: USER_A,
      entityType: "beach",
      entityId: BEACH_SIM,
      dedupeKey:
        `similarity_match:${USER_A}:${BEACH_SIM}:` +
        `2026-05-04T15:00:00Z:${storedDecision.decisionId}`,
    });
    expect(simCall.payload).toMatchObject({
      beach_id: BEACH_SIM,
      beach_slug: "ocean-beach-sf",
      beach_name: "Ocean Beach SF",
      alert_date: "2026-05-04",
      forecast_at: "2026-05-04T15:00:00Z",
      score: 8.5,
      label: "EPIC",
      reason: "Conditions match your top sessions",
      // Plan V4 fix F2: extended fields forwarded from conditions_snapshot.
      window_local: "Sat 8am",
      wave_height_ft: 3.5,
      wave_period_s: 11,
      wind_speed_mph: 8,
      wind_direction: "NW",
      tide_height_ft: 2.1,
      tide_status: "rising",
      confidence: 0.86,
      condition_summary: "3.5ft @ 11s, NW wind 8mph, rising tide 2.1ft",
      board_tip: "Bring the step-up",
      policy_context: {
        kind: "positive_session_recommendation",
        beach_id: BEACH_SIM,
        starts_at: "2026-05-04T15:00:00Z",
        ends_at: "2026-05-04T16:00:00.000Z",
      },
      queue_items: [{ queue_id: QUEUE_SIM, rule_id: RULE_SIM }],
      session_decision: storedDecision,
    });

    // Similarity DOES NOT pre-write an alert_delivery_attempts row on success
    // (mirror of forecast_alert — the worker's onChannelOutcome hook does it).
    const simAttempts = store.attemptInserts.filter(
      (a) => a.queue_id === QUEUE_SIM,
    );
    expect(simAttempts).toHaveLength(0);

    // Both queue rows marked sent.
    const allMarked = store.queueUpdates.flatMap((u) => u.ids).sort();
    expect(allMarked).toEqual([QUEUE_1, QUEUE_SIM].sort());
  });

  it("suppresses a held or unresolved similarity row before notification enqueue", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedSimilarityQueueRow();
    seedProfile();
    mockResolveNotificationMajorEventHold.mockResolvedValueOnce({
      status: "suppressed",
      reasonCode: "major_event_hold",
      auditCode: "major_event_hold",
      candidate: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledWith({
      eventId: `condition-alert-deliver:similarity:${QUEUE_SIM}`,
      type: "similarity_match",
      payload: expect.objectContaining({
        beach_id: BEACH_SIM,
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: BEACH_SIM,
          starts_at: "2026-05-04T15:00:00Z",
          ends_at: "2026-05-04T16:00:00.000Z",
        },
      }),
      profileExperience: "beginner",
    });
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({
        queue_id: QUEUE_SIM,
        channel: "push",
        status: "skipped_disabled",
        skip_reason: "major_event_hold:major_event_hold",
      }),
    ]);
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_SIM], sent: true }]);
  });

  it("forecast delivery shadow mode withholds similarity enqueue and records its canonical outcome", async () => {
    delete process.env.FORECAST_ALERT_DELIVERY_ENABLED;
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);
    expect(store.attemptInserts).toEqual([
      expect.objectContaining({
        queue_id: QUEUE_SIM,
        channel: "push",
        status: "shadow_withheld",
      }),
    ]);
    expect(store.queueRefreshUpdates).toContainEqual({
      id: QUEUE_SIM,
      values: {
        delivery_shadow_outcome: {
          status: "shadow_withheld",
          verdict: "go",
          reason_code: "selected_go",
          preset_type: "similarity_match",
          would_use_channels: ["push"],
        },
      },
    });
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_SIM], sent: true }]);
    expect(body.queue_marked_by_reason.shadow_withheld).toBe(1);
    expectQueueReasonTotals(body);
  });

  it("kill switch: ALERTS_DELIVERY_ENABLED=false records skipped_disabled and marks similarity queue sent without enqueueing", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "false";
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    const simAttempts = store.attemptInserts.filter(
      (a) => a.queue_id === QUEUE_SIM,
    );
    expect(simAttempts).toHaveLength(1);
    expect(simAttempts[0]).toMatchObject({
      queue_id: QUEUE_SIM,
      rule_id: RULE_SIM,
      user_id: USER_A,
      channel: "push",
      status: "skipped_disabled",
    });

    const allMarked = store.queueUpdates.flatMap((u) => u.ids);
    expect(allMarked).toContain(QUEUE_SIM);
  });

  it("allowlist: user not in list records skipped_allowlist and marks similarity queue sent without enqueueing", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = USER_B;
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    const simAttempts = store.attemptInserts.filter(
      (a) => a.queue_id === QUEUE_SIM,
    );
    expect(simAttempts).toHaveLength(1);
    expect(simAttempts[0]).toMatchObject({
      queue_id: QUEUE_SIM,
      rule_id: RULE_SIM,
      user_id: USER_A,
      channel: "push",
      status: "skipped_allowlist",
    });

    const allMarked = store.queueUpdates.flatMap((u) => u.ids);
    expect(allMarked).toContain(QUEUE_SIM);
  });

  it("enqueue duplicate: marks queue sent + records skipped_dedup_collision", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });
    mockEnqueueNotification.mockResolvedValueOnce({
      enqueued: false,
      reason: "duplicate",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    const simAttempts = store.attemptInserts.filter(
      (a) => a.queue_id === QUEUE_SIM,
    );
    expect(simAttempts).toHaveLength(1);
    expect(simAttempts[0]).toMatchObject({
      queue_id: QUEUE_SIM,
      channel: "push",
      status: "skipped_dedup_collision",
    });

    const allMarked = store.queueUpdates.flatMap((u) => u.ids);
    expect(allMarked).toContain(QUEUE_SIM);
  });

  it("enqueue internal_error: leaves queue UNSENT for retry, records failed_internal", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });
    mockEnqueueNotification.mockResolvedValueOnce({
      enqueued: false,
      reason: "internal_error",
      message: "supabase blip",
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("similarity enqueue failed for user"),
      expect.objectContaining({ reason: "internal_error" }),
    );
    consoleErrorSpy.mockRestore();
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    const simAttempts = store.attemptInserts.filter(
      (a) => a.queue_id === QUEUE_SIM,
    );
    expect(simAttempts).toHaveLength(1);
    expect(simAttempts[0]).toMatchObject({
      queue_id: QUEUE_SIM,
      channel: "push",
      status: "failed_internal",
    });
    expect(simAttempts[0].skip_reason).toContain("internal_error");

    // Queue NOT marked sent — the next tick should retry.
    const allMarked = store.queueUpdates.flatMap((u) => u.ids);
    expect(allMarked).not.toContain(QUEUE_SIM);
  });

  it("enqueue invalid_payload: marks queue sent (permanent), records failed_internal with reason", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });
    mockEnqueueNotification.mockResolvedValueOnce({
      enqueued: false,
      reason: "invalid_payload",
      message: "beach_id: Required",
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = await GET(makeRequest());
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("similarity enqueue rejected invalid payload"),
      expect.objectContaining({ reason: "invalid_payload" }),
    );
    consoleErrorSpy.mockRestore();
    expect(res.status).toBe(503);

    const simAttempts = store.attemptInserts.filter(
      (a) => a.queue_id === QUEUE_SIM,
    );
    expect(simAttempts).toHaveLength(1);
    expect(simAttempts[0]).toMatchObject({
      queue_id: QUEUE_SIM,
      channel: "push",
      status: "failed_internal",
    });
    expect(simAttempts[0].skip_reason).toContain("invalid_payload");

    // Permanent failure — queue marked sent so we don't loop on it.
    const allMarked = store.queueUpdates.flatMap((u) => u.ids);
    expect(allMarked).toContain(QUEUE_SIM);
    expectConsoleWarnings([/degraded queue consumption/]);
  });

  it("fails a legacy similarity row without wave safety data closed", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedSimilarityQueueRow({
      conditions_snapshot: {
        alert_type: "similarity_match",
        score: 8.5,
        label: "EPIC",
        forecast_at: "2026-05-04T15:00:00Z",
        rule_id: RULE_SIM,
        beach_id: BEACH_SIM,
        beach_slug: "ocean-beach-sf",
        beach_name: "Ocean Beach SF",
        reason: "Conditions match your top sessions",
        // window_local / wave_height_ft / wave_period_s deliberately omitted
        // to simulate a legacy row stamped before fix F2.
      },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });

    await GET(makeRequest());

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(store.attemptInserts).toContainEqual(
      expect.objectContaining({
        queue_id: QUEUE_SIM,
        channel: "push",
        status: "skipped_disabled",
        skip_reason: "canonical_decision:missing_wave_height",
      }),
    );
  });

  it("forwards window_local/wave_height_ft/wave_period_s from conditions_snapshot", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });

    await GET(makeRequest());

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    const payload = mockEnqueueNotification.mock.calls[0][0].payload;
    expect(payload.window_local).toBe("Sat 8am");
    expect(payload.wave_height_ft).toBe(3.5);
    expect(payload.wave_period_s).toBe(11);
  });

  it("similarity bypasses cooldown + weekly cap (own dedup model via partial unique index)", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedSimilarityQueueRow();
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });

    // Seed 10 prior 'sent' attempts for USER_A — would trip the legacy
    // forecast weekly cap. Similarity must enqueue regardless.
    for (let i = 0; i < 10; i++) {
      store.seededAttempts.push({
        queue_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        rule_id: RULE_SIM,
        user_id: USER_A,
        channel: "push",
        status: "sent",
        attempted_at: new Date(
          Date.now() - (i + 1) * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification.mock.calls[0][0].type).toBe(
      "similarity_match",
    );
  });
});
