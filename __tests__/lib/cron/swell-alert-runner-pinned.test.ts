/**
 * @jest-environment node
 *
 * Follow-ups against the real detector, key resolution and state store, with
 * only the Supabase client faked.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { runSwellAlertCron, type SwellAlertProfile } from "@/lib/cron/swell-alert-runner";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import type { Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

/** Friday 2026-09-18, 10:00 PDT. */
const NOW = new Date("2026-09-18T17:00:00.000Z");
const USER_ID = "73040cff-afe9-4fa0-a874-2016203fc015";
const BEACH_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_KEY = `${BEACH_ID}:W:2026-09-19`;
const LAST_TOLD_AT = "2026-09-18T00:00:00+00:00";
const beach = createMockBeach({
  id: BEACH_ID,
  name: "Blacks Beach",
  slug: "blacks",
  state: "CA",
  timezone: "America/Los_Angeles",
  short_name: "Blacks",
  nws_forecast_zone: null,
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 30,
});
const profile: SwellAlertProfile = {
  id: USER_ID,
  timezone: "America/Los_Angeles",
  homeBeachId: BEACH_ID,
  location: null,
  maxDriveMinutes: null,
  experienceLevel: "advanced",
  notifPushEnabled: true,
  notifSwellAlerts: true,
};

/** Told on Thursday evening: a W 16 s swell peaking Saturday 2026-09-19 at 08:00 PDT. */
const STATE_ROW = {
  user_id: USER_ID,
  event_key: EVENT_KEY,
  beach_id: BEACH_ID,
  last_arrival_at: "2026-09-18T15:00:00+00:00",
  last_peak_at: "2026-09-19T15:00:00+00:00",
  last_face_height_ft: "6.0",
  last_period_s: "16",
  last_direction_deg: "270",
  serious: false,
  last_kind: "coming",
  told_kinds: ["coming"],
  last_told_at: LAST_TOLD_AT,
  last_followup_at: null,
  status: "active",
};

/** Three-hourly rows from 2026-09-15 through 2026-09-27 (PDT), sized per local date. */
function rows(
  heightFor: (localDate: string) => number,
  direction = "270",
): EnhancedForecastEntity[] {
  const out: EnhancedForecastEntity[] = [];
  for (let day = 15; day <= 27; day += 1) {
    const localDate = `2026-09-${String(day).padStart(2, "0")}`;
    for (let hour = 0; hour < 24; hour += 3) {
      out.push({
        id: `${localDate}T${hour}`,
        beach_id: BEACH_ID,
        forecast_at: new Date(Date.UTC(2026, 8, day, hour + 7)).toISOString(),
        swell_1_height: `${heightFor(localDate)} ft`,
        swell_1_period: "16s",
        swell_1_direction: direction,
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
      } as EnhancedForecastEntity);
    }
  }
  return out;
}

interface StateWrite {
  values: Record<string, unknown>;
  filters: Array<[string, unknown]>;
}

function client(args: {
  forecasts: EnhancedForecastEntity[];
  states?: unknown[];
  claimed?: boolean;
}) {
  const stateWrites: StateWrite[] = [];
  const from = jest.fn((table: string) => {
    const filters: Array<[string, unknown]> = [];
    let update: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    for (const method of ["in", "gte", "lt", "order"]) chain[method] = () => chain;
    chain.eq = (column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    };
    chain.update = (values: Record<string, unknown>) => {
      update = values;
      return chain;
    };
    chain.select = () => {
      if (!update) return chain;
      stateWrites.push({ values: update, filters });
      return Promise.resolve({ data: args.claimed === false ? [] : [{ user_id: USER_ID }], error: null });
    };
    chain.maybeSingle = async () => ({ data: table === "beaches" ? beach : null, error: null });
    chain.range = async (first: number, last: number) => {
      if (table === "swell_event_user_state") {
        return { data: first === 0 ? args.states ?? [STATE_ROW] : [], error: null };
      }
      if (table === "swell_event_forecast_snapshots") return { data: [], error: null };
      return { data: args.forecasts.slice(first, last + 1), error: null };
    };
    return chain;
  });
  return { supabase: { from } as unknown as SupabaseClient<Database>, stateWrites, from };
}

async function run(fake: ReturnType<typeof client>) {
  const enqueue = jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" }));
  const result = await runSwellAlertCron({
    now: NOW,
    supabase: fake.supabase,
    deps: {
      isEnabled: () => true,
      isUserAllowed: () => true,
      isFollowupEnabled: () => true,
      isFollowupUserAllowed: () => true,
      loadProfiles: async () => [profile],
      enqueue,
    },
  });
  const payload = enqueue.mock.calls[0]
    ? (enqueue.mock.calls[0] as unknown as [{ payload: Record<string, unknown> }])[0].payload
    : null;
  return { result, enqueue, payload };
}

describe("pinned swell follow-ups on the real detector", () => {
  it("keeps the told key when the peak slips a day and tells the user it moved", async () => {
    // The swell now builds Saturday and peaks Sunday: about a day later than told.
    const fake = client({
      forecasts: rows((date) => (date === "2026-09-19" ? 3 : date === "2026-09-20" ? 5 : 1.5)),
    });

    const { result, payload } = await run(fake);

    expect(result.sentByKind).toEqual({ moved: 1 });
    expect(payload).toMatchObject({
      kind: "moved",
      event_key: EVENT_KEY,
      beach_id: BEACH_ID,
      peak_date: "2026-09-20",
      previous_peak_date: "2026-09-19",
      previous_peak_height_ft: 6,
      peak_period_s: 16,
    });
    expect(payload?.title).toContain("Sunday");
  });

  it("still follows the swell when its peak slips past the key-reuse window", async () => {
    // Two days later than told: resolveEventKeys gives it a new key, the pin does not.
    const fake = client({
      forecasts: rows((date) => (date === "2026-09-21" ? 5 : 1.5)),
    });

    const { result, payload } = await run(fake);

    expect(result.sentByKind).toEqual({ moved: 1 });
    expect(payload).toMatchObject({ event_key: EVENT_KEY, peak_date: "2026-09-21" });
  });

  it("tells the user the swell dropped when it leaves the forecast", async () => {
    const fake = client({ forecasts: rows(() => 1.5) });

    const { result, payload } = await run(fake);

    expect(result.sentByKind).toEqual({ dropped: 1 });
    expect(payload).toMatchObject({
      kind: "dropped",
      event_key: EVENT_KEY,
      peak_date: "2026-09-19",
      peak_height_ft: 6,
    });
    expect(fake.stateWrites[0].values).toMatchObject({ status: "dropped", last_kind: "dropped" });
  });

  it("tells the user the swell dropped when it swings out of the beach's swell window", async () => {
    // Same size and timing as told, now from the south: nothing reaches a west-facing beach.
    const fake = client({
      forecasts: rows((date) => (date === "2026-09-19" ? 5 : 1.5), "180"),
    });

    const { result } = await run(fake);

    expect(result.sentByKind).toEqual({ dropped: 1 });
  });

  it("stays quiet when the forecast still matches what was told", async () => {
    const told = { ...STATE_ROW, last_face_height_ft: "1" };
    const probe = client({ forecasts: rows((date) => (date === "2026-09-19" ? 5 : 1.5)), states: [told] });
    // First learn the face height the detector gives this swell, then pin exactly that.
    const first = await run(probe);
    const faceHeightFt = first.payload?.peak_height_ft as number;
    expect(faceHeightFt).toBeGreaterThanOrEqual(3);

    const fake = client({
      forecasts: rows((date) => (date === "2026-09-19" ? 5 : 1.5)),
      states: [{ ...STATE_ROW, last_face_height_ft: String(faceHeightFt), last_peak_at: first.payload?.forecast_at }],
    });
    const { result, enqueue } = await run(fake);

    expect(result.skippedCounts.followup_no_change).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
    expect(fake.stateWrites).toEqual([]);
  });

  it("never reports missing forecast rows as a dropped swell", async () => {
    const fake = client({ forecasts: [] });

    const { result, enqueue } = await run(fake);

    expect(result.skippedCounts.followup_no_forecast).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("claims the follow-up against the last-told timestamp before enqueueing", async () => {
    const fake = client({ forecasts: rows(() => 1.5) });

    await run(fake);

    expect(fake.stateWrites).toHaveLength(1);
    expect(fake.stateWrites[0].filters).toEqual([
      ["user_id", USER_ID],
      ["event_key", EVENT_KEY],
      ["status", "active"],
      ["last_told_at", LAST_TOLD_AT],
    ]);
    expect(fake.stateWrites[0].values).toMatchObject({
      told_kinds: ["coming", "dropped"],
      last_told_at: NOW.toISOString(),
      last_followup_at: NOW.toISOString(),
    });
  });

  it("sends nothing when the claim finds the row already updated", async () => {
    const fake = client({ forecasts: rows(() => 1.5), claimed: false });

    const { result, enqueue } = await run(fake);

    expect(result.skippedCounts.followup_claim_lost).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("writes nothing to swell_event_alerts for a follow-up", async () => {
    const fake = client({ forecasts: rows(() => 1.5) });

    await run(fake);

    expect(fake.from.mock.calls.map(([table]) => table)).not.toContain("swell_event_alerts");
  });

  it("ignores a stored row it cannot read", async () => {
    const fake = client({
      forecasts: rows(() => 1.5),
      states: [{ ...STATE_ROW, last_peak_at: null }, { ...STATE_ROW, last_kind: "exploded" }],
    });

    const { result, enqueue } = await run(fake);

    expect(result.followupsEvaluated).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
