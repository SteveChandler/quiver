/**
 * @jest-environment node
 *
 * Tests for forecast-alerts service.
 *
 * Mocking strategy:
 * - createSupabaseServiceRoleClient: returns a per-test configurable mock client
 * - getFreshForecastFromCache: returns controllable forecast buckets per beach
 * - sendPushNotification: captured to assert what notifications were sent
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

jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotification: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import { sendPushNotification } from "@/lib/services/push-notifications";

// ---------------------------------------------------------------------------
// Test helpers / fixtures
// ---------------------------------------------------------------------------

/** A forecast record that matches the default thresholds (wave 4ft, 12s, 8mph) */
function makeGoodForecast(offsetHours = 2): object {
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
    // Default: push notification succeeds with 1 device
    (sendPushNotification as jest.Mock).mockResolvedValue({
      success: 1,
      failed: 0,
      errors: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Baseline: existing home beach path still works
  // -------------------------------------------------------------------------

  it("returns zero sent when no profiles have a home beach", async () => {
    const supabase = buildMockSupabase({
      profiles: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(0);
    expect(summary.eligibleUsers).toBe(0);
  });

  it("skips mock users for home beach alerts", async () => {
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
  });

  it("sends a home beach alert when conditions match", async () => {
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
      forecast_alert_deliveries: { data: [], error: null },
      favorite_beaches: { data: [], error: null },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
      forecasts: [makeGoodForecast(2)],
      metadata: { stale: false, missing: false },
    });

    const summary = await runForecastThresholdAlerts();

    expect(summary.sent).toBe(1);
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    const call = (sendPushNotification as jest.Mock).mock.calls[0][0];
    expect(call.userIds).toEqual([userId]);
    expect(call.data.beach_id).toBe(beachId);
  });

  // -------------------------------------------------------------------------
  // New: favorite beach alerts
  // -------------------------------------------------------------------------

  describe("favorite beach alerts", () => {
    it("sends an alert for a favorite beach with alerts_enabled = true when conditions match", async () => {
      const userId = "user-fav";
      const favBeachId = "beach-fav";

      // This user has NO home beach — only a favorite beach
      const supabase = buildMockSupabase({
        profiles: {
          data: [],  // no home beach profiles
          error: null,
        },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: favBeachId,
              alerts_enabled: true,
              profiles: {
                id: userId,
                notif_push_enabled: true,
                notif_forecast_alerts: true,
                is_mock: false,
                timezone: "America/Los_Angeles",
              },
            },
          ],
          error: null,
        },
        beaches: {
          data: [{ id: favBeachId, slug: "fav-beach", name: "Fav Beach" }],
          error: null,
        },
        user_surf_preferences: { data: [], error: null },
        forecast_alert_deliveries: { data: [], error: null },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      const summary = await runForecastThresholdAlerts();

      expect(summary.sent).toBe(1);
      expect(sendPushNotification).toHaveBeenCalledTimes(1);
      const call = (sendPushNotification as jest.Mock).mock.calls[0][0];
      expect(call.userIds).toEqual([userId]);
      expect(call.data.beach_id).toBe(favBeachId);
    });

    it("does NOT send an alert for a favorite beach with alerts_enabled = false", async () => {
      const userId = "user-fav-disabled";
      const favBeachId = "beach-fav-disabled";

      const supabase = buildMockSupabase({
        profiles: { data: [], error: null },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: favBeachId,
              alerts_enabled: false,
              profiles: {
                id: userId,
                notif_push_enabled: true,
                notif_forecast_alerts: true,
                is_mock: false,
                timezone: null,
              },
            },
          ],
          error: null,
        },
        beaches: { data: [], error: null },
        user_surf_preferences: { data: [], error: null },
        forecast_alert_deliveries: { data: [], error: null },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      const summary = await runForecastThresholdAlerts();

      expect(summary.sent).toBe(0);
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("home beach delivery does NOT prevent favorite beach alert for the same user", async () => {
      const userId = "user-both";
      const homeBeachId = "beach-home-dedup";
      const favBeachId = "beach-fav-dedup";

      // The user already received a home beach alert recently (within dedupe window)
      const recentlySentAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago

      const supabase = buildMockSupabase({
        profiles: {
          data: [
            {
              id: userId,
              home_beach_id: homeBeachId,
              notif_push_enabled: true,
              notif_forecast_alerts: true,
              is_mock: false,
              timezone: null,
            },
          ],
          error: null,
        },
        beaches: {
          data: [
            { id: homeBeachId, slug: "home-beach-dedup", name: "Home Beach" },
            { id: favBeachId,  slug: "fav-beach-dedup",  name: "Fav Beach" },
          ],
          error: null,
        },
        user_surf_preferences: { data: [], error: null },
        forecast_alert_deliveries: {
          // Prior delivery exists ONLY for the home beach
          data: [
            {
              user_id: userId,
              beach_id: homeBeachId,
              alert_type: "forecast_threshold",
              last_sent_at: recentlySentAt,
              last_matching_forecast_ts: null,
            },
          ],
          error: null,
        },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: favBeachId,
              alerts_enabled: true,
              profiles: {
                id: userId,
                notif_push_enabled: true,
                notif_forecast_alerts: true,
                is_mock: false,
                timezone: null,
              },
            },
          ],
          error: null,
        },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      const summary = await runForecastThresholdAlerts();

      // Home beach should be rate-limited (sent within 24h window)
      expect(summary.skipped.rateLimited).toBeGreaterThanOrEqual(1);

      // Favorite beach alert should still fire — it has its own dedupe key
      expect(summary.sent).toBe(1);
      const call = (sendPushNotification as jest.Mock).mock.calls[0][0];
      expect(call.data.beach_id).toBe(favBeachId);
    });

    it("user receives alerts for BOTH home beach AND favorite beach in the same run", async () => {
      const userId = "user-both-send";
      const homeBeachId = "beach-home-both";
      const favBeachId  = "beach-fav-both";

      const supabase = buildMockSupabase({
        profiles: {
          data: [
            {
              id: userId,
              home_beach_id: homeBeachId,
              notif_push_enabled: true,
              notif_forecast_alerts: true,
              is_mock: false,
              timezone: null,
            },
          ],
          error: null,
        },
        beaches: {
          data: [
            { id: homeBeachId, slug: "home-beach-both", name: "Home Beach" },
            { id: favBeachId,  slug: "fav-beach-both",  name: "Fav Beach" },
          ],
          error: null,
        },
        user_surf_preferences: { data: [], error: null },
        forecast_alert_deliveries: { data: [], error: null },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: favBeachId,
              alerts_enabled: true,
              profiles: {
                id: userId,
                notif_push_enabled: true,
                notif_forecast_alerts: true,
                is_mock: false,
                timezone: null,
              },
            },
          ],
          error: null,
        },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      const summary = await runForecastThresholdAlerts();

      expect(summary.sent).toBe(2);
      expect(sendPushNotification).toHaveBeenCalledTimes(2);

      const beachIds = (sendPushNotification as jest.Mock).mock.calls.map(
        (c) => c[0].data.beach_id
      );
      expect(beachIds).toContain(homeBeachId);
      expect(beachIds).toContain(favBeachId);
    });

    it("does not double-fetch forecast for a beach that is both a home beach and a favorite", async () => {
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
        forecast_alert_deliveries: { data: [], error: null },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: sharedBeachId,
              alerts_enabled: true,
              profiles: {
                id: userId,
                notif_push_enabled: true,
                notif_forecast_alerts: true,
                is_mock: false,
                timezone: null,
              },
            },
          ],
          error: null,
        },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      await runForecastThresholdAlerts();

      // getFreshForecastFromCache should be called exactly once for the shared beach
      expect(getFreshForecastFromCache).toHaveBeenCalledTimes(1);
      expect(
        (getFreshForecastFromCache as jest.Mock).mock.calls[0][0]
      ).toBe(sharedBeachId);
    });

    it("skips favorite beach alert when profile push notifications are disabled", async () => {
      const userId = "user-push-off";
      const favBeachId = "beach-push-off";

      const supabase = buildMockSupabase({
        profiles: { data: [], error: null },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: favBeachId,
              alerts_enabled: true,
              profiles: {
                id: userId,
                notif_push_enabled: false,  // push disabled
                notif_forecast_alerts: true,
                is_mock: false,
                timezone: null,
              },
            },
          ],
          error: null,
        },
        beaches: { data: [], error: null },
        user_surf_preferences: { data: [], error: null },
        forecast_alert_deliveries: { data: [], error: null },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      const summary = await runForecastThresholdAlerts();

      expect(summary.sent).toBe(0);
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("skips favorite beach alert when profile forecast alerts are disabled", async () => {
      const userId = "user-alerts-off";
      const favBeachId = "beach-alerts-off";

      const supabase = buildMockSupabase({
        profiles: { data: [], error: null },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: favBeachId,
              alerts_enabled: true,
              profiles: {
                id: userId,
                notif_push_enabled: true,
                notif_forecast_alerts: false,  // alerts disabled
                is_mock: false,
                timezone: null,
              },
            },
          ],
          error: null,
        },
        beaches: { data: [], error: null },
        user_surf_preferences: { data: [], error: null },
        forecast_alert_deliveries: { data: [], error: null },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      const summary = await runForecastThresholdAlerts();

      expect(summary.sent).toBe(0);
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("increments favoriteBeachesProcessed summary counter", async () => {
      const userId = "user-counter";
      const favBeachId = "beach-counter";

      const supabase = buildMockSupabase({
        profiles: { data: [], error: null },
        favorite_beaches: {
          data: [
            {
              user_id: userId,
              beach_id: favBeachId,
              alerts_enabled: true,
              profiles: {
                id: userId,
                notif_push_enabled: true,
                notif_forecast_alerts: true,
                is_mock: false,
                timezone: null,
              },
            },
          ],
          error: null,
        },
        beaches: {
          data: [{ id: favBeachId, slug: "counter-beach", name: "Counter Beach" }],
          error: null,
        },
        user_surf_preferences: { data: [], error: null },
        forecast_alert_deliveries: { data: [], error: null },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
      (getFreshForecastFromCache as jest.Mock).mockResolvedValue({
        forecasts: [makeGoodForecast(2)],
        metadata: { stale: false, missing: false },
      });

      const summary = await runForecastThresholdAlerts();

      expect((summary as any).favoriteBeachesProcessed).toBe(1);
    });
  });
});
