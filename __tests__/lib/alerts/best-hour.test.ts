import { scoreForecastHour } from "@/lib/alerts/best-hour";
import type { AlertConditions, ForecastHour } from "@/lib/alerts/types";

const nullForecast: ForecastHour = {
  forecast_at: "a", wave_height: null, wave_period: null, wave_direction: null,
  swell_1_height: null, swell_1_period: null, swell_1_direction: null,
  wind_speed: null, wind_direction_deg: null, tide_height: null, tide_status: null,
};

describe("scoreForecastHour", () => {
  it("scores higher when swell exceeds minimum by more", () => {
    const conditions: AlertConditions = { swell_height_min: 3 };
    const f1: ForecastHour = { ...nullForecast, wave_height: 4 };
    const f2: ForecastHour = { ...nullForecast, wave_height: 6 };
    expect(scoreForecastHour(conditions, f2)).toBeGreaterThan(scoreForecastHour(conditions, f1));
  });

  it("scores higher when wind is further below maximum", () => {
    const conditions: AlertConditions = { wind_speed_max_kt: 10 };
    const f1: ForecastHour = { ...nullForecast, wind_speed: 8 };
    const f2: ForecastHour = { ...nullForecast, wind_speed: 2 };
    expect(scoreForecastHour(conditions, f2)).toBeGreaterThan(scoreForecastHour(conditions, f1));
  });

  it("scores higher when tide is closer to range center", () => {
    const conditions: AlertConditions = { tide_height_min_ft: 2, tide_height_max_ft: 6 };
    const center: ForecastHour = { ...nullForecast, tide_height: 4 };
    const edge: ForecastHour = { ...nullForecast, tide_height: 2.5 };
    expect(scoreForecastHour(conditions, center)).toBeGreaterThan(scoreForecastHour(conditions, edge));
  });

  it("returns 0 for empty conditions", () => {
    expect(scoreForecastHour({}, nullForecast)).toBe(0);
  });
});
