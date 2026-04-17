import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

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

  it("normalizes numeric wind direction to cardinal", () => {
    const result = forecastToConditionsData(
      makeForecast({ wind_direction: "109" })
    );
    expect(result.windDirection).toBe("ESE");
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

const testBeach = {
  break_type: "beach",
  aspect_deg: 180,
  swell_access_factors: null,
} as unknown as Beach;

describe("forecastToConditionsData with beach (wave frequency)", () => {
  it("returns 0 when wave_height is below the break's threshold even with stacked swell components", () => {
    // Rockaway-like components (2.7 + 2.2 + 1.3 ft) that would RSS-combine
    // above the 2.0 ft beach threshold but wave_height itself reads 1.8 ft.
    // The gate now reads wave_height directly — same source as the card
    // display — so below-threshold displayed heights gate out regardless
    // of per-component energy.
    const forecast = makeForecast({
      wave_height: "1.8 ft",
      wave_period: "10s",
      swell_1_height: "2.7 ft",
      swell_1_period: "10s",
      swell_1_direction: "SE",
      swell_2_height: "2.2 ft",
      swell_2_period: "9s",
      wind_wave_height: "1.3 ft",
    });
    const result = forecastToConditionsData(forecast, testBeach);
    expect(result.rideableWavesPerHour).toBe(0);
  });

  it("passes the gate when wave_height is above the break's threshold", () => {
    const forecast = makeForecast({
      wave_height: "3 ft",
      wave_period: "12s",
      swell_1_height: "3 ft",
      swell_1_period: "12s",
      swell_1_direction: "S",
    });
    const result = forecastToConditionsData(forecast, testBeach);
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });

  it("gates on wave_height string, including range formats like '4-5ft'", () => {
    const forecast = makeForecast({
      wave_height: "4-5ft",
      wave_period: "10s",
    });
    const result = forecastToConditionsData(forecast, testBeach);
    // wave_height lower bound 4ft > 2.0ft threshold → should produce waves
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });

  it("returns 0 waves/hr when all components are flat", () => {
    const forecast = makeForecast({
      wave_height: "Flat",
      wave_period: "8s",
    });
    const result = forecastToConditionsData(forecast, testBeach);
    expect(result.rideableWavesPerHour).toBe(0);
  });

  it("returns null rideableWavesPerHour when no beach provided", () => {
    const forecast = makeForecast({
      wave_height: "4-5ft",
      wave_period: "10s",
      swell_1_height: "3 ft",
    });
    const result = forecastToConditionsData(forecast);
    expect(result.rideableWavesPerHour).toBeUndefined();
  });

  it("still passes the gate when swell components are null as long as wave_height is above threshold", () => {
    // All swell fields null/missing but wave_height has a real value.
    // Swell components are still used downstream for period/weighting math,
    // but the gate is purely wave_height-driven.
    const forecast = makeForecast({
      wave_height: "3 ft",
      wave_period: "10s",
      swell_1_height: null,
      swell_2_height: null,
      wind_wave_height: null,
    });
    const result = forecastToConditionsData(forecast, testBeach);
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });
});
