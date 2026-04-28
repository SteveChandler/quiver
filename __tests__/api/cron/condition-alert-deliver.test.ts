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
 * - ALERTS_DELIVERY_ENABLED=false short-circuits providers and writes one
 *   alert_delivery_attempts row per (queue_id, channel) with status
 *   "skipped_disabled" — but still marks queue rows sent.
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
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

// ---- Mock api-utils ----
jest.mock("@/lib/api-utils", () => ({
  validateCronRequest: jest.fn(() => true),
}));

// ---- Mock mailer client ----
const mockEmailsSend = jest.fn();
jest.mock("@/lib/mailer/client", () => ({
  resend: {
    emails: { send: (...args: any[]) => mockEmailsSend(...args) },
  },
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  getBaseUrl: () => "https://quiversurf.app",
}));

// ---- Mock email template (avoid React rendering in jsdom) ----
jest.mock("@/lib/mailer/templates/ConsolidatedAlertEmail", () => ({
  ConsolidatedAlertEmail: jest.fn(() => "ConsolidatedAlertEmail"),
}));

// ---- Mock email logging + rate limiter ----
jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: jest.fn(() => ({
    logDelivery: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: jest.fn(() => ({
    throttle: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ---- Mock push service ----
const mockSendPushNotifications = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotifications: (...args: any[]) => mockSendPushNotifications(...args),
}));

// ---- Mock email-token (deterministic) ----
jest.mock("@/lib/alerts/email-token", () => ({
  generateDisableToken: jest.fn(() => "test-disable-token"),
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
  profileRows: any[];
  existingDeliveries: DeliveryRow[];
  deviceRows: { user_id: string; device_token: string }[];
  attemptInserts: AttemptRow[];
  deliveryInserts: DeliveryRow[];
  queueUpdates: QueueUpdate[];
  // Pre-existing attempt rows (for cooldown/cap throttle queries).
  // Worker reads these via SELECT on alert_delivery_attempts where status='sent'
  // and attempted_at >= sinceWeek. Inserts during the run land in attemptInserts.
  seededAttempts: SeededAttemptRow[];
}

const store: MockStore = {
  alertQueueRows: [],
  profileRows: [],
  existingDeliveries: [],
  deviceRows: [],
  attemptInserts: [],
  deliveryInserts: [],
  queueUpdates: [],
  seededAttempts: [],
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
    single: jest.fn(() => Promise.resolve({ data: rowsResolver()[0] ?? null, error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: rowsResolver()[0] ?? null, error: null })),
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
    queueChain.update = jest.fn((vals: any) => {
      const updateChain: any = {
        in: jest.fn((_col: string, ids: string[]) => {
          store.queueUpdates.push({ ids, sent: vals.sent === true });
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
      const f = chain._filters;
      return store.existingDeliveries.filter(
        (d) =>
          (f.user_id == null || d.user_id === f.user_id) &&
          (f.alert_date == null || d.alert_date === f.alert_date) &&
          (f.channel == null || d.channel === f.channel)
      );
    });
    chain.insert = jest.fn((row: DeliveryRow) => {
      store.deliveryInserts.push(row);
      return Promise.resolve({ error: null });
    });
    return chain;
  }
  if (table === "user_devices") {
    return makeChain(() =>
      store.deviceRows.map((d) => ({ device_token: d.device_token }))
    );
  }
  if (table === "alert_delivery_attempts") {
    // Reads on this table are the throttle's recent-sent fetch:
    //   .select("rule_id, user_id, attempted_at")
    //   .eq("status", "sent")
    //   .gte("attempted_at", sinceWeek)
    // Filter the seeded rows accordingly so the worker exercises its real query intent.
    const chain: any = makeChain(() => {
      const f = chain._filters;
      return store.seededAttempts.filter((a) => {
        if (f.status != null && a.status !== f.status) return false;
        if (f.attempted_at__gte != null && a.attempted_at < f.attempted_at__gte) return false;
        return true;
      });
    });
    chain.insert = jest.fn((row: AttemptRow) => {
      store.attemptInserts.push(row);
      return Promise.resolve({ error: null });
    });
    return chain;
  }
  return makeChain(() => []);
}

const mockSupabase = { from: jest.fn(mockFrom) };

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// ---- Test helpers ----
const USER_A = "00000000-0000-0000-0000-000000000001";
const USER_B = "00000000-0000-0000-0000-000000000002";
const RULE_1 = "00000000-0000-0000-0000-0000000000a1";
const BEACH_1 = "00000000-0000-0000-0000-0000000000b1";
const QUEUE_1 = "00000000-0000-0000-0000-0000000000c1";

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
    conditions_snapshot: {},
    sent: false,
    alert_rules: { name: "Test rule", notify_email: true, notify_push: true },
    beaches: { name: "Test Beach", timezone: "America/Los_Angeles" },
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
    ...overrides,
  });
}

function makeRequest(): Request {
  return new Request("https://quiversurf.app/api/cron/condition-alert-deliver", {
    method: "GET",
    headers: { authorization: "Bearer dummy" },
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  store.alertQueueRows = [];
  store.profileRows = [];
  store.existingDeliveries = [];
  store.deviceRows = [];
  store.attemptInserts = [];
  store.deliveryInserts = [];
  store.queueUpdates = [];
  store.seededAttempts = [];
  mockEmailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  delete process.env.ALERTS_DELIVERY_ENABLED;
  delete process.env.ALERTS_DELIVERY_USER_ALLOWLIST;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("condition-alert-deliver — kill switch + allowlist + per-attempt rows", () => {
  it("ALERTS_DELIVERY_ENABLED=false writes skipped_disabled per channel and still marks queue sent", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "false";
    seedQueueRow({
      alert_rules: { name: "Test rule", notify_email: true, notify_push: true },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: true });
    store.deviceRows.push({ user_id: USER_A, device_token: "ExpoPushToken[abc]" });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).not.toHaveBeenCalled();
    expect(mockSendPushNotifications).not.toHaveBeenCalled();
    expect(store.deliveryInserts).toHaveLength(0);

    expect(store.attemptInserts).toHaveLength(2);
    const channels = store.attemptInserts.map((a) => a.channel).sort();
    expect(channels).toEqual(["email", "push"]);
    for (const a of store.attemptInserts) {
      expect(a.status).toBe("skipped_disabled");
      expect(a.queue_id).toBe(QUEUE_1);
      expect(a.user_id).toBe(USER_A);
      expect(a.rule_id).toBe(RULE_1);
    }

    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });

  it("Allowlist set, user not in list, ENABLED=true writes skipped_allowlist", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST =
      "73040cff-afe9-4fa0-a874-2016203fc015";
    seedQueueRow({
      user_id: USER_B,
      alert_rules: { name: "Test rule", notify_email: true, notify_push: false },
    });
    seedProfile({ id: USER_B, notif_email_enabled: true, notif_push_enabled: false });

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

  it("Empty allowlist, ENABLED=true, healthy email path writes one sent attempt + delivery row", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: { name: "Test rule", notify_email: true, notify_push: false },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(mockSendPushNotifications).not.toHaveBeenCalled();

    expect(store.deliveryInserts).toHaveLength(1);
    expect(store.deliveryInserts[0]).toMatchObject({
      user_id: USER_A,
      alert_date: "2026-04-26",
      channel: "email",
    });

    expect(store.attemptInserts).toHaveLength(1);
    expect(store.attemptInserts[0]).toMatchObject({
      queue_id: QUEUE_1,
      user_id: USER_A,
      rule_id: RULE_1,
      channel: "email",
      status: "sent",
    });

    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });
});

describe("condition-alert-deliver — throttle (cooldown + weekly cap)", () => {
  it("rule cooldown: prior sent attempt 12h ago records skipped_cooldown and skips provider", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    process.env.ALERTS_DELIVERY_USER_ALLOWLIST = "";
    seedQueueRow({
      alert_rules: { name: "Test rule", notify_email: true, notify_push: false },
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
      alert_rules: { name: "Test rule", notify_email: true, notify_push: false },
    });
    seedProfile({ notif_email_enabled: true, notif_push_enabled: false });

    // 10 prior 'sent' attempts for USER_A spread across days 1..6 ago.
    // Different rule_ids so cooldown doesn't trip first; weekly cap is per-user.
    for (let i = 0; i < 10; i++) {
      const dayOffset = (i % 6) + 1; // days 1..6
      const hourJitter = i; // unique timestamps
      store.seededAttempts.push({
        queue_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        rule_id: `00000000-0000-0000-0000-${String(i).padStart(8, "0")}cap`.slice(0, 36),
        user_id: USER_A,
        channel: "email",
        status: "sent",
        attempted_at: new Date(
          Date.now() - dayOffset * 24 * 60 * 60 * 1000 - hourJitter * 60 * 60 * 1000
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
});

describe("condition-alert-deliver — orphaned queue rows", () => {
  it("marks rows sent and records failed_internal when the queued user has no profile", async () => {
    process.env.ALERTS_DELIVERY_ENABLED = "true";
    seedQueueRow({
      alert_rules: { name: "Test rule", notify_email: true, notify_push: true },
    });

    const res = await GET(makeRequest());
    expectConsoleWarnings([/\[condition-alert-deliver\] No profile found for user/]);
    expect(res.status).toBe(200);

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
      ])
    );
    expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
  });
});
