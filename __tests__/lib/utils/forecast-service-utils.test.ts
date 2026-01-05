import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

type QueryResult<T> = { data: T; error: { message: string } | null };

describe("getFreshForecastFromCache", () => {
  const BEACH_ID = "badd7986-4609-421a-ab3d-81fcd8409a5b";

  let getFreshForecastFromCache: typeof import("@/lib/utils/forecast-service-utils").getFreshForecastFromCache;
  let latestResult: QueryResult<{ updated_at: string; data_source: string | null } | null>;
  let forecastsResult: QueryResult<any[]>;
  let enhancedForecastsQueried: boolean;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-05T15:00:00Z"));
    jest.clearAllMocks();
    jest.resetModules();

    latestResult = { data: null, error: null };
    forecastsResult = { data: [], error: null };
    enhancedForecastsQueried = false;

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: jest.fn(async () => ({
        from: (table: string) => {
          if (table === "v_enhanced_forecast_latest") {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => latestResult),
                })),
              })),
            };
          }

          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  gte: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      order: jest.fn(() => ({
                        order: jest.fn(async () => {
                          enhancedForecastsQueried = true;
                          return forecastsResult;
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }

          throw new Error(`Unexpected table: ${table}`);
        },
      })),
    }));

    ({ getFreshForecastFromCache } = await import("@/lib/utils/forecast-service-utils"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses v_enhanced_forecast_latest for staleness (does not treat oldest forecast row as most recent)", async () => {
    const nowIso = new Date().toISOString();
    const oneHourAgoIso = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const fortySevenHoursAgoIso = new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString();

    latestResult = {
      data: { updated_at: oneHourAgoIso, data_source: "CDIP" },
      error: null,
    };

    const forecasts = [
      // Oldest row in the window (this used to incorrectly drive staleness)
      { beach_id: BEACH_ID, forecast_date: "2026-01-04", forecast_time: "00:00:00", updated_at: fortySevenHoursAgoIso, data_source: "CDIP" },
      // Newer row in the window
      { beach_id: BEACH_ID, forecast_date: "2026-01-05", forecast_time: "00:00:00", updated_at: nowIso, data_source: "CDIP" },
    ];
    forecastsResult = { data: forecasts, error: null };

    const result = await getFreshForecastFromCache(BEACH_ID, 48);

    expect(result.metadata.cached).toBe(true);
    expect(result.metadata.stale).toBe(false);
    expect(result.metadata.missing).toBe(false);
    expect(result.forecasts.length).toBe(2);
    expect(enhancedForecastsQueried).toBe(true);
  });

  it("returns stale=true and does not load full forecast rows when latest metadata is stale", async () => {
    const fiveHoursAgoIso = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

    latestResult = {
      data: { updated_at: fiveHoursAgoIso, data_source: "CDIP" }, // CDIP threshold is 1.5h
      error: null,
    };

    const result = await getFreshForecastFromCache(BEACH_ID, 48);

    expect(result.forecasts).toEqual([]);
    expect(result.metadata.cached).toBe(true);
    expect(result.metadata.stale).toBe(true);
    expect(result.metadata.missing).toBe(false);
    expect(enhancedForecastsQueried).toBe(false);
  });

  it("returns missing=true when latest metadata does not exist (no cached forecasts yet)", async () => {
    latestResult = { data: null, error: null };

    const result = await getFreshForecastFromCache(BEACH_ID, 48);

    expect(result.forecasts).toEqual([]);
    expect(result.metadata.missing).toBe(true);
    expect(result.metadata.cached).toBe(false);
    expect(result.metadata.stale).toBe(false);
    expect(enhancedForecastsQueried).toBe(false);
  });
});


