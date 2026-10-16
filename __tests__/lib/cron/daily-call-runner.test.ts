/**
 * @jest-environment node
 */

jest.mock("@/lib/alerts/sunrise", () => {
  const actual = jest.requireActual("@/lib/alerts/sunrise");
  return { ...actual, getDaylightWindow: jest.fn(actual.getDaylightWindow) };
});

jest.mock("@/lib/alerts/window-refiner", () => {
  const actual = jest.requireActual("@/lib/alerts/window-refiner");
  return { ...actual, refineWindow: jest.fn(actual.refineWindow) };
});

jest.mock("@/lib/alerts/canonical-forecast-verdict", () => {
  const actual = jest.requireActual("@/lib/alerts/canonical-forecast-verdict");
  return { ...actual, evaluateForecastVerdict: jest.fn(actual.evaluateForecastVerdict) };
});

jest.mock("@/lib/services/discovery/window-selector", () => {
  const actual = jest.requireActual("@/lib/services/discovery/window-selector");
  return {
    __esModule: true,
    ...actual,
    scoreWindowConditionScore: jest.fn(actual.scoreWindowConditionScore),
  };
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadUserPool, type PoolBeach } from "@/lib/alerts/user-pool";
import * as sunrise from "@/lib/alerts/sunrise";
import type { ForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import { evaluateForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import { refineWindow } from "@/lib/alerts/window-refiner";
import { buildCanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import type {
  CanonicalWeekScoutResponse,
  WeekScoutDayResponse,
  WeekScoutWindowResponse,
} from "@/lib/services/discovery/week-scout";
import {
  buildCandidates,
  buildComparisonLine,
  groupGoForecasts,
  rankCandidates,
  runDailyCallCron,
  type DailyCallCandidate,
  type DailyCallDeps,
  type DailyCallProfile,
  type DailyCallRankingDeps,
} from "@/lib/cron/daily-call-runner";
import { scoreWindowConditionScore, selectBestWindows } from "@/lib/services/discovery/window-selector";
import * as windowSelector from "@/lib/services/discovery/window-selector";
import { TideCache } from "@/lib/services/noaa-coops/tide-cache";
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
      skill_level: "intermediate",
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
      title: "Wind stays polite. Osprey 8:00 to 9:40",
      body: "Offshore through ~9:40, then it turns.",
      fallback: false,
    })),
    resolveHeldBeaches: jest.fn(async () => new Map()),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    ...overrides,
  };
}

const supabase = {} as SupabaseClient<Database>;

describe("daily call advertised window decisions", () => {
  let restoreSelector: () => void;
  const runNow = new Date("2026-10-15T13:08:00.000Z");
  const sunriseAt = "2026-10-15T13:54:00.000Z";
  const at = (hour: number): string => new Date(Date.UTC(2026, 9, 15, hour + 7)).toISOString();
  const beach = { ...home, beach: { ...home.beach, lat: 32.89, lon: -117.25, skill_level: "intermediate" } };
  const rows = [5, 8, 11].map((hour) => sourceForecast(blacksId, {
    id: `hour-${hour}`,
    forecast_at: at(hour),
    forecast_date: "2026-10-15",
    forecast_time: `${String(hour).padStart(2, "0")}:00:00`,
    wave_height: hour === 5 ? "4" : "3",
    confidence_score: hour === 5 ? 84 : 70,
  }));

  async function build(forecasts = rows, asOf = runNow): ReturnType<typeof buildCandidates> {
    const client = {
      from: jest.fn((table: string) => {
        const query = {
          select: () => query, in: () => query, eq: () => query,
          gte: () => query, lt: () => query,
          order: async () => ({ data: table === "enhanced_forecasts" ? forecasts : [], error: null }),
        };
        return query;
      }),
    } as unknown as SupabaseClient<Database>;
    return buildCandidates(client, new TideCache(), {
      profile, pool: [beach], timezone: "America/Los_Angeles", alertDate: "2026-10-15", now: asOf,
    });
  }

  beforeEach(() => {
    jest.mocked(sunrise.getDaylightWindow).mockReturnValue({
      sunrise: new Date(sunriseAt), sunset: new Date(at(18)),
    });
    jest.mocked(scoreWindowConditionScore).mockImplementation((forecast) => forecast.confidence_score ?? 0);
    // Keep the selector's cap separate from the canonical row scores.
    const selector = jest.spyOn(windowSelector, "selectBestWindows");
    restoreSelector = () => selector.mockRestore();
    selector.mockReturnValue([{
      start: new Date(sunriseAt), end: new Date(at(9)), score: 99, sourceForecast: rows[0],
    } as ReturnType<typeof selectBestWindows>[number]]);
  });

  afterEach(() => {
    jest.mocked(sunrise.getDaylightWindow).mockReset().mockImplementation(
      jest.requireActual("@/lib/alerts/sunrise").getDaylightWindow,
    );
    jest.mocked(scoreWindowConditionScore).mockReset().mockImplementation(
      jest.requireActual("@/lib/services/discovery/window-selector").scoreWindowConditionScore,
    );
    restoreSelector();
    jest.mocked(refineWindow).mockReset().mockImplementation(
      jest.requireActual("@/lib/alerts/window-refiner").refineWindow,
    );
    jest.mocked(evaluateForecastVerdict).mockReset().mockImplementation(
      jest.requireActual("@/lib/alerts/canonical-forecast-verdict").evaluateForecastVerdict,
    );
  });

  it("keeps the selector score and persists its serving row through the advertised window end", async () => {
    const built = await build();
    expect(built.candidates).toHaveLength(1);
    const selected = built.candidates[0];
    expect(selected).toMatchObject({
      sourceForecast: { forecast_at: at(5) }, physicalScore: 99,
    });
    expect(Date.parse(selected.window.start)).toBeGreaterThanOrEqual(Date.parse(sunriseAt));
    const mocked = deps({
      loadPool: async () => [beach], buildCandidates: async () => built,
      selectTitle: jest.fn(realSelectTitle),
    });
    const result = await runDailyCallCron({ now: runNow, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    const payload = jest.mocked(mocked.enqueue).mock.calls[0][0].payload!;
    const decision = payload.session_decision as ForecastVerdict["decision"];
    expect(payload).toMatchObject({ window_local: "6:54–9 AM", wave_height_ft: 4, decision_id: decision.decisionId });
    expect(selected.window).toMatchObject({ start: sunriseAt, end: at(9) });
    expect(decision).toMatchObject({
      verdict: "go", createdAt: runNow.toISOString(),
      scope: { windowStart: selected.window.start, windowEnd: selected.window.end },
      selection: {
        windowStart: selected.window.start, windowEnd: selected.window.end,
        forecastRef: { forecastAt: at(5), forecastId: "hour-5" }, evidence: { conditionScore: 84 },
      },
    });
    expect(Date.parse(decision.expiresAt)).toBeGreaterThanOrEqual(Date.parse(payload.window_end as string));
    expect(Date.parse(decision.expiresAt)).toBeGreaterThan(Date.parse(decision.createdAt));
    expect(parseDailyCallPayload(payload)).not.toBeNull();
  });

  it("skips a window at its end even when a row still has grid coverage", async () => {
    const built = await build(rows, new Date(at(9)));
    expect(built).toMatchObject({ candidates: [], noInWindowRowCount: 1 });
  });

  it("keeps the selector's 08:00 row and score for a healthy 08:00–12:00 window", async () => {
    const forecasts = [
      { ...rows[1], confidence_score: 75, wave_height: "3" },
      { ...rows[2], confidence_score: 85, wave_height: "5" },
    ];
    jest.mocked(selectBestWindows).mockReturnValueOnce([{
      start: new Date(at(8)), end: new Date(at(12)), score: 75, sourceForecast: forecasts[0],
    } as ReturnType<typeof selectBestWindows>[number]]);
    const built = await build(forecasts);
    expect(built.candidates).toHaveLength(1);
    expect(built.candidates[0]).toMatchObject({
      window: { start: at(8), end: at(12) },
      sourceForecast: { forecast_at: at(8), wave_height: "3" }, physicalScore: 75,
      sessionDecision: {
        expiresAt: at(12),
        selection: { forecastRef: { forecastAt: at(8) }, evidence: { conditionScore: 75 } },
      },
    });
    const alternative = candidate({ pool: favorite, start: at(8), end: at(12), physicalScore: 80 });
    expect(rankCandidates([...built.candidates, alternative], blacksId)[0]).toBe(alternative);
    const mocked = deps({
      loadPool: async () => [beach], buildCandidates: async () => built, selectTitle: jest.fn(realSelectTitle),
    });
    const result = await runDailyCallCron({ now: runNow, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(jest.mocked(mocked.enqueue).mock.calls[0][0].payload).toMatchObject({
      wave_height_ft: 3,
      session_decision: { selection: { forecastRef: { forecastAt: at(8) } } },
    });
  });

  it("rejects a default-path window inside the missing 08:00 grid interval", async () => {
    jest.mocked(refineWindow)
      .mockReturnValueOnce({ start: at(8), end: at(10), minutes: 120, drivers: [] })
      .mockReturnValueOnce(null);
    jest.mocked(selectBestWindows).mockReturnValueOnce([{
      start: new Date(at(8)), end: new Date(at(10)), score: 84, sourceForecast: rows[0],
    } as ReturnType<typeof selectBestWindows>[number]]);
    const built = await build([rows[0], rows[2]]);
    expect(built.candidates).toEqual([]);
    const mocked = deps({ loadPool: async () => [beach], buildCandidates: async () => built });
    const result = await runDailyCallCron({ now: runNow, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0 });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it.each([6, 8])("uses the best serving decision with shared ranking at %s AM", async (hour) => {
    const asOf = hour === 6 ? runNow : new Date(at(hour));
    const pick = {
      id: "shared-pick", beachId: blacksId, start: at(5), end: at(10),
      displayWindowStart: sunriseAt, displayWindowEnd: at(10), peakTime: at(5),
      conditionScore: 84, personalVerdict: "go", isBeachDayBest: true, rankedSpots: [],
    } as unknown as WeekScoutWindowResponse;
    const mocked: DailyCallDeps & DailyCallRankingDeps = {
      ...deps({
        loadProfiles: async () => [{ ...profile, dailyCallTime: `${String(hour).padStart(2, "0")}:00` }],
        loadPool: async () => [beach], selectTitle: jest.fn(realSelectTitle),
      }),
      usesSharedRanking: () => true,
      rankDay: async () => ({ days: [{
        localDate: "2026-10-15", windows: [pick], bestWindowId: pick.id,
        bestDayWindow: pick, exclusionReasons: [],
      }] }) as unknown as CanonicalWeekScoutResponse,
      loadBeachDay: async () => ({ forecasts: rows, tideSamples: null }),
    };
    const result = await runDailyCallCron({ now: asOf, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    const payload = jest.mocked(mocked.enqueue).mock.calls[0][0].payload!;
    const decision = payload.session_decision as ForecastVerdict["decision"];
    expect(decision).toMatchObject({
      verdict: "go", expiresAt: at(10), createdAt: asOf.toISOString(),
      scope: { windowStart: sunriseAt, windowEnd: at(10) },
      selection: { forecastRef: { forecastAt: at(hour === 6 ? 5 : 8) }, evidence: { conditionScore: hour === 6 ? 84 : 70 } },
    });
    expect(payload).toMatchObject({ wave_height_ft: hour === 6 ? 4 : 3, decision_id: decision.decisionId });
  });

  it("gives the decision the advertised lifetime even when the judged row is still upcoming", async () => {
    const selected = (await build(rows.slice(1))).candidates[0];
    const decision = selected.sessionDecision as ForecastVerdict["decision"];
    expect(Date.parse(decision.expiresAt)).toBeGreaterThanOrEqual(Date.parse(selected.window.end));
  });

  it("judges only rows inside the final cap, ignoring the selector's source outside it", async () => {
    jest.mocked(selectBestWindows).mockReturnValueOnce([{
      start: new Date(at(8)), end: new Date(at(9)), score: 99, sourceForecast: rows[0],
    } as ReturnType<typeof selectBestWindows>[number]]);
    const built = await build([rows[0], rows[1], { ...rows[2], confidence_score: 90 }]);
    expect(built.candidates).toHaveLength(1);
    expect(built.candidates[0]).toMatchObject({
      window: { start: at(8), end: at(9) },
      sourceForecast: { forecast_at: at(8) }, physicalScore: 70,
    });
  });

  it.each([6, 7])("matches main: a lone 05:00 go row has no candidate or send at %s:08", async (hour) => {
    const asOf = new Date(Date.parse(at(hour)) + 8 * 60_000);
    const built = await build(rows.slice(0, 1), asOf);
    expect(built).toMatchObject({ candidates: [], hadForecasts: true, noInWindowRowCount: 0 });
    const mocked = deps({
      loadProfiles: async () => [{ ...profile, dailyCallTime: `${String(hour).padStart(2, "0")}:00` }],
      loadPool: async () => [beach], buildCandidates: async () => built,
    });
    const result = await runDailyCallCron({ now: asOf, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0 });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    { hour: 8, nextNoHour: 11 },
    { hour: 14, nextNoHour: null },
  ])("real selector preserves main's one-hour advertised window starting at $hour:00", async ({ hour, nextNoHour }) => {
    restoreSelector();
    expect(jest.isMockFunction(selectBestWindows)).toBe(false);
    const goRow = sourceForecast(blacksId, {
      id: `go-${hour}`, forecast_at: at(hour), forecast_time: `${hour}:00:00`,
      forecast_date: "2026-10-15", confidence_score: 84,
    });
    const forecasts = nextNoHour === null ? [goRow] : [goRow, sourceForecast(blacksId, {
      ...goRow, id: `no-${nextNoHour}`, forecast_at: at(nextNoHour), forecast_time: `${nextNoHour}:00:00`,
      confidence_score: 0,
    })];
    const built = await build(forecasts);
    expect(built.candidates).toHaveLength(1);
    expect(built.candidates[0]).toMatchObject({
      window: { start: at(hour), end: at(hour + 1), minutes: 60, drivers: [] },
      sourceForecast: { id: goRow.id },
      sessionDecision: { expiresAt: at(hour + 1) },
    });
    expect(jest.mocked(evaluateForecastVerdict).mock.results.map((result) => result.value.verdict))
      .toEqual(nextNoHour === null ? ["go"] : ["go", "no"]);
    const mocked = deps({ loadPool: async () => [beach], buildCandidates: async () => built });
    const result = await runDailyCallCron({ now: runNow, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(jest.mocked(mocked.enqueue).mock.calls[0][0].payload).toMatchObject({
      window_start: at(hour), window_end: at(hour + 1), drivers: [],
    });
  });

  it.each([
    { label: "05:00/08:00 group capped at 08:00", hour: 6, forecasts: rows.slice(0, 2), endHour: 8, judgedHour: 5, score: 84 },
    { label: "future start with better 05:00 coverage", hour: 6, forecasts: rows, endHour: 9, judgedHour: 5, score: 84 },
    { label: "future start with better 08:00 coverage", hour: 6, forecasts: [rows[0], { ...rows[1], confidence_score: 95 }, rows[2]], endHour: 9, judgedHour: 8, score: 95 },
  ])("sends using step coverage: $label", async ({ hour, forecasts, endHour, judgedHour, score }) => {
    const asOf = new Date(Date.parse(at(hour)) + 8 * 60_000);
    jest.mocked(selectBestWindows).mockReturnValueOnce([{
      start: new Date(sunriseAt), end: new Date(at(endHour)),
    } as ReturnType<typeof selectBestWindows>[number]]);
    const built = await build(forecasts, asOf);
    expect(built.candidates).toHaveLength(1);
    expect(built.candidates[0]).toMatchObject({
      window: { start: sunriseAt, end: at(endHour) },
      sourceForecast: { forecast_at: at(judgedHour) }, physicalScore: score,
    });
    const mocked = deps({
      loadProfiles: async () => [{ ...profile, dailyCallTime: `${String(hour).padStart(2, "0")}:00` }],
      loadPool: async () => [beach], buildCandidates: async () => built,
      selectTitle: jest.fn(realSelectTitle),
    });
    const result = await runDailyCallCron({ now: asOf, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0, skippedCounts: { no_in_window_row: 0 } });
    const payload = jest.mocked(mocked.enqueue).mock.calls[0][0].payload!;
    const decision = payload.session_decision as ForecastVerdict["decision"];
    expect(decision).toMatchObject({
      createdAt: asOf.toISOString(), expiresAt: at(endHour),
      scope: { windowStart: sunriseAt, windowEnd: at(endHour) },
      selection: { forecastRef: { forecastAt: at(judgedHour) }, evidence: { conditionScore: score } },
    });
    expect(Date.parse(decision.expiresAt)).toBeGreaterThan(Date.parse(decision.createdAt));
  });

  it("skips when only a non-go row serves the capped window", async () => {
    const actual = jest.requireActual("@/lib/alerts/canonical-forecast-verdict");
    jest.mocked(evaluateForecastVerdict).mockImplementation((args) => ({
      ...actual.evaluateForecastVerdict(args),
      verdict: args.forecast.forecast_at === at(8) ? "no" : "go",
    }));
    jest.mocked(refineWindow).mockReturnValueOnce({ start: at(8), end: at(9), minutes: 60, drivers: [] });
    const built = await build(rows.slice(0, 2));
    expect(built).toMatchObject({ candidates: [], noInWindowRowCount: 1 });
    const mocked = deps({ buildCandidates: async () => built });
    const result = await runDailyCallCron({ now: runNow, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0, skippedCounts: { no_in_window_row: 1 } });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("counts two unservable built windows once for one user", async () => {
    const actual = jest.requireActual("@/lib/alerts/canonical-forecast-verdict");
    jest.mocked(evaluateForecastVerdict).mockImplementation((args) => ({
      ...actual.evaluateForecastVerdict(args),
      verdict: args.forecast.forecast_at === at(8) ? "no" : "go",
    }));
    jest.mocked(refineWindow)
      .mockReturnValueOnce({ start: at(8), end: at(9), minutes: 60, drivers: [] })
      .mockReturnValueOnce({ start: at(9), end: at(10), minutes: 60, drivers: [] });
    const built = await build();
    expect(built).toMatchObject({ candidates: [], noInWindowRowCount: 2 });
    const mocked = deps({ buildCandidates: async () => built });
    const result = await runDailyCallCron({ now: runNow, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0, skippedCounts: { no_in_window_row: 1 } });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it.each([false, true])("counts unservable windows once per unsent user (send available: %s)", async (sendAvailable) => {
    const mocked = deps({ buildCandidates: async () => ({
      candidates: sendAvailable ? [candidate({ pool: home, start: at(8), end: at(9) })] : [],
      hadForecasts: true, noInWindowRowCount: 2,
    }) });
    const result = await runDailyCallCron({ now: runNow, supabase, deps: mocked });
    expect(result).toMatchObject({
      sent: sendAvailable ? 1 : 0, silent: sendAvailable ? 0 : 1, errors: 0,
      skippedCounts: { no_in_window_row: sendAvailable ? 0 : 1 },
    });
  });

  it("rejects a window that ended even if its last row still has coverage", async () => {
    jest.mocked(selectBestWindows).mockReturnValueOnce([{
      start: new Date(sunriseAt), end: new Date("2026-10-15T15:30:00.000Z"),
    } as ReturnType<typeof selectBestWindows>[number]]);
    const built = await build(rows, new Date("2026-10-15T15:45:00.000Z"));
    expect(built).toMatchObject({ candidates: [], noInWindowRowCount: 1 });
  });

  it("preserves a gated recommendation label when rebuilding the window decision", async () => {
    const actual = jest.requireActual("@/lib/alerts/canonical-forecast-verdict");
    jest.mocked(evaluateForecastVerdict).mockImplementation((args) => {
      const evaluation: ForecastVerdict = actual.evaluateForecastVerdict(args);
      if (evaluation.decision.selection) evaluation.decision.selection.evidence.recommendationLabel = "Maybe";
      return evaluation;
    });
    expect((await build()).candidates).toEqual([]);
  });
});

describe("shared ranking (flag on)", () => {
  const enabledBefore = process.env.CALL_SHARED_RANKING_ENABLED;
  const allowlistBefore = process.env.CALL_SHARED_RANKING_USER_ALLOWLIST;
  const verdict = jest.mocked(evaluateForecastVerdict);
  const refiner = jest.mocked(refineWindow);

  function sharedForecast(beachId: string, overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
    return sourceForecast(beachId, { forecast_at: "2026-09-16T17:00:00.000Z", ...overrides });
  }

  function gridForecast(beachId: string, hour: number, waveHeight = "3"): EnhancedForecastEntity {
    return sourceForecast(beachId, {
      id: `${beachId}-${hour}`,
      forecast_at: new Date(Date.UTC(2026, 8, 16, hour + 7)).toISOString(),
      forecast_time: `${String(hour).padStart(2, "0")}:00:00`,
      wave_height: waveHeight,
    });
  }

  function window(
    beachId: string,
    overrides: Partial<WeekScoutWindowResponse> = {},
  ): WeekScoutWindowResponse {
    return {
      id: `window-${beachId}`,
      beachId,
      start: "2026-09-16T14:00:00.000Z",
      end: "2026-09-16T19:00:00.000Z",
      displayWindowStart: "2026-09-16T16:23:00.000Z",
      displayWindowEnd: "2026-09-16T18:41:00.000Z",
      peakTime: "2026-09-16T17:00:00.000Z",
      conditionScore: 82,
      personalVerdict: "go",
      isBeachDayBest: true,
      rankedSpots: [],
      ...overrides,
    } as WeekScoutWindowResponse;
  }

  function day(windows: WeekScoutWindowResponse[]): WeekScoutDayResponse {
    return {
      localDate: "2026-09-16",
      windows,
      bestWindowId: windows[0]?.id ?? null,
      bestDayWindow: windows[0] ?? null,
      exclusionReasons: [],
    };
  }

  function sharedDeps(
    scoutDay = day([window(blacksId)]),
    overrides: Partial<DailyCallDeps & DailyCallRankingDeps> = {},
  ): DailyCallDeps & DailyCallRankingDeps {
    return {
      ...deps(),
      loadPool: jest.fn(async () => [home, favorite].map((entry) => ({
        ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
      }))),
      selectTitle: jest.fn(realSelectTitle),
      usesSharedRanking: () => true,
      rankDay: jest.fn(async () => ({ days: [scoutDay] }) as CanonicalWeekScoutResponse),
      loadBeachDay: jest.fn(async ({ beach }) => ({
        forecasts: [sharedForecast(beach.id)],
        tideSamples: null,
      })),
      ...overrides,
    };
  }

  beforeEach(() => {
    verdict.mockImplementation((args) => {
      const decision = buildCanonicalSessionDecision({
        anchorTime: args.now.toISOString(),
        scope: {
          kind: "plan_next_session",
          windowStart: args.forecast.forecast_at,
          windowEnd: new Date(Date.parse(args.forecast.forecast_at) + 3_600_000).toISOString(),
          timezone: args.timezone,
        },
        profileExperience: "advanced",
        recommendationAvailability: {
          state: "available",
          holdEpoch: "daily-call",
          resolutionAsOf: args.now.toISOString(),
        },
        candidates: [{
          candidateId: `daily-call:${args.forecast.id}`,
          beachId: args.beach.id,
          beachName: args.beach.name,
          beachSkillLevel: "intermediate",
          windowStart: args.forecast.forecast_at,
          windowEnd: new Date(Date.parse(args.forecast.forecast_at) + 3_600_000).toISOString(),
          timezone: args.timezone,
          forecastId: args.forecast.id,
          forecastAt: args.forecast.forecast_at,
          waveHeight: args.forecast.wave_height,
          utilityScore: 90,
          recommendationLabel: "Worth it",
        }],
      });
      return { forecast: args.forecast, verdict: decision.verdict, score: 90, decision };
    });
    refiner.mockReturnValue(null);
  });

  afterEach(() => {
    verdict.mockReset().mockImplementation(
      jest.requireActual("@/lib/alerts/canonical-forecast-verdict").evaluateForecastVerdict,
    );
    refiner.mockReset().mockImplementation(
      jest.requireActual("@/lib/alerts/window-refiner").refineWindow,
    );
    if (enabledBefore === undefined) delete process.env.CALL_SHARED_RANKING_ENABLED;
    else process.env.CALL_SHARED_RANKING_ENABLED = enabledBefore;
    if (allowlistBefore === undefined) delete process.env.CALL_SHARED_RANKING_USER_ALLOWLIST;
    else process.env.CALL_SHARED_RANKING_USER_ALLOWLIST = allowlistBefore;
  });

  it("uses the shared pick and display pair when the old ranker picks another beach", async () => {
    const pick = window(blacksId);
    const mocked = sharedDeps(day([pick]));
    const shared = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(shared).toMatchObject({ sent: 1, errors: 0 });
    expect(mocked.buildCandidates).not.toHaveBeenCalled();
    expect(mocked.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        beach_id: blacksId,
        beach_name: "Blacks",
        window_start: pick.displayWindowStart,
        window_end: pick.displayWindowEnd,
        window_local: "9:23–11:41 AM",
        title: expect.stringContaining("Blacks"),
        drivers: [],
        comparison: null,
      }),
    }), supabase);

    const legacy = sharedDeps(day([pick]), {
      buildCandidates: mocked.buildCandidates,
      usesSharedRanking: () => false,
    });
    const flagOff = await runDailyCallCron({ now, supabase, deps: legacy });
    expect(flagOff).toMatchObject({ sent: 1, errors: 0 });
    expect(legacy.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        beach_id: ospreyId,
        window_start: "2026-09-16T15:00:00.000Z",
        window_end: "2026-09-16T16:40:00.000Z",
      }),
    }), supabase);
    expect(legacy.rankDay).not.toHaveBeenCalled();
    expect(legacy.loadBeachDay).not.toHaveBeenCalled();
  });

  it.each(["maybe", undefined] as const)("stays silent for personal verdict %s", async (personalVerdict) => {
    const mocked = sharedDeps(day([window(blacksId, { personalVerdict })]));
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0, skippedCounts: { no_go_window: 1 } });
    expect(mocked.loadBeachDay).not.toHaveBeenCalled();
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    { label: "held day", scoutDay: { ...day([]), exclusionReasons: ["major_event_hold"] } as WeekScoutDayResponse, skip: "no_clear_window" },
    { label: "held nomination", scoutDay: { ...day([window(blacksId)]), bestWindowId: null,
      exclusionReasons: ["major_event_hold"] } as WeekScoutDayResponse, skip: "no_clear_window" },
    { label: "no go windows", scoutDay: day([]), skip: "no_go_window" },
    { label: "missing forecasts", scoutDay: { ...day([]), exclusionReasons: ["no_forecasts"] } as WeekScoutDayResponse, skip: "no_forecast" },
  ])("stays silent for a $label", async ({ scoutDay, skip }) => {
    const mocked = sharedDeps(scoutDay);
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0, skippedCounts: { [skip]: 1 } });
    expect(mocked.loadBeachDay).not.toHaveBeenCalled();
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("counts a missing day as no_forecast", async () => {
    const mocked = sharedDeps(undefined, {
      rankDay: jest.fn(async () => ({ days: [] }) as unknown as CanonicalWeekScoutResponse),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ silent: 1, errors: 0, skippedCounts: { no_forecast: 1 } });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("falls back when the nominated display window closes inside 30 minutes", async () => {
    const closing = window(blacksId, { displayWindowEnd: "2026-09-16T13:20:00.000Z",
      displayWindowStart: "2026-09-16T12:00:00.000Z", conditionScore: 99 });
    const next = window(ospreyId);
    const mocked = sharedDeps(day([closing, next]));
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(mocked.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        beach_id: ospreyId, window_start: next.displayWindowStart, window_end: next.displayWindowEnd,
      }),
    }), supabase);
  });

  it("stays silent when every display window closes inside 30 minutes", async () => {
    const mocked = sharedDeps(day([window(blacksId, {
      displayWindowStart: "2026-09-16T12:00:00.000Z", displayWindowEnd: "2026-09-16T13:20:00.000Z",
    })]));
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ silent: 1, errors: 0, skippedCounts: { no_go_window: 1 } });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("keeps drivers within 15 minutes inclusive without moving the shared edges", async () => {
    const pick = window(blacksId);
    const startDriver = { kind: "tide" as const, edge: "start" as const,
      at: "2026-09-16T16:08:00.000Z", approximate: true, label: "rising tide" };
    const endDriver = { kind: "wind" as const, edge: "end" as const,
      at: "2026-09-16T18:56:00.001Z", approximate: true, label: "wind turns" };
    refiner.mockImplementationOnce((args) => {
      expect(args.coarse).toEqual({ start: pick.displayWindowStart, end: pick.displayWindowEnd });
      expect(args.verdictAt(args.forecasts[0])).toBe("go");
      expect(args).toMatchObject({ tideSamples: [{ at: pick.peakTime, heightFt: 3 }],
        daylight: { sunrise: expect.any(String), sunset: expect.any(String) } });
      return { start: startDriver.at, end: endDriver.at, minutes: 168, drivers: [startDriver, endDriver] };
    });
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: jest.fn(async () => ({
        forecasts: [sharedForecast(blacksId)], tideSamples: [{ at: pick.peakTime, heightFt: 3 }],
      })),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(refiner).toHaveBeenCalledTimes(1);
    expect(mocked.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        drivers: [startDriver], window_start: pick.displayWindowStart, window_end: pick.displayWindowEnd,
      }),
    }), supabase);
  });

  it("uses go options with day-best windows, home first, then ranked saved spots, at most two", async () => {
    const lead = poolBeach("30000000-0000-4000-8000-000000000001", "Nearby", "nearby");
    const custom = poolBeach("30000000-0000-4000-8000-000000000002", "Custom", "custom");
    const maybe = poolBeach("30000000-0000-4000-8000-000000000003", "Maybe", "favorite");
    const noWindow = poolBeach("30000000-0000-4000-8000-000000000004", "No window", "favorite");
    const pick = window(lead.beach.id, { rankedSpots: [
      { beachId: lead.beach.id, personalVerdict: "go" },
      { beachId: maybe.beach.id, personalVerdict: "maybe" },
      { beachId: noWindow.beach.id, personalVerdict: "go" },
      { beachId: "outside-pool", personalVerdict: "go" },
      { beachId: custom.beach.id, personalVerdict: "go" },
      { beachId: ospreyId, personalVerdict: "go" },
      { beachId: blacksId, personalVerdict: "go" },
    ] as WeekScoutWindowResponse["rankedSpots"] });
    const homeWindow = window(blacksId, { conditionScore: 55, displayWindowStart: "2026-09-16T15:00:00.000Z",
      displayWindowEnd: "2026-09-16T17:00:00.000Z" });
    const customWindow = window(custom.beach.id, { conditionScore: 65, displayWindowStart: "2026-09-16T18:00:00.000Z",
      displayWindowEnd: "2026-09-16T20:00:00.000Z" });
    const mocked = sharedDeps(day([pick, homeWindow, customWindow, window(ospreyId, { conditionScore: 99 }), window(maybe.beach.id),
      window(noWindow.beach.id, { isBeachDayBest: false })]), {
      loadPool: jest.fn(async () => [lead, home, favorite, custom, maybe, noWindow].map((entry) => ({
        ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
      }))),
      loadBeachDay: jest.fn(async ({ beach }) => ({
        forecasts: beach.id === custom.beach.id ? [] : [sharedForecast(beach.id, {
          forecast_at: beach.id === blacksId ? "2026-09-16T16:00:00.000Z" : "2026-09-16T17:00:00.000Z",
        })],
        tideSamples: null,
      })),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    const payload = (mocked.enqueue as jest.Mock).mock.calls[0][0].payload;
    expect(payload.options).toEqual([
      expect.objectContaining({ beach_id: blacksId, relation: "home", wave_height_ft: 3,
        window_start: homeWindow.displayWindowStart, window_end: homeWindow.displayWindowEnd }),
      expect.objectContaining({ beach_id: custom.beach.id, relation: "custom", wave_height_ft: null,
        window_start: customWindow.displayWindowStart, window_end: customWindow.displayWindowEnd }),
    ]);
    expect(payload.comparison).toBe("Rated higher than Blacks today");
  });

  it("builds the decision from the best serving row even when the go peak row scores lower", async () => {
    const pick = window(blacksId, { peakTime: "2026-09-16T18:00:00.000Z" });
    const earlier = gridForecast(blacksId, 8, "5");
    const peak = gridForecast(blacksId, 11, "3");
    const evaluate = verdict.getMockImplementation()!;
    verdict.mockImplementation((args) => ({ ...evaluate(args), score: args.forecast.id === peak.id ? 75 : 85 }));
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: [earlier, peak], tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T13:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(jest.mocked(mocked.enqueue).mock.calls[0][0].payload).toMatchObject({
      wave_height_ft: 5,
      session_decision: {
        verdict: "go", expiresAt: pick.displayWindowEnd,
        scope: { windowStart: pick.displayWindowStart, windowEnd: pick.displayWindowEnd },
        selection: { forecastRef: { forecastAt: earlier.forecast_at }, evidence: { conditionScore: 85 } },
      },
    });
    expect(verdict).toHaveBeenLastCalledWith({
      forecast: peak, beach: expect.objectContaining(home.beach), experienceLevel: "advanced",
      timezone: profile.timezone, now: new Date("2026-09-16T13:08:00.000Z"), candidateIdPrefix: "daily-call",
    });
  });

  it("fills two unheld options when the top option is held", async () => {
    const lead = poolBeach("30000000-0000-4000-8000-000000000001", "Lead", "nearby");
    const custom = poolBeach("30000000-0000-4000-8000-000000000002", "Custom", "custom");
    const nearby = poolBeach("30000000-0000-4000-8000-000000000003", "Nearby", "nearby");
    const pick = window(lead.beach.id, { rankedSpots: [nearby, custom, favorite, home].map((entry) => ({
      beachId: entry.beach.id, personalVerdict: "go",
    })) as WeekScoutWindowResponse["rankedSpots"] });
    const homeWindow = window(blacksId);
    const customWindow = window(custom.beach.id);
    const savedWindow = window(ospreyId);
    const nearbyWindow = window(nearby.beach.id);
    const mocked = sharedDeps(day([pick, homeWindow, customWindow, savedWindow, nearbyWindow]), {
      loadPool: jest.fn(async () => [lead, home, favorite, custom, nearby].map((entry) => ({
        ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
      }))),
      resolveHeldBeaches: jest.fn(async ({ candidates }) => new Map(candidates
        .filter((value) => value.beachId === blacksId)
        .map((value) => [value.candidateId, "water_quality_hold" as const]))),
    });

    const result = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(result).toMatchObject({ sent: 1, errors: 0, skippedCounts: { held_water_quality_hold: 1 } });
    const payload = (mocked.enqueue as jest.Mock).mock.calls[0][0].payload;
    expect(payload.options).toEqual([
      expect.objectContaining({ beach_id: custom.beach.id, relation: "custom" }),
      expect.objectContaining({ beach_id: ospreyId, relation: "favorite" }),
    ]);
    expect(payload.comparison).toBeNull();
    expect(mocked.resolveHeldBeaches).toHaveBeenCalledWith({
      candidates: [pick, homeWindow, customWindow, savedWindow, nearbyWindow].map((value, index) => ({
        candidateId: `daily-call:${index}`, beachId: value.beachId,
        startsAt: value.displayWindowStart, endsAt: value.displayWindowEnd,
      })),
      profileExperience: profile.experienceLevel, asOf: now,
    });
    expect(jest.mocked(mocked.loadBeachDay).mock.calls.map(([args]) => args.beach.id))
      .toEqual([lead.beach.id, custom.beach.id, ospreyId]);
  });

  it("loads both options and a separate home comparison concurrently without changing their order", async () => {
    const lead = poolBeach("30000000-0000-4000-8000-000000000001", "Lead", "nearby");
    const custom = poolBeach("30000000-0000-4000-8000-000000000002", "Custom", "custom");
    const pick = window(lead.beach.id, { rankedSpots: [custom, favorite].map((entry) => ({
      beachId: entry.beach.id, personalVerdict: "go",
    })) as WeekScoutWindowResponse["rankedSpots"] });
    const reads: string[] = [];
    const mocked = sharedDeps(day([pick, window(custom.beach.id), window(ospreyId), window(blacksId)]), {
      loadPool: jest.fn(async () => [lead, home, favorite, custom].map((entry) => ({
        ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
      }))),
      loadBeachDay: jest.fn(async ({ beach }) => {
        reads.push(beach.id);
        const data = { forecasts: [sharedForecast(beach.id)], tideSamples: null };
        if (beach.id === lead.beach.id) return data;
        await Promise.resolve();
        expect(reads).toEqual([lead.beach.id, custom.beach.id, ospreyId, blacksId]);
        // Complete the first option last to pin Promise.all's ordering.
        if (beach.id === custom.beach.id) await Promise.resolve();
        return data;
      }),
    });

    const result = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(result).toMatchObject({ sent: 1, errors: 0 });
    const payload = (mocked.enqueue as jest.Mock).mock.calls[0][0].payload;
    expect(payload.options).toEqual([
      expect.objectContaining({ beach_id: custom.beach.id, relation: "custom" }),
      expect.objectContaining({ beach_id: ospreyId, relation: "favorite" }),
    ]);
    expect(payload.comparison).toBe("Rated higher than Blacks today");
    expect(mocked.loadBeachDay).toHaveBeenCalledTimes(4);
  });

  it.each([
    { label: "69/75/0 scores at 08:00/11:00/14:00 with a 10:30 peak", peak: "17:30", hours: [8, 11, 14], sent: 1 },
    { label: "equal distances with the go row first", peak: "16:30", hours: [11, 8, 14], sent: 1 },
    { label: "equal distances with the maybe row first", peak: "16:30", hours: [8, 11, 14], sent: 0 },
  ])("$label uses main's nearest-row peak gate", async ({ peak, hours, sent }) => {
    const pick = window(blacksId, { peakTime: `2026-09-16T${peak}:00.000Z` });
    const scores: Record<string, number> = { "08:00:00": 69, "11:00:00": 75, "14:00:00": 0 };
    const evaluate = verdict.getMockImplementation()!;
    verdict.mockImplementation((args) => {
      const score = scores[args.forecast.forecast_time] ?? 0;
      return { ...evaluate(args), score, verdict: score >= 70 ? "go" : score > 0 ? "maybe" : "no" };
    });
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: hours.map((hour) => gridForecast(blacksId, hour)), tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T13:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({
      sent, silent: 1 - sent, errors: 0,
      skippedCounts: { ranking_verdict_mismatch: 1 - sent, no_in_window_row: 0 },
    });
    const payloads = jest.mocked(mocked.enqueue).mock.calls.map(([args]) => args.payload);
    const expectedPayload = expect.objectContaining({
      window_start: pick.displayWindowStart, window_end: pick.displayWindowEnd,
      session_decision: expect.objectContaining({
        verdict: "go", expiresAt: pick.displayWindowEnd,
        selection: expect.objectContaining({
          forecastRef: expect.objectContaining({ forecastAt: "2026-09-16T18:00:00.000Z" }),
          evidence: expect.objectContaining({ conditionScore: 75 }),
        }),
      }),
    });
    expect(payloads).toEqual(sent ? [expectedPayload] : []);
  });

  it("counts ranking_verdict_mismatch when the nearest row is not canonically go", async () => {
    const pick = window(blacksId, { peakTime: "2026-09-16T18:00:00.000Z" });
    const evaluate = verdict.getMockImplementation()!;
    verdict.mockImplementation((args) => ({
      ...evaluate(args),
      score: args.forecast.forecast_time === "08:00:00" ? 84 : 10,
      verdict: args.forecast.forecast_time === "08:00:00" ? "go" : "no",
    }));
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: [8, 11].map((hour) => gridForecast(blacksId, hour)), tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T13:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({
      sent: 0, silent: 1, errors: 0,
      skippedCounts: { ranking_verdict_mismatch: 1, no_in_window_row: 0 },
    });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    { peak: "18:00", goHour: "11:00:00", judgedAt: "18:00" },
    { peak: "16:25", goHour: "08:00:00", judgedAt: "15:00" },
  ])("sends with a go row nearest peak $peak and a non-go non-peak serving row", async ({ peak, goHour, judgedAt }) => {
    const pick = window(blacksId, { peakTime: `2026-09-16T${peak}:00.000Z` });
    const evaluate = verdict.getMockImplementation()!;
    verdict.mockImplementation((args) => ({
      ...evaluate(args), score: args.forecast.forecast_time === goHour ? 84 : 10,
      verdict: args.forecast.forecast_time === goHour ? "go" : "no",
    }));
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: [8, 11].map((hour) => gridForecast(blacksId, hour)), tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T13:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0, skippedCounts: { ranking_verdict_mismatch: 0 } });
    expect(jest.mocked(mocked.enqueue).mock.calls[0][0].payload).toMatchObject({
      session_decision: {
        expiresAt: pick.displayWindowEnd,
        selection: { forecastRef: { forecastAt: `2026-09-16T${judgedAt}:00.000Z` }, evidence: { conditionScore: 84 } },
      },
    });
  });

  it("rejects a 10:45 peak nearest the 11:00 non-go row when the 08:00 row is missing", async () => {
    const pick = window(blacksId, {
      displayWindowStart: "2026-09-16T14:00:00.000Z", displayWindowEnd: "2026-09-16T18:00:00.000Z",
      peakTime: "2026-09-16T17:45:00.000Z",
    });
    const evaluate = verdict.getMockImplementation()!;
    verdict.mockImplementation((args) => ({
      ...evaluate(args), score: args.forecast.forecast_time === "11:00:00" ? 10 : 84,
      verdict: args.forecast.forecast_time === "11:00:00" ? "no" : "go",
    }));
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: [5, 11].map((hour) => gridForecast(blacksId, hour)), tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T13:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({
      sent: 0, silent: 1, errors: 0,
      skippedCounts: { ranking_verdict_mismatch: 1, no_in_window_row: 0 },
    });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("sends when the 08:00 go row is nearest a 09:00 peak in a 07:00–11:00 window", async () => {
    const pick = window(blacksId, {
      displayWindowStart: "2026-09-16T14:00:00.000Z", displayWindowEnd: "2026-09-16T18:00:00.000Z",
      peakTime: "2026-09-16T16:00:00.000Z",
    });
    const evaluate = verdict.getMockImplementation()!;
    verdict.mockImplementation((args) => ({
      ...evaluate(args), score: args.forecast.forecast_time === "11:00:00" ? 10 : 84,
      verdict: args.forecast.forecast_time === "11:00:00" ? "no" : "go",
    }));
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: [5, 8, 11].map((hour) => gridForecast(blacksId, hour)), tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T13:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0, skippedCounts: { ranking_verdict_mismatch: 0 } });
    expect(jest.mocked(mocked.enqueue).mock.calls[0][0].payload).toMatchObject({
      window_start: pick.displayWindowStart, window_end: pick.displayWindowEnd,
      session_decision: { verdict: "go", expiresAt: pick.displayWindowEnd },
    });
  });

  it("counts no_in_window_row when all serving rows are non-go", async () => {
    const nearest = sourceForecast(blacksId, { id: "nearest", forecast_at: "2026-09-16T18:00:00.000Z" });
    verdict.mockReturnValue({ forecast: nearest, verdict: "maybe" } as ForecastVerdict);
    const mocked = sharedDeps(undefined, {
      loadBeachDay: jest.fn(async () => ({
        forecasts: [sourceForecast(blacksId), nearest], tideSamples: null,
      })),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0,
      skippedCounts: { no_in_window_row: 1 } });
    expect(mocked.enqueue).not.toHaveBeenCalled();
    expect(verdict).toHaveBeenLastCalledWith(expect.objectContaining({ forecast: nearest }));
  });

  it("counts a pick outside the pool", async () => {
    const mocked = sharedDeps(day([window("outside-pool")]));
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ silent: 1, errors: 0, skippedCounts: { ranking_beach_not_in_pool: 1 } });
    expect(mocked.loadBeachDay).not.toHaveBeenCalled();
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("counts missing winner forecast rows", async () => {
    const mocked = sharedDeps(undefined, {
      loadBeachDay: jest.fn(async () => ({ forecasts: [], tideSamples: null })),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ silent: 1, errors: 0, skippedCounts: { no_forecast: 1 } });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it("uses the in-effect go row for a shared 150-minute band between grid rows", async () => {
    const pick = window(blacksId, {
      displayWindowStart: "2026-09-16T15:15:00.000Z", displayWindowEnd: "2026-09-16T17:45:00.000Z",
      peakTime: "2026-09-16T15:30:00.000Z",
    });
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: [5, 8, 11].map((hour) => gridForecast(blacksId, hour)), tideSamples: null }),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0, skippedCounts: { no_in_window_row: 0, no_forecast: 0 } });
    expect(jest.mocked(mocked.enqueue).mock.calls[0][0].payload).toMatchObject({
      window_start: pick.displayWindowStart, window_end: pick.displayWindowEnd,
      session_decision: {
        expiresAt: pick.displayWindowEnd,
        selection: { forecastRef: { forecastAt: "2026-09-16T15:00:00.000Z" } },
      },
    });
  });

  it("does not bridge the missing 08:00 row between 05:00 and 11:00 in shared ranking", async () => {
    const pick = window(blacksId, {
      displayWindowStart: "2026-09-16T15:00:00.000Z", displayWindowEnd: "2026-09-16T17:00:00.000Z",
    });
    const mocked = sharedDeps(day([pick]), {
      loadBeachDay: async () => ({ forecasts: [5, 11].map((hour) => gridForecast(blacksId, hour)), tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T13:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({
      sent: 0, silent: 1, errors: 0, skippedCounts: { no_in_window_row: 1 },
    });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it.each([6, 7])("shared dawn window uses 05:00 coverage at %s:08", async (hour) => {
    const pick = window(blacksId, {
      displayWindowStart: "2026-09-16T13:54:00.000Z", displayWindowEnd: "2026-09-16T15:00:00.000Z",
      peakTime: "2026-09-16T14:00:00.000Z",
    });
    const mocked = sharedDeps(day([pick]), {
      loadProfiles: async () => [{ ...profile, dailyCallTime: `${String(hour).padStart(2, "0")}:00` }],
      loadBeachDay: async () => ({ forecasts: [gridForecast(blacksId, 5)], tideSamples: null }),
    });
    const asOf = new Date(Date.UTC(2026, 8, 16, hour + 7, 8));
    const result = await runDailyCallCron({ now: asOf, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0, skippedCounts: { no_in_window_row: 0 } });
    const payload = jest.mocked(mocked.enqueue).mock.calls[0][0].payload!;
    const decision = payload.session_decision as ForecastVerdict["decision"];
    expect(decision).toMatchObject({
      createdAt: asOf.toISOString(), expiresAt: pick.displayWindowEnd,
      scope: { windowStart: pick.displayWindowStart, windowEnd: pick.displayWindowEnd },
      selection: { forecastRef: { forecastAt: "2026-09-16T12:00:00.000Z" } },
    });
    expect(Date.parse(decision.expiresAt)).toBeGreaterThan(Date.parse(decision.createdAt));
  });

  it("skips the shared dawn window after its advertised end", async () => {
    const pick = window(blacksId, {
      displayWindowStart: "2026-09-16T13:54:00.000Z", displayWindowEnd: "2026-09-16T15:00:00.000Z",
    });
    const mocked = sharedDeps(day([pick]), {
      loadProfiles: async () => [{ ...profile, dailyCallTime: "08:00" }],
      loadBeachDay: async () => ({ forecasts: [gridForecast(blacksId, 5)], tideSamples: null }),
    });
    const result = await runDailyCallCron({ now: new Date("2026-09-16T15:08:00.000Z"), supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0 });
    expect(mocked.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    { label: "no row in the band", start: "15:15", end: "17:45", peak: "15:30", height: 3 },
    { label: "a serving pre-window row nearest the excluded end row", start: "13:54", end: "15:00", peak: "14:55", height: 4 },
  ])("keeps option heights and the home comparison with $label", async ({ start, end, peak, height }) => {
    const lead = poolBeach("30000000-0000-4000-8000-000000000001", "Lead", "nearby");
    const pick = window(lead.beach.id, {
      rankedSpots: [{ beachId: ospreyId, personalVerdict: "go" }] as WeekScoutWindowResponse["rankedSpots"],
    });
    const option = window(ospreyId, {
      displayWindowStart: `2026-09-16T${start}:00.000Z`, displayWindowEnd: `2026-09-16T${end}:00.000Z`,
      peakTime: `2026-09-16T${peak}:00.000Z`,
    });
    const homeWindow = window(blacksId, {
      displayWindowStart: "2026-09-16T13:54:00.000Z", displayWindowEnd: "2026-09-16T15:00:00.000Z",
      peakTime: "2026-09-16T14:55:00.000Z", conditionScore: 55,
    });
    const mocked = sharedDeps(day([pick, option, homeWindow]), {
      loadPool: async () => [lead, favorite, home].map((entry) => ({
        ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
      })),
      loadBeachDay: async ({ beach }) => ({
        forecasts: beach.id === lead.beach.id ? [gridForecast(beach.id, 11, "5")]
          : [5, 8, 11].map((hour) => gridForecast(beach.id, hour,
            beach.id === blacksId ? (hour === 5 ? "2" : "7") : hour === 5 ? "4" : "3")),
        tideSamples: null,
      }),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(jest.mocked(mocked.enqueue).mock.calls[0][0].payload).toMatchObject({
      comparison: "Bigger than Blacks today",
      options: [{ beach_id: ospreyId, wave_height_ft: height }],
    });
  });

  it("passes the session preference and resolved pool anchor to ranking", async () => {
    const location = { lat: 21.28, lon: -157.83, timezone: "Pacific/Honolulu", captured_at: now.toISOString() };
    const mocked = sharedDeps(undefined, {
      loadProfiles: jest.fn(async () => [{ ...profile, preferredSessionTime: "morning" as const, location }]),
    });
    await runDailyCallCron({ now, supabase, deps: mocked });
    expect(mocked.rankDay).toHaveBeenCalledWith({
      userId, poolBeachIds: [blacksId, ospreyId], timezone: profile.timezone, localDate: "2026-09-16",
      sessionTime: "morning", anchor: { lat: location.lat, lon: location.lon }, driveRadiusMiles: 100,
    });
  });

  it.each(["major_event_hold", "water_quality_hold", "hold_state_unavailable"] as const)(
    "stays silent when the shared pick is held: %s", async (reason) => {
      const pick = window(blacksId);
      const mocked = sharedDeps(day([pick, window(ospreyId)]), {
        resolveHeldBeaches: jest.fn(async ({ candidates }) => new Map(
          candidates.filter((value) => value.beachId === blacksId).map((value) => [value.candidateId, reason]),
        )),
      });
      const result = await runDailyCallCron({ now, supabase, deps: mocked });
      expect(result).toMatchObject({ sent: 0, silent: 1, errors: 0,
        skippedCounts: { [`held_${reason}`]: 1, no_clear_window: 1, no_go_window: 0 } });
      expect(mocked.resolveHeldBeaches).toHaveBeenCalledWith({
        candidates: [{ candidateId: "daily-call:0", beachId: blacksId,
          startsAt: pick.displayWindowStart, endsAt: pick.displayWindowEnd }],
        profileExperience: profile.experienceLevel, asOf: now,
      });
      expect(mocked.enqueue).not.toHaveBeenCalled();
      expect(mocked.loadBeachDay).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])("drops a held home comparison and options (home option: %s)", async (homeOption) => {
    const lead = poolBeach("30000000-0000-4000-8000-000000000001", "Nearby", "nearby");
    const pick = window(lead.beach.id, { rankedSpots: [
      ...(homeOption ? [{ beachId: blacksId, personalVerdict: "go" }] : []),
      { beachId: ospreyId, personalVerdict: "go" },
    ] as WeekScoutWindowResponse["rankedSpots"] });
    const homeWindow = window(blacksId);
    const savedWindow = window(ospreyId);
    const mocked = sharedDeps(day([pick, homeWindow, savedWindow]), {
      loadPool: jest.fn(async () => [lead, home, favorite].map((entry) => ({
        ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
      }))),
      resolveHeldBeaches: jest.fn(async ({ candidates }) => new Map(candidates
        .filter((value) => value.beachId !== lead.beach.id)
        .map((value) => [value.candidateId, "water_quality_hold" as const]))),
    });
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0, skippedCounts: { held_water_quality_hold: 2 } });
    expect(mocked.resolveHeldBeaches).toHaveBeenCalledWith({
      candidates: expect.arrayContaining([pick, homeWindow, savedWindow].map((value) => ({
        candidateId: expect.any(String), beachId: value.beachId,
        startsAt: value.displayWindowStart, endsAt: value.displayWindowEnd,
      }))),
      profileExperience: profile.experienceLevel, asOf: now,
    });
    const payload = (mocked.enqueue as jest.Mock).mock.calls[0][0].payload;
    expect(payload).toMatchObject({ beach_id: lead.beach.id, comparison: null });
    expect(payload).not.toHaveProperty("options");
    expect(payload.title).not.toContain("Blacks");
    expect(payload.reason).not.toContain("Blacks");
  });

  it("passes the same capped pool to both ranking paths", async () => {
    const nearby = Array.from({ length: 60 }, (_, index) => ({
      ...poolBeach(`40000000-0000-4000-8000-${String(index).padStart(12, "0")}`, `Nearby ${index}`, "nearby"),
      distanceMiles: 60 - index,
    }));
    const custom = poolBeach("30000000-0000-4000-8000-000000000001", "Custom", "custom");
    const loadPool = jest.fn(async () => [home, favorite, custom, ...nearby].map((entry) => ({
      ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
    })));
    const shared = sharedDeps(undefined, { loadPool });
    const legacy = sharedDeps(undefined, { loadPool, usesSharedRanking: () => false });
    expect(await runDailyCallCron({ now, supabase, deps: shared })).toMatchObject({ sent: 1, errors: 0 });
    expect(await runDailyCallCron({ now, supabase, deps: legacy })).toMatchObject({ sent: 1, errors: 0 });
    const expected = [home, favorite, custom, ...nearby.slice(10)].map((entry) => entry.beach.id);
    expect(jest.mocked(shared.rankDay).mock.calls[0][0].poolBeachIds).toEqual(expected);
    expect(jest.mocked(legacy.buildCandidates).mock.calls[0][0].pool.map((entry) => entry.beach.id)).toEqual(expected);
  });

  it("passes a beginner's distant eligible beach into shared ranking", async () => {
    const nearby = Array.from({ length: 50 }, (_, index) => {
      const entry = poolBeach(`40000000-0000-4000-8000-${String(index).padStart(12, "0")}`, `Intermediate ${index}`, "nearby");
      return { ...entry, beach: { ...entry.beach, skill_level: "intermediate" }, distanceMiles: index + 1 };
    });
    const beginnerEntry = poolBeach("40000000-0000-4000-8000-000000000051", "Beginner Beach", "nearby");
    const beginner = {
      ...beginnerEntry,
      beach: { ...beginnerEntry.beach, skill_level: "beginner" },
      distanceMiles: 51,
    };
    const mocked = sharedDeps(day([window(beginner.beach.id)]), {
      loadProfiles: jest.fn(async () => [{ ...profile, experienceLevel: "beginner" }]),
      loadPool: jest.fn(async () => [home, favorite, ...nearby, beginner].map((entry) => ({
        ...entry, beach: { ...entry.beach, lat: 32.89, lon: -117.25 },
      }))),
    });

    const result = await runDailyCallCron({ now, supabase, deps: mocked });

    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(jest.mocked(mocked.rankDay).mock.calls[0][0].poolBeachIds).toContain(beginner.beach.id);
    expect((mocked.enqueue as jest.Mock).mock.calls[0][0].payload.beach_id).toBe(beginner.beach.id);
  });

  it.each([11, 12, 13, 25])("uses the Daily Call's 12-hour anchor for a %s-hour fix", async (ageHours) => {
    const homeBeach = { ...home.beach, lat: 32.89, lon: -117.25 };
    const location = { lat: 33.15, lon: -117.35, timezone: profile.timezone!,
      captured_at: new Date(now.getTime() - ageHours * 3_600_000).toISOString() };
    const mocked = sharedDeps(undefined, {
      loadProfiles: jest.fn(async () => [{ ...profile, homeBeach, location, maxDriveMinutes: 90 }]),
    });
    await runDailyCallCron({ now, supabase, deps: mocked });
    const anchor = ageHours <= 12 ? { lat: location.lat, lon: location.lon } : { lat: homeBeach.lat, lon: homeBeach.lon };
    expect(mocked.loadPool).toHaveBeenCalledWith(expect.objectContaining({ location: anchor }));
    expect(mocked.rankDay).toHaveBeenCalledWith(expect.objectContaining({ anchor, driveRadiusMiles: 45 }));
  });

  it("uses the default flag and allowlist gate", async () => {
    const { usesSharedRanking: _usesSharedRanking, ...mocked } = sharedDeps();
    delete process.env.CALL_SHARED_RANKING_ENABLED;
    process.env.CALL_SHARED_RANKING_USER_ALLOWLIST = userId;
    await runDailyCallCron({ now, supabase, deps: mocked });
    expect(mocked.rankDay).not.toHaveBeenCalled();
    expect(mocked.loadBeachDay).not.toHaveBeenCalled();
    process.env.CALL_SHARED_RANKING_ENABLED = "true";
    process.env.CALL_SHARED_RANKING_USER_ALLOWLIST = "another-user";
    await runDailyCallCron({ now, supabase, deps: mocked });
    expect(mocked.rankDay).not.toHaveBeenCalled();
    process.env.CALL_SHARED_RANKING_USER_ALLOWLIST = ` ${userId} `;
    const result = await runDailyCallCron({ now, supabase, deps: mocked });
    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(mocked.rankDay).toHaveBeenCalledTimes(1);
  });
});

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
  it("prints beach-local windows while scheduling on the user clock", async () => {
    const waikiki = poolBeach("30000000-0000-4000-8000-000000000004", "Waikiki – Canoes", "nearby");
    waikiki.beach.timezone = "Pacific/Honolulu";
    const hawaiiFavorite = { ...favorite, beach: { ...favorite.beach, timezone: "Pacific/Honolulu" } };
    const start = "2026-10-11T18:00:00.000Z";
    const end = "2026-10-11T21:00:00.000Z";
    const mocked = deps({
      loadPool: async () => [waikiki, home, hawaiiFavorite],
      buildCandidates: jest.fn(async () => ({
        candidates: [
          candidate({ pool: waikiki, start, end, physicalScore: 90 }),
          candidate({ pool: home, start, end, physicalScore: 80 }),
          candidate({ pool: hawaiiFavorite, start, end, physicalScore: 70 }),
        ],
        hadForecasts: true,
      })),
      selectTitle: jest.fn(realSelectTitle),
    });
    const { resolveTimezone: _resolveTimezone, ...injected } = mocked;

    const summary = await runDailyCallCron({ now: new Date("2026-10-11T13:00:00.000Z"), supabase, deps: injected });

    expect(summary).toMatchObject({ sent: 1, errors: 0 });
    expect(mocked.buildCandidates).toHaveBeenCalledWith(expect.objectContaining({
      timezone: "America/Los_Angeles", alertDate: "2026-10-11",
    }));
    expect(mocked.alreadySentToday).toHaveBeenCalledWith(userId, "2026-10-11");
    const enqueueArgs = jest.mocked(mocked.enqueue).mock.calls[0][0];
    const payload = parseDailyCallPayload(enqueueArgs.payload);
    const push = NOTIFICATION_REGISTRY.daily_call.buildPushPayload!(payload);
    expect(push.title).toContain("8 to 11 AM");
    expect(push.title).not.toContain("11 AM to 2 PM");
    expect(enqueueArgs.dedupeKey).toBe(`daily_call:${userId}:2026-10-11`);
    expect(payload).toMatchObject({
      alert_date: "2026-10-11", window_start: start, window_end: end, window_local: "8–~11 AM",
      options: [
        { beach_id: home.beach.id, window_local: "11 AM–~2 PM" },
        { beach_id: hawaiiFavorite.beach.id, window_local: "8–~11 AM" },
      ],
    });
    expect(push.body).toContain("Best before the wind picks up around 11 AM.");
    expect(push.body).toContain("Also: Blacks 11 AM–~2 PM, Osprey 8–~11 AM.");
    expect(payload.reason).not.toContain("around 2 PM");
  });

  it.each([null, ""])("falls back to the user clock when the beach timezone is %s", async (timezone) => {
    // Exercise missing data despite the generated type requiring a timezone.
    const beach = { ...favorite, beach: { ...favorite.beach, timezone } as PoolBeach["beach"] };
    const mocked = deps({
      loadProfiles: async () => [{ ...profile, timezone: "Pacific/Honolulu" }],
      loadPool: async () => [beach],
      buildCandidates: async () => ({
        candidates: [candidate({
          pool: beach, start: "2026-10-11T18:00:00.000Z", end: "2026-10-11T21:00:00.000Z",
        })],
        hadForecasts: true,
      }),
      selectTitle: realSelectTitle,
    });
    const { resolveTimezone: _resolveTimezone, ...injected } = mocked;

    const summary = await runDailyCallCron({ now: new Date("2026-10-11T16:00:00.000Z"), supabase, deps: injected });

    expect(summary).toMatchObject({ sent: 1, errors: 0 });
    const payload = parseDailyCallPayload(jest.mocked(mocked.enqueue).mock.calls[0][0].payload);
    expect(payload.window_local).toBe("8–~11 AM");
    expect(payload.title).toContain("8 to 11 AM");
    expect(payload.reason).toContain("around 11 AM.");
  });

  it("logs the reason and message when enqueue fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const mocked = deps({
      enqueue: jest.fn(async () => ({
        enqueued: false as const,
        reason: "invalid_payload" as const,
        message: "title: too long",
      })),
    });

    try {
      const summary = await runDailyCallCron({ now, supabase, deps: mocked });

      expect(summary.sent).toBe(0);
      expect(summary.skippedCounts.enqueue_failed).toBe(1);
      expect(summary.errors).toBe(1);
      expect(consoleError).toHaveBeenCalledWith("[daily-call] enqueue failed", {
        userId,
        reason: "invalid_payload",
        message: "title: too long",
      });
    } finally {
      consoleError.mockRestore();
    }
  });

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
          title: "Wind stays polite. Osprey 8:00 to 9:40",
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
      title: "Offshore's on. Osprey 5:30 to 7:30",
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
    expect(summary.skippedCounts).toMatchObject({ no_go_window: 0, no_clear_window: 1, held_hold_state_unavailable: 2 });
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

    expect(payload.title).toMatch(/^\S.*\. Torrey Pines 8 to 11 AM$/);
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
  it.each([96, 1])("resolves a %s-hour Honolulu fix before pool selection and timezone fallback", async (ageHours) => {
    // The morning call trusts a fix from the last 12 hours; older ones fall back to the home beach,
    // and past three days a far fix no longer says the surfer is away.
    const stale = ageHours > 12;
    const runNow = stale ? now : new Date("2026-09-16T16:00:00Z");
    const homeBeach = { ...home.beach, lat: 32.89, lon: -117.25 };
    const location = { lat: 21.28, lon: -157.83, timezone: "Pacific/Honolulu",
      captured_at: new Date(runNow.getTime() - ageHours * 3_600_000).toISOString() };
    const user = { ...profile, timezone: null, homeBeach: { ...homeBeach, timezone: null }, location };
    const sanDiego = poolBeach("30000000-0000-4000-8000-000000000003", "La Jolla", "nearby");
    const honolulu = poolBeach("30000000-0000-4000-8000-000000000004", "Waikiki", "nearby");
    honolulu.beach.timezone = "Pacific/Honolulu";
    const nearby = stale ? sanDiego : honolulu;
    const rpc = jest.fn(async (_name: string, input: { input_lat: number }) => ({ data: [{ id: input.input_lat === homeBeach.lat ? sanDiego.beach.id : honolulu.beach.id, distance_meters: 1000 }], error: null }));
    const select = jest.fn();
    const client = { rpc, from: (table: string) => {
      const builder: Record<string, unknown> = {};
      let ids: string[] = [];
      builder.select = (fields: string) => { select(fields); return builder; };
      builder.order = builder.eq = builder.not = () => builder;
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
    expect(overrides.loadPool).toHaveBeenCalledWith(expect.objectContaining({ location: stale
      ? { lat: homeBeach.lat, lon: homeBeach.lon } : { lat: location.lat, lon: location.lon } }));
    expect(overrides.getSunrise).toHaveBeenCalledWith(expect.objectContaining({ location: stale ? null : { user_id: userId, ...location } }), runNow);
    expect(overrides.buildCandidates).toHaveBeenCalledWith(expect.objectContaining({ timezone: stale ? "America/Los_Angeles" : "Pacific/Honolulu" }));
    expect(overrides.enqueue).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      beach_id: nearby.beach.id, beach_name: nearby.beach.name, anchor_source: stale ? "home" : "location",
      window_local: stale ? "8–~11:40 AM" : "5–~8:40 AM",
    }) }), client);
    expect(select).toHaveBeenCalledWith("user_id, lat, lon, timezone, captured_at");
    expect(rpc).toHaveBeenCalledWith("get_weekend_scout_candidates", expect.objectContaining({ input_lat: stale ? homeBeach.lat : location.lat }));
  });

  it.each([12.02, 21, 72])("stays silent when a %s-hour fix puts the surfer outside the home drive range", async (ageHours) => {
    const location = { lat: 39.96, lon: -75.17, timezone: "America/New_York",
      captured_at: new Date(now.getTime() - ageHours * 3_600_000).toISOString() };
    const injected = deps({ loadProfiles: async () => [{ ...profile, maxDriveMinutes: 90,
      homeBeach: { ...home.beach, lat: 32.75, lon: -117.25 }, location }] });

    const result = await runDailyCallCron({ now, supabase, deps: injected });

    expect(result.skippedCounts.away_from_home).toBe(1);
    expect(result.silent).toBe(1);
    expect(injected.loadPool).not.toHaveBeenCalled();
    expect(injected.enqueue).not.toHaveBeenCalled();
  });

  it("still calls the home beach when a stale fix is inland of it, beyond a short drive range", async () => {
    // Poway is ~22 miles from OB Pier; a 30-minute range is 15 miles.
    const location = { lat: 32.96, lon: -117.04, timezone: "America/Los_Angeles",
      captured_at: new Date(now.getTime() - 20 * 3_600_000).toISOString() };
    const homeBeach = { ...home.beach, lat: 32.75, lon: -117.25 };
    const injected = deps({ loadProfiles: async () => [{ ...profile, maxDriveMinutes: 30, homeBeach, location }] });

    const result = await runDailyCallCron({ now, supabase, deps: injected });

    expect(result.sent).toBe(1);
    expect(injected.loadPool).toHaveBeenCalledWith(expect.objectContaining({ location: { lat: 32.75, lon: -117.25 } }));
  });

  it.each([
    ["2026-10-14T10:08:00Z", "no_pool"],
    ["2026-10-14T13:08:00Z", "not_send_hour"],
  ])("sends at 6 AM where a trusted fix is, not at the profile's 6 AM (%s)", async (at, skip) => {
    const runNow = new Date(at);
    const location = { lat: 39.96, lon: -75.17, timezone: "America/New_York",
      captured_at: new Date(Date.parse("2026-10-14T10:08:00Z") - 9 * 3_600_000).toISOString() };
    const injected = deps({
      loadProfiles: async () => [{ ...profile, homeBeach: { ...home.beach, lat: 32.75, lon: -117.25 }, location }],
      loadPool: jest.fn(async () => []),
    });
    const { resolveTimezone: _resolveTimezone, ...overrides } = injected;

    const result = await runDailyCallCron({ now: runNow, supabase, deps: overrides });

    expect(result.skippedCounts[skip]).toBe(1);
    expect(result.skippedCounts.away_from_home).toBe(0);
  });

  it("times a sunrise call from a trusted fix, not the home beach", async () => {
    const daylight = jest.mocked(sunrise.getDaylightWindow);
    daylight.mockClear();
    const runNow = new Date("2026-10-14T11:30:00Z");
    const location = { lat: 39.96, lon: -75.17, timezone: "America/New_York",
      captured_at: new Date(runNow.getTime() - 3_600_000).toISOString() };
    const injected = deps({
      loadProfiles: async () => [{ ...profile, dailyCallTime: "sunrise",
        homeBeach: { ...home.beach, lat: 32.75, lon: -117.25 }, location }],
      loadPool: jest.fn(async () => []),
    });
    const { getSunrise: _getSunrise, resolveTimezone: _resolveTimezone, ...overrides } = injected;

    await runDailyCallCron({ now: runNow, supabase, deps: overrides });

    expect(daylight).toHaveBeenCalledWith(39.96, -75.17, runNow);
    expect(daylight).not.toHaveBeenCalledWith(32.75, -117.25, expect.anything());
  });

  it("ranks the 50 nearest beaches plus every saved spot in range", async () => {
    const nearby = Array.from({ length: 60 }, (_, index) => ({
      ...poolBeach(`40000000-0000-4000-8000-${String(index).padStart(12, "0")}`, `Nearby ${index}`, "nearby"),
      distanceMiles: 60 - index,
    }));
    const injected = deps({ loadPool: jest.fn(async () => [home, favorite, ...nearby]) });

    await runDailyCallCron({ now, supabase, deps: injected });

    const { pool } = jest.mocked(injected.buildCandidates).mock.calls[0][0];
    expect(pool).toHaveLength(52);
    expect(pool).toEqual(expect.arrayContaining([home, favorite, nearby[59], nearby[10]]));
    expect(pool).not.toContain(nearby[9]);
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
