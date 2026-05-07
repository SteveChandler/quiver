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
  isWithinDailyForecastSendWindow,
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

function makeGoodForecastAt(
  forecastAt: string,
  overrides: Parameters<typeof makeGoodForecast>[1] = {}
): object {
  return makeGoodForecast(2, {
    forecast_at: forecastAt,
    forecast_date: forecastAt.split("T")[0],
    forecast_time: forecastAt.split("T")[1]?.replace(".000Z", "") ?? "00:00:00",
    ...overrides,
  });
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
  rpc: jest.Mock;
}

/** Build a minimal Supabase mock client that routes .from() calls by table name */
function buildMockSupabase(
  tableResponses: Record<string, unknown>,
  rpcResponses: Record<string, unknown> = {
    claim_daily_forecast_notification_slot: { data: true, error: null },
  }
): MockSupabase {
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
    rpc: jest.fn((name: string) => {
      return Promise.resolve(
        rpcResponses[name] ?? { data: null, error: { message: `Unexpected RPC: ${name}` } }
      );
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

describe("isWithinDailyForecastSendWindow", () => {
  it("returns true in the daily forecast send window", () => {
    const date = new Date("2026-02-26T14:00:00Z"); // 6 AM PST
    expect(isWithinDailyForecastSendWindow("America/Los_Angeles", date)).toBe(true);
  });

  it("returns false before the daily forecast send window", () => {
    const date = new Date("2026-02-26T12:00:00Z"); // 4 AM PST
    expect(isWithinDailyForecastSendWindow("America/Los_Angeles", date)).toBe(false);
  });

  it("returns false after the daily forecast send window", () => {
    const date = new Date("2026-02-26T20:00:00Z"); // noon PST
    expect(isWithinDailyForecastSendWindow("America/Los_Angeles", date)).toBe(false);
  });

  it("falls back to DEFAULT_TIMEZONE when null passed", () => {
    const date = new Date("2026-02-26T14:00:00Z"); // 6 AM PST
    expect(isWithinDailyForecastSendWindow(null, date)).toBe(true);
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
  // Pin the clock to 6 AM Pacific so tests are inside the 5 AM - 11 AM daily
  // forecast send window and results are deterministic.
  const FAKE_NOW_UTC = new Date("2026-03-13T13:00:00Z"); // 6 AM Pacific

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
    expect(supabase.rpc).toHaveBeenCalledWith("claim_daily_forecast_notification_slot", {
      p_user_id: userId,
      p_beach_id: beachId,
      p_notification_type: "daily_forecast",
      p_local_forecast_date: "2026-03-13",
    });
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

  it("claims only beaches included in the top-three batched summary", async () => {
    const userId = "user-top-three";
    const beachIds = ["beach-home", "beach-fav-1", "beach-fav-2", "beach-fav-3"];

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: beachIds[0],
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: beachIds.map((id, idx) => ({
          id,
          slug: `beach-${idx}`,
          name: `Beach ${idx}`,
        })),
        error: null,
      },
      favorite_beaches: {
        data: beachIds.slice(1).map((beach_id) => ({
          user_id: userId,
          beach_id,
          alerts_enabled: true,
        })),
        error: null,
      },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });

    await runForecastThresholdAlerts();

    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    expect(event.payload.match_count).toBe(3);
    expect(supabase.rpc).toHaveBeenCalledTimes(3);
  });

  it("fills the batched summary from lower-ranked beaches when a top candidate is duplicate", async () => {
    const userId = "user-fill-duplicate";
    const beachIds = ["beach-home", "beach-fav-1", "beach-fav-2", "beach-fav-3"];

    const supabase = buildMockSupabase({
      profiles: {
        data: [
          {
            id: userId,
            home_beach_id: beachIds[0],
            notif_push_enabled: true,
            notif_forecast_alerts: true,
            is_mock: false,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      beaches: {
        data: beachIds.map((id, idx) => ({
          id,
          slug: `fill-${idx}`,
          name: `Fill Beach ${idx}`,
        })),
        error: null,
      },
      favorite_beaches: {
        data: beachIds.slice(1).map((beach_id) => ({
          user_id: userId,
          beach_id,
          alerts_enabled: true,
        })),
        error: null,
      },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });
    supabase.rpc
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    const summary = await runForecastThresholdAlerts();

    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    expect(summary.skipped.duplicateDailySummary).toBe(1);
    expect(event.payload.match_count).toBe(3);
    expect(event.payload.body).not.toContain("Fill Beach 0:");
    expect(event.payload.body).toContain("Fill Beach 3:");
    expect(supabase.rpc).toHaveBeenCalledTimes(4);
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

  it("filters daily forecast candidates to daylight before writing the summary", async () => {
    const userId = "user-daylight";
    const beachId = "beach-blacks";
    jest.setSystemTime(new Date("2026-05-07T13:00:00.000Z")); // 6 AM Pacific

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
        data: [
          {
            id: beachId,
            slug: "blacks",
            name: "Blacks Beach",
            lat: 32.8916,
            lon: -117.2537,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [
        makeGoodForecastAt("2026-05-08T00:00:00.000Z", { wave_height: "2.5", wave_period: "11", wind_speed: "7" }), // 5 PM PDT
        makeGoodForecastAt("2026-05-08T03:00:00.000Z", { wave_height: "5.5", wave_period: "18", wind_speed: "1" }), // 8 PM PDT
        makeGoodForecastAt("2026-05-08T06:00:00.000Z", { wave_height: "5.5", wave_period: "18", wind_speed: "1" }), // 11 PM PDT
        makeGoodForecastAt("2026-05-08T09:00:00.000Z", { wave_height: "5.5", wave_period: "18", wind_speed: "1" }), // 2 AM PDT
      ],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(1);
    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    expect(event.payload.body).toContain("Blacks Beach: 5PM looks good");
    expect(event.payload.body).not.toContain("8PM");
    expect(event.payload.body).not.toContain("11PM");
    expect(event.payload.body).not.toContain("2AM");
  });

  it("prefers a lower-scoring daylight forecast over a higher-scoring post-sunset forecast", async () => {
    const userId = "user-post-sunset-ranking";
    const beachId = "beach-ranking";
    jest.setSystemTime(new Date("2026-05-07T13:00:00.000Z")); // 6 AM Pacific

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
        data: [
          {
            id: beachId,
            slug: "ranking",
            name: "Ranking Beach",
            lat: 32.85,
            lon: -117.27,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [
        makeGoodForecastAt("2026-05-08T00:00:00.000Z", { wave_height: "2.2", wave_period: "10", wind_speed: "12" }), // 5 PM PDT
        makeGoodForecastAt("2026-05-08T03:00:00.000Z", { wave_height: "4", wave_period: "16", wind_speed: "2" }), // 8 PM PDT
      ],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(1);
    const event = (enqueueNotification as jest.Mock).mock.calls[0][0];
    expect(event.payload.body).toContain("Ranking Beach: 5PM looks good");
    expect(event.payload.body).not.toContain("8PM");
  });

  it("does not enqueue when all matching forecasts are before civil dawn", async () => {
    const userId = "user-before-dawn";
    const beachId = "beach-before-dawn";
    jest.setSystemTime(new Date("2026-05-07T12:00:00.000Z")); // 5 AM Pacific, inside send window

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
        data: [
          {
            id: beachId,
            slug: "before-dawn",
            name: "Before Dawn",
            lat: 32.85,
            lon: -117.27,
            timezone: "America/Los_Angeles",
          },
        ],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [
        makeGoodForecastAt("2026-05-07T12:00:00.000Z", { wave_height: "4", wave_period: "12", wind_speed: "5" }), // 5 AM PDT
      ],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.skipped.noGoodForecasts).toBe(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
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

  it("skips duplicate daily forecast claims on repeated scheduler execution", async () => {
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
    }, {
      claim_daily_forecast_notification_slot: { data: true, error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });
    supabase.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    const firstSummary = await runForecastThresholdAlerts();
    const secondSummary = await runForecastThresholdAlerts();

    expect(firstSummary.sent).toBe(1);
    expect(secondSummary.sent).toBe(0);
    expect(secondSummary.skipped.duplicateDailySummary).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(enqueueNotification).toHaveBeenCalledTimes(1);
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
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("claim_daily_forecast_notification_slot", {
      p_user_id: userId,
      p_beach_id: sharedBeachId,
      p_notification_type: "daily_forecast",
      p_local_forecast_date: "2026-03-13",
    });
  });

  it("dedupes by matched forecast local date across scheduler runs before and after midnight", async () => {
    const userId = "user-midnight";
    const beachId = "beach-midnight";
    const forecastAt = "2026-03-14T15:00:00.000Z"; // 8 AM Pacific on Mar 14

    jest.setSystemTime(new Date("2026-03-14T07:30:00.000Z")); // 11:30 PM Pacific Mar 13

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
        data: [{ id: beachId, slug: "midnight", name: "Midnight Beach" }],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [
        {
          ...makeGoodForecast(8),
          forecast_at: forecastAt,
          forecast_date: "2026-03-14",
        },
      ],
      metadata: { stale: false, missing: false },
    });
    supabase.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    const firstSummary = await runForecastThresholdAlerts();
    jest.setSystemTime(new Date("2026-03-14T13:00:00.000Z")); // 6 AM Pacific Mar 14
    const secondSummary = await runForecastThresholdAlerts();

    expect(firstSummary.sent).toBe(0);
    expect(firstSummary.skipped.quietHours).toBe(1);
    expect(secondSummary.sent).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("claim_daily_forecast_notification_slot", {
      p_user_id: userId,
      p_beach_id: beachId,
      p_notification_type: "daily_forecast",
      p_local_forecast_date: "2026-03-14",
    });
  });

  it("suppresses daily forecast enqueue outside the daytime send window even for an 8 AM forecast", async () => {
    const userId = "user-quiet";
    const beachId = "beach-quiet";
    jest.setSystemTime(new Date("2026-03-13T11:00:00.000Z")); // 4 AM Pacific

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
        data: [{ id: beachId, slug: "quiet", name: "Quiet Beach" }],
        error: null,
      },
      favorite_beaches: { data: [], error: null },
      user_surf_preferences: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [
        {
          ...makeGoodForecast(4),
          forecast_at: "2026-03-13T15:00:00.000Z", // 8 AM Pacific
          forecast_date: "2026-03-13",
        },
      ],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.skipped.quietHours).toBe(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
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
