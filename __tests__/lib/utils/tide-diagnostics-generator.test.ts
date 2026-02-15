import { generateTideDiagnosticsFromForecasts } from "@/lib/utils/tide-diagnostics-generator";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Helper to create a mock forecast entity
function createMockForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "test-id",
    beach_id: "test-beach-id",
    forecast_at: "2025-01-06T12:00:00Z",
    forecast_date: "2025-01-06",
    forecast_time: "12:00:00",
    wave_height: "3 ft",
    wave_period: "12 s",
    wave_direction: "SW",
    swell_1_height: "2 ft",
    swell_1_period: "14 s",
    swell_1_direction: "S",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    air_temperature: "65",
    wind_speed: "10 mph",
    wind_direction: "NW",
    wind_direction_deg: 315,
    weather_condition: "Clear",
    tide_status: "Rising",
    tide_height: "3.5 ft",
    next_tide_time: "14:30",
    next_tide_type: "High",
    next_tide_height: "5.2 ft",
    water_temp: "60",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    raw_forecast: null,
    created_at: "2025-01-06T10:00:00Z",
    updated_at: "2025-01-06T12:00:00Z",
    ...overrides,
  };
}

describe("tide-diagnostics-generator", () => {
  describe("generateTideDiagnosticsFromForecasts", () => {
    describe("freshness calculation (regression test for forecasts[0] bug)", () => {
      it("uses max(updated_at) for freshness, not forecasts[0]", () => {
        // Create forecasts where forecasts[0] has an old updated_at
        // This simulates the bug scenario: tide chart lookback includes
        // yesterday's data, sorted ASC, so forecasts[0] is the oldest row
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const forecasts: EnhancedForecastEntity[] = [
          // Old lookback row - would cause "stale" if used
          createMockForecast({
            forecast_date: "2025-01-04",
            updated_at: twoDaysAgo.toISOString(),
          }),
          // Fresh data - should be used for freshness check
          createMockForecast({
            forecast_date: "2025-01-06",
            updated_at: tenMinutesAgo.toISOString(),
          }),
        ];

        const diagnostics = generateTideDiagnosticsFromForecasts(forecasts, {
          beachName: "Test Beach",
        });

        // The freshness should be "fresh" (< 30 minutes) because we use
        // the max(updated_at) which is 10 minutes ago
        expect(diagnostics.dataFreshness).toBe("fresh");

        // Verify that lastFetchTime is the latest timestamp, not forecasts[0]
        const lastFetchTimeMs = diagnostics.lastFetchTime!.getTime();
        const expectedMs = tenMinutesAgo.getTime();
        expect(Math.abs(lastFetchTimeMs - expectedMs)).toBeLessThan(1000);
      });

      it("returns stale only when ALL forecasts are actually old", () => {
        const now = new Date();
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

        const forecasts: EnhancedForecastEntity[] = [
          createMockForecast({
            forecast_date: "2025-01-04",
            updated_at: fourHoursAgo.toISOString(),
          }),
          createMockForecast({
            forecast_date: "2025-01-05",
            updated_at: threeHoursAgo.toISOString(),
          }),
        ];

        const diagnostics = generateTideDiagnosticsFromForecasts(forecasts, {
          beachName: "Test Beach",
        });

        // Both are > 2 hours old, so should be stale
        expect(diagnostics.dataFreshness).toBe("stale");
      });

      it("returns cached for data 30-120 minutes old", () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const forecasts: EnhancedForecastEntity[] = [
          createMockForecast({
            updated_at: oneHourAgo.toISOString(),
          }),
        ];

        const diagnostics = generateTideDiagnosticsFromForecasts(forecasts, {
          beachName: "Test Beach",
        });

        expect(diagnostics.dataFreshness).toBe("cached");
      });

      it("handles forecasts with null updated_at gracefully", () => {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const forecasts: EnhancedForecastEntity[] = [
          createMockForecast({ updated_at: null as any }),
          createMockForecast({ updated_at: fiveMinutesAgo.toISOString() }),
          createMockForecast({ updated_at: undefined as any }),
        ];

        const diagnostics = generateTideDiagnosticsFromForecasts(forecasts, {
          beachName: "Test Beach",
        });

        // Should find the valid timestamp and use it
        expect(diagnostics.dataFreshness).toBe("fresh");
      });

      it("returns stale for empty forecasts array", () => {
        const diagnostics = generateTideDiagnosticsFromForecasts([], {
          beachName: "Test Beach",
        });

        expect(diagnostics.dataFreshness).toBe("stale");
      });

      it("returns cached when all updated_at are null", () => {
        const forecasts: EnhancedForecastEntity[] = [
          createMockForecast({ updated_at: null as any }),
          createMockForecast({ updated_at: undefined as any }),
        ];

        const diagnostics = generateTideDiagnosticsFromForecasts(forecasts, {
          beachName: "Test Beach",
        });

        // When no valid timestamp found, returns "cached" (not "stale")
        expect(diagnostics.dataFreshness).toBe("cached");
      });
    });

    describe("basic functionality", () => {
      it("generates diagnostics from valid forecasts", () => {
        const forecasts: EnhancedForecastEntity[] = [
          createMockForecast(),
        ];

        const diagnostics = generateTideDiagnosticsFromForecasts(forecasts, {
          beachName: "Test Beach",
          stationId: "test-station",
          isPrimaryStation: true,
        });

        expect(diagnostics.beachName).toBe("Test Beach");
        expect(diagnostics.stationId).toBe("test-station");
        expect(diagnostics.isPrimaryStation).toBe(true);
        expect(diagnostics.isValidated).toBe(true);
      });

      it("extracts next high/low tide info", () => {
        const now = new Date();
        const forecasts: EnhancedForecastEntity[] = [
          createMockForecast({
            forecast_date: now.toISOString().split("T")[0],
            next_tide_time: new Date(
              now.getTime() + 2 * 60 * 60 * 1000
            ).toISOString(),
            next_tide_type: "High",
            next_tide_height: "5.2 ft",
          }),
        ];

        const diagnostics = generateTideDiagnosticsFromForecasts(forecasts);

        expect(diagnostics.nextHigh).toBeDefined();
        expect(diagnostics.nextHigh?.height).toBe(5.2);
      });
    });
  });
});
