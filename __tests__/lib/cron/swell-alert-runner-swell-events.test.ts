/**
 * @jest-environment node
 */

jest.mock("@/lib/alerts/user-pool", () => ({
  ...jest.requireActual("@/lib/alerts/user-pool"),
  loadUserPool: jest.fn(),
}));
// Board reads are not under test here; keep them off the recorded query fake.
jest.mock("@/lib/alerts/entitlements", () => ({ getUserEntitlement: jest.fn(async () => "free") }));
jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  fetchUserBoardContext: jest.fn(async () => ({ boardsForPicks: [] })),
}));
jest.mock("@/lib/cron/daily-call-runner", () => ({
  ...jest.requireActual("@/lib/cron/daily-call-runner"),
  loadTideSamples: jest.fn(async () => null),
}));
jest.mock("@/lib/recommendations/major-swell-awareness/official-advisory-adapter", () => ({
  loadOfficialSwellAdvisories: jest.fn(async () => []),
  loadNwsSwellAdvisories: jest.fn(async () => []),
}));
jest.mock("@/lib/alerts/canonical-forecast-verdict", () => ({
  evaluateForecastVerdict: jest.fn(),
}));

import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import { loadUserPool, type PoolBeach } from "@/lib/alerts/user-pool";
import { runSwellAlertCron, type SwellAlertDeps, type SwellAlertProfile } from "@/lib/cron/swell-alert-runner";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import type { Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { RankDay } from "@/lib/cron/daily-call-runner";
import type { CanonicalWeekScoutResponse } from "@/lib/services/discovery/week-scout";

// 17:00 PDT on Thursday 2026-09-17: the send hour. Tomorrow is 2026-09-18.
const NOW = new Date("2026-09-18T00:00:00.000Z");
const BEACH_ID = "44444444-4444-4444-8444-444444444444";
const beach = createMockBeach({
  id: BEACH_ID,
  name: "Blacks",
  slug: "blacks",
  state: "CA",
  timezone: "America/Los_Angeles",
  short_name: null,
  nws_forecast_zone: null,
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 30,
});
const profile: SwellAlertProfile = {
  id: "73040cff-afe9-4fa0-a874-2016203fc015",
  timezone: "America/Los_Angeles",
  homeBeachId: BEACH_ID,
  location: null,
  maxDriveMinutes: null,
  experienceLevel: "advanced",
  notifPushEnabled: true,
  notifSwellAlerts: true, notifForecastAlerts: false,
};

/** Three-hourly W 16 s rows from 2026-09-08 through 2026-09-27 (PDT), sized per local date. */
function rows(heightFor: (localDate: string) => number): EnhancedForecastEntity[] {
  const out: EnhancedForecastEntity[] = [];
  for (let day = 8; day <= 27; day += 1) {
    const localDate = `2026-09-${String(day).padStart(2, "0")}`;
    for (let hour = 0; hour < 24; hour += 3) {
      const forecastAt = new Date(Date.UTC(2026, 8, day, hour + 7)).toISOString();
      out.push({
        id: `${localDate}T${hour}`,
        beach_id: BEACH_ID,
        forecast_at: forecastAt,
        swell_1_height: `${heightFor(localDate)} ft`,
        swell_1_period: "16s",
        swell_1_direction: "270",
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
      } as EnhancedForecastEntity);
    }
  }
  return out;
}

function client(forecasts: EnhancedForecastEntity[], snapshots: { data: unknown[] | null; error: unknown }) {
  const from = jest.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "in", "or", "eq", "gte", "lt", "order"]) chain[method] = () => chain;
    chain.range = async (first: number, last: number) => {
      if (table === "swell_event_forecast_snapshots") {
        return first === 0 ? snapshots : { data: [], error: null };
      }
      return { data: forecasts.slice(first, last + 1), error: null };
    };
    return chain;
  });
  return { from } as unknown as SupabaseClient<Database>;
}

function deps(): Partial<SwellAlertDeps> {
  return {
    isEnabled: () => true,
    isUserAllowed: () => true,
    loadProfiles: async () => [profile],
    loadAlertState: async () => ({ eventExists: false, lastAlertAt: null, recentTitleIds: [], recentFilmCount: 0 }),
    insertAlert: jest.fn(async () => ({ id: "alert-1" })),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    markAlertEnqueued: jest.fn(async () => undefined),
    recordForecast: jest.fn(async () => ({ inserted: true })),
    resolveHeldBeaches: jest.fn(async () => new Map()),
  };
}

// A W swell builds on 2026-09-18 (tomorrow) and peaks on 2026-09-19.
const SWELL_TOMORROW = rows((date) => (date === "2026-09-18" ? 4 : date === "2026-09-19" ? 5 : 1.5));
const PREVIOUS_RUN_KEY = `${BEACH_ID}:W:2026-09-18`;
const PREVIOUS_RUN = {
  beach_id: BEACH_ID, event_key: PREVIOUS_RUN_KEY, detector_version: "swell-events.v1",
  run_date: "2026-09-16", detected_at: "2026-09-16T14:30:00+00:00", direction_deg: 270, direction_band: "W",
  period_s: 16, peak_offshore_height_ft: 4.5, peak_face_height_ft: 6, exposure: 1, energy_ratio: 9,
  arrival_at: "2026-09-18T07:00:00+00:00", peak_at: "2026-09-18T22:00:00+00:00", fade_at: null,
  crossing_direction_deg: null, crossing_period_s: null, crossing_offshore_height_ft: null,
};

beforeEach(() => {
  jest.mocked(loadUserPool).mockResolvedValue([{ beach, relation: "home", distanceMiles: null }]);
  // Past days are ordinary; the swell days are a canonical go.
  jest.mocked(evaluateForecastVerdict).mockImplementation(({ forecast }) => {
    const go = forecast.forecast_at >= "2026-09-18T07:00:00.000Z";
    return { forecast, score: go ? 80 : 40, verdict: go ? "go" : "no", decision: {} as CanonicalSessionDecision };
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("swell alert runner on the swell-events detector", () => {
  it("preserves the pool beach's timezone through detection and push copy", async () => {
    const hawaiiBeach = { ...beach, state: "HI", timezone: "Pacific/Honolulu" };
    jest.mocked(loadUserPool).mockResolvedValue([{ beach: hawaiiBeach, relation: "home", distanceMiles: null }]);
    const peakAt = "2026-09-20T01:00:00.000Z";
    const forecasts = SWELL_TOMORROW.map((forecast) => forecast.forecast_at === peakAt
      ? { ...forecast, swell_1_height: "5.1 ft" }
      : forecast);
    const runDeps = deps();

    const result = await runSwellAlertCron({
      now: NOW,
      supabase: client(forecasts, { data: [], error: null }),
      deps: runDeps,
    });

    expect(result.sent).toBe(1);
    const payload = jest.mocked(runDeps.enqueue!).mock.calls[0][0].payload;
    expect(payload?.forecast_at).toBe(peakAt);
    expect(payload?.body).toMatch(/peak:? Saturday afternoon/i);
  });

  it("starts the peak-day window from the 04:00 row in effect at the 05:00 day start after the fall-back", async () => {
    // 17:00 PST on Tuesday 2026-11-03. The UTC-aligned grid is 04:00, 07:00, 10:00 ... local.
    const novNow = new Date("2026-11-04T01:00:00.000Z");
    const forecasts: EnhancedForecastEntity[] = [];
    for (let day = 25; day <= 44; day += 1) {
      for (let hour = 0; hour < 24; hour += 3) {
        const forecastAt = new Date(Date.UTC(2026, 9, day, hour));
        const localDate = new Date(forecastAt.getTime() - 8 * 3_600_000).toISOString().slice(0, 10);
        const height = localDate === "2026-11-04" ? 4 : localDate === "2026-11-05" ? 5 : 1.5;
        forecasts.push({
          id: forecastAt.toISOString(), beach_id: BEACH_ID, forecast_at: forecastAt.toISOString(), confidence_score: 90,
          swell_1_height: `${height} ft`, swell_1_period: "16s", swell_1_direction: "270",
          swell_2_height: null, swell_2_period: null, swell_2_direction: null,
        } as EnhancedForecastEntity);
      }
    }
    jest.mocked(evaluateForecastVerdict).mockImplementation(({ forecast }) => {
      const go = forecast.forecast_at >= "2026-11-04T08:00:00.000Z";
      return { forecast, score: go ? 80 : 40, verdict: go ? "go" : "no", decision: {} as CanonicalSessionDecision };
    });
    const runDeps = deps();
    const result = await runSwellAlertCron({
      now: novNow, supabase: client(forecasts, { data: [], error: null }), deps: runDeps,
    });
    expect(result.sent).toBe(1);
    const payload = jest.mocked(runDeps.enqueue!).mock.calls[0][0].payload;
    // Sunrise, not the 07:00 row, starts the window: the 04:00 row is in effect until then.
    expect(payload?.body).toMatch(/Thursday 6:\d\d–8 AM/);
  });

  it("ranks the nearest 50 nearby beaches plus home/saved/custom while detecting swells over the full pool", async () => {
    const nearby: PoolBeach[] = Array.from({ length: 60 }, (_, index) => ({
      beach: createMockBeach({ ...beach,
        id: index === 0 ? BEACH_ID : `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      }),
      relation: "nearby",
      distanceMiles: 60 - index,
    }));
    const preferred: PoolBeach[] = (["home", "favorite", "custom"] as const).map((relation, index) => ({
      beach: createMockBeach({ ...beach, id: `50000000-0000-4000-8000-${String(index).padStart(12, "0")}` }),
      relation,
      distanceMiles: 80,
    }));
    jest.mocked(loadUserPool).mockResolvedValue([...nearby, ...preferred]);
    const rankDay = jest.fn<ReturnType<RankDay>, Parameters<RankDay>>(async () => ({ days: [] }) as unknown as CanonicalWeekScoutResponse);
    const runDeps = { ...deps(), usesSharedRanking: () => true, rankDay,
      loadProfiles: async () => [{ ...profile, homeBeachId: preferred[0].beach.id }],
    };

    const result = await runSwellAlertCron({
      now: NOW, supabase: client(SWELL_TOMORROW, { data: [PREVIOUS_RUN], error: null }), deps: runDeps,
    });

    expect(result).toMatchObject({ sent: 1, errors: 0, candidates: 1 });
    expect(rankDay).toHaveBeenCalledTimes(1);
    const rankedIds = rankDay.mock.calls[0][0].poolBeachIds;
    expect(rankedIds).toEqual([...nearby.slice(10), ...preferred].map(({ beach }) => beach.id));
    expect(rankedIds).toHaveLength(53);
    expect(rankedIds).not.toContain(BEACH_ID);
    expect(runDeps.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ beach_id: BEACH_ID, event_key: PREVIOUS_RUN_KEY }),
    }));
  });

  it("alerts on tomorrow's swell under the key an earlier run gave it", async () => {
    const runDeps = deps();
    const result = await runSwellAlertCron({
      now: NOW,
      supabase: client(SWELL_TOMORROW, { data: [PREVIOUS_RUN], error: null }),
      deps: runDeps,
    });

    expect(result.sent).toBe(1);
    const payload = jest.mocked(runDeps.enqueue!).mock.calls[0][0].payload as Record<string, unknown>;
    // Go all day: the best stretch, capped at four hours, not first light to dark.
    expect(payload.body).toContain("Your call: Blacks Saturday 6:36–10 AM. Good until 10 AM.");
    expect(payload).toMatchObject({
      event_key: PREVIOUS_RUN_KEY,
      event_start_date: "2026-09-18",
      peak_date: "2026-09-19",
      peak_period_s: 16,
      beach_id: BEACH_ID,
      awareness_signal: "forecast_trend",
    });
    expect(payload.peak_height_ft).toBeGreaterThanOrEqual(3);
    expect(runDeps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: PREVIOUS_RUN_KEY,
      peakDate: "2026-09-19",
    }));
    expect(runDeps.recordForecast).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: PREVIOUS_RUN_KEY,
      detectorVersion: "swell-events.v1",
      arrivalAt: "2026-09-18T07:00:00.000Z",
      peakOffshoreHeightFt: 5,
      peakPeriodS: 16,
      directionDeg: 270,
    }));
  });

  it("falls back to the detector's own key when snapshots cannot be read", async () => {
    const runDeps = deps();
    const result = await runSwellAlertCron({
      now: NOW,
      supabase: client(SWELL_TOMORROW, { data: null, error: { message: "relation does not exist" } }),
      deps: runDeps,
    });

    expect(result.sent).toBe(1);
    const payload = jest.mocked(runDeps.enqueue!).mock.calls[0][0].payload as { event_key: string };
    expect(payload.event_key).toBe(`${BEACH_ID}:W:2026-09-19`);
    expectConsoleWarnings([/Snapshot read failed; using detector keys/]);
  });

  it("calls the first go after three flat days, the last of them today, first-after-flat", async () => {
    // Flat 15th-17th (today); an ordinary 40 before that; the swell is a go tomorrow.
    jest.mocked(evaluateForecastVerdict).mockImplementation(({ forecast }) => {
      const at = forecast.forecast_at;
      const score = at >= "2026-09-18T07:00:00.000Z" ? 80 : at >= "2026-09-15T07:00:00.000Z" ? 30 : 60;
      return { forecast, score, verdict: score === 80 ? "go" : "no", decision: {} as CanonicalSessionDecision };
    });
    const oneDaySwell = rows((date) => (date === "2026-09-18" ? 5 : 1.5));
    const runDeps = deps();

    const result = await runSwellAlertCron({
      now: NOW,
      supabase: client(oneDaySwell, { data: [], error: null }),
      deps: runDeps,
    });

    expect(result.sent).toBe(1);
    const payload = jest.mocked(runDeps.enqueue!).mock.calls[0][0].payload as { rarity: string; peak_date: string };
    expect(payload).toMatchObject({ peak_date: "2026-09-18", rarity: "First real swell in 4 days" });
  });

  it("does not alert when neither arrival nor peak is tomorrow", async () => {
    const runDeps = deps();
    const later = rows((date) => (date === "2026-09-20" ? 4 : date === "2026-09-21" ? 5 : 1.5));
    const result = await runSwellAlertCron({
      now: NOW,
      supabase: client(later, { data: [], error: null }),
      deps: runDeps,
    });

    expect(result.skippedCounts.no_event_tomorrow).toBe(1);
    expect(runDeps.enqueue).not.toHaveBeenCalled();
  });
});
