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
          comparison: "Cleaner than Blacks today",
          window_local: "8:00–~9:40",
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
  it("describes the winning wind difference", () => {
    expect(buildComparisonLine(
      candidate({ pool: favorite, endDriver: "wind" }),
      candidate({ pool: home, physicalScore: 55 }),
    )).toBe("Cleaner than Blacks today");
  });
});
