/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET as dailyGet } from "@/app/api/cron/daily-call-streak-reminder/route";
import { GET as weeklyGet } from "@/app/api/cron/weekly-streak-reminder/route";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";
import { scoreWindowWithComposite } from "@/lib/services/discovery/window-selector";

const mockEnqueueNotification = jest.fn();
jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

const mockInsert = jest.fn();
const mockFrom = jest.fn((table: string) => buildQuery(table));
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) => beaches);

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

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

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

jest.mock("@/lib/services/discovery/window-selector", () => ({
  FORECAST_WINDOW_DURATION_MINUTES: 30,
  scoreWindowWithComposite: jest.fn(() => ({ total: 72 })),
}));

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

interface TableState {
  rows: Array<Record<string, unknown>>;
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
  errorOffset?: number;
}

interface Filter {
  op: "eq" | "lte" | "gte" | "lt" | "in" | "is";
  column: string;
  value: unknown;
}

const tableState: Record<string, TableState> = {};
const queryReads: Array<{
  table: string;
  filters: Filter[];
  range: [number, number] | null;
  count: number;
}> = [];
let rowCap = 1000;
const originalAllowlist = process.env.STREAK_REMINDER_TEST_USER_IDS;
const originalFeedbackAllowlist =
  process.env.FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS;
const originalFeedbackEnabled = process.env.FORECAST_FEEDBACK_NUDGE_ENABLED;

function applyFilters(
  rows: Array<Record<string, unknown>>,
  filters: Filter[]
): Array<Record<string, unknown>> {
  return rows.filter((row) =>
    filters.every((filter) => {
      const value = row[filter.column];
      if (filter.op === "eq") return value === filter.value;
      if (filter.op === "lte") return String(value) <= String(filter.value);
      if (filter.op === "gte") return String(value) >= String(filter.value);
      if (filter.op === "lt") return String(value) < String(filter.value);
      if (filter.op === "in") {
        return Array.isArray(filter.value) && filter.value.includes(value);
      }
      return value === filter.value;
    })
  );
}

function buildQuery(table: string) {
  const filters: Filter[] = [];
  const builder: Record<string, unknown> = {};
  let range: [number, number] | null = null;
  const orders: string[] = [];
  builder.range = jest.fn((from: number, to: number) => {
    range = [from, to];
    return builder;
  });
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn((column: string, value: unknown) => {
    filters.push({ op: "eq", column, value });
    return builder;
  });
  builder.lte = jest.fn((column: string, value: unknown) => {
    filters.push({ op: "lte", column, value });
    return builder;
  });
  builder.gte = jest.fn((column: string, value: unknown) => {
    filters.push({ op: "gte", column, value });
    return builder;
  });
  builder.lt = jest.fn((column: string, value: unknown) => {
    filters.push({ op: "lt", column, value });
    return builder;
  });
  builder.in = jest.fn((column: string, value: unknown[]) => {
    filters.push({ op: "in", column, value });
    return builder;
  });
  builder.is = jest.fn((column: string, value: unknown) => {
    filters.push({ op: "is", column, value });
    return builder;
  });
  builder.order = jest.fn((column: string) => {
    orders.push(column);
    return builder;
  });
  builder.insert = jest.fn((payload: Record<string, unknown>) => {
    mockInsert(table, payload);
    const row = tableState[table] ?? { rows: [] };
    return Promise.resolve({ error: row.insertError ?? null });
  });
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => {
    const row = tableState[table] ?? { rows: [] };
    const filtered = applyFilters(row.rows, filters).sort((a, b) => {
      for (const column of orders) {
        const result = String(a[column]).localeCompare(String(b[column]));
        if (result !== 0) return result;
      }
      return 0;
    });
    const offset = range?.[0] ?? 0;
    const limit = Math.min(rowCap, range ? range[1] - offset + 1 : rowCap);
    const data = filtered.slice(offset, offset + limit);
    queryReads.push({ table, filters, range, count: data.length });
    const resolved = {
      data,
      error: row.errorOffset === offset
        ? { message: "page failed" }
        : row.selectError ?? null,
    };
    return Promise.resolve(resolved).then(onFulfilled, onRejected);
  };
  return builder;
}

function seed(table: string, rows: Array<Record<string, unknown>>): void {
  tableState[table] = { rows };
}

function mockRequest(): Request {
  return {
    headers: { get: jest.fn(() => "Bearer test-cron-secret") },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  queryReads.length = 0;
  rowCap = 1000;
  for (const key of Object.keys(tableState)) delete tableState[key];
  delete process.env.STREAK_REMINDER_TEST_USER_IDS;
  process.env.FORECAST_FEEDBACK_NUDGE_ENABLED = "true";
  jest.useFakeTimers().setSystemTime(new Date("2026-06-22T12:00:00.000Z"));
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  (scoreWindowWithComposite as jest.Mock).mockReturnValue({ total: 72 });
  mockEnqueueNotification.mockResolvedValue({
    enqueued: true,
    eventId: "evt-streak",
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (originalAllowlist === undefined) {
    delete process.env.STREAK_REMINDER_TEST_USER_IDS;
  } else {
    process.env.STREAK_REMINDER_TEST_USER_IDS = originalAllowlist;
  }
  if (originalFeedbackAllowlist === undefined) {
    delete process.env.FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS;
  } else {
    process.env.FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS = originalFeedbackAllowlist;
  }
  if (originalFeedbackEnabled === undefined) {
    delete process.env.FORECAST_FEEDBACK_NUDGE_ENABLED;
  } else {
    process.env.FORECAST_FEEDBACK_NUDGE_ENABLED = originalFeedbackEnabled;
  }
});

describe("streak reminder registry entries", () => {
  it("registers forecast feedback and weekly push types behind notif_reminders with quiet hours", () => {
    const feedback = NOTIFICATION_REGISTRY.forecast_feedback_nudge;
    const weekly = NOTIFICATION_REGISTRY.weekly_streak_reminder;

    expect(feedback.channels).toEqual(["push"]);
    expect(feedback.prefs.master.push).toBe("notif_push_enabled");
    expect(feedback.prefs.perType.push).toBe("notif_reminders");
    expect(feedback.quietHours.mode).toBe("defer");

    expect(weekly.channels).toEqual(["push"]);
    expect(weekly.prefs.master.push).toBe("notif_push_enabled");
    expect(weekly.prefs.perType.push).toBe("notif_reminders");
    expect(weekly.quietHours.mode).toBe("defer");
  });

  it("builds the forecast feedback nudge push payload", () => {
    const payload = NOTIFICATION_REGISTRY.forecast_feedback_nudge.buildPushPayload!({
      beach_id: "beach-1",
      beach_slug: "ocean-beach",
      beach_name: "Ocean Beach",
      forecast_at: "2026-06-22T18:00:00.000Z",
      deeplink:
        "quiver://sessions/new?beach=ocean-beach&at=2026-06-22T18%3A00%3A00.000Z&utm_source=push_log_nudge",
    });

    expect(payload).toMatchObject({
      title: "Catch a session today?",
      body: "If you paddle out, log it when you are done.",
      data: {
        type: "forecast_feedback_nudge",
        beach_id: "beach-1",
        beach_slug: "ocean-beach",
        forecast_at: "2026-06-22T18:00:00.000Z",
        deeplink:
          "quiver://sessions/new?beach=ocean-beach&at=2026-06-22T18%3A00%3A00.000Z&utm_source=push_log_nudge",
      },
    });
  });

  it("allows beach-specific forecast feedback copy only at high confidence", () => {
    const payload = NOTIFICATION_REGISTRY.forecast_feedback_nudge.buildPushPayload!({
      beach_id: "beach-1",
      beach_name: "Ocean Beach",
      relevance_confidence: "high",
      assumed_attendance: false,
    });

    expect(payload).toMatchObject({
      title: "Surfed Ocean Beach today?",
      body: "Log it in one tap.",
      data: {
        type: "forecast_feedback_nudge",
        beach_id: "beach-1",
        relevance_confidence: "high",
        assumed_attendance: false,
      },
    });
  });

  it("builds the weekly reminder push payload", () => {
    const payload = NOTIFICATION_REGISTRY.weekly_streak_reminder.buildPushPayload!({
      streak: 3,
    });

    expect(payload).toMatchObject({
      title: "Keep your streak alive",
      body: "Your 3-week streak ends Sunday. Log a session to keep it going.",
      data: { type: "weekly_streak_reminder", streak: 3 },
    });
  });
});

describe("forecast-feedback-nudge cron", () => {
  it("is disabled by default and performs no DB fanout", async () => {
    delete process.env.FORECAST_FEEDBACK_NUDGE_ENABLED;

    const response = await dailyGet(mockRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.enabled).toBe(false);
    expect(body.data.summary.sent).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("selects enabled users with a passed worth-it home or saved beach window and no feedback/session", async () => {
    jest.setSystemTime(new Date("2026-06-22T20:00:00.000Z"));
    (scoreWindowWithComposite as jest.Mock).mockImplementation((forecast) => ({
      total: forecast.id === "f-poor" ? 50 : 72,
    }));

    seed("profiles", [
      { id: "u-active", home_beach_id: "b-home", notif_reminders: true },
      { id: "u-fav", home_beach_id: null, notif_reminders: true },
      { id: "u-off", home_beach_id: "b-home", notif_reminders: false },
      { id: "u-logged", home_beach_id: "b-home", notif_reminders: null },
      { id: "u-feedback", home_beach_id: "b-home", notif_reminders: true },
      { id: "u-session", home_beach_id: "b-home", notif_reminders: true },
      { id: "u-poor", home_beach_id: "b-poor", notif_reminders: true },
    ]);
    seed("favorite_beaches", [
      { user_id: "u-fav", beach_id: "b-fav", rank: 1 },
    ]);
    seed("streak_reminder_log", [
      {
        user_id: "u-logged",
        reminder_type: "forecast_feedback_nudge",
        period_key: "2026-06-22",
      },
    ]);
    seed("beaches", [
      {
        id: "b-home",
        name: "Home Break",
        slug: "home-break",
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
      {
        id: "b-fav",
        name: "Saved Break",
        slug: "saved-break",
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
      {
        id: "b-poor",
        name: "Poor Break",
        slug: "poor-break",
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
    ]);
    seed("enhanced_forecasts", [
      { id: "f-home", beach_id: "b-home", forecast_at: "2026-06-22T18:00:00.000Z" },
      { id: "f-fav", beach_id: "b-fav", forecast_at: "2026-06-22T17:00:00.000Z" },
      { id: "f-poor", beach_id: "b-poor", forecast_at: "2026-06-22T18:00:00.000Z" },
    ]);
    seed("forecast_feedback_contexts", [
      {
        user_id: "u-feedback",
        beach_id: "b-home",
        forecast_at: "2026-06-22T18:00:00.000Z",
        window_start: null,
        window_end: null,
      },
    ]);
    seed("sessions", [
      {
        user_id: "u-session",
        beach_id: "b-home",
        arrival_time: "2026-06-22T18:10:00.000Z",
        deleted_at: null,
      },
    ]);

    const response = await dailyGet(mockRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.summary.candidates).toBe(2);
    expect(body.data.summary.sent).toBe(2);
    expect(body.data.summary.skipped).toMatchObject({
      remindersDisabled: 1,
      alreadyLogged: 1,
      alreadyFeedback: 1,
      alreadySessionLogged: 1,
      noPassedWorthItWindow: 1,
    });
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    expect(mockEnqueueNotification).toHaveBeenNthCalledWith(1, {
      type: "forecast_feedback_nudge",
      recipientUserId: "u-active",
      entityType: "beach",
      entityId: "b-home",
      payload: {
        beach_id: "b-home",
        beach_slug: "home-break",
        beach_name: "Home Break",
        forecast_at: "2026-06-22T18:00:00.000Z",
        deeplink:
          "quiver://sessions/new?beach=home-break&at=2026-06-22T18%3A00%3A00.000Z&utm_source=push_log_nudge",
        notification_category: "session_growth",
        trigger_source: "forecast_feedback_nudge",
        relevance_confidence: "low",
        beach_confidence: "low",
        assumed_attendance: false,
        relevance_score: 72,
      },
      dedupeKey: "forecast_feedback_nudge:u-active:2026-06-22",
    });
    expect(mockEnqueueNotification).toHaveBeenNthCalledWith(2, {
      type: "forecast_feedback_nudge",
      recipientUserId: "u-fav",
      entityType: "beach",
      entityId: "b-fav",
      payload: {
        beach_id: "b-fav",
        beach_slug: "saved-break",
        beach_name: "Saved Break",
        forecast_at: "2026-06-22T17:00:00.000Z",
        deeplink:
          "quiver://sessions/new?beach=saved-break&at=2026-06-22T17%3A00%3A00.000Z&utm_source=push_log_nudge",
        notification_category: "session_growth",
        trigger_source: "forecast_feedback_nudge",
        relevance_confidence: "low",
        beach_confidence: "low",
        assumed_attendance: false,
        relevance_score: 72,
      },
      dedupeKey: "forecast_feedback_nudge:u-fav:2026-06-22",
    });
    expect(mockInsert).toHaveBeenCalledWith("streak_reminder_log", {
      user_id: "u-active",
      reminder_type: "forecast_feedback_nudge",
      period_key: "2026-06-22",
    });
  });

  it("falls back to beach id in native deeplinks when the beach has no slug", async () => {
    jest.setSystemTime(new Date("2026-06-22T20:00:00.000Z"));
    seed("profiles", [
      { id: "u-active", home_beach_id: "b-home", notif_reminders: true },
    ]);
    seed("favorite_beaches", []);
    seed("streak_reminder_log", []);
    seed("beaches", [
      {
        id: "b-home",
        name: "Home Break",
        slug: null,
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
    ]);
    seed("enhanced_forecasts", [
      { id: "f-home", beach_id: "b-home", forecast_at: "2026-06-22T18:00:00.000Z" },
    ]);
    seed("forecast_feedback_contexts", []);
    seed("sessions", []);

    const response = await dailyGet(mockRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.summary.sent).toBe(1);
    expect(mockEnqueueNotification).toHaveBeenCalledWith({
      type: "forecast_feedback_nudge",
      recipientUserId: "u-active",
      entityType: "beach",
      entityId: "b-home",
      payload: {
        beach_id: "b-home",
        beach_slug: undefined,
        beach_name: "Home Break",
        forecast_at: "2026-06-22T18:00:00.000Z",
        deeplink:
          "quiver://sessions/new?beach=b-home&at=2026-06-22T18%3A00%3A00.000Z&utm_source=push_log_nudge",
        notification_category: "session_growth",
        trigger_source: "forecast_feedback_nudge",
        relevance_confidence: "low",
        beach_confidence: "low",
        assumed_attendance: false,
        relevance_score: 72,
      },
      dedupeKey: "forecast_feedback_nudge:u-active:2026-06-22",
    });
  });

  it("caps sends to FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS when set", async () => {
    jest.setSystemTime(new Date("2026-06-22T20:00:00.000Z"));
    process.env.FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS = "u-other";
    seed("profiles", [
      { id: "u-active", home_beach_id: "b-home", notif_reminders: true },
    ]);
    seed("favorite_beaches", []);
    seed("streak_reminder_log", []);
    seed("beaches", [
      {
        id: "b-home",
        name: "Home Break",
        slug: "home-break",
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
    ]);
    seed("enhanced_forecasts", [
      { id: "f-home", beach_id: "b-home", forecast_at: "2026-06-22T18:00:00.000Z" },
    ]);
    seed("forecast_feedback_contexts", []);
    seed("sessions", []);

    const response = await dailyGet(mockRequest());
    const body = await response.json();

    expect(body.data.candidates).toBe(0);
    expect(body.data.summary.candidates).toBe(1);
    expect(body.data.summary.skipped.notInTestAllowlist).toBe(1);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS active")
    );
  });
});

describe("weekly-streak-reminder cron", () => {
  it("selects only enabled users with a live previous-week streak and no session this week", async () => {
    jest.setSystemTime(new Date("2026-06-21T18:00:00.000Z"));
    seed("profiles", [
      { id: "u-active", notif_reminders: true },
      { id: "u-this-week", notif_reminders: true },
      { id: "u-off", notif_reminders: false },
      { id: "u-logged", notif_reminders: true },
      { id: "u-short", notif_reminders: true },
    ]);
    seed("streak_reminder_log", [
      {
        user_id: "u-logged",
        reminder_type: "weekly_streak",
        period_key: "2026-25",
      },
    ]);
    seed("sessions", [
      { user_id: "u-active", arrival_time: "2026-06-08T15:00:00.000Z", deleted_at: null },
      { user_id: "u-active", arrival_time: "2026-06-01T15:00:00.000Z", deleted_at: null },
      { user_id: "u-active", arrival_time: "2026-06-16T15:00:00.000Z", deleted_at: "2026-06-16T16:00:00.000Z" },
      { user_id: "u-this-week", arrival_time: "2026-06-16T15:00:00.000Z", deleted_at: null },
      { user_id: "u-this-week", arrival_time: "2026-06-08T15:00:00.000Z", deleted_at: null },
      { user_id: "u-off", arrival_time: "2026-06-08T15:00:00.000Z", deleted_at: null },
      { user_id: "u-logged", arrival_time: "2026-06-08T15:00:00.000Z", deleted_at: null },
      { user_id: "u-short", arrival_time: "2026-05-25T15:00:00.000Z", deleted_at: null },
    ]);

    const response = await weeklyGet(mockRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.summary.periodKey).toBe("2026-25");
    expect(body.data.summary.candidates).toBe(1);
    expect(body.data.summary.sent).toBe(1);
    expect(body.data.summary.skipped).toMatchObject({
      remindersDisabled: 1,
      alreadyLogged: 1,
      alreadyLoggedThisWeek: 1,
      streakTooShort: 1,
    });
    expect(mockEnqueueNotification).toHaveBeenCalledWith({
      type: "weekly_streak_reminder",
      recipientUserId: "u-active",
      payload: {
        streak: 2,
        period_key: "2026-25",
        notification_category: "session_growth",
        trigger_source: "weekly_streak_reminder",
        relevance_confidence: "medium",
        beach_confidence: "low",
        assumed_attendance: false,
      },
      dedupeKey: "weekly_streak:u-active:2026-25",
    });
    expect(mockInsert).toHaveBeenCalledWith("streak_reminder_log", {
      user_id: "u-active",
      reminder_type: "weekly_streak",
      period_key: "2026-25",
    });
  });
});

describe("weekly streak pagination and local weeks", () => {
  function session(userId: string, arrivalTime: string): Record<string, unknown> {
    return { id: `${userId}:${arrivalTime}`, user_id: userId, arrival_time: arrivalTime, deleted_at: null };
  }

  it("counts relevant sessions beyond row 1000 and paginates each bounded read", async () => {
    jest.setSystemTime(new Date("2026-06-21T17:00:00.000Z"));
    seed("profiles", [
      { id: "u-busy", notif_reminders: true },
      { id: "u-late", notif_reminders: true },
      { id: "u-off", notif_reminders: false },
      { id: "u-outside", notif_reminders: true },
    ]);
    process.env.STREAK_REMINDER_TEST_USER_IDS = "u-busy,u-late,u-off";
    seed("sessions", [
      ...Array.from({ length: 1001 }, (_, i) => ({ ...session("u-busy", "2026-06-08T15:00:00.000Z"), id: String(i).padStart(4, "0") })),
      session("u-late", "2026-06-08T15:00:00.000Z"),
      session("u-late", "2026-06-01T15:00:00.000Z"),
      session("u-off", "2026-06-08T15:00:00.000Z"),
      session("u-outside", "2026-06-08T15:00:00.000Z"),
      { ...session("u-late", "2026-06-16T15:00:00.000Z"), deleted_at: "2026-06-17T00:00:00.000Z" },
    ]);

    const response = await weeklyGet(mockRequest());
    expect(response.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: "u-late", payload: expect.objectContaining({ streak: 2 }),
    }));
    const reads = queryReads.filter((read) => read.table === "sessions");
    expect(reads.reduce((count, read) => count + read.count, 0)).toBe(1003);
    expect(reads).toContainEqual(expect.objectContaining({ range: [1000, 1999], count: 3 }));
    for (const read of reads) {
      expect(read.range).not.toBeNull();
      expect(read.filters).toEqual(expect.arrayContaining([
        { op: "in", column: "user_id", value: ["u-busy", "u-late"] },
        { op: "is", column: "deleted_at", value: null },
        { op: "gte", column: "arrival_time", value: expect.any(String) },
        { op: "lt", column: "arrival_time", value: expect.any(String) },
      ]));
    }
  });

  it.each([1000, 2])("paginates profiles and logs with server cap %i", async (cap) => {
    rowCap = cap;
    jest.setSystemTime(new Date("2026-06-21T17:00:00.000Z"));
    const profileCount = cap + 1;
    const lastUser = `u-${String(cap).padStart(4, "0")}`;
    const profiles = Array.from({ length: profileCount }, (_, i) => ({ id: `u-${String(i).padStart(4, "0")}`, notif_reminders: true }));
    seed("profiles", [...profiles, { id: "z-send", notif_reminders: null }]);
    seed("streak_reminder_log", profiles.map(({ id }) => ({ user_id: id, reminder_type: "weekly_streak", period_key: "2026-25" })));
    seed("sessions", [session(lastUser, "2026-06-08T15:00:00.000Z"), session("z-send", "2026-06-08T15:00:00.000Z")]);

    const response = await weeklyGet(mockRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.summary.skipped.alreadyLogged).toBe(profileCount);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: "z-send" }));
    expect(queryReads.filter((read) => read.table === "profiles" || read.table === "streak_reminder_log")
      .every((read) => read.range !== null)).toBe(true);
  });

  it("keeps Pacific Sunday 8 PM in the current local week and continues the streak", async () => {
    jest.setSystemTime(new Date("2026-06-22T04:00:00.000Z"));
    seed("profiles", [{ id: "u-pacific", notif_reminders: true, timezone: "America/Los_Angeles" }]);
    seed("sessions", [session("u-pacific", "2026-06-22T03:00:00.000Z"), session("u-pacific", "2026-06-08T15:00:00.000Z")]);
    const response = await weeklyGet(mockRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).data.summary.skipped.alreadyLoggedThisWeek).toBe(1);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();

    jest.setSystemTime(new Date("2026-06-28T17:00:00.000Z"));
    expect((await weeklyGet(mockRequest())).status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ streak: 2, period_key: "2026-26" }),
    }));
  });

  it("uses profile timezone before home beach, then home beach before Pacific fallback", async () => {
    jest.setSystemTime(new Date("2026-06-22T06:00:00.000Z"));
    seed("profiles", [
      { id: "u-hawaii", notif_reminders: true, timezone: null, home_beach: { timezone: "Pacific/Honolulu" } },
      { id: "u-new-york", notif_reminders: true, timezone: "America/New_York", home_beach: { timezone: "Pacific/Honolulu" } },
      { id: "u-default", notif_reminders: true, timezone: null, home_beach: null },
    ]);
    seed("sessions", [
      session("u-hawaii", "2026-06-15T05:00:00.000Z"),
      session("u-new-york", "2026-06-15T05:00:00.000Z"),
      session("u-new-york", "2026-06-08T05:00:00.000Z"),
      session("u-default", "2026-06-15T05:00:00.000Z"),
    ]);
    expect((await weeklyGet(mockRequest())).status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(3);
    for (const [userId, streak, periodKey] of [["u-hawaii", 1, "2026-25"], ["u-new-york", 2, "2026-26"], ["u-default", 1, "2026-25"]]) {
      expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({
        recipientUserId: userId,
        payload: expect.objectContaining({ streak, period_key: periodKey }),
        dedupeKey: `weekly_streak:${userId}:${periodKey}`,
      }));
    }
    expect(queryReads.filter((read) => read.table === "sessions").map((read) => read.filters))
      .toContainEqual(expect.arrayContaining([
        { op: "in", column: "user_id", value: ["u-default", "u-hawaii", "u-new-york"] },
        { op: "gte", column: "arrival_time", value: "2025-12-15T08:00:00.000Z" },
        { op: "lt", column: "arrival_time", value: "2026-06-29T04:00:00.000Z" },
      ]));
  });

  it.each(["2026-25", "2026-26"])("suppresses a Pacific reminder logged under local or legacy key %s", async (periodKey) => {
    jest.setSystemTime(new Date("2026-06-22T04:00:00.000Z"));
    seed("profiles", [{ id: "u-logged", notif_reminders: true }]);
    seed("sessions", [session("u-logged", "2026-06-15T03:00:00.000Z")]);
    seed("streak_reminder_log", [{ user_id: "u-logged", reminder_type: "weekly_streak", period_key: periodKey, sent_at: "2026-06-21T17:00:00.000Z" }]);
    const response = await weeklyGet(mockRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).data.summary.skipped.alreadyLogged).toBe(1);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("checks the legacy enqueue key when UTC and local weeks differ and the log is missing", async () => {
    jest.setSystemTime(new Date("2026-06-22T04:00:00.000Z"));
    seed("profiles", [{ id: "u-queued", notif_reminders: true }]);
    seed("sessions", [session("u-queued", "2026-06-15T03:00:00.000Z")]);
    seed("notification_events", [{ id: "event", dedupe_key: "weekly_streak:u-queued:2026-26", created_at: "2026-06-22T03:00:00.000Z" }]);
    expect((await weeklyGet(mockRequest())).status).toBe(200);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it.each(["streak_reminder_log", "notification_events"])("honors an eastern timezone's legacy key after UTC rollover via %s", async (table) => {
    jest.setSystemTime(new Date("2026-06-22T02:00:00.000Z"));
    seed("profiles", [{ id: "u-tokyo", notif_reminders: true, timezone: "Asia/Tokyo" }]);
    seed("sessions", [session("u-tokyo", "2026-06-16T10:00:00.000Z")]);
    seed(table, [{ id: "event", user_id: "u-tokyo", reminder_type: "weekly_streak", period_key: "2026-25", sent_at: "2026-06-21T17:00:00.000Z", created_at: "2026-06-21T17:00:00.000Z", dedupe_key: "weekly_streak:u-tokyo:2026-25" }]);
    const response = await weeklyGet(mockRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).data.summary.skipped.alreadyLogged).toBe(1);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it.each(["streak_reminder_log", "notification_events"])("does not mistake the previous local week's reminder for a legacy send via %s", async (table) => {
    jest.setSystemTime(new Date("2026-06-22T02:00:00.000Z"));
    seed("profiles", [{ id: "u-tokyo", notif_reminders: true, timezone: "Asia/Tokyo" }]);
    seed("sessions", [session("u-tokyo", "2026-06-16T10:00:00.000Z")]);
    seed(table, [{ id: "event", user_id: "u-tokyo", reminder_type: "weekly_streak", period_key: "2026-25", sent_at: "2026-06-15T02:00:00.000Z", created_at: "2026-06-15T02:00:00.000Z", dedupe_key: "weekly_streak:u-tokyo:2026-25" }]);
    expect((await weeklyGet(mockRequest())).status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: "weekly_streak:u-tokyo:2026-26", payload: expect.objectContaining({ streak: 1, period_key: "2026-26" }),
    }));
  });

  it("keeps the local key stable across UTC Monday and handles ISO year rollover", async () => {
    seed("profiles", [{ id: "u-stable", notif_reminders: true }]);
    seed("sessions", [session("u-stable", "2026-12-21T15:00:00.000Z")]);
    for (const instant of ["2027-01-04T00:00:00.000Z", "2027-01-04T06:59:59.000Z"]) {
      jest.setSystemTime(new Date(instant));
      expect((await weeklyGet(mockRequest())).status).toBe(200);
    }
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    for (const call of mockEnqueueNotification.mock.calls) {
      expect(call[0]).toMatchObject({ dedupeKey: "weekly_streak:u-stable:2026-53", payload: { streak: 1, period_key: "2026-53" } });
    }
  });

  it("uses local midnight bounds across DST and stops at the first gap", async () => {
    jest.setSystemTime(new Date("2026-03-15T17:00:00.000Z"));
    seed("profiles", [{ id: "u-dst", notif_reminders: true, timezone: "America/Los_Angeles" }]);
    seed("sessions", [session("u-dst", "2026-03-09T06:59:59.000Z"), session("u-dst", "2026-02-16T15:00:00.000Z")]);
    expect((await weeklyGet(mockRequest())).status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ streak: 1 }) }));
    expect(queryReads.filter((read) => read.table === "sessions").map((read) => read.filters))
      .toContainEqual(expect.arrayContaining([
        { op: "gte", column: "arrival_time", value: "2025-09-08T07:00:00.000Z" },
        { op: "lt", column: "arrival_time", value: "2026-03-16T07:00:00.000Z" },
      ]));
  });

  it.each([
    { streakLength: 25, expectedReads: 2, pageCounts: [25] },
    { streakLength: 26, expectedReads: 3, pageCounts: [26, 0] },
    { streakLength: 27, expectedReads: 4, pageCounts: [26, 1] },
    { streakLength: 70, expectedReads: 4, pageCounts: [26, 44] },
    { streakLength: 200, expectedReads: 8, pageCounts: [26, 52, 104, 18] },
  ])("counts a $streakLength-week streak without truncation", async ({ streakLength, expectedReads, pageCounts }) => {
    jest.setSystemTime(new Date("2026-06-21T17:00:00.000Z"));
    seed("profiles", [{ id: "u-long", notif_reminders: true }]);
    seed("sessions", Array.from({ length: streakLength }, (_, i) => {
      const arrival = new Date("2026-06-08T15:00:00.000Z");
      arrival.setUTCDate(arrival.getUTCDate() - i * 7);
      return session("u-long", arrival.toISOString());
    }));
    expect((await weeklyGet(mockRequest())).status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ streak: streakLength }) }));
    const reads = queryReads.filter((read) => read.table === "sessions");
    expect(reads).toHaveLength(expectedReads);
    expect(reads.filter((read) => read.range?.[0] === 0).map((read) => read.count)).toEqual(pageCounts);
  });

  it.each([[1, 1, 2], [1, 20, 2], [40, 1, 2], [40, 20, 2], [201, 1, 4], [460, 1, 6]])(
    "batches session reads for %i users with %i-week streaks into %i page calls",
    async (userCount, streakLength, expectedReads) => {
      jest.setSystemTime(new Date("2026-06-21T17:00:00.000Z"));
      const profiles = Array.from({ length: userCount }, (_, i) => ({ id: `u-${i}`, notif_reminders: true }));
      seed("profiles", profiles);
      seed("sessions", profiles.flatMap(({ id }) => Array.from({ length: streakLength }, (_, i) => {
        const arrival = new Date("2026-06-08T15:00:00.000Z");
        arrival.setUTCDate(arrival.getUTCDate() - i * 7);
        return session(id, arrival.toISOString());
      })));
      expect((await weeklyGet(mockRequest())).status).toBe(200);
      expect(mockEnqueueNotification).toHaveBeenCalledTimes(userCount);
      expect(mockEnqueueNotification.mock.calls.every(([args]) => args.payload.streak === streakLength)).toBe(true);
      expect(queryReads.filter((read) => read.table === "sessions")).toHaveLength(expectedReads);
    },
  );

  it("batches legacy events across users and filters their timestamps by each local week", async () => {
    jest.setSystemTime(new Date("2026-06-22T04:00:00.000Z"));
    seed("profiles", [
      { id: "u-pacific", notif_reminders: true, timezone: "America/Los_Angeles" },
      { id: "u-hawaii", notif_reminders: true, timezone: "Pacific/Honolulu" },
      { id: "u-tokyo", notif_reminders: true, timezone: "Asia/Tokyo" },
    ]);
    seed("notification_events", [
      { id: "e-pacific", dedupe_key: "weekly_streak:u-pacific:2026-26", created_at: "2026-06-15T08:00:00.000Z" },
      { id: "e-pacific-later", dedupe_key: "weekly_streak:u-pacific:2026-26", created_at: "2026-06-23T08:00:00.000Z" },
      { id: "e-hawaii", dedupe_key: "weekly_streak:u-hawaii:2026-26", created_at: "2026-06-15T08:00:00.000Z" },
      { id: "e-tokyo", dedupe_key: "weekly_streak:u-tokyo:2026-25", created_at: "2026-06-15T12:00:00.000Z" },
    ]);
    seed("sessions", [
      session("u-pacific", "2026-06-08T15:00:00.000Z"),
      session("u-hawaii", "2026-06-08T15:00:00.000Z"),
      session("u-tokyo", "2026-06-16T10:00:00.000Z"),
    ]);
    const response = await weeklyGet(mockRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).data.summary.skipped.alreadyLogged).toBe(1);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: "u-hawaii" }));
    expect(mockEnqueueNotification).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: "u-tokyo" }));
    const eventReads = queryReads.filter((read) => read.table === "notification_events");
    expect(eventReads).toHaveLength(2);
    expect(eventReads[0].count).toBe(4);
    expect(eventReads[0].filters).toEqual(expect.arrayContaining([
      { op: "in", column: "dedupe_key", value: expect.arrayContaining([
        "weekly_streak:u-hawaii:2026-26", "weekly_streak:u-pacific:2026-26", "weekly_streak:u-tokyo:2026-25",
      ]) },
      { op: "gte", column: "created_at", value: "2026-06-15T07:00:00.000Z" },
      { op: "lt", column: "created_at", value: "2026-06-28T15:00:00.000Z" },
    ]));
  });

  it("chunks the legacy key pool and paginates within each chunk", async () => {
    jest.setSystemTime(new Date("2026-06-22T04:00:00.000Z"));
    const profiles = Array.from({ length: 201 }, (_, i) => ({ id: `u-${i}`, notif_reminders: true }));
    seed("profiles", profiles);
    seed("notification_events", profiles.map(({ id }) => ({
      id: `event-${id}`, dedupe_key: `weekly_streak:${id}:2026-26`, created_at: "2026-06-21T17:00:00.000Z",
    })));
    expect((await weeklyGet(mockRequest())).status).toBe(200);
    expect(queryReads.filter((read) => read.table === "notification_events")).toHaveLength(6);
    expect(queryReads.filter((read) => read.table === "sessions")).toHaveLength(0);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("fails closed when a later page fails", async () => {
    seed("profiles", Array.from({ length: 1001 }, (_, i) => ({ id: `u-${i}`, notif_reminders: true })));
    tableState.profiles.errorOffset = 1000;
    const response = await weeklyGet(mockRequest());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("page failed");
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });
});

describe("streak_reminder_log migration", () => {
  it("creates a composite primary-key idempotency log", () => {
    const sql = readFileSync(
      "supabase/migrations/20260622041000_create_streak_reminder_log.sql",
      "utf8"
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.streak_reminder_log");
    expect(sql).toContain("PRIMARY KEY (user_id, reminder_type, period_key)");
    expect(sql).toContain("ALTER TABLE public.streak_reminder_log ENABLE ROW LEVEL SECURITY");
  });
});
