type MockBeach = { id: string; name: string; lat: number; lon: number };

function makeBeach(id: string, name?: string): MockBeach {
  return { id, name: name ?? id, lat: 1, lon: 1 };
}

/**
 * This test verifies the beach selection logic used by the background refresh:
 * - Prioritize beaches with NO forecasts (missing coverage)
 * - Then prioritize beaches with the OLDEST `updated_at`
 * - Do not repeatedly re-select recently updated beaches due to too-short freshness window
 */
describe("EnhancedForecastService.updateAllEnhancedForecasts selection", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-12-11T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("prioritizes missing beaches, then oldest stale beaches", async () => {
    const beaches = [
      makeBeach("b1", "Missing 1"),
      makeBeach("b2", "Missing 2"),
      makeBeach("b3", "Oldest"),
      makeBeach("b4", "Newer"),
      makeBeach("b5", "Fresh"),
    ];

    // Build a mock Supabase client that supports the limited method chains used
    // by updateAllEnhancedForecasts().
    const latestRows = [
      { beach_id: "b5", updated_at: "2025-12-11T06:30:00Z" }, // 5.5h old (fresh within 12h)
      { beach_id: "b4", updated_at: "2025-12-10T10:00:00Z" }, // older
      { beach_id: "b3", updated_at: "2025-12-09T10:00:00Z" }, // oldest
    ];

    const mockSupabase = {
      from: (table: string) => {
        if (table === "beaches") {
          return {
            select: () => Promise.resolve({ data: beaches, error: null }),
          };
        }

        if (table === "enhanced_forecasts") {
          return {
            select: () => Promise.resolve({ data: [], error: null }),
          };
        }

        if (table === "v_enhanced_forecast_latest") {
          return {
            select: () =>
              Promise.resolve({
                data: latestRows,
                error: null,
              }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
      rpc: (_fn: string, _args: any) =>
        // fetchNowcastAnchors calls get_nowcast_anchors once per run.
        // Return empty so the per-beach builds fall through to forecast-only.
        Promise.resolve({ data: [], error: null }),
    };

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: async () => mockSupabase,
    }));

    // Re-import after mocking supabase
    const { EnhancedForecastService: Service } = await import(
      "@/lib/services/enhanced-forecast-service"
    );
    const service = new Service() as any;

    // Avoid network calls and DB writes during the test; capture chosen beaches via the forecast generator stub.
    const processedBeachIds: string[] = [];
    jest
      .spyOn(service, "generateComprehensiveForecastWithDiagnostics")
      .mockImplementation(async (beach: any) => {
        processedBeachIds.push(beach.id);
        return {
          forecasts: [],
          cdip: { stationId: null, skipReason: "no_station" },
        };
      });
    jest.spyOn(service, "storeEnhancedForecasts").mockResolvedValue({ success: true });
    jest.spyOn(service, "prefetchTideStations").mockResolvedValue(undefined);

    // updateAllEnhancedForecasts includes an inter-batch delay (setTimeout).
    // With fake timers enabled, we must advance timers for the promise to resolve.
    const run = service.updateAllEnhancedForecasts();
    await jest.runAllTimersAsync();
    await run;

    // Missing beaches should be selected first
    expect(processedBeachIds[0]).toBe("b1");
    expect(processedBeachIds[1]).toBe("b2");

    // Then oldest stale next (b3 older than b4)
    expect(processedBeachIds).toContain("b3");
    expect(processedBeachIds).toContain("b4");

    const idxB3 = processedBeachIds.indexOf("b3");
    const idxB4 = processedBeachIds.indexOf("b4");
    expect(idxB3).toBeGreaterThan(-1);
    expect(idxB4).toBeGreaterThan(-1);
    expect(idxB3).toBeLessThan(idxB4);
  });

  it("selects only stale CDIP beaches for updateCdipEnhancedForecasts()", async () => {
    // Beaches with cdip_eligible flag - the service now filters by cdip_eligible=true
    const allBeaches = [
      { ...makeBeach("b1", "CDIP stale old"), cdip_eligible: true },
      { ...makeBeach("b2", "CDIP stale newer"), cdip_eligible: true },
      { ...makeBeach("b3", "NOAA stale"), cdip_eligible: false }, // Not CDIP eligible
      { ...makeBeach("b4", "CDIP fresh"), cdip_eligible: true },
    ];

    // System time is 2025-12-11T12:00:00Z from beforeEach()
    const latestRows = [
      { beach_id: "b1", updated_at: "2025-12-11T08:00:00Z", data_source: "CDIP" }, // 4h old (stale for 2h window)
      { beach_id: "b2", updated_at: "2025-12-11T09:30:00Z", data_source: "CDIP" }, // 2.5h old (stale for 2h window)
      { beach_id: "b3", updated_at: "2025-12-10T10:00:00Z", data_source: "NOAA_NWS" }, // irrelevant for CDIP-only
      { beach_id: "b4", updated_at: "2025-12-11T11:30:00Z", data_source: "CDIP" }, // 0.5h old (fresh)
    ];

    const mockSupabase = {
      from: (table: string) => {
        if (table === "beaches") {
          return {
            select: () => ({
              eq: (column: string, value: boolean) => {
                // Filter beaches by cdip_eligible when called
                if (column === "cdip_eligible" && value === true) {
                  return Promise.resolve({
                    data: allBeaches.filter((b) => b.cdip_eligible),
                    error: null,
                  });
                }
                return Promise.resolve({ data: allBeaches, error: null });
              },
            }),
          };
        }

        if (table === "v_enhanced_forecast_latest") {
          return {
            select: () =>
              Promise.resolve({
                data: latestRows,
                error: null,
              }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
      // updateCdipEnhancedForecasts now fetches nowcast anchors per-run
      // (mirrors updateAllEnhancedForecasts). Empty result means the per-beach
      // builds fall through to forecast-only — the only thing this test
      // observes is which beaches get selected.
      rpc: (_fn: string, _args: any) =>
        Promise.resolve({ data: [], error: null }),
    };

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: async () => mockSupabase,
    }));

    const { EnhancedForecastService: Service } = await import(
      "@/lib/services/enhanced-forecast-service"
    );
    const service = new Service() as any;

    process.env.FORECAST_CDIP_FRESHNESS_WINDOW_HOURS = "2";
    process.env.FORECAST_CDIP_MAX_BEACHES_PER_RUN = "10";

    const processedBeachIds: string[] = [];
    jest
      .spyOn(service, "generateComprehensiveForecastWithDiagnostics")
      .mockImplementation(async (beach: any) => {
        processedBeachIds.push(beach.id);
        return {
          forecasts: [],
          cdip: { stationId: null, skipReason: "no_station" },
        };
      });
    jest.spyOn(service, "storeEnhancedForecasts").mockResolvedValue({ success: true });
    jest.spyOn(service, "prefetchTideStations").mockResolvedValue(undefined);

    const run = service.updateCdipEnhancedForecasts();
    await jest.runAllTimersAsync();
    await run;

    // Only b1 and b2 should be selected (CDIP + older than 2h), oldest first
    expect(processedBeachIds).toEqual(["b1", "b2"]);
  });

  it("updateCdipEnhancedForecasts() fetches and passes nowcast anchors per beach", async () => {
    // Regression: previously the CDIP-only cron called
    // generateComprehensiveForecast(beach) without an anchor, which silently
    // overwrote the main cron's anchored values for any observation_anchor-
    // flagged beach on the next CDIP refresh.
    const allBeaches = [
      { ...makeBeach("b-anchor", "anchored CDIP"), cdip_eligible: true },
      { ...makeBeach("b-no-anchor", "unanchored CDIP"), cdip_eligible: true },
    ];

    const latestRows = [
      { beach_id: "b-anchor", updated_at: "2025-12-11T08:00:00Z", data_source: "CDIP" },
      { beach_id: "b-no-anchor", updated_at: "2025-12-11T09:30:00Z", data_source: "CDIP" },
    ];

    const anchorRow = {
      beach_id: "b-anchor",
      station_id: "edu_ucsd_cdip_220",
      observed_at: "2025-12-11T11:30:00Z",
      wave_height_m: 0.6,
      wave_period_s: 14,
      wave_direction_deg: 240,
    };

    const mockSupabase = {
      from: (table: string) => {
        if (table === "beaches") {
          return {
            select: () => ({
              eq: (column: string, value: boolean) =>
                column === "cdip_eligible" && value === true
                  ? Promise.resolve({ data: allBeaches.filter((b) => b.cdip_eligible), error: null })
                  : Promise.resolve({ data: allBeaches, error: null }),
            }),
          };
        }
        if (table === "v_enhanced_forecast_latest") {
          return { select: () => Promise.resolve({ data: latestRows, error: null }) };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc: (fn: string) =>
        fn === "get_nowcast_anchors"
          ? Promise.resolve({ data: [anchorRow], error: null })
          : Promise.resolve({ data: [], error: null }),
    };

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: async () => mockSupabase,
    }));

    const { EnhancedForecastService: Service } = await import(
      "@/lib/services/enhanced-forecast-service"
    );
    const service = new Service() as any;

    process.env.FORECAST_CDIP_FRESHNESS_WINDOW_HOURS = "2";
    process.env.FORECAST_CDIP_MAX_BEACHES_PER_RUN = "10";

    const anchorByBeach: Record<string, unknown> = {};
    jest
      .spyOn(service, "generateComprehensiveForecastWithDiagnostics")
      .mockImplementation(async (beach: any, anchor: any) => {
        anchorByBeach[beach.id] = anchor;
        return {
          forecasts: [],
          cdip: { stationId: null, skipReason: "no_station" },
        };
      });
    jest.spyOn(service, "storeEnhancedForecasts").mockResolvedValue({ success: true });
    jest.spyOn(service, "prefetchTideStations").mockResolvedValue(undefined);

    const run = service.updateCdipEnhancedForecasts();
    await jest.runAllTimersAsync();
    await run;

    // The anchored beach got the anchor; the unanchored one got null.
    expect(anchorByBeach["b-anchor"]).toMatchObject({
      beachId: "b-anchor",
      stationId: "edu_ucsd_cdip_220",
      waveHeightM: 0.6,
    });
    expect(anchorByBeach["b-no-anchor"]).toBeNull();
  });
});
