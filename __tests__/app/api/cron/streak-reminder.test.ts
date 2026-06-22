/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET as dailyGet } from "@/app/api/cron/daily-call-streak-reminder/route";
import { GET as weeklyGet } from "@/app/api/cron/weekly-streak-reminder/route";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

const mockEnqueueNotification = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn((table: string) => buildQuery(table));

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

interface TableState {
  rows: Array<Record<string, unknown>>;
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
}

interface Filter {
  op: "eq" | "lte" | "gte";
  column: string;
  value: unknown;
}

const tableState: Record<string, TableState> = {};
const originalAllowlist = process.env.STREAK_REMINDER_TEST_USER_IDS;

function applyFilters(
  rows: Array<Record<string, unknown>>,
  filters: Filter[]
): Array<Record<string, unknown>> {
  return rows.filter((row) =>
    filters.every((filter) => {
      const value = row[filter.column];
      if (filter.op === "eq") return value === filter.value;
      if (filter.op === "lte") return String(value) <= String(filter.value);
      return String(value) >= String(filter.value);
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
  jest.useFakeTimers().setSystemTime(new Date("2026-06-22T12:00:00.000Z"));
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
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
});

describe("streak reminder registry entries", () => {
  it("registers daily and weekly push types behind notif_reminders with quiet hours", () => {
    const daily = NOTIFICATION_REGISTRY.daily_call_streak_reminder;
    const weekly = NOTIFICATION_REGISTRY.weekly_streak_reminder;

    expect(daily.channels).toEqual(["push"]);
    expect(daily.prefs.master.push).toBe("notif_push_enabled");
    expect(daily.prefs.perType.push).toBe("notif_reminders");
    expect(daily.quietHours.mode).toBe("defer");

    expect(weekly.channels).toEqual(["push"]);
    expect(weekly.prefs.master.push).toBe("notif_push_enabled");
    expect(weekly.prefs.perType.push).toBe("notif_reminders");
    expect(weekly.quietHours.mode).toBe("defer");
  });

  it("builds the daily reminder push payload", () => {
    const payload = NOTIFICATION_REGISTRY.daily_call_streak_reminder.buildPushPayload!({
      streak: 4,
    });

    expect(payload).toMatchObject({
      title: "Don't break your streak",
      body: "You're on a 4-day call streak. Make today's call before midnight.",
      data: { type: "daily_call_streak_reminder", streak: 4 },
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

describe("daily-call-streak-reminder cron", () => {
  it("selects only enabled users with a current 2+ day streak and no call today", async () => {
    seed("profiles", [
      { id: "u-active", notif_reminders: true },
      { id: "u-today", notif_reminders: true },
      { id: "u-off", notif_reminders: false },
      { id: "u-logged", notif_reminders: null },
      { id: "u-short", notif_reminders: true },
    ]);
    seed("streak_reminder_log", [
      {
        user_id: "u-logged",
        reminder_type: "daily_call_streak",
        period_key: "2026-06-22",
      },
    ]);
    seed("daily_calls", [
      { user_id: "u-active", call_date: "2026-06-20" },
      { user_id: "u-active", call_date: "2026-06-21" },
      { user_id: "u-today", call_date: "2026-06-20" },
      { user_id: "u-today", call_date: "2026-06-21" },
      { user_id: "u-today", call_date: "2026-06-22" },
      { user_id: "u-off", call_date: "2026-06-20" },
      { user_id: "u-off", call_date: "2026-06-21" },
      { user_id: "u-logged", call_date: "2026-06-20" },
      { user_id: "u-logged", call_date: "2026-06-21" },
      { user_id: "u-short", call_date: "2026-06-21" },
    ]);

    const response = await dailyGet(mockRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.summary.candidates).toBe(1);
    expect(body.data.summary.sent).toBe(1);
    expect(body.data.summary.skipped).toMatchObject({
      remindersDisabled: 1,
      alreadyLogged: 1,
      alreadyActedToday: 1,
      streakTooShort: 1,
    });
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification).toHaveBeenCalledWith({
      type: "daily_call_streak_reminder",
      recipientUserId: "u-active",
      payload: { streak: 2 },
      dedupeKey: "daily_call_streak:u-active:2026-06-22",
    });
    expect(mockInsert).toHaveBeenCalledWith("streak_reminder_log", {
      user_id: "u-active",
      reminder_type: "daily_call_streak",
      period_key: "2026-06-22",
    });
  });

  it("caps first send to STREAK_REMINDER_TEST_USER_IDS when set", async () => {
    process.env.STREAK_REMINDER_TEST_USER_IDS = "u-other";
    seed("profiles", [{ id: "u-active", notif_reminders: true }]);
    seed("streak_reminder_log", []);
    seed("daily_calls", [
      { user_id: "u-active", call_date: "2026-06-20" },
      { user_id: "u-active", call_date: "2026-06-21" },
    ]);

    const response = await dailyGet(mockRequest());
    const body = await response.json();

    expect(body.data.candidates).toBe(0);
    expect(body.data.summary.candidates).toBe(1);
    expect(body.data.summary.skipped.notInTestAllowlist).toBe(1);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("STREAK_REMINDER_TEST_USER_IDS active")
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
      payload: { streak: 2 },
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
