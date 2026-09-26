/**
 * @jest-environment node
 */

jest.mock("@/lib/alerts/user-pool", () => ({ loadUserPool: jest.fn() }));
jest.mock("@/lib/recommendations/major-swell-awareness/official-advisory-adapter", () => ({
  loadOfficialSwellAdvisories: jest.fn(async () => []),
  loadNwsSwellAdvisories: jest.fn(async () => []),
}));
jest.mock("@/lib/alerts/swell-events", () => ({
  ...jest.requireActual("@/lib/alerts/swell-events"),
  detectBeachSwellEvents: jest.fn(),
  loadRecentSwellSnapshots: jest.fn(async () => []),
}));
jest.mock("@/lib/alerts/canonical-forecast-verdict", () => {
  const actual = jest.requireActual("@/lib/alerts/canonical-forecast-verdict");
  return {
    ...actual,
    evaluateForecastVerdict: jest.fn(actual.evaluateForecastVerdict),
  };
});

import type { SupabaseClient } from "@supabase/supabase-js";

import snapshot from "@/__tests__/fixtures/grandview-crossing-swells-20260911.json";
import { evaluateForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import { detectBeachSwellEvents, loadRecentSwellSnapshots } from "@/lib/alerts/swell-events";
import { loadUserPool } from "@/lib/alerts/user-pool";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";
import {
  runSwellAlertCron,
  type SwellAlertDeps,
  type SwellAlertProfile,
} from "@/lib/cron/swell-alert-runner";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { scoreNativeForecastSlot } from "@/lib/scoring/native-condition-score";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// 17:00 PDT on 2026-09-17, the send hour; the event starts tomorrow.
const NOW = new Date("2026-09-18T00:00:00.000Z");
const PEAK_AT = "2026-09-19T16:00:00.000Z";
const actualVerdict = jest.requireActual(
  "@/lib/alerts/canonical-forecast-verdict",
).evaluateForecastVerdict as typeof evaluateForecastVerdict;

const beach = {
  ...(snapshot.beach as unknown as Beach),
  short_name: null,
  slug: "grandview",
  state: "CA",
  nws_forecast_zone: null,
} as Beach;
const crossing = snapshot.forecast as EnhancedForecastEntity;
const clean: EnhancedForecastEntity = {
  ...crossing,
  swell_2_direction: crossing.swell_1_direction,
};
const flat: EnhancedForecastEntity = {
  ...clean,
  wave_height: "0.5 ft",
  wave_period: "6s",
  swell_1_height: "0.4 ft",
  swell_1_period: "6s",
};

function at(forecast: EnhancedForecastEntity, id: string, forecastAt: string): EnhancedForecastEntity {
  return { ...forecast, id, forecast_at: forecastAt };
}

const profile: SwellAlertProfile = {
  id: "73040cff-afe9-4fa0-a874-2016203fc015",
  timezone: "America/Los_Angeles",
  homeBeachId: beach.id,
  location: null,
  maxDriveMinutes: null,
  experienceLevel: "intermediate",
  notifPushEnabled: true,
  notifSwellAlerts: true,
};

type QueryOp = [string, unknown[]];

/** enhanced_forecasts fake that sorts and pages like PostgREST and never returns more than `cap` rows. */
function cappedForecastClient(rows: EnhancedForecastEntity[], cap = 1000) {
  const queries: QueryOp[][] = [];
  const sorted = [...rows].sort((left, right) =>
    left.forecast_at.localeCompare(right.forecast_at)
    || left.beach_id.localeCompare(right.beach_id));
  const from = jest.fn(() => {
    const ops: QueryOp[] = [];
    queries.push(ops);
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "in", "gte", "lt", "order"]) {
      chain[method] = (...args: unknown[]) => {
        ops.push([method, args]);
        return chain;
      };
    }
    chain.range = async (first: number, last: number) => {
      ops.push(["range", [first, last]]);
      return {
        data: sorted.slice(first, Math.min(last + 1, first + cap)),
        error: null,
      };
    };
    return chain;
  });
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    queries,
  };
}

function forecastClient(rows: EnhancedForecastEntity[]): SupabaseClient<Database> {
  return cappedForecastClient(rows).client;
}

function dependencies(): Partial<SwellAlertDeps> {
  return {
    isEnabled: () => true,
    isUserAllowed: () => true,
    loadProfiles: async () => [profile],
    loadAlertState: async () => ({
      eventExists: false,
      lastAlertAt: null,
      recentTitleIds: [],
      recentFilmCount: 0,
    }),
    insertAlert: jest.fn(async () => ({ id: "alert-1" })),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    markAlertEnqueued: jest.fn(async () => undefined),
    recordForecast: jest.fn(async () => ({ inserted: true })),
  };
}

const flatHistory = [
  at(flat, "flat-14", "2026-09-14T19:00:00.000Z"),
  at(flat, "flat-15", "2026-09-15T19:00:00.000Z"),
  at(flat, "flat-16", "2026-09-16T19:00:00.000Z"),
];

beforeEach(() => {
  jest.mocked(evaluateForecastVerdict).mockImplementation(actualVerdict);
  jest.mocked(loadUserPool).mockResolvedValue([
    { beach, relation: "home", distanceMiles: null },
  ]);
  jest.mocked(loadRecentSwellSnapshots).mockResolvedValue([]);
  jest.mocked(detectBeachSwellEvents).mockImplementation(({ beach: detected }) => [beachSwellEvent({
    beachId: detected.id,
    eventKey: `${detected.id}:W:2026-09-19`,
    directionDeg: 247.5,
    directionBand: "W",
    directionLabel: "WSW",
    periodS: 18,
    peakOffshoreHeightFt: 2.5,
    peakFaceHeightFt: 3.2,
    // 08:00 PDT tomorrow.
    arrivalAt: "2026-09-18T15:00:00.000Z",
    peakAt: PEAK_AT,
    fadeAt: "2026-09-20T07:00:00.000Z",
    peakLocalDate: "2026-09-19",
  })]);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("swell alert pool evaluation with the canonical verdict", () => {
  it("does not alert on crossing swells the old 70 threshold would have called go", async () => {
    const peak = at(crossing, "peak", PEAK_AT);
    const legacyScore = scoreNativeForecastSlot(peak, "intermediate", null, {
      windDirectionDeg: peak.wind_direction_deg ?? null,
      swellDirectionDeg: null,
      offshoreDeg: beach.wind_offshore_deg,
      offshoreToleranceDeg: beach.wind_offshore_tol_deg ?? 35,
      windowCenterDeg: beach.swell_window_center_deg_v2 ?? beach.swell_window_center_deg,
      windowHalfwidthDeg: beach.swell_window_halfwidth_deg_v2 ?? beach.swell_window_halfwidth_deg,
    });
    const deps = dependencies();

    const result = await runSwellAlertCron({
      now: NOW,
      supabase: forecastClient([...flatHistory, peak]),
      deps,
    });

    expect(legacyScore).toBeGreaterThanOrEqual(70);
    expect(result.skippedCounts.not_rare).toBe(1);
    expect(deps.insertAlert).not.toHaveBeenCalled();
    expect(jest.mocked(evaluateForecastVerdict).mock.results.at(-1)?.value).toEqual(
      expect.objectContaining({ verdict: "maybe" }),
    );
  });

  it("alerts on the same pool when the peak is a canonical go, and records its forecast", async () => {
    const peak = at(clean, "peak", PEAK_AT);
    const deps = dependencies();

    const result = await runSwellAlertCron({
      now: NOW,
      supabase: forecastClient([...flatHistory, peak]),
      deps,
    });

    expect(result.sent).toBe(1);
    const calls = jest.mocked(evaluateForecastVerdict).mock.calls.map(([args]) => args);
    expect(calls.map(({ forecast }) => forecast.id)).toEqual([
      "flat-14",
      "flat-15",
      "flat-16",
      "peak",
    ]);
    for (const args of calls) {
      expect(args).toEqual({
        forecast: expect.any(Object),
        beach,
        experienceLevel: "intermediate",
        timezone: "America/Los_Angeles",
        now: NOW,
        candidateIdPrefix: "swell-alert",
      });
    }
    expect(deps.recordForecast).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: `${beach.id}:W:2026-09-19`,
      beachId: beach.id,
      detectorVersion: "swell-events.v1",
      arrivalAt: "2026-09-18T15:00:00.000Z",
      peakAt: PEAK_AT,
      fadeAt: "2026-09-20T07:00:00.000Z",
      peakFaceHeightFt: 3.2,
      peakPeriodS: 18,
      peakOffshoreHeightFt: 2.5,
      directionDeg: 247.5,
    }));
    const payload = jest.mocked(deps.enqueue!).mock.calls[0][0].payload as { event_key: string; event_start_date: string };
    expect(payload).toMatchObject({ event_key: `${beach.id}:W:2026-09-19`, event_start_date: "2026-09-18" });
  });

  it("marks a history day go only when one of its daylight rows is a canonical go", async () => {
    const controlled: Record<string, { score: number; verdict: "go" | "maybe" | "no" }> = {
      "sep-13": { score: 72, verdict: "go" },
      "sep-15-vetoed": { score: 75, verdict: "no" },
      "sep-15-fair": { score: 50, verdict: "maybe" },
      "sep-16-predawn": { score: 99, verdict: "go" },
      "sep-16": { score: 55, verdict: "maybe" },
      peak: { score: 80, verdict: "go" },
    };
    jest.mocked(evaluateForecastVerdict).mockImplementation(({ forecast }) => ({
      forecast,
      ...controlled[forecast.id],
      decision: {} as CanonicalSessionDecision,
    }));
    const deps = dependencies();

    const result = await runSwellAlertCron({
      now: NOW,
      supabase: forecastClient([
        at(clean, "sep-13", "2026-09-13T19:00:00.000Z"),
        at(clean, "sep-15-vetoed", "2026-09-15T19:00:00.000Z"),
        at(clean, "sep-15-fair", "2026-09-15T20:00:00.000Z"),
        at(clean, "sep-16-predawn", "2026-09-16T12:00:00.000Z"),
        at(clean, "sep-16", "2026-09-16T19:00:00.000Z"),
        at(clean, "peak", PEAK_AT),
      ]),
      deps,
    });

    expect(result.sent).toBe(1);
    const payload = jest.mocked(deps.enqueue!).mock.calls[0][0].payload as { rarity: string };
    // A 70+ score alone no longer makes Sep 15 a go day; the 05:00 row is outside daylight.
    expect(payload.rarity).toBe("Best since Sep 13");
    expect(
      jest.mocked(evaluateForecastVerdict).mock.calls.map(([args]) => args.forecast.id),
    ).not.toContain("sep-16-predawn");
  });
});

describe("swell alert forecast read under the PostgREST row cap", () => {
  const southBeach = {
    ...beach,
    id: "22222222-2222-4222-8222-222222222222",
    name: "Grandview South",
    slug: "grandview-south",
  } as Beach;

  // Hourly rows for both beaches across the full 30-day history + 10-day horizon: 1,920 rows.
  function fortyDaysOfRows(): EnhancedForecastEntity[] {
    const rows: EnhancedForecastEntity[] = [];
    const start = Date.parse("2026-08-19T00:00:00.000Z");
    const end = Date.parse("2026-09-28T00:00:00.000Z");
    for (const { id } of [beach, southBeach]) {
      for (let at = start; at < end; at += 60 * 60 * 1000) {
        const forecastAt = new Date(at).toISOString();
        rows.push({ ...clean, id: `${id}:${forecastAt}`, beach_id: id, forecast_at: forecastAt });
      }
    }
    return rows;
  }

  beforeEach(() => {
    jest.mocked(loadUserPool).mockResolvedValue([
      { beach, relation: "home", distanceMiles: null },
      { beach: southBeach, relation: "favorite", distanceMiles: null },
    ]);
    jest.mocked(evaluateForecastVerdict).mockImplementation(({ forecast }) => ({
      forecast,
      score: forecast.forecast_at === PEAK_AT ? 80 : 30,
      verdict: forecast.forecast_at === PEAK_AT ? "go" : "no",
      decision: {} as CanonicalSessionDecision,
    }));
    // A candidate exists only if the peak row, ten days into the read, reached the detector.
    const detected = jest.mocked(detectBeachSwellEvents).getMockImplementation();
    jest.mocked(detectBeachSwellEvents).mockImplementation((input) => (
      input.forecasts.some(({ forecast_at }) => forecast_at === PEAK_AT) ? detected!(input) : []
    ));
  });

  it.each([
    [1000, [[0, 999], [1000, 1999], [1920, 2919]]],
    [400, [[0, 999], [400, 1399], [800, 1799], [1200, 2199], [1600, 2599], [1920, 2919]]],
  ])("reads every row with a %i-row cap and still finds tomorrow's event at both beaches", async (cap, ranges) => {
    const rows = fortyDaysOfRows();
    const capped = cappedForecastClient(rows, cap);
    const deps = dependencies();

    const result = await runSwellAlertCron({ now: NOW, supabase: capped.client, deps });

    expect(rows).toHaveLength(1920);
    expect(result.sent).toBe(1);
    const payload = jest.mocked(deps.enqueue!).mock.calls[0][0].payload as {
      beaches: Array<{ beach_id: string }>;
    };
    expect(payload.beaches.map(({ beach_id }) => beach_id).sort()).toEqual([beach.id, southBeach.id].sort());
    expect(
      jest.mocked(detectBeachSwellEvents).mock.calls.map(([input]) => input.forecasts.length),
    ).toEqual([960, 960]);
    expect(capped.queries.map((ops) => ops.find(([op]) => op === "range")?.[1])).toEqual(ranges);
    for (const ops of capped.queries) {
      expect(ops).toEqual([
        ["select", ["*"]],
        ["in", ["beach_id", [beach.id, southBeach.id]]],
        ["gte", ["forecast_at", "2026-08-19T00:00:00.000Z"]],
        ["lt", ["forecast_at", "2026-09-28T00:00:00.000Z"]],
        ["order", ["forecast_at", { ascending: true }]],
        ["order", ["beach_id", { ascending: true }]],
        ["range", expect.any(Array)],
      ]);
    }
  });
});
