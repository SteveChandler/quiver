/**
 * @jest-environment node
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoolBeach } from "@/lib/alerts/user-pool";
import {
  buildComparisonLine,
  rankCandidates,
  runDailyCallCron,
  type DailyCallCandidate,
  type DailyCallDeps,
  type DailyCallProfile,
} from "@/lib/cron/daily-call-runner";
import { selectTitle as realSelectTitle } from "@/lib/notifications/copy/select-title";
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
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    ...overrides,
  };
}

const supabase = {} as SupabaseClient<Database>;

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
