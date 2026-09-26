/**
 * @jest-environment node
 */

jest.mock("@/lib/alerts/user-pool", () => ({ loadUserPool: jest.fn() }));
jest.mock("@/lib/recommendations/major-swell-awareness/official-advisory-adapter", () => ({
  loadOfficialSwellAdvisories: jest.fn(async () => []),
  loadNwsSwellAdvisories: jest.fn(async () => []),
}));
jest.mock("@/lib/alerts/canonical-forecast-verdict", () => ({
  evaluateForecastVerdict: jest.fn(),
}));

import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import { loadUserPool } from "@/lib/alerts/user-pool";
import { runSwellAlertCron, type SwellAlertDeps, type SwellAlertProfile } from "@/lib/cron/swell-alert-runner";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import type { Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

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
  notifSwellAlerts: true,
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
    for (const method of ["select", "in", "eq", "gte", "lt", "order"]) chain[method] = () => chain;
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
  it("alerts on tomorrow's swell under the key an earlier run gave it", async () => {
    const runDeps = deps();
    const result = await runSwellAlertCron({
      now: NOW,
      supabase: client(SWELL_TOMORROW, { data: [PREVIOUS_RUN], error: null }),
      deps: runDeps,
    });

    expect(result.sent).toBe(1);
    const payload = jest.mocked(runDeps.enqueue!).mock.calls[0][0].payload as Record<string, unknown>;
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
