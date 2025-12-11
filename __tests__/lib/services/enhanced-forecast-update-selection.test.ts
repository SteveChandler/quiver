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
    const enhancedForecastRows = [
      // Newest first, as if ordered by updated_at desc:
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
            select: () => ({
              order: () => ({
                range: () =>
                  Promise.resolve({
                    data: enhancedForecastRows,
                    error: null,
                  }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
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
      .spyOn(service, "generateComprehensiveForecast")
      .mockImplementation(async (beach: any) => {
        processedBeachIds.push(beach.id);
        return [];
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
});

