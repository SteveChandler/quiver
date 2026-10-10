/**
 * @jest-environment node
 */

jest.mock("@/lib/alerts/sunrise", () => {
  const actual = jest.requireActual("@/lib/alerts/sunrise");
  return { ...actual, getDaylightWindow: jest.fn(actual.getDaylightWindow) };
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadUserPool, type PoolBeach } from "@/lib/alerts/user-pool";
import * as sunrise from "@/lib/alerts/sunrise";
import type { ForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import {
  buildComparisonLine,
  groupGoForecasts,
  rankCandidates,
  runDailyCallCron,
  type DailyCallCandidate,
  type DailyCallDeps,
  type DailyCallProfile,
} from "@/lib/cron/daily-call-runner";
import { selectTitle as realSelectTitle } from "@/lib/notifications/copy/select-title";
import { resolveNotificationMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/notification";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";
import { parseDailyCallPayload } from "@/lib/notifications/types/daily-call";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";
import type { Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const now = new Date("2026-09-16T13:00:00.000Z");
const userId = "10000000-0000-4000-8000-000000000001";
const blacksId = "20000000-0000-4000-8000-000000000001";
const ospreyId = "20000000-0000-4000-8000-000000000002";

function poolBeach(
  id: string,
  name: string,
  relation: PoolBeach["relation"],
): PoolBeach {
  return {
    beach: {
      id,
      name,
      short_name: name,
      slug: name.toLowerCase(),
      timezone: "America/Los_Angeles",
    } as PoolBeach["beach"],
    relation,
    distanceMiles: relation === "nearby" ? 4 : null,
  };
}

const home = poolBeach(blacksId, "Blacks", "home");
const favorite = poolBeach(ospreyId, "Osprey", "favorite");

const profile: DailyCallProfile = {
  id: userId,
  homeBeachId: blacksId,
  timezone: "America/Los_Angeles",
  dailyCallTime: "06:00",
  notifPushEnabled: true,
  notifForecastAlerts: true,
  experienceLevel: "advanced",
  maxDriveMinutes: null,
  location: null,
  homeBeach: home.beach,
};

function sourceForecast(
  beachId: string,
  overrides: Partial<EnhancedForecastEntity> = {},
): EnhancedForecastEntity {
  return {
    id: `forecast-${beachId}`,
    beach_id: beachId,
    forecast_at: "2026-09-16T15:00:00.000Z",
    forecast_date: "2026-09-16",
    forecast_time: "08:00:00",
    wave_height: "3",
    wave_period: "13",
    wave_direction: "SW",
    wind_speed: "4",
    wind_direction: "E",
    tide_height: "3",
    tide_status: "Rising",
    water_temp: "66",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

function candidate(args: {
  pool: PoolBeach;
  start?: string;
  end?: string;
  physicalScore?: number;
  personalFit?: number;
  endDriver?: "wind" | "tide" | "swell" | "daylight";
}): DailyCallCandidate & {
  sourceForecast: EnhancedForecastEntity;
  timezone: string;
} {
  const start = args.start ?? "2026-09-16T15:00:00.000Z";
  const end = args.end ?? "2026-09-16T16:40:00.000Z";
  return {
    pool: args.pool,
    window: {
      start,
      end,
      minutes: (Date.parse(end) - Date.parse(start)) / 60_000,
      drivers: [{
        kind: args.endDriver ?? "wind",
        edge: "end",
        at: end,
        approximate: true,
        label: "offshore till the wind turns",
      }],
    },
    physicalScore: args.physicalScore ?? 82,
    personalFit: args.personalFit ?? 0,
    verdict: "go",
    decisionId: `decision-${args.pool.beach.id}-${start}`,
    sessionDecision: { verdict: "go" },
    sourceForecast: sourceForecast(args.pool.beach.id),
    timezone: "America/Los_Angeles",
  };
}

function deps(
  overrides: Partial<DailyCallDeps> = {},
): DailyCallDeps {
  return {
    isEnabled: () => true,
    isUserAllowed: () => true,
    loadProfiles: jest.fn(async () => [profile]),
    resolveTimezone: (value) => value.timezone ?? "America/Los_Angeles",
    getSunrise: () => null,
    loadPool: jest.fn(async () => [home, favorite]),
    buildCandidates: jest.fn(async () => ({
      candidates: [
        candidate({ pool: home, physicalScore: 55 }),
        candidate({ pool: favorite, physicalScore: 82 }),
      ],
      hadForecasts: true,
    })),
    alreadySentToday: jest.fn(async () => false),
    loadSwellEventKey: jest.fn(async () => null),
    loadRecentTitleIds: jest.fn(async () => []),
    selectTitle: jest.fn(() => ({
      id: "d05",
      title: "Wind stays polite. Osprey 8:00–9:40",
      body: "Offshore through ~9:40, then it turns.",
      fallback: false,
    })),
    resolveHeldBeaches: jest.fn(async () => new Map()),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    ...overrides,
  };
}

const supabase = {} as SupabaseClient<Database>;

describe("daily call alternatives", () => {
  const nearby = poolBeach("30000000-0000-4000-8000-000000000001", "K-40", "nearby");
  const custom = poolBeach("30000000-0000-4000-8000-000000000002", "Custom", "custom");
  const otherNearby = poolBeach("30000000-0000-4000-8000-000000000003", "Nearby", "nearby");
  const lead = candidate({ pool: nearby, physicalScore: 99 });

  async function send(candidates: DailyCallCandidate[]) {
    const mocked = deps({
      buildCandidates: jest.fn(async () => ({ candidates, hadForecasts: true })),
      selectTitle: jest.fn(realSelectTitle),
    });
    const summary = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(summary.errors).toBe(0);
    expect(summary.sent).toBe(1);
    return {
      payload: (mocked.enqueue as jest.Mock).mock.calls[0][0].payload,
      titleArgs: (mocked.selectTitle as jest.Mock).mock.calls[0][0],
    };
  }

  it("keeps the best nearby lead and its copy, with home then the best saved spot as options", async () => {
    const homeCandidate = candidate({ pool: { ...home, relation: "favorite" }, physicalScore: 55 });
    const baseline = await send([lead, homeCandidate]);
    const customCandidate = candidate({ pool: custom, physicalScore: 80 });
    customCandidate.pool = { ...custom, beach: { ...custom.beach, name: "Custom State Beach", short_name: null } };
    customCandidate.sourceForecast.wave_height = null;
    const { payload, titleArgs } = await send([
      candidate({ pool: otherNearby, physicalScore: 98 }),
      candidate({ pool: favorite, physicalScore: 75, personalFit: 100 }),
      customCandidate,
      homeCandidate,
      lead,
    ]);

    expect(payload.beach_id).toBe(nearby.beach.id);
    expect(titleArgs).toEqual(baseline.titleArgs);
    expect(payload).toMatchObject({
      title: baseline.payload.title,
      title_id: baseline.payload.title_id,
      reason: baseline.payload.reason,
      comparison: baseline.payload.comparison,
      options: [
        { beach_id: blacksId, beach_slug: "blacks", beach_name: "Blacks",
          window_start: homeCandidate.window.start, window_end: homeCandidate.window.end,
          window_local: "8–~9:40 AM", wave_height_ft: 3, relation: "home" },
        { beach_id: custom.beach.id, beach_slug: "custom", beach_name: "Custom State Beach",
          window_start: customCandidate.window.start, window_end: customCandidate.window.end,
          window_local: "8–~9:40 AM", wave_height_ft: null, relation: "custom" },
      ],
    });
    const parsed = parseDailyCallPayload(payload);
    expect(parsed.options).toEqual(payload.options);
    expect(NOTIFICATION_REGISTRY.daily_call.buildPushPayload!(parsed).body).toBe(
      `${payload.reason} Also: Blacks 8–~9:40 AM, Custom State Beach 8–~9:40 AM.`,
    );
  });

  it.each([
    { label: "physical score within saved spots", candidates: [
      candidate({ pool: favorite, physicalScore: 70 }), candidate({ pool: custom, physicalScore: 80 }),
      candidate({ pool: otherNearby, physicalScore: 98 }),
    ], ids: [custom.beach.id, ospreyId] },
    { label: "nearby filling the remaining slot", candidates: [
      candidate({ pool: favorite, physicalScore: 70 }), candidate({ pool: otherNearby, physicalScore: 98 }),
    ], ids: [ospreyId, otherNearby.beach.id] },
    { label: "personal fit breaking a score tie", candidates: [
      candidate({ pool: favorite, physicalScore: 80, personalFit: 1 }),
      candidate({ pool: custom, physicalScore: 80, personalFit: 2 }),
    ], ids: [custom.beach.id, ospreyId] },
    { label: "earlier window breaking a fit tie", candidates: [
      candidate({ pool: favorite, physicalScore: 80, start: "2026-09-16T16:00:00.000Z" }),
      candidate({ pool: custom, physicalScore: 80 }),
    ], ids: [custom.beach.id, ospreyId] },
    { label: "beach id breaking the final tie", candidates: [
      candidate({ pool: custom, physicalScore: 80 }), candidate({ pool: favorite, physicalScore: 80 }),
    ], ids: [ospreyId, custom.beach.id] },
  ])("orders options by $label", async ({ candidates, ids }) => {
    const { payload } = await send([lead, ...candidates]);
    expect(payload.options.map((option: { beach_id: string }) => option.beach_id)).toEqual(ids);
  });

  it("excludes every winner window, deduplicates beaches, and filters closing windows", async () => {
    const { payload } = await send([
      lead, candidate({ pool: nearby, physicalScore: 90 }),
      candidate({ pool: home, physicalScore: 80, end: "2026-09-16T13:29:59.000Z" }),
      candidate({ pool: favorite, physicalScore: 70 }),
      candidate({ pool: favorite, physicalScore: 85 }),
      candidate({ pool: otherNearby, physicalScore: 90, start: "2026-09-16T12:00:00.000Z", end: "2026-09-16T13:30:00.000Z" }),
    ]);
    expect(payload.options).toHaveLength(2);
    expect(payload.options.map((option: { beach_id: string }) => option.beach_id)).toEqual([ospreyId, otherNearby.beach.id]);
    expect(payload.options[1].window_local).toBe("5–~6:30 AM");
  });

  it("omits options when only winner windows and closing windows remain", async () => {
    const { payload } = await send([
      lead, candidate({ pool: nearby, physicalScore: 90 }),
      candidate({ pool: home, end: "2026-09-16T13:20:00.000Z" }),
    ]);
    expect(payload).not.toHaveProperty("options");
    const push = NOTIFICATION_REGISTRY.daily_call.buildPushPayload!(parseDailyCallPayload(payload));
    expect(push.body).toBe(payload.reason);
    expect(push.data).not.toHaveProperty("options");
  });
});

describe("runDailyCallCron", () => {
  it("sends the best go window with comparison and local window copy", async () => {
    const mocked = deps();

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(summary).toEqual(expect.objectContaining({
      evaluated: 1,
      sent: 1,
      silent: 0,
      errors: 0,
    }));
    expect(mocked.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "daily_call",
        recipientUserId: userId,
        dedupeKey: `daily_call:${userId}:2026-09-16`,
        payload: expect.objectContaining({
          beach_id: ospreyId,
          title: "Wind stays polite. Osprey 8:00–9:40",
          comparison: "Rated higher than Blacks today",
          window_local: "8–~9:40 AM",
        }),
      }),
      supabase,
    );
  });

  it("stays silent when every beach is maybe", async () => {
    const mocked = deps({
      buildCandidates: jest.fn(async () => ({ candidates: [], hadForecasts: true })),
    });

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(summary.silent).toBe(1);
    expect(summary.skippedCounts.no_go_window).toBe(1);
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("skips a user whose configured hour has not arrived", async () => {
    const mocked = deps({
      loadProfiles: jest.fn(async () => [{ ...profile, dailyCallTime: "07:00" }]),
    });

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(summary.skippedCounts.not_send_hour).toBe(1);
    expect(mocked.buildCandidates).not.toHaveBeenCalled();
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("adds the live tag when the winning window is already open", async () => {
    const selectTitle = jest.fn(() => ({
      id: "d07",
      title: "Offshore's on. Osprey 5:30–7:30",
      body: "It's already clean.",
      fallback: false,
    }));
    const mocked = deps({
      buildCandidates: jest.fn(async () => ({
        candidates: [candidate({
          pool: favorite,
          start: "2026-09-16T12:30:00.000Z",
          end: "2026-09-16T14:30:00.000Z",
        })],
        hadForecasts: true,
      })),
      selectTitle,
    });

    await runDailyCallCron({ now, supabase, deps: mocked });

    expect(selectTitle).toHaveBeenCalledWith(
      expect.objectContaining({ tags: expect.arrayContaining(["live"]) }),
    );
  });

  it("skips a second tick after today's event exists", async () => {
    const mocked = deps({
      alreadySentToday: jest.fn(async () => true),
    });

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(summary.skippedCounts.already_sent_today).toBe(1);
    expect(mocked.buildCandidates).not.toHaveBeenCalled();
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("uses the next go window when the top window closes within 30 minutes", async () => {
    const closing = candidate({
      pool: favorite,
      start: "2026-09-16T12:00:00.000Z",
      end: "2026-09-16T13:20:00.000Z",
      physicalScore: 90,
    });
    const later = candidate({
      pool: home,
      start: "2026-09-16T15:00:00.000Z",
      end: "2026-09-16T17:00:00.000Z",
      physicalScore: 80,
    });
    const mocked = deps({
      buildCandidates: jest.fn(async () => ({
        candidates: [closing, later],
        hadForecasts: true,
      })),
    });

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(summary.sent).toBe(1);
    expect(summary.skippedCounts.window_closing_within_30m).toBe(1);
    expect(mocked.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ beach_id: blacksId }),
      }),
      supabase,
    );
  });
});

describe("daily call holds", () => {
  const nearby = poolBeach("30000000-0000-4000-8000-000000000001", "K-40", "nearby");
  const custom = poolBeach("30000000-0000-4000-8000-000000000002", "Custom", "custom");

  function holding(heldBeachIds: string[], reason = "water_quality_hold"): DailyCallDeps["resolveHeldBeaches"] {
    return jest.fn(async ({ candidates }) => new Map(candidates
      .filter((value) => heldBeachIds.includes(value.beachId))
      .map((value) => [value.candidateId, reason as "water_quality_hold"])));
  }

  it("checks every candidate window for the surfer's skill before choosing", async () => {
    const homeCandidate = candidate({ pool: home, physicalScore: 55 });
    const mocked = deps({
      buildCandidates: jest.fn(async () => ({
        candidates: [homeCandidate, candidate({ pool: favorite, physicalScore: 82 })],
        hadForecasts: true,
      })),
    });

    await runDailyCallCron({ now, supabase, deps: mocked });

    expect(mocked.resolveHeldBeaches).toHaveBeenCalledWith({
      candidates: [
        { candidateId: "daily-call:0", beachId: blacksId, startsAt: homeCandidate.window.start, endsAt: homeCandidate.window.end },
        { candidateId: "daily-call:1", beachId: ospreyId, startsAt: homeCandidate.window.start, endsAt: homeCandidate.window.end },
      ],
      profileExperience: "advanced",
      asOf: now,
    });
  });

  it("leads with the best clear beach and leaves held beaches out of the options", async () => {
    const mocked = deps({
      buildCandidates: jest.fn(async () => ({
        candidates: [
          candidate({ pool: nearby, physicalScore: 99 }),
          candidate({ pool: favorite, physicalScore: 82 }),
          candidate({ pool: custom, physicalScore: 80 }),
          candidate({ pool: home, physicalScore: 55 }),
        ],
        hadForecasts: true,
      })),
      resolveHeldBeaches: holding([nearby.beach.id, custom.beach.id]),
    });

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    const payload = (mocked.enqueue as jest.Mock).mock.calls[0][0].payload;
    expect(payload.beach_id).toBe(ospreyId);
    expect(payload.options.map((option: { beach_id: string }) => option.beach_id)).toEqual([blacksId]);
    expect(summary.skippedCounts.held_water_quality_hold).toBe(2);
  });

  it("does not compare the winner with a held home beach", async () => {
    const mocked = deps({ resolveHeldBeaches: holding([blacksId], "major_event_hold") });

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    expect((mocked.enqueue as jest.Mock).mock.calls[0][0].payload).toMatchObject({
      beach_id: ospreyId,
      comparison: null,
    });
    expect(summary.skippedCounts.held_major_event_hold).toBe(1);
  });

  it("enqueues a payload the delivery-time hold check can read, lead and options", async () => {
    const mocked = deps({
      buildCandidates: jest.fn(async () => ({
        candidates: [
          candidate({ pool: nearby, physicalScore: 99 }),
          candidate({ pool: favorite, physicalScore: 82 }),
          candidate({ pool: home, physicalScore: 55 }),
        ],
        hadForecasts: true,
      })),
    });
    await runDailyCallCron({ now, supabase, deps: mocked });
    const payload = (mocked.enqueue as jest.Mock).mock.calls[0][0].payload;
    const evaluateCandidates = jest.fn(async ({ candidates }) =>
      (candidates as MajorEventHoldCandidate[]).map((value) => ({
        candidateId: value.candidateId,
        evaluation: { outcome: "allow" as const, holdIds: [], holdEpoch: "epoch" },
        recommendationAvailability: { state: "available" as const, holdEpoch: "epoch" },
      })));

    const result = await resolveNotificationMajorEventHold(
      { eventId: "event-1", type: "daily_call", payload, profileExperience: "beginner", mode: "enforce" },
      { evaluateCandidates },
    );

    expect(result.status).toBe("allowed");
    expect(evaluateCandidates.mock.calls[0][0].candidates.map((value: MajorEventHoldCandidate) => value.beachId))
      .toEqual([nearby.beach.id, blacksId, ospreyId]);
  });

  it("stays silent when every go window is held or its hold state is unknown", async () => {
    const mocked = deps({
      resolveHeldBeaches: holding([blacksId, ospreyId], "hold_state_unavailable"),
    });

    const summary = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(mocked.enqueue).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ sent: 0, silent: 1 });
    expect(summary.skippedCounts).toMatchObject({ no_go_window: 1, held_hold_state_unavailable: 2 });
  });
});

describe("groupGoForecasts", () => {
  // Local 08:00, 11:00, 14:00, 17:00 PDT on the 3-hourly grid.
  const at = (hour: number): string => new Date(Date.UTC(2026, 8, 16, hour + 7)).toISOString();
  const row = (hour: number, verdict: ForecastVerdict["verdict"]): ForecastVerdict =>
    ({ forecast: { id: `h${hour}`, forecast_at: at(hour) }, verdict, score: 80 }) as unknown as ForecastVerdict;
  const ids = (groups: ForecastVerdict[][]): string[][] => groups.map((group) => group.map(({ forecast }) => forecast.id));

  it("joins consecutive 3-hourly go rows into one run", () => {
    expect(ids(groupGoForecasts([row(8, "go"), row(11, "go"), row(14, "go"), row(17, "no")])))
      .toEqual([["h8", "h11", "h14"]]);
  });

  it("ends a run at a non-go row", () => {
    expect(ids(groupGoForecasts([row(8, "go"), row(9, "maybe"), row(10, "go")])))
      .toEqual([["h8"], ["h10"]]);
  });

  it("ends a run at a missing grid row", () => {
    expect(ids(groupGoForecasts([row(8, "go"), row(14, "go")])))
      .toEqual([["h8"], ["h14"]]);
  });
});

describe("rankCandidates", () => {
  it("prefers favorite over nearby, then home over another favorite", () => {
    const nearby = candidate({
      pool: poolBeach("30000000-0000-4000-8000-000000000001", "Nearby", "nearby"),
    });
    const otherFavorite = candidate({ pool: favorite });
    const homeAsFavorite = candidate({
      pool: { ...home, relation: "favorite" },
    });

    expect(rankCandidates(
      [nearby, otherFavorite, homeAsFavorite],
      blacksId,
    ).map((value) => value.pool.beach.id)).toEqual([
      blacksId,
      ospreyId,
      nearby.pool.beach.id,
    ]);
  });
});

describe("buildComparisonLine", () => {
  it("names a wind difference only when home's forecast is windier", () => {
    const windyHome = { ...candidate({ pool: home, physicalScore: 55 }), sourceForecast: sourceForecast(blacksId, { wind_speed: "12" }) };
    expect(buildComparisonLine(candidate({ pool: favorite, endDriver: "wind" }), windyHome))
      .toBe("Less wind than Blacks today");
  });

  it("does not invent a reason when the forecasts match", () => {
    expect(buildComparisonLine(
      candidate({ pool: favorite, endDriver: "tide" }),
      candidate({ pool: home, physicalScore: 55 }),
    )).toBe("Rated higher than Blacks today");
  });
});

describe("daily call copy on the real title pool", () => {
  // 2026-09-24: OB Pier was home; Torrey Pines won on swell size with a window
  // that ends as the tide drops. The old copy said OB Pier "misses the tide".
  const obPierId = "20000000-0000-4000-8000-000000000003";
  const torreyId = "20000000-0000-4000-8000-000000000004";
  const obPier: PoolBeach = {
    beach: { id: obPierId, name: "Ocean Beach Pier", short_name: null, slug: "ocean-beach-pier",
      timezone: "America/Los_Angeles" } as PoolBeach["beach"],
    relation: "home",
    distanceMiles: null,
  };
  const torrey: PoolBeach = {
    beach: { id: torreyId, name: "Torrey Pines State Beach", short_name: null, slug: "torrey-pines-state-beach",
      timezone: "America/Los_Angeles" } as PoolBeach["beach"],
    relation: "favorite",
    distanceMiles: null,
  };
  const sept24 = new Date("2026-09-24T13:00:00.000Z"); // 06:00 PDT send hour
  const obProfile: DailyCallProfile = { ...profile, homeBeachId: obPierId, homeBeach: obPier.beach };

  function go(pool: PoolBeach, forecast: Partial<EnhancedForecastEntity>, physicalScore: number) {
    const start = "2026-09-24T15:00:00.000Z";
    const end = "2026-09-24T18:00:00.000Z";
    return {
      pool,
      window: {
        start,
        end,
        minutes: 180,
        drivers: [{ kind: "tide" as const, edge: "end" as const, at: end, approximate: false, label: "falling to a 1.4ft low" }],
      },
      physicalScore,
      personalFit: 0,
      verdict: "go" as const,
      decisionId: `decision-${pool.beach.id}`,
      sessionDecision: { verdict: "go" },
      sourceForecast: sourceForecast(pool.beach.id, { forecast_at: start, ...forecast }),
      timezone: "America/Los_Angeles",
    };
  }

  const torreyForecast = { wave_height: "4.1 ft", wave_period: "15s", wave_direction: "WSW", wind_speed: "3 mph", wind_direction: "W" };

  async function send(candidates: DailyCallCandidate[], sendProfile = obProfile) {
    const mocked = deps({
      loadProfiles: jest.fn(async () => [sendProfile]),
      loadPool: jest.fn(async () => [obPier, torrey]),
      buildCandidates: jest.fn(async () => ({ candidates, hadForecasts: true })),
      selectTitle: realSelectTitle,
    });
    await runDailyCallCron({ now: sept24, supabase, deps: mocked });
    return (mocked.enqueue as jest.Mock).mock.calls[0][0].payload;
  }

  it("keeps the title's hook, reads 12-hour time, and never claims home missed the tide", async () => {
    const payload = await send([go(torrey, torreyForecast, 82)]);

    expect(payload.title).toMatch(/^\S.*\. Torrey Pines 8–11 AM$/);
    expect([...payload.title].length).toBeLessThanOrEqual(40);
    expect(payload.reason).toBe("4–5 ft at 15s WSW with light wind. Best before the tide drops around 11 AM.");
    expect(payload.reason).not.toMatch(/Ocean Beach Pier|misses/);
    expect(payload.comparison).toBeNull();
    expect(payload.window_local).toBe("8–11 AM");
  });

  it("never prints 0mph or light wind when the forecast has no wind", async () => {
    const payload = await send([go(torrey, { ...torreyForecast, wind_speed: null, wind_direction: null }, 82)]);

    expect(payload.wind_label).toBe("Wind unknown");
    expect(payload.reason).toBe("4–5 ft at 15s WSW with wind unknown. Best before the tide drops around 11 AM.");
  });

  it("labels calm as 0mph", async () => {
    const payload = await send([go(torrey, { ...torreyForecast, wind_speed: "0 mph", wind_direction: null }, 82)]);

    expect(payload.wind_label).toBe("0mph");
  });

  it("leads with a comparison only when home was evaluated, and names the real difference", async () => {
    const payload = await send([
      go(obPier, { wave_height: "2.6 ft", wave_period: "10s", wave_direction: "SSW", wind_speed: "0 mph" }, 60),
      go(torrey, torreyForecast, 82),
    ]);

    expect(payload.comparison).toBe("Bigger than Ocean Beach Pier today");
    expect(payload.reason).toBe(
      "Bigger than Ocean Beach Pier today: 4–5 ft at 15s WSW with light wind. Best before the tide drops around 11 AM.",
    );
  });

  it("does not treat a surfer without a home beach as away from home", async () => {
    const selectTitle = jest.fn(realSelectTitle);
    const mocked = deps({
      loadProfiles: jest.fn(async () => [{ ...obProfile, homeBeachId: null, homeBeach: null }]),
      loadPool: jest.fn(async () => [torrey]),
      buildCandidates: jest.fn(async () => ({ candidates: [go(torrey, torreyForecast, 82)], hadForecasts: true })),
      selectTitle,
    });
    await runDailyCallCron({ now: sept24, supabase, deps: mocked });

    const tags = selectTitle.mock.calls[0][0].tags;
    expect(tags).not.toContain("not-home");
    expect(tags).not.toContain("home-beach");
  });
});


describe("daily call location freshness", () => {
  it.each([72, 1])("resolves a %s-hour Honolulu fix before pool selection and timezone fallback", async (ageHours) => {
    const runNow = ageHours === 72 ? now : new Date("2026-09-16T16:00:00Z");
    const homeBeach = { ...home.beach, lat: 32.89, lon: -117.25 };
    const location = { lat: 21.28, lon: -157.83, timezone: "Pacific/Honolulu",
      captured_at: new Date(runNow.getTime() - ageHours * 3_600_000).toISOString() };
    const user = { ...profile, timezone: null, homeBeach: { ...homeBeach, timezone: null }, location };
    const sanDiego = poolBeach("30000000-0000-4000-8000-000000000003", "La Jolla", "nearby");
    const honolulu = poolBeach("30000000-0000-4000-8000-000000000004", "Waikiki", "nearby");
    const nearby = ageHours === 72 ? sanDiego : honolulu;
    const rpc = jest.fn(async (_name: string, input: { input_lat: number }) => ({ data: [{ id: input.input_lat === homeBeach.lat ? sanDiego.beach.id : honolulu.beach.id, distance_meters: 1000 }], error: null }));
    const select = jest.fn();
    const client = { rpc, from: (table: string) => {
      const builder: Record<string, unknown> = {};
      let ids: string[] = [];
      builder.select = (fields: string) => { select(fields); return builder; };
      builder.order = builder.eq = () => builder;
      builder.in = (_column: string, values: string[]) => { ids = values; return builder; };
      builder.is = () => builder;
      builder.then = (resolve: (value: unknown) => void) => resolve({ data: table === "profiles"
        ? [{ id: user.id, timezone: null, home_beach_id: blacksId, daily_call_time: "06:00", notif_push_enabled: true, notif_forecast_alerts: true }]
        : table === "user_location_snapshots" ? [{ user_id: userId, ...location }]
        : table === "beaches" ? [user.homeBeach, sanDiego.beach, honolulu.beach].filter((beach) => ids.includes(beach.id)) : [], error: null });
      return builder;
    } } as unknown as SupabaseClient<Database>;
    const overrides = deps({
      loadPool: jest.fn(loadUserPool),
      buildCandidates: jest.fn(async ({ pool }: Parameters<DailyCallDeps["buildCandidates"]>[0]) => ({ candidates: pool.filter((entry) => entry.relation === "nearby").map((entry) => candidate({ pool: entry, end: "2026-09-16T18:40:00.000Z" })), hadForecasts: true })),
      getSunrise: jest.fn(() => null),
    });
    const { resolveTimezone: _resolveTimezone, loadProfiles: _loadProfiles, ...injected } = overrides;
    const result = await runDailyCallCron({ now: runNow, supabase: client, deps: injected });
    expect(result.sent).toBe(1);
    expect(overrides.loadPool).toHaveBeenCalledWith(expect.objectContaining({ location: ageHours === 72
      ? { lat: homeBeach.lat, lon: homeBeach.lon } : { lat: location.lat, lon: location.lon } }));
    expect(overrides.getSunrise).toHaveBeenCalledWith(expect.objectContaining({ location: ageHours === 72 ? null : { user_id: userId, ...location } }), runNow);
    expect(overrides.buildCandidates).toHaveBeenCalledWith(expect.objectContaining({ timezone: ageHours === 72 ? "America/Los_Angeles" : "Pacific/Honolulu" }));
    expect(overrides.enqueue).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      beach_id: nearby.beach.id, beach_name: nearby.beach.name, anchor_source: ageHours === 72 ? "home" : "location",
      window_local: ageHours === 72 ? "8–~11:40 AM" : "5–~8:40 AM",
    }) }), client);
    expect(select).toHaveBeenCalledWith("user_id, lat, lon, timezone, captured_at");
    expect(rpc).toHaveBeenCalledWith("get_weekend_scout_candidates", expect.objectContaining({ input_lat: ageHours === 72 ? homeBeach.lat : location.lat }));
  });

  it("does not use stale coordinates for the sunrise fallback without a home", async () => {
    const daylight = jest.mocked(sunrise.getDaylightWindow);
    daylight.mockClear();
    const injected = deps({ loadProfiles: async () => [{ ...profile, homeBeachId: null, homeBeach: null,
      location: { lat: 21.28, lon: -157.83, timezone: "Pacific/Honolulu", captured_at: "2026-09-13T13:00:00Z" } }],
      loadPool: jest.fn(async () => []),
    });
    const { getSunrise: _getSunrise, resolveTimezone: _resolveTimezone, ...overrides } = injected;
    const result = await runDailyCallCron({ now, supabase, deps: overrides });
    expect(result.skippedCounts.no_pool).toBe(1);
    expect(injected.loadPool).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
    expect(daylight).not.toHaveBeenCalled();
  });
});
