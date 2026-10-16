/** @jest-environment node */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSwellDispatchEligibility } from "@/lib/alerts/swell-outlook/dispatch-eligibility";
import type { Database } from "@/types/database";

const NOW = new Date("2026-10-14T18:00:00.000Z");
const HAWAII = { lat: 21.28, lon: -157.83 };
const SOCAL = { lat: 32.89, lon: -117.25 };

function client(options: {
  fix?: { lat: number; lon: number; captured_at: string } | null;
  home?: { lat: number; lon: number } | null;
  beach?: { lat: number; lon: number; deleted_at: string | null } | null;
  profileError?: boolean;
  beachError?: boolean;
} = {}): SupabaseClient<Database> {
  return { from: jest.fn((table: string) => {
    const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockImplementation(async () => table === "profiles"
      ? { data: { max_drive_minutes: 60, user_location_snapshots: options.fix === undefined
        ? [{ ...HAWAII, captured_at: NOW.toISOString() }] : options.fix,
        home_beach: options.home === undefined ? SOCAL : options.home },
        error: options.profileError ? { message: "profile read failed" } : null }
      : { data: options.beach === undefined ? { ...HAWAII, deleted_at: null } : options.beach,
        error: options.beachError ? { message: "beach read failed" } : null });
    return query;
  }) } as unknown as SupabaseClient<Database>;
}

const payload = { beach_id: "ffffffff-0000-4000-8000-000000000001", forecast_at: "2026-10-15T18:00:00.000Z" };
const resolve = (supabase: SupabaseClient<Database>, override: Record<string, unknown> = {}) =>
  resolveSwellDispatchEligibility({ supabase, userId: "user-1", payload: { ...payload, ...override }, now: NOW });

describe("swell dispatch eligibility", () => {
  it("starts the profile and lead-beach reads before either completes", async () => {
    const started: string[] = [];
    let releaseProfile!: () => void;
    const profileRead = new Promise((resolveProfile) => {
      releaseProfile = () => resolveProfile({ data: { max_drive_minutes: 60,
        user_location_snapshots: [{ ...HAWAII, captured_at: NOW.toISOString() }], home_beach: SOCAL }, error: null });
    });
    const supabase = { from: jest.fn((table: string) => {
      const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.maybeSingle.mockImplementation(() => {
        started.push(table);
        return table === "profiles" ? profileRead : Promise.resolve({ data: { ...HAWAII, deleted_at: null }, error: null });
      });
      return query;
    }) } as unknown as SupabaseClient<Database>;
    const decision = resolve(supabase);
    const readsBeforeProfileCompleted = [...started];
    releaseProfile();
    expect(await decision).toEqual({ allowed: true });
    expect(readsBeforeProfileCompleted).toEqual(["profiles", "beaches"]);
  });

  it("uses a fresh Hawaii fix instead of the SoCal home beach", async () => {
    expect(await resolve(client())).toEqual({ allowed: true });
    expect(await resolve(client({ beach: { ...SOCAL, deleted_at: null } })))
      .toEqual({ allowed: false, reasonCode: "out_of_range" });
  });

  it("falls back to home after 24 hours and suppresses without either anchor", async () => {
    const stale = { ...HAWAII, captured_at: new Date(NOW.getTime() - 25 * 3_600_000).toISOString() };
    expect(await resolve(client({ fix: stale, beach: { ...SOCAL, deleted_at: null } })))
      .toEqual({ allowed: true });
    expect(await resolve(client({ fix: stale, home: null })))
      .toEqual({ allowed: false, reasonCode: "no_location_anchor" });
  });

  it("suppresses missing and deleted lead beaches", async () => {
    expect(await resolve(client({ beach: null }))).toEqual({ allowed: false, reasonCode: "beach_unavailable" });
    expect(await resolve(client({ beach: { ...HAWAII, deleted_at: NOW.toISOString() } })))
      .toEqual({ allowed: false, reasonCode: "beach_unavailable" });
  });

  it("expires a recommended window using its end, even when forecast_at is future", async () => {
    expect(await resolve(client(), { surf_window: { state: "recommended", end: "2026-10-14T17:00:00.000Z" } }))
      .toEqual({ allowed: false, reasonCode: "window_expired" });
    expect(await resolve(client(), { surf_window: { state: "recommended", end: "2026-10-14T19:00:00.000Z" }, forecast_at: "2026-10-13T18:00:00.000Z" }))
      .toEqual({ allowed: true });
  });

  it("expires a revised follow-up window after its peak and before its queued push dispatches", async () => {
    expect(await resolve(client(), { kind: "bigger", forecast_at: "2026-10-14T16:00:00.000Z",
      surf_window: { state: "recommended", start: "2026-10-14T14:00:00.000Z", end: "2026-10-14T17:00:00.000Z" } }))
      .toEqual({ allowed: false, reasonCode: "window_expired" });
    expect(await resolve(client(), { kind: "moved", forecast_at: "2026-10-14T16:00:00.000Z",
      surf_window: { state: "recommended", start: "2026-10-14T18:00:00.000Z", end: "2026-10-14T20:00:00.000Z" } }))
      .toEqual({ allowed: true });
  });

  it.each([undefined, "coming", "bigger", "smaller", "moved"])("passes a %s forecast only while future", async (kind) => {
    expect(await resolve(client(), { kind, forecast_at: "2026-10-14T17:00:00.000Z" }))
      .toEqual({ allowed: false, reasonCode: "forecast_passed" });
  });

  it("throws on database read errors for the worker to fail closed", async () => {
    await expect(resolve(client({ profileError: true }))).rejects.toThrow("profile read failed");
    await expect(resolve(client({ beachError: true }))).rejects.toThrow("beach read failed");
  });
});
