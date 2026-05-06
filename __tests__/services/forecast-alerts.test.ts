/**
 * @jest-environment node
 *
 * Tests for forecast-alerts service.
 *
 * Mocking strategy:
 * - createSupabaseServiceRoleClient: returns a per-test configurable mock client
 * - getFreshForecastFromCache: returns controllable forecast buckets per beach
 * - enqueueNotification: captured to assert one daily summary event per user
 */

import {
  runForecastThresholdAlerts,
  findFirstMatchingForecast,
  isWithinQuietHours,
  shouldSuppressForQuietHours,
  formatForecastTimeLocal,
  type ForecastAlertRunSummary,
} from "@/lib/services/forecast-alerts";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test helpers / fixtures
// ---------------------------------------------------------------------------

/** A forecast record that matches the default thresholds (wave 4ft, 12s, 8mph) */
function makeGoodForecast(
  offsetHours = 2,
  overrides: Partial<{
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

/** A forecast that never matches (wave too small) */
function makeBadForecast(offsetHours = 2): object {
  const futureMs = Date.now() + offsetHours * 60 * 60 * 1000;
  return {
    forecast_at: new Date(futureMs).toISOString(),
    forecast_date: new Date(futureMs).toISOString().split("T")[0],
    forecast_time: "12:00:00",
    wave_height: "0.5",  // below 2ft default threshold
    wave_period: "12",
    wind_speed: "8",
    tide_status: null,
    confidence_score: 0.9,
  };
}

interface MockSupabase {
  from: jest.Mock;
}

/** Build a minimal Supabase mock client that routes .from() calls by table name */
function buildMockSupabase(tableResponses: Record<string, unknown>): MockSupabase {
  const client = {
    from: jest.fn((table: string) => {
      const response = tableResponses[table] ?? { data: [], error: null };

      // Each query builder returns a fluent chain that resolves with the response.
      const chain: Record<string, unknown> = {};
      const fluent = () => chain;

      chain.select = jest.fn(fluent);
      chain.eq    = jest.fn(fluent);
      chain.neq   = jest.fn(fluent);
      chain.not   = jest.fn(fluent);
      chain.in    = jest.fn(fluent);
      chain.is    = jest.fn(fluent);
      chain.order = jest.fn(fluent);
      chain.limit = jest.fn(fluent);
      chain.upsert = jest.fn(() => Promise.resolve({ error: null }));
      // The terminal awaitable — when tests await the chain it resolves with the
      // table-specific response.
      chain.then = jest.fn((resolve: (v: unknown) => void) => resolve(response));

      return chain;
    }),
  };
  return client;
}

// ---------------------------------------------------------------------------
// Pure function unit tests
// ---------------------------------------------------------------------------

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
    expect(result).not.toBeNull();
    expect(result?.forecast).toBe(forecast);
  });

  it("skips forecasts outside the lookahead window", () => {
    const farFutureForecast = makeGoodForecast(24) as any; // 24h > 18h lookahead
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
    const lowWave = { ...makeGoodForecast(2) as any, wave_height: "1.5" };
    const result = findFirstMatchingForecast({
      forecasts: [lowWave],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips forecast with wave height above max threshold", () => {
    const highWave = { ...makeGoodForecast(2) as any, wave_height: "8" };
    const result = findFirstMatchingForecast({
      forecasts: [highWave],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips forecast with wind speed above max threshold", () => {
    const highWind = { ...makeGoodForecast(2) as any, wind_speed: "20" };
    const result = findFirstMatchingForecast({
      forecasts: [highWind],
      nowMs,
      lookaheadHours: 18,
      thresholds: defaultThresholds,
    });
    expect(result).toBeNull();
  });

  it("skips forecast with confidence below minimum", () => {
    const lowConf = { ...makeGoodForecast(2) as any, confidence_score: 0.3 };
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
    const rising = { ...makeGoodForecast(2) as any, tide_status: "rising" };
    const falling = { ...makeGoodForecast(3) as any, tide_status: "falling" };
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

describe("isWithinQuietHours", () => {
  it("returns true for hour in quiet window (11 PM)", () => {
    const date = new Date("2026-02-26T07:00:00Z"); // 11 PM PST
    expect(isWithinQuietHours("America/Los_Angeles", date)).toBe(true);
  });

  it("returns false for hour outside quiet window (noon)", () => {
    const date = new Date("2026-02-26T20:00:00Z"); // noon PST
    expect(isWithinQuietHours("America/Los_Angeles", date)).toBe(false);
  });

  it("falls back to DEFAULT_TIMEZONE when null passed", () => {
    const date = new Date("2026-02-26T20:00:00Z"); // noon PST
    expect(isWithinQuietHours(null, date)).toBe(false);
  });
});

describe("shouldSuppressForQuietHours", () => {
  it("suppresses when both current time and forecast time are in quiet hours", () => {
    // 11 PM local — current time is quiet
    const nowDate = new Date("2026-02-26T07:00:00Z"); // 11 PM PST
    // 1 AM local — forecast time is also quiet
    const forecastMs = new Date("2026-02-26T09:00:00Z").getTime(); // 1 AM PST
    expect(
      shouldSuppressForQuietHours("America/Los_Angeles", forecastMs, nowDate)
    ).toBe(true);
  });

  it("does NOT suppress when current time is quiet but forecast is not", () => {
    // 11 PM local — current time quiet
    const nowDate = new Date("2026-02-26T07:00:00Z"); // 11 PM PST
    // 9 AM local — forecast is NOT in quiet hours
    const forecastMs = new Date("2026-02-26T17:00:00Z").getTime(); // 9 AM PST
    expect(
      shouldSuppressForQuietHours("America/Los_Angeles", forecastMs, nowDate)
    ).toBe(false);
  });

  it("does NOT suppress when current time is not in quiet hours", () => {
    // noon local
    const nowDate = new Date("2026-02-26T20:00:00Z"); // noon PST
    const forecastMs = new Date("2026-02-26T23:00:00Z").getTime(); // 3 PM PST
    expect(
      shouldSuppressForQuietHours("America/Los_Angeles", forecastMs, nowDate)
    ).toBe(false);
  });
});

describe("formatForecastTimeLocal", () => {
  it("formats a UTC timestamp into local time string", () => {
    // Feb 26 2026 12:00 UTC = Feb 26 2026 4:00 AM PST
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

// ---------------------------------------------------------------------------
// Integration tests for runForecastThresholdAlerts
// ---------------------------------------------------------------------------

describe("runForecastThresholdAlerts", () => {
  // Pin the clock to noon Pacific (8 PM UTC) so tests never land in quiet
  // hours (10 PM – 4 AM local) and results are deterministic.
  const FAKE_NOW_UTC = new Date("2026-03-13T20:00:00Z"); // noon Pacific

  beforeEach(() => {
    jest.useFakeTimers({ now: FAKE_NOW_UTC });
    jest.clearAllMocks();
    (enqueueNotification as jest.Mock).mockResolvedValue({
      enqueued: true,
      eventId: "event-1",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns zero sent when no profiles are eligible", async () => {
    const supabase = buildMockSupabase({
      profiles: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.eligibleUsers).toBe(0);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it("skips mock users", async () => {
    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: "user-mock",
            home_beach_id: "beach-1",
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: true,
            timezone: null,
          },
        ],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.skipped.mockUser).toBe(1);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it("enqueues one daily summary for a home beach with one good window", async () => {
    const userId = "user-home";
    const beachId = "beach-home";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: beachId,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: [{ id: beachId, slug: "home-beach", name: "Home Beach" }],
        error: null,
      },
      user_surf_preferences: { data: [], error: null },
      favorite_beaches: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(1);
    expect(summary.eligibleUsers).toBe(1);
    expect(summary.eligibleBeachesProcessed).toBe(1);
    expect(enqueueNotification).toHaveBeenCalledTimes(1);
    const [event, client] = (enqueueNotification as jest.Mock).mock.calls[0];
    expect(client).toBe(supabase);
    expect(event.type).toBe("daily_digest");
    expect(event.recipientUserId).toBe(userId);
    expect(event.dedupeKey).toBe("daily_forecast_summary:user-home:2026-03-13");
    expect(event.payload.title).toBe("Quiver Daily Forecast");
    expect(event.payload.body).toContain("Home Beach:");
    expect(event.payload.body).toContain("4ft @ 12s, 8mph wind");
    expect(event.payload.match_count).toBe(1);
  });

  it("groups home beach and two alert-enabled favorites into one summary", async () => {
    const userId = "user-batch";
    const homeBeachId = "beach-home";
    const favoriteOneId = "beach-fav-1";
    const favoriteTwoId = "beach-fav-2";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: homeBeachId,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: [
          { id: homeBeachId, slug: "home", name: "Home Beach" },
          { id: favoriteOneId, slug: "favorite-one", name: "Favorite One" },
          { id: favoriteTwoId, slug: "favorite-two", name: "Favorite Two" },
        ],
        error: null,
      },
      favorite_beaches: {
        data: [
          { user_id: userId, beach_id: favoriteOneId, alerts_enabled: true },
          { user_id: userId, beach_id: favoriteTwoId, alerts_enabled: true },
        ],
        error: null,
      },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(1);
    expect(summary.eligibleBeachesProcessed).toBe(3);
    expect(getFreshForecastFromCache).toHaveBeenCalledTimes(3);
    expect(enqueueNotification).toHaveBeenCalledTimes(1);
    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    expect(event.payload.match_count).toBe(3);
    expect(event.payload.body).toContain("Home Beach:");
    expect(event.payload.body).toContain("Favorite One:");
    expect(event.payload.body).toContain("Favorite Two:");
  });

  it("uses one best window for a beach with multiple good windows", async () => {
    const userId = "user-best-window";
    const beachId = "beach-best-window";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: beachId,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: [{ id: beachId, slug: "best-window", name: "Best Window" }],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [
        makeGoodForecast(1, { wave_height: "2", wave_period: "10", wind_speed: "14" }),
        makeGoodForecast(2, { wave_height: "4", wave_period: "16", wind_speed: "4" }),
        makeGoodForecast(3, { wave_height: "5", wave_period: "12", wind_speed: "8" }),
      ],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(1);
    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    const lines = event.payload.body.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Best Window:");
    expect(lines[0]).toContain("4ft @ 16s, 4mph wind");
  });

  it("normalizes 0-100 confidence scores when ranking matching windows", async () => {
    const userId = "user-confidence-normalized";
    const beachId = "beach-confidence-normalized";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: beachId,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: [{ id: beachId, slug: "confidence", name: "Confidence Beach" }],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [
        makeGoodForecast(1, { wave_height: "2", wave_period: "10", wind_speed: "14", confidence_score: 100 }),
        makeGoodForecast(2, { wave_height: "4", wave_period: "16", wind_speed: "4", confidence_score: 50 }),
      ],
      metadata: { stale: false, missing: false },
    });

    await runForecastThresholdAlerts();

    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    const [line] = event.payload.body.split("\n");
    expect(line).toContain("4ft @ 16s, 4mph wind");
  });

  it("does not enqueue when only non-eligible beaches have good forecasts", async () => {
    const userId = "user-non-eligible";
    const homeBeachId = "beach-home-bad";
    const disabledFavoriteId = "beach-disabled-good";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: homeBeachId,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: [
          { id: homeBeachId, slug: "home-bad", name: "Home Bad" },
          { id: disabledFavoriteId, slug: "disabled-good", name: "Disabled Good" },
        ],
        error: null,
      },
      favorite_beaches: {
        data: [{ user_id: userId, beach_id: disabledFavoriteId, alerts_enabled: false }],
        error: null,
      },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockImplementation(async (beachId: string) => ({
      forecasts: beachId === disabledFavoriteId ? [makeGoodForecast(2)] : [makeBadForecast(2)],
      metadata: { stale: false, missing: false },
    }));

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.skipped.noGoodForecasts).toBe(1);
    expect(getFreshForecastFromCache).toHaveBeenCalledTimes(1);
    expect((getFreshForecastFromCache as jest.Mock).mock.calls[0][0]).toBe(homeBeachId);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it("skips duplicate daily summary enqueue for the same user and local date", async () => {
    const userId = "user-duplicate";
    const beachId = "beach-duplicate";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: beachId,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: [{ id: beachId, slug: "duplicate", name: "Duplicate Beach" }],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });
    (enqueueNotification as jest.Mock)
      .mockResolvedValueOnce({ enqueued: true, eventId: "event-1" })
      .mockResolvedValueOnce({ enqueued: false, reason: "duplicate" });

    const firstSummary = await runForecastThresholdAlerts();
    const secondSummary = await runForecastThresholdAlerts();

    expect(firstSummary.sent).toBe(1);
    expect(secondSummary.sent).toBe(0);
    expect(secondSummary.skipped.duplicateDailySummary).toBe(1);
    expect(enqueueNotification).toHaveBeenCalledTimes(2);
    expect((enqueueNotification as jest.Mock).mock.calls[1][0].dedupeKey).toBe(
      "daily_forecast_summary:user-duplicate:2026-03-13"
    );
  });

  it("skips users with no home beach and no alert-enabled favorites", async () => {
    const userId = "user-no-beaches";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: null,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.eligibleUsers).toBe(1);
    expect(summary.skipped.noEligibleBeaches).toBe(1);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it("enqueues one summary for an alert-enabled favorite without a home beach", async () => {
    const userId = "user-favorite-only";
    const favoriteBeachId = "beach-favorite-only";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: null,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      favorite_beaches: {
        data: [{ user_id: userId, beach_id: favoriteBeachId, alerts_enabled: true }],
        error: null,
      },
      beaches: {
        data: [{ id: favoriteBeachId, slug: "favorite-only", name: "Favorite Only" }],
        error: null,
      },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(1);
    expect(summary.eligibleBeachesProcessed).toBe(1);
    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    expect(event.payload.body).toContain("Favorite Only:");
  });

  it("does not double-fetch forecast for a beach that is both home and favorite", async () => {
    const userId = "user-overlap";
    const sharedBeachId = "beach-shared";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: sharedBeachId,
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: null,
          },
        ],
        error: null,
      },
      beaches: {
        data: [{ id: sharedBeachId, slug: "shared-beach", name: "Shared" }],
        error: null,
      },
      user_surf_preferences: { data: [], error: null },
      favorite_beaches: {
        data: [{ user_id: userId, beach_id: sharedBeachId, alerts_enabled: true }],
        error: null,
      },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });

    await runForecastThresholdAlerts();

    expect(getFreshForecastFromCache).toHaveBeenCalledTimes(1);
    expect((getFreshForecastFromCache as jest.Mock).mock.calls[0][0]).toBe(sharedBeachId);
  });

  it("skips users when profile push notifications are disabled", async () => {
    const userId = "user-push-off";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: "beach-push-off",
            notif_push_enabled: false,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: null,
          },
        ],
        error: null,
      },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.skipped.pushDisabled).toBe(1);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it("skips users when profile forecast alerts are disabled", async () => {
    const userId = "user-alerts-off";

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: "beach-alerts-off",
            notif_push_enabled: true,
            notif_forecast_alerts: false,
            is_mock: false,
            timezone: null,
          },
        ],
        error: null,
      },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.skipped.alertsDisabled).toBe(1);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });
});
