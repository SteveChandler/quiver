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

describe("getBatchFreshForecastsFromCache", () => {
  const BEACH_IDS = [
    "beach-1-fresh",
    "beach-2-stale",
    "beach-3-missing",
  ];

  let getBatchFreshForecastsFromCache: typeof import("@/lib/utils/forecast-service-utils").getBatchFreshForecastsFromCache;
  let latestBatchResult: QueryResult<Array<{ beach_id: string; updated_at: string; data_source: string | null }>>;
  let forecastsBatchResult: QueryResult<any[]>;
  let enhancedForecastsQueried: boolean;
  let latestViewQueried: boolean;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-05T15:00:00Z"));
    jest.clearAllMocks();
    jest.resetModules();

    latestBatchResult = { data: [], error: null };
    forecastsBatchResult = { data: [], error: null };
    enhancedForecastsQueried = false;
    latestViewQueried = false;

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: jest.fn(async () => ({
        from: (table: string) => {
          if (table === "v_enhanced_forecast_latest") {
            return {
              select: jest.fn(() => ({
                in: jest.fn(async () => {
                  latestViewQueried = true;
                  return latestBatchResult;
                }),
              })),
            };
          }

          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn(() => ({
                in: jest.fn(() => ({
                  gte: jest.fn(() => ({
                    lte: jest.fn(() => ({
                      order: jest.fn(() => ({
                        order: jest.fn(() => ({
                          order: jest.fn(async () => {
                            enhancedForecastsQueried = true;
                            return forecastsBatchResult;
                          }),
                        })),
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

    ({ getBatchFreshForecastsFromCache } = await import("@/lib/utils/forecast-service-utils"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns empty map for empty beach ID array input", async () => {
    const result = await getBatchFreshForecastsFromCache([], 48);

    expect(result.size).toBe(0);
    expect(latestViewQueried).toBe(false);
    expect(enhancedForecastsQueried).toBe(false);
  });

  it("handles all beaches fresh (happy path)", async () => {
    const oneHourAgoIso = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    latestBatchResult = {
      data: [
        { beach_id: "beach-1-fresh", updated_at: oneHourAgoIso, data_source: "NOAA_NWS" },
        { beach_id: "beach-2-stale", updated_at: oneHourAgoIso, data_source: "NOAA_NWS" },
      ],
      error: null,
    };

    forecastsBatchResult = {
      data: [
        { beach_id: "beach-1-fresh", forecast_date: "2026-01-05", forecast_time: "12:00:00", wave_height: "4" },
        { beach_id: "beach-1-fresh", forecast_date: "2026-01-05", forecast_time: "15:00:00", wave_height: "5" },
        { beach_id: "beach-2-stale", forecast_date: "2026-01-05", forecast_time: "12:00:00", wave_height: "3" },
      ],
      error: null,
    };

    const result = await getBatchFreshForecastsFromCache(["beach-1-fresh", "beach-2-stale"], 48);

    expect(result.size).toBe(2);

    const beach1 = result.get("beach-1-fresh");
    expect(beach1?.metadata.cached).toBe(true);
    expect(beach1?.metadata.stale).toBe(false);
    expect(beach1?.metadata.missing).toBe(false);
    expect(beach1?.forecasts.length).toBe(2);

    const beach2 = result.get("beach-2-stale");
    expect(beach2?.metadata.cached).toBe(true);
    expect(beach2?.metadata.stale).toBe(false);
    expect(beach2?.forecasts.length).toBe(1);

    expect(latestViewQueried).toBe(true);
    expect(enhancedForecastsQueried).toBe(true);
  });

  it("handles all beaches stale", async () => {
    const twentyHoursAgoIso = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

    latestBatchResult = {
      data: [
        { beach_id: "beach-1-fresh", updated_at: twentyHoursAgoIso, data_source: "NOAA_NWS" }, // NOAA_NWS threshold is 12h
        { beach_id: "beach-2-stale", updated_at: twentyHoursAgoIso, data_source: "NOAA_NWS" },
      ],
      error: null,
    };

    const result = await getBatchFreshForecastsFromCache(["beach-1-fresh", "beach-2-stale"], 48);

    expect(result.size).toBe(2);

    const beach1 = result.get("beach-1-fresh");
    expect(beach1?.metadata.cached).toBe(true);
    expect(beach1?.metadata.stale).toBe(true);
    expect(beach1?.metadata.missing).toBe(false);
    expect(beach1?.forecasts).toEqual([]);

    const beach2 = result.get("beach-2-stale");
    expect(beach2?.metadata.cached).toBe(true);
    expect(beach2?.metadata.stale).toBe(true);
    expect(beach2?.forecasts).toEqual([]);

    // Should NOT query enhanced_forecasts when all beaches are stale
    expect(latestViewQueried).toBe(true);
    expect(enhancedForecastsQueried).toBe(false);
  });

  it("handles mixed fresh/stale/missing beaches", async () => {
    const oneHourAgoIso = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const twentyHoursAgoIso = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

    latestBatchResult = {
      data: [
        { beach_id: "beach-1-fresh", updated_at: oneHourAgoIso, data_source: "NOAA_NWS" }, // Fresh
        { beach_id: "beach-2-stale", updated_at: twentyHoursAgoIso, data_source: "NOAA_NWS" }, // Stale
        // beach-3-missing not in results = missing
      ],
      error: null,
    };

    forecastsBatchResult = {
      data: [
        { beach_id: "beach-1-fresh", forecast_date: "2026-01-05", forecast_time: "12:00:00", wave_height: "4" },
      ],
      error: null,
    };

    const result = await getBatchFreshForecastsFromCache(BEACH_IDS, 48);

    expect(result.size).toBe(3);

    // Beach 1: Fresh with forecasts
    const beach1 = result.get("beach-1-fresh");
    expect(beach1?.metadata.cached).toBe(true);
    expect(beach1?.metadata.stale).toBe(false);
    expect(beach1?.metadata.missing).toBe(false);
    expect(beach1?.forecasts.length).toBe(1);

    // Beach 2: Stale
    const beach2 = result.get("beach-2-stale");
    expect(beach2?.metadata.cached).toBe(true);
    expect(beach2?.metadata.stale).toBe(true);
    expect(beach2?.metadata.missing).toBe(false);
    expect(beach2?.forecasts).toEqual([]);

    // Beach 3: Missing (no metadata)
    const beach3 = result.get("beach-3-missing");
    expect(beach3?.metadata.cached).toBe(false);
    expect(beach3?.metadata.stale).toBe(false);
    expect(beach3?.metadata.missing).toBe(true);
    expect(beach3?.forecasts).toEqual([]);
  });

  it("handles database error on staleness query (v_enhanced_forecast_latest)", async () => {
    latestBatchResult = {
      data: null as any,
      error: { message: "Database connection failed" },
    };

    const result = await getBatchFreshForecastsFromCache(["beach-1-fresh"], 48);

    expect(result.size).toBe(1);

    const beach1 = result.get("beach-1-fresh");
    expect(beach1?.metadata.missing).toBe(true);
    expect(beach1?.metadata.reason).toContain("Database error");
    expect(beach1?.forecasts).toEqual([]);

    expect(enhancedForecastsQueried).toBe(false);
  });

  it("handles database error on forecast query (enhanced_forecasts)", async () => {
    const oneHourAgoIso = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    latestBatchResult = {
      data: [
        { beach_id: "beach-1-fresh", updated_at: oneHourAgoIso, data_source: "NOAA_NWS" },
      ],
      error: null,
    };

    forecastsBatchResult = {
      data: null as any,
      error: { message: "Query timeout" },
    };

    const result = await getBatchFreshForecastsFromCache(["beach-1-fresh"], 48);

    expect(result.size).toBe(1);

    const beach1 = result.get("beach-1-fresh");
    expect(beach1?.metadata.missing).toBe(true);
    expect(beach1?.metadata.reason).toContain("Database error");
    expect(beach1?.forecasts).toEqual([]);
  });

  it("handles fresh beach with no forecast rows (metadata exists but no data)", async () => {
    const oneHourAgoIso = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    latestBatchResult = {
      data: [
        { beach_id: "beach-1-fresh", updated_at: oneHourAgoIso, data_source: "NOAA_NWS" },
      ],
      error: null,
    };

    forecastsBatchResult = {
      data: [], // No forecast rows
      error: null,
    };

    const result = await getBatchFreshForecastsFromCache(["beach-1-fresh"], 48);

    expect(result.size).toBe(1);

    const beach1 = result.get("beach-1-fresh");
    expect(beach1?.metadata.missing).toBe(true);
    expect(beach1?.metadata.reason).toContain("No forecast rows");
    expect(beach1?.forecasts).toEqual([]);
  });
});

