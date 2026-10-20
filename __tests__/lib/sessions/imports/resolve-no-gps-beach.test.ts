/** @jest-environment node */

import type { SupabaseClient } from "@supabase/supabase-js";
import { rankNoGpsCandidates, resolveNoGpsBeach } from "@/lib/sessions/imports/resolve-no-gps-beach";

const start = "2026-08-15T12:00:00.000Z";
const end = "2026-08-15T13:40:00.000Z";
const beaches = [
  { id: "a", name: "A", lat: 34, lon: -119, swell_window_center_deg: 270 },
  { id: "b", name: "B", lat: 34.0001, lon: -119, swell_window_center_deg: null },
  { id: "c", name: "C", lat: 35, lon: -120, swell_window_center_deg: null },
];
let sessions: Array<Record<string, unknown>>;
let snapshot: Record<string, unknown> | null;
let nearby: Array<Record<string, unknown>>;
let homeBeachId: string | null;
let rpc: jest.Mock;
let from: jest.Mock;

function service(): SupabaseClient {
  rpc = jest.fn(async () => ({ data: nearby, error: null }));
  from = jest.fn((table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const query: Record<string, unknown> = {};
    for (const method of ["select", "order", "limit"] as const) query[method] = () => query;
    query.eq = (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; };
    query.is = (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return query; };
    query.gte = (key: string, value: string) => { filters.push(row => String(row[key]) >= value); return query; };
    query.lte = (key: string, value: string) => { filters.push(row => String(row[key]) <= value); return query; };
    query.in = (key: string, ids: string[]) => { filters.push(row => ids.includes(String(row[key]))); return query; };
    const result = () => {
      const data: Array<Record<string, unknown>> = table === "sessions" ? sessions
        : table === "user_location_snapshots" ? snapshot ? [snapshot] : []
          : table === "profiles" ? [{ id: "user", home_beach_id: homeBeachId }]
            : table === "beaches" ? beaches : [];
      return { data: data.filter(row => filters.every(filter => filter(row))), error: null };
    };
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    query.maybeSingle = async () => ({ ...result(), data: result().data[0] ?? null });
    return query;
  });
  return { from, rpc } as unknown as SupabaseClient;
}

beforeEach(() => {
  sessions = [];
  snapshot = { user_id: "user", lat: 34, lon: -119, captured_at: start };
  nearby = [{ ...beaches[0], distance_meters: 0 }];
  homeBeachId = null;
});

it("prefers the closest logged session at any beach over the phone", async () => {
  sessions = [{ id: "farther", user_id: "user", beach_id: "a",
    arrival_time: "2026-08-15T12:45:00.000Z" },
  { id: "logged", user_id: "user", beach_id: "c", arrival_time: start }];
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toMatchObject({
    status: "resolved", source: "logged_session", beach: { id: "c" },
    attachTarget: { sessionId: "logged", beachId: "c", hasTrack: false },
  });
  expect(rpc).not.toHaveBeenCalled();
});

it.each(["garmin_watch", "file_import"])("does not treat a %s session as an app-logged surf", async source => {
  sessions = [{ id: "imported", user_id: "user", beach_id: "c", arrival_time: start, source }];
  snapshot = null;
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toEqual({
    status: "needs_beach", candidates: [],
  });
  expect(from).not.toHaveBeenCalledWith("session_tracks");
});

it("resolves one beach from a snapshot ten minutes before the surf", async () => {
  snapshot = { user_id: "user", lat: 34, lon: -119,
    captured_at: new Date(Date.parse(start) - 10 * 60_000).toISOString() };
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toMatchObject({
    status: "resolved", source: "phone_location", beach: { id: "a" }, attachTarget: null,
  });
  expect(rpc).toHaveBeenCalledWith("get_nearby_beaches", {
    input_lat: 34, input_lng: -119, max_distance_meters: 1500, limit_count: 3,
  });
});

it("asks the user when two beaches are within 1500 m, even when one is closer", async () => {
  nearby = [{ ...beaches[0], lat: 34.0001 }, { ...beaches[1], lat: 34.001 }];
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toMatchObject({
    status: "needs_beach", candidates: [{ id: "a" }, { id: "b" }],
  });
});

it("keeps a snapshot from 90 minutes before the surf as the first candidate without auto-picking", async () => {
  snapshot = { user_id: "user", lat: 34, lon: -119,
    captured_at: new Date(Date.parse(start) - 90 * 60_000).toISOString() };
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toMatchObject({
    status: "needs_beach", candidates: [{ id: "a" }],
  });
});

it("asks the user when two beaches are similarly close", async () => {
  snapshot = { user_id: "user", lat: 34.00005, lon: -119, captured_at: start };
  nearby = beaches.slice(0, 2);
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toMatchObject({
    status: "needs_beach", candidates: [{ id: "a" }, { id: "b" }],
  });
});

it("asks the user when two beaches share the rounded phone point", async () => {
  nearby = [{ ...beaches[0] }, { ...beaches[1], lat: 34 }];
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toMatchObject({
    status: "needs_beach", candidates: [{ id: "a" }, { id: "b" }],
  });
});

it.each(["old", "missing"])("ignores an %s phone snapshot", async kind => {
  snapshot = kind === "old" ? { user_id: "user", lat: 34, lon: -119,
    captured_at: "2026-08-15T09:59:59.000Z" } : null;
  const client = service();
  await expect(resolveNoGpsBeach(client, "user", start, start, end)).resolves.toEqual({
    status: "needs_beach", candidates: [],
  });
  expect(rpc).not.toHaveBeenCalled();
});

it("ranks phone beaches, the most-surfed recent beach, and home beach without duplicates", async () => {
  snapshot = { user_id: "user", lat: 34, lon: -119,
    captured_at: new Date(Date.parse(start) - 90 * 60_000).toISOString() };
  nearby = beaches.slice(0, 2);
  sessions = [{ user_id: "user", beach_id: "c", arrival_time: start, status: "completed" },
    { user_id: "user", beach_id: "c", arrival_time: end, status: "completed" },
    { user_id: "user", beach_id: "a", arrival_time: end, status: "completed" }];
  homeBeachId = "a";
  const client = service();
  const ranked = await rankNoGpsCandidates(client, "user", start, end, new Date("2026-08-16T00:00:00Z"));
  expect(ranked.map(beach => beach.id)).toEqual(["a", "b", "c"]);
});
