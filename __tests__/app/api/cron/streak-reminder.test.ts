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
}

interface Filter {
  op: "eq" | "lte" | "gte" | "lt" | "in" | "is";
  column: string;
  value: unknown;
}

const tableState: Record<string, TableState> = {};
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
  builder.order = jest.fn(() => builder);
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
    const resolved = {
      data: applyFilters(row.rows, filters),
      error: row.selectError ?? null,
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
