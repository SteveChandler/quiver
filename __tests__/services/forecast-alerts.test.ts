/**
 * @jest-environment node
 *
 * Tests for forecast-alerts service.
 */

import {
  runForecastThresholdAlerts,
  findFirstMatchingForecast,
  isWithinDailyForecastSendWindow,
  formatForecastTimeLocal,
} from "@/lib/services/forecast-alerts";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/utils/forecast-service-utils", () => ({
  getFreshForecastFromCache: jest.fn(),
}));

jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import { enqueueNotification } from "@/lib/notifications/enqueue";

function makeGoodForecast(
  offsetHours = 2,
  overrides: Partial<{
    forecast_at: string;
    forecast_date: string;
    forecast_time: string;
    wave_height: string;
    wave_period: string;
    wind_speed: string;
    confidence_score: number;
  }> = {}
): object {
  const futureMs = Date.now() + offsetHours * 60 * 60 * 1000;
  return {
    forecast_at: new Date(futureMs).toISOString(),
    forecast_date: new Date(futureMs).toISOString().split("T")[0],
    forecast_time: "12:00:00",
    wave_height: "4",
    wave_period: "12",
    wind_speed: "8",
    tide_status: null,
    confidence_score: 0.9,
    ...overrides,
  };
}

function makeBadForecast(offsetHours = 2): object {
  const futureMs = Date.now() + offsetHours * 60 * 60 * 1000;
  return {
    forecast_at: new Date(futureMs).toISOString(),
    forecast_date: new Date(futureMs).toISOString().split("T")[0],
    forecast_time: "12:00:00",
    wave_height: "0.5",
    wave_period: "12",
    wind_speed: "8",
    tide_status: null,
    confidence_score: 0.9,
  };
}

function buildMockSupabase(): { from: jest.Mock; rpc: jest.Mock } {
  return {
    from: jest.fn(),
    rpc: jest.fn(),
  };
}

describe("findFirstMatchingForecast", () => {
  const nowMs = Date.now();
  const defaultThresholds = {
    source: "default" as const,
    waveMinFt: 2,
    waveMaxFt: 6,
    periodMinS: 10,
    periodMaxS: 18,
    maxWindMph: 15,
    confidenceMin: 0.5,
    preferredTideStatuses: null,
  };

  it("returns null when no forecasts provided", () => {
    const result = findFirstMatchingForecast({
      forecasts: [],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("returns matching forecast within lookahead window", () => {
    const forecast = makeGoodForecast(2) as any;
    const result = findFirstMatchingForecast({
      forecasts: [forecast],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result?.forecast).toBe(forecast);
  });

  it("skips forecasts outside the lookahead window", () => {
    const farFutureForecast = makeGoodForecast(24) as any;
    const result = findFirstMatchingForecast({
      forecasts: [farFutureForecast],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips past forecasts", () => {
    const pastMs = nowMs - 3 * 60 * 60 * 1000;
    const pastForecast = {
      forecast_at: new Date(pastMs).toISOString(),
      forecast_date: new Date(pastMs).toISOString().split("T")[0],
      forecast_time: "06:00:00",
      wave_height: "4",
      wave_period: "12",
      wind_speed: "8",
      tide_status: null,
      confidence_score: 0.9,
    };
    const result = findFirstMatchingForecast({
      forecasts: [pastForecast],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips forecast with wave height below min threshold", () => {
    const lowWave = { ...(makeGoodForecast(2) as any), wave_height: "1.5" };
    const result = findFirstMatchingForecast({
      forecasts: [lowWave],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips forecast with wave height above max threshold", () => {
    const highWave = { ...(makeGoodForecast(2) as any), wave_height: "8" };
    const result = findFirstMatchingForecast({
      forecasts: [highWave],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips forecast with wind speed above max threshold", () => {
    const highWind = { ...(makeGoodForecast(2) as any), wind_speed: "20" };
    const result = findFirstMatchingForecast({
      forecasts: [highWind],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips forecast with confidence below minimum", () => {
    const lowConf = { ...(makeGoodForecast(2) as any), confidence_score: 0.3 };
    const result = findFirstMatchingForecast({
      forecasts: [lowConf],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("returns first matching when multiple forecasts present", () => {
    const bad = makeBadForecast(1) as any;
    const good = makeGoodForecast(4) as any;
    const result = findFirstMatchingForecast({
      forecasts: [bad, good],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result?.forecast).toBe(good);
  });

  it("filters by preferred tide statuses when set", () => {
    const rising = { ...(makeGoodForecast(2) as any), tide_status: "rising" };
    const falling = { ...(makeGoodForecast(3) as any), tide_status: "falling" };
    const thresholdsWithTide = {
      ...defaultThresholds,
      preferredTideStatuses: ["rising"],
    };
    const result = findFirstMatchingForecast({
      forecasts: [falling, rising],
      nowMs,
      lookaheadHours: 18,
      thresholds: thresholdsWithTide,
    });
    expect(result?.forecast).toBe(rising);
  });
});

describe("isWithinDailyForecastSendWindow", () => {
  it("returns true in the daily forecast send window", () => {
    const date = new Date("2026-02-26T14:00:00Z");
    expect(isWithinDailyForecastSendWindow("America/Los_Angeles", date)).toBe(true);
  });

  it("returns false before the daily forecast send window", () => {
    const date = new Date("2026-02-26T12:00:00Z");
    expect(isWithinDailyForecastSendWindow("America/Los_Angeles", date)).toBe(false);
  });

  it("returns false after the daily forecast send window", () => {
    const date = new Date("2026-02-26T20:00:00Z");
    expect(isWithinDailyForecastSendWindow("America/Los_Angeles", date)).toBe(false);
  });

  it("falls back to DEFAULT_TIMEZONE when null passed", () => {
    const date = new Date("2026-02-26T14:00:00Z");
    expect(isWithinDailyForecastSendWindow(null, date)).toBe(true);
  });
});

describe("formatForecastTimeLocal", () => {
  it("formats a UTC timestamp into local time string", () => {
    const tsMs = new Date("2026-02-26T12:00:00Z").getTime();
    const result = formatForecastTimeLocal(tsMs, "America/Los_Angeles");
    expect(result).toMatch(/^2\/26/);
    expect(result).toMatch(/AM/);
  });

  it("falls back to UTC format on invalid timezone", () => {
    const tsMs = new Date("2026-02-26T12:00:00Z").getTime();
    const result = formatForecastTimeLocal(tsMs, "Invalid/Timezone");
    expect(result).toMatch(/UTC/);
  });
});

describe("runForecastThresholdAlerts", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-03-13T13:00:00Z") });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not query or enqueue while the daily digest producer is disabled", async () => {
    const supabase = buildMockSupabase();
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.eligibleUsers).toBe(0);
    expect(summary.eligibleBeachesProcessed).toBe(0);
    expect(summary.skipped.dailyDigestDisabled).toBe(1);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(getFreshForecastFromCache).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
  });
});
