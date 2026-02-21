import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import type { EnhancedForecastEntity } from "@/types/forecast";

/** Helper to create a minimal valid EnhancedForecastEntity with optional overrides. */
function makeForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "test-id",
    beach_id: "beach-1",
    forecast_at: "2026-02-18T08:00:00Z",
    forecast_date: "2026-02-18",
    forecast_time: "08:00",
    wave_height: null,
    water_temp: null,
    confidence_score: null,
    data_source: "NOAA_NWS",
    created_at: "2026-02-18T00:00:00Z",
    updated_at: "2026-02-18T00:00:00Z",
    ...overrides,
  };
}

describe("forecastToConditionsData", () => {
  it("maps all 8 fields from a fully-populated forecast", () => {
    const forecast = makeForecast({
      wave_height: "3-5ft",
      wave_period: "12s",
      wave_direction: "SSW",
      wind_speed: "8mph",
      wind_direction: "NW",
      water_temp: "62F",
      tide_status: "Rising",
      tide_height: "3.2ft",
    });

    const result = forecastToConditionsData(forecast);

    expect(result).toEqual({
      waveHeight: "3-5ft",
      wavePeriod: "12s",
      waveDirection: "SSW",
      windSpeed: "8mph",
      windDirection: "NW",
      waterTemp: "62F",
      tideStatus: "Rising",
      tideHeight: "3.2ft",
    });
  });

  it("returns all nulls for a minimal forecast with no optional fields", () => {
    const forecast = makeForecast();

    const result = forecastToConditionsData(forecast);

    expect(result).toEqual({
      waveHeight: null,
      wavePeriod: null,
      waveDirection: null,
      windSpeed: null,
      windDirection: null,
      waterTemp: null,
      tideStatus: null,
      tideHeight: null,
    });
  });

  it("maps individual fields independently", () => {
    const withWaveOnly = forecastToConditionsData(
      makeForecast({ wave_height: "4-6ft" })
    );
    expect(withWaveOnly.waveHeight).toBe("4-6ft");
    expect(withWaveOnly.windSpeed).toBeNull();

    const withWindOnly = forecastToConditionsData(
      makeForecast({ wind_speed: "15mph", wind_direction: "S" })
    );
    expect(withWindOnly.windSpeed).toBe("15mph");
    expect(withWindOnly.windDirection).toBe("S");
    expect(withWindOnly.waveHeight).toBeNull();
  });

  it("converts undefined optional fields to null", () => {
    // wave_period, wave_direction, etc. are optional on EnhancedForecastEntity
    // and may be undefined rather than null — the mapper should normalize to null
    const forecast = makeForecast({
      wave_height: "2-3ft",
      // wave_period is intentionally omitted (undefined)
    });

    const result = forecastToConditionsData(forecast);

    expect(result.waveHeight).toBe("2-3ft");
    expect(result.wavePeriod).toBeNull();
  });
});
