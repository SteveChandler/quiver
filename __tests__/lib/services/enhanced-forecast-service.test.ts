import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";

// Mock external services and supabase client used internally
const upsertMock: jest.Mock<any, any> = jest.fn(async () => ({
  data: [],
  error: null,
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "1" }, error: null }),
        }),
      }),
      upsert: upsertMock,
    }),
  }),
}));

// Mock WaveWatch and CO-OPS dependencies indirectly via their fetch methods
jest.mock("@/lib/services/noaa-coops-service");
jest.mock("@/lib/services/cdip-service");

describe("EnhancedForecastService", () => {
  const beach = {
    id: "b1",
    name: "Test Beach",
    lat: 32.7157,
    lon: -117.1611,
    created_at: "",
    updated_at: "",
  } as any;

  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ data: [], error: null });
  });

  test("generateComprehensiveForecast returns forecasts array and storeEnhancedForecasts succeeds", async () => {
    // Spy on internal methods to avoid real network calls
    const service = new EnhancedForecastService() as any;

    jest.spyOn(service, "fetchWaveDataWithRetry").mockResolvedValue({
      lat: beach.lat,
      lng: beach.lon,
      data_source: "FALLBACK",
      forecast: [
        {
          timestamp: new Date().toISOString(),
          significant_wave_height: 1,
          peak_wave_period: 10,
          peak_wave_direction: 225,
          swell_1_height: 0.7,
          swell_1_period: 12,
          swell_1_direction: 225,
          swell_2_height: 0.3,
          swell_2_period: 8,
          swell_2_direction: 270,
          wind_wave_height: 0.2,
          wind_wave_period: 5,
          wind_wave_direction: 225,
          data_source: "FALLBACK",
        },
      ],
    });
    jest
      .spyOn(service, "fetchTidalDataWithRetry")
      .mockResolvedValue({ tides: [] });
    jest.spyOn(service, "fetchWeatherDataWithRetry").mockResolvedValue([]);
    jest.spyOn(service, "fetchNearbyBuoyDataWithRetry").mockResolvedValue(null);
    jest.spyOn(service, "fetchCDIPDataWithRetry").mockResolvedValue(null);

    const forecasts = await service.generateComprehensiveForecast(beach);
    expect(Array.isArray(forecasts)).toBe(true);
    expect(forecasts.length).toBeGreaterThan(0);
    // Basic shape checks
    const f = forecasts[0];
    expect(f.beach_id).toBe("b1");
    expect(f.forecast_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.forecast_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    const store = await service.storeEnhancedForecasts(beach, forecasts);
    expect(store.success).toBe(true);
  });

  test("storeEnhancedForecasts strips missing columns and retries on PGRST204", async () => {
    const service = new EnhancedForecastService() as any;

    // Keep forecast generation local/stubbed to avoid network calls
    jest.spyOn(service, "fetchWaveDataWithRetry").mockResolvedValue({
      lat: beach.lat,
      lng: beach.lon,
      data_source: "FALLBACK",
      forecast: [
        {
          timestamp: new Date().toISOString(),
          significant_wave_height: 1,
          peak_wave_period: 10,
          peak_wave_direction: 225,
          swell_1_height: 0.7,
          swell_1_period: 12,
          swell_1_direction: 225,
          swell_2_height: 0.3,
          swell_2_period: 8,
          swell_2_direction: 270,
          wind_wave_height: 0.2,
          wind_wave_period: 5,
          wind_wave_direction: 225,
          data_source: "FALLBACK",
        },
      ],
    });
    jest.spyOn(service, "fetchTidalDataWithRetry").mockResolvedValue({ tides: [] });
    jest.spyOn(service, "fetchWeatherDataWithRetry").mockResolvedValue([]);
    jest.spyOn(service, "fetchNearbyBuoyDataWithRetry").mockResolvedValue(null);
    jest.spyOn(service, "fetchCDIPDataWithRetry").mockResolvedValue(null);

    const forecasts = await service.generateComprehensiveForecast(beach);

    upsertMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST204",
          message:
            "Could not find the 'wind_direction_deg' column of 'enhanced_forecasts' in the schema cache",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const store = await service.storeEnhancedForecasts(beach, forecasts);
    expect(store.success).toBe(true);

    expect(upsertMock).toHaveBeenCalledTimes(2);

    expect(upsertMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const firstArg = upsertMock.mock.calls[0]?.[0];
    const secondArg = upsertMock.mock.calls[1]?.[0];
    expect(Array.isArray(firstArg)).toBe(true);
    expect(Array.isArray(secondArg)).toBe(true);
    const firstChunk = firstArg as Array<Record<string, unknown>>;
    const secondChunk = secondArg as Array<Record<string, unknown>>;

    // Ensure the first attempt included the column, and the retry removed it.
    expect(firstChunk.some((row) => Object.prototype.hasOwnProperty.call(row, "wind_direction_deg"))).toBe(true);
    expect(secondChunk.some((row) => Object.prototype.hasOwnProperty.call(row, "wind_direction_deg"))).toBe(false);
  });

  test("storeEnhancedForecasts returns failure on error", async () => {
    const service = new EnhancedForecastService() as any;
    // Mock supabase upsert error by monkey patching method call chain
    jest
      .spyOn(service, "storeEnhancedForecasts")
      .mockResolvedValueOnce({ success: false, error: "db" });
    const res = await service.storeEnhancedForecasts(beach, []);
    expect(res.success).toBe(false);
  });
});
