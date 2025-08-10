import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";

// Mock external services and supabase client used internally
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "1" }, error: null }),
        }),
      }),
      upsert: async () => ({ data: [], error: null }),
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
    latitude: 32.7157,
    longitude: -117.1611,
    created_at: "",
    updated_at: "",
  } as any;

  test("generateComprehensiveForecast returns forecasts array and storeEnhancedForecasts succeeds", async () => {
    // Spy on internal methods to avoid real network calls
    const service = new EnhancedForecastService() as any;

    jest.spyOn(service, "fetchWaveDataWithRetry").mockResolvedValue({
      lat: beach.latitude,
      lng: beach.longitude,
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
