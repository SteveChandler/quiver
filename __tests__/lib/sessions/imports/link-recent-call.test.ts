/** @jest-environment node */
jest.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { linkRecentCall } from "@/lib/sessions/imports/link-recent-call";

const arrivalTime = "2026-10-18T12:00:00Z";
const input = { userId: "user-1", sessionId: "session-1", beachId: "beach-1", arrivalTime };
type Row = Record<string, any>;

function service(events: Row[], session: Row, failTable?: string): SupabaseClient {
  return { from: (table: string) => {
    let mode = "select";
    let update: Row = {};
    const predicates: Array<(row: Row) => boolean> = [];
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { predicates.push(row => row[key] === value); return query; },
      is: (key: string, value: unknown) => { predicates.push(row => (row[key] ?? null) === value); return query; },
      gte: (key: string, value: string) => { predicates.push(row => row[key] >= value); return query; },
      lte: (key: string, value: string) => { predicates.push(row => row[key] <= value); return query; },
      order: () => query,
      limit: () => query,
      update: (values: Row) => { mode = "update"; update = values; return query; },
      maybeSingle: async () => {
        const result = await query;
        return { ...result, data: result.data?.[0] ?? null };
      },
      then: (resolve: (value: unknown) => void) => {
        if (table === failTable) return Promise.resolve({ data: null, error: { message: "db failed" } }).then(resolve);
        const rows = (table === "user_events" ? events : [session]).filter(row => predicates.every(test => test(row)));
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

it("links the newest qualifying exposure and ignores wrong beach, age, and forecast offset", async () => {
  const session = { id: "session-1", user_id: "user-1", call_id: null };
  const events = [
    exposure("wrong-beach", "2026-10-18T11:55:00Z", arrivalTime, "beach-2"),
    exposure("wrong-forecast", "2026-10-18T11:50:00Z", "2026-10-18T08:00:00Z"),
    exposure("newest-valid", "2026-10-18T11:30:00Z", "2026-10-18T10:00:00Z"),
    exposure("older-valid", "2026-10-18T09:00:00Z", arrivalTime),
    exposure("too-old", "2026-10-16T23:00:00Z", arrivalTime),
  ];
  expect(await linkRecentCall(service(events, session), input)).toBe("newest-valid");
  expect(session.call_id).toBe("newest-valid");
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
