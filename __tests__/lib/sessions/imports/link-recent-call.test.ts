/** @jest-environment node */
jest.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { linkRecentCall } from "@/lib/sessions/imports/link-recent-call";

const arrivalTime = "2026-10-18T12:00:00Z";
const input = { userId: "user-1", sessionId: "session-1", beachId: "beach-1", arrivalTime };
type Row = Record<string, any>;

function service(events: Row[], session: Row, failTable?: string, otherSessions: Row[] = []): SupabaseClient {
  return { from: (table: string) => {
    let mode = "select";
    let update: Row = {};
    let ordering: { key: string; ascending: boolean } | undefined;
    let rowLimit: number | undefined;
    const predicates: Array<(row: Row) => boolean> = [];
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { predicates.push(row => row[key] === value); return query; },
      neq: (key: string, value: unknown) => { predicates.push(row => row[key] !== value); return query; },
      in: (key: string, values: unknown[]) => { predicates.push(row => values.includes(row[key])); return query; },
      is: (key: string, value: unknown) => { predicates.push(row => (row[key] ?? null) === value); return query; },
      gte: (key: string, value: string) => { predicates.push(row => row[key] >= value); return query; },
      lte: (key: string, value: string) => { predicates.push(row => row[key] <= value); return query; },
      order: (key: string, options: { ascending: boolean }) => { ordering = { key, ...options }; return query; },
      limit: (count: number) => { rowLimit = count; return query; },
      update: (values: Row) => { mode = "update"; update = values; return query; },
      maybeSingle: async () => {
        const result = await query;
        return { ...result, data: result.data?.[0] ?? null };
      },
      then: (resolve: (value: unknown) => void) => {
        if (table === failTable) return Promise.resolve({ data: null, error: { message: "db failed" } }).then(resolve);
        let rows = (table === "user_events" ? events : [session, ...otherSessions]).filter(row => predicates.every(test => test(row)));
        if (ordering) {
          const { key, ascending } = ordering;
          rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1));
        }
        if (rowLimit !== undefined) rows = rows.slice(0, rowLimit);
        if (mode === "update") rows.forEach(row => Object.assign(row, update));
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return query;
  } } as unknown as SupabaseClient;
}

const exposure = (callId: string, createdAt: string, forecastAt: string, beachId = "beach-1"): Row => ({
  user_id: "user-1", beach_id: beachId, event_type: "board_pick_exposed", created_at: createdAt,
  metadata: { call_id: callId, forecast_at: forecastAt, is_personal: true },
});

it("only considers the 50 newest exposures even if an older forecast is nearer", async () => {
  const session = { id: "session-1", user_id: "user-1", call_id: null };
  const arrivalMs = Date.parse(arrivalTime);
  const recent = Array.from({ length: 50 }, (_, index) => exposure(
    `recent-${index}`, new Date(arrivalMs - (index + 1) * 60000).toISOString(), "2026-10-18T13:00:00Z",
  ));
  const oldest = exposure("outside-limit", new Date(arrivalMs - 51 * 60000).toISOString(), arrivalTime);
  expect(await linkRecentCall(service([oldest, ...recent], session), input)).toBe("recent-0");
  expect(session.call_id).toBe("recent-0");
});

it("links the nearest forecast instead of the newest exposure and ignores wrong beach, age, and forecast offset", async () => {
  const session = { id: "session-1", user_id: "user-1", call_id: null };
  const events = [
    exposure("wrong-beach", "2026-10-18T11:55:00Z", arrivalTime, "beach-2"),
    exposure("wrong-forecast", "2026-10-18T11:50:00Z", "2026-10-18T08:00:00Z"),
    exposure("newest-valid", "2026-10-18T11:30:00Z", "2026-10-18T10:00:00Z"),
    exposure("older-valid", "2026-10-18T09:00:00Z", arrivalTime),
    exposure("too-old", "2026-10-16T23:00:00Z", arrivalTime),
  ];
  expect(await linkRecentCall(service(events, session), input)).toBe("older-valid");
  expect(session.call_id).toBe("older-valid");
});

it("skips a call linked to another session of the same user", async () => {
  const session = { id: "session-1", user_id: "user-1", call_id: null };
  const events = [
    exposure("used", "2026-10-18T11:30:00Z", arrivalTime),
    exposure("available", "2026-10-18T11:00:00Z", "2026-10-18T13:00:00Z"),
  ];
  const otherSessions = [
    { id: "session-2", user_id: "user-1", call_id: "used" },
    { id: "other-user-session", user_id: "user-2", call_id: "available" },
  ];
  expect(await linkRecentCall(service(events, session, undefined, otherSessions), input)).toBe("available");
  expect(session.call_id).toBe("available");
  expect(otherSessions[0].call_id).toBe("used");
});

it("ignores non-personal exposures and exposures created after arrival", async () => {
  const session = { id: "session-1", user_id: "user-1", call_id: null };
  const nonPersonal = exposure("non-personal", "2026-10-18T11:00:00Z", arrivalTime);
  nonPersonal.metadata.is_personal = false;
  const events = [exposure("future", "2026-10-18T12:00:01Z", arrivalTime), nonPersonal];
  expect(await linkRecentCall(service(events, session), input)).toBeNull();
  expect(session.call_id).toBeNull();
});

it.each(["2026-10-18T09:00:00Z", "2026-10-18T15:00:00Z"])("includes exact 36-hour exposure and 3-hour forecast boundaries (%s)", async forecastAt => {
  const session = { id: "session-1", user_id: "user-1", call_id: null };
  const events = [exposure("boundary", "2026-10-17T00:00:00.000Z", forecastAt)];
  expect(await linkRecentCall(service(events, session), input)).toBe("boundary");
  expect(session.call_id).toBe("boundary");
});

it("preserves an existing session call", async () => {
  const session = { id: "session-1", user_id: "user-1", call_id: "existing" };
  expect(await linkRecentCall(service([exposure("candidate", "2026-10-18T11:00:00Z", arrivalTime)], session), input)).toBeNull();
  expect(session.call_id).toBe("existing");
});

it("warns and returns null if the lookup fails", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    expect(await linkRecentCall(service([], { id: "session-1", user_id: "user-1", call_id: null }, "user_events"), input)).toBeNull();
    expect(warn).toHaveBeenCalled();
  } finally { warn.mockRestore(); }
});
