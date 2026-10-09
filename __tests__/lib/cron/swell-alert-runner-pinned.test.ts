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
import { row } from "@/__tests__/helpers/swell-events";
import { detectBeachSwellEvents, toSwellEventBeach, toSwellEventSnapshotRow, type SwellEventSnapshot } from "@/lib/alerts/swell-events";
import { buildSwellOutlook } from "@/lib/services/discovery/swell-outlook";
import type { SwellFollowupDeps } from "@/lib/cron/swell-alert-runner";

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
  snapshots?: unknown[];
}) {
  const stateWrites: StateWrite[] = [];
  const from = jest.fn((table: string) => {
    const filters: Array<[string, unknown]> = [];
    let update: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    for (const method of ["in", "or", "gte", "lt", "order"]) chain[method] = () => chain;
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
      if (table === "swell_event_forecast_snapshots") {
        return { data: first === 0 ? args.snapshots ?? [] : [], error: null };
      }
      return { data: args.forecasts.slice(first, last + 1), error: null };
    };
    return chain;
  });
  return { supabase: { from } as unknown as SupabaseClient<Database>, stateWrites, from };
}

async function run(
  fake: ReturnType<typeof client>,
  now: Date = NOW,
  deps: NonNullable<Parameters<typeof runSwellAlertCron>[0]["deps"]> = {},
) {
  const enqueue = jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" }));
  const result = await runSwellAlertCron({
    now,
    supabase: fake.supabase,
    deps: {
      isEnabled: () => true,
      isUserAllowed: () => true,
      isFollowupEnabled: () => true,
      isFollowupUserAllowed: () => true,
      loadProfiles: async () => [profile],
      enqueue,
      ...deps,
    },
  });
  const payload = enqueue.mock.calls[0]
    ? (enqueue.mock.calls[0] as unknown as [{ payload: Record<string, unknown> }])[0].payload
    : null;
  return { result, enqueue, payload };
}

describe("pinned swell follow-ups on the real detector", () => {
  const oct6 = new Date("2026-10-06T15:24:00.000Z");
  const saturdayKey = `${BEACH_ID}:W:2026-10-11`;

  function octoberForecasts(): EnhancedForecastEntity[] {
    return Array.from({ length: 14 * 8 }, (_, index) => {
      const at = new Date(Date.UTC(2026, 9, 3, index * 3)).toISOString();
      return { ...row(at, {
        heightFt: at === "2026-10-10T15:00:00.000Z" ? 3.2 : at.startsWith("2026-10-10") ? 2.8 : 0.5,
        periodS: 14, direction: 270,
      }), beach_id: BEACH_ID } as EnhancedForecastEntity;
    });
  }

  function saturdayEvent(forecasts: EnhancedForecastEntity[]) {
    const events = detectBeachSwellEvents({ beach: toSwellEventBeach(beach), forecasts, now: oct6, timezone: profile.timezone });
    expect(events).toHaveLength(1);
    expect(events[0].peakAt).toBe("2026-10-10T15:00:00.000Z");
    return { ...events[0], eventKey: saturdayKey };
  }

  async function firstOctoberSighting() {
    const forecasts = octoberForecasts();
    const event = saturdayEvent(forecasts);
    const notable: SwellEventSnapshot = {
      ...event, detectorVersion: "swell-events.v1", runDate: "2026-10-06", detectedAt: "2026-10-06T14:30:00.000Z",
      crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
    };
    const pulse = { ...notable, eventKey: `${BEACH_ID}:W:2026-10-09:p`, detectorVersion: "swell-outlook-pulse.v1",
      peakAt: "2026-10-10T00:00:00.000Z", peakFaceHeightFt: event.peakFaceHeightFt * 0.8, periodS: 15 };
    const swells = buildSwellOutlook({
      pool: [{ beach, relation: "home" }], homeBeachId: BEACH_ID,
      pulseSnapshots: [pulse], notableSnapshots: [notable], forecastsByBeach: new Map(), previous: null,
      skillLevel: "intermediate", boardClasses: [], storms: [], now: oct6,
    }).response.swells;
    const saveFirstTold = jest.fn<ReturnType<SwellFollowupDeps["saveFirstTold"]>, Parameters<SwellFollowupDeps["saveFirstTold"]>>(async () => undefined);
    const first = await run(client({ forecasts, states: [] }), oct6, {
      isOutlookEnabled: () => true, isOutlookUserAllowed: () => true,
      loadOutlook: async () => swells, loadEngagement: async () => null, saveEngagement: async () => undefined,
      getTier: async () => "premium", hasFirstSightingAlert: async () => false,
      insertAlert: async () => ({ id: "first-alert" }), markAlertEnqueued: async () => undefined,
      loadFirstSightingHazard: async () => null, loadBeachDistancesKm: async () => new Map(), saveFirstTold,
    });
    expect(first.result.errors).toBe(0);
    expect(first.result.sentByKind).toEqual({ coming: 1 });
    expect(saveFirstTold).toHaveBeenCalledTimes(1);
    const { eventKey, told } = saveFirstTold.mock.calls[0][0];
    const state = { ...STATE_ROW, event_key: eventKey, last_arrival_at: told.arrivalAt, last_peak_at: told.peakAt,
      last_face_height_ft: String(told.faceHeightFt), last_period_s: String(told.periodS),
      last_direction_deg: String(told.directionDeg), last_told_at: told.toldAt };
    return { first, state, forecasts, event };
  }

  it("produces no moved follow-up one hour after the Oct 6 first sighting with unchanged forecasts", async () => {
    const { state, forecasts, event } = await firstOctoberSighting();
    const fake = client({ forecasts, states: [state], snapshots: [toSwellEventSnapshotRow(event, oct6)] });
    const next = await run(fake, new Date("2026-10-06T16:24:00.000Z"));
    expect(next.result.errors).toBe(0);
    expect(next.result.skippedCounts.followup_no_change).toBe(1);
    expect(next.enqueue).not.toHaveBeenCalled();
    expect(fake.stateWrites).toEqual([]);
  });

  it("does not drop the Saturday swell on Oct 8 when it is still forecast under :W:2026-10-11", async () => {
    const { state, forecasts, event } = await firstOctoberSighting();
    const oct8 = new Date("2026-10-08T15:24:00.000Z");
    const fake = client({ forecasts, states: [{ ...state, event_key: `${BEACH_ID}:W:2026-10-07` }],
      snapshots: [toSwellEventSnapshotRow(event, oct8)] });
    const next = await run(fake, oct8);
    expect(next.result.errors).toBe(0);
    expect(next.result.skippedCounts.followup_no_change).toBe(1);
    expect(next.enqueue).not.toHaveBeenCalled();
    expect(fake.stateWrites).toEqual([]);
  });

  it("saves the same notable swell described by the first-sighting payload's key, date, height and period", async () => {
    const { first, state, event } = await firstOctoberSighting();
    expect(first.payload).toMatchObject({
      event_key: saturdayKey, peak_date: "2026-10-10", forecast_at: event.peakAt, peak_period_s: event.periodS,
      peak_height_ft: Number(state.last_face_height_ft),
    });
    expect(state).toMatchObject({ event_key: saturdayKey, last_peak_at: event.peakAt, last_period_s: String(event.periodS) });
    expect(first.payload?.body).toContain("Saturday morning");
  });

  it("never turns a Todos Santos 1.5 ft @ 10 s pin into a different 3 ft @ 11 s swell two days later", async () => {
    const forecasts = octoberForecasts().map((forecast) => ({ ...forecast, swell_1_period: "11s" }));
    const event = detectBeachSwellEvents({ beach: toSwellEventBeach(beach), forecasts, now: oct6, timezone: profile.timezone })[0];
    expect(event.peakFaceHeightFt).toBeGreaterThan(1.5 * 1.5);
    const fake = client({ forecasts, states: [{ ...STATE_ROW,
      event_key: `${BEACH_ID}:W:2026-10-07`, last_peak_at: "2026-10-09T03:00:00.000Z",
      last_arrival_at: "2026-10-07T15:00:00.000Z", last_face_height_ft: "1.5", last_period_s: "10",
      last_told_at: oct6.toISOString(),
    }], snapshots: [toSwellEventSnapshotRow({ ...event, eventKey: saturdayKey, peakAt: "2026-10-09T00:00:00.000Z" }, oct6)] });
    const next = await run(fake, new Date("2026-10-06T16:24:00.000Z"));
    expect(next.result.sentByKind).toEqual({ dropped: 1 });
    expect(next.enqueue).toHaveBeenCalledTimes(1);
  });

  it("sends exactly one moved for a genuine one-day peak shift of the same direction, period and size", async () => {
    const { state, forecasts, event } = await firstOctoberSighting();
    const shifted = forecasts.map((forecast) => ({ ...forecast,
      forecast_at: new Date(Date.parse(forecast.forecast_at) + 24 * 3_600_000).toISOString() }));
    const fake = client({ forecasts: shifted, states: [state], snapshots: [toSwellEventSnapshotRow(event, oct6)] });
    const moved = await run(fake, new Date("2026-10-07T15:24:00.000Z"));
    expect(moved.result.errors).toBe(0);
    expect(moved.result.sentByKind).toEqual({ moved: 1 });
    expect(moved.enqueue).toHaveBeenCalledTimes(1);
    expect(moved.payload).toMatchObject({ kind: "moved", event_key: saturdayKey,
      peak_date: "2026-10-11", previous_peak_date: "2026-10-10", peak_period_s: 14 });
    expect(fake.stateWrites).toHaveLength(1);
    const next = await run(client({ forecasts: shifted, states: [{ ...state, ...fake.stateWrites[0].values }],
      snapshots: [toSwellEventSnapshotRow(event, oct6)] }), new Date("2026-10-08T16:24:00.000Z"));
    expect(next.result.skippedCounts.followup_no_change).toBe(1);
    expect(next.enqueue).not.toHaveBeenCalled();
  });

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

  it("follows a matching component and size even when snapshots track it under another key", async () => {
    const fake = client({
      forecasts: rows((date) => (date === "2026-09-21" ? 5 : 1.5)),
      snapshots: [{
        beach_id: BEACH_ID, event_key: `${BEACH_ID}:W:2026-09-21`, detector_version: "swell-events.v1",
        run_date: "2026-09-17", detected_at: "2026-09-17T14:30:00+00:00", direction_deg: 270, direction_band: "W",
        period_s: 16, peak_offshore_height_ft: 5, peak_face_height_ft: 6, exposure: 1, energy_ratio: 9,
        arrival_at: "2026-09-20T15:00:00+00:00", peak_at: "2026-09-21T15:00:00+00:00", fade_at: null,
      }],
    });

    const { result, payload } = await run(fake);

    expect(result.sentByKind).toEqual({ moved: 1 });
    expect(payload).toMatchObject({ kind: "moved", event_key: EVENT_KEY, peak_date: "2026-09-21" });
  });

  it("does not call a swell twice the told size the told swell moved", async () => {
    // Told a small pulse; the only swell left is a much bigger one two days later.
    const fake = client({
      forecasts: rows((date) => (date === "2026-09-21" ? 5 : 1.5)),
      states: [{ ...STATE_ROW, last_face_height_ft: "1.5" }],
    });

    const { result, payload } = await run(fake);

    expect(result.sentByKind).toEqual({ dropped: 1 });
    expect(payload).toMatchObject({ kind: "dropped", peak_date: "2026-09-19" });
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
    const forecasts = rows((date) => (date === "2026-09-19" ? 5 : 1.5));
    const events = detectBeachSwellEvents({ beach: toSwellEventBeach(beach), forecasts, now: NOW, timezone: profile.timezone });
    expect(events).toHaveLength(1);
    const fake = client({
      forecasts,
      states: [{ ...STATE_ROW, last_face_height_ft: String(events[0].peakFaceHeightFt), last_peak_at: events[0].peakAt }],
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
