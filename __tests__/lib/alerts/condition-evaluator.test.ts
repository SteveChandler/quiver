import { evaluateConditions } from "@/lib/alerts/condition-evaluator";
import type {
  AlertConditions,
  BeachAlertMeta,
  ForecastHour,
} from "@/lib/alerts/types";

const mockBeach: BeachAlertMeta = {
  id: "beach-1",
  name: "Blacks Beach",
  slug: "blacks-beach",
  lat: 32.88,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 45,
  aspect_deg: 270,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
  preferred_tide_direction: "rising",
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 60,
};

const baseForecast: ForecastHour = {
  forecast_at: "2026-04-01T15:00:00Z",
  wave_height: 4,
  wave_period: 12,
  wave_direction: "W",
  swell_1_height: 4,
  swell_1_period: 12,
  swell_1_direction: 250,
  wind_speed: 5,
  wind_direction_deg: 45,
  tide_height: 3.5,
  tide_status: "rising",
};

describe("evaluateConditions", () => {
  it("returns true when all conditions match", () => {
    const conditions: AlertConditions = {
      swell_height_min: 3,
      wind_speed_max_kt: 10,
      tide_direction: "rising",
    };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(true);
  });

  it("returns false when swell height below minimum", () => {
    expect(
      evaluateConditions({ swell_height_min: 6 }, baseForecast, mockBeach),
    ).toBe(false);
  });

  it("returns false when swell height above maximum", () => {
    expect(
      evaluateConditions({ swell_height_max: 3 }, baseForecast, mockBeach),
    ).toBe(false);
  });

  it("evaluates swell period minimum", () => {
    expect(
      evaluateConditions({ swell_period_min: 14 }, baseForecast, mockBeach),
    ).toBe(false);
    expect(
      evaluateConditions({ swell_period_min: 10 }, baseForecast, mockBeach),
    ).toBe(true);
  });

  it("evaluates wind speed maximum", () => {
    expect(
      evaluateConditions({ wind_speed_max_kt: 3 }, baseForecast, mockBeach),
    ).toBe(false);
    expect(
      evaluateConditions({ wind_speed_max_kt: 10 }, baseForecast, mockBeach),
    ).toBe(true);
  });

  it("evaluates offshore wind direction", () => {
    expect(
      evaluateConditions(
        { wind_direction: "offshore" },
        baseForecast,
        mockBeach,
      ),
    ).toBe(true);
  });

  it("evaluates onshore wind direction", () => {
    const onshoreWind = { ...baseForecast, wind_direction_deg: 270 };
    expect(
      evaluateConditions({ wind_direction: "onshore" }, onshoreWind, mockBeach),
    ).toBe(true);
  });

  it("evaluates tide height range", () => {
    expect(
      evaluateConditions(
        { tide_height_min_ft: 2, tide_height_max_ft: 4 },
        baseForecast,
        mockBeach,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        { tide_height_min_ft: 2, tide_height_max_ft: 4 },
        { ...baseForecast, tide_height: 6 },
        mockBeach,
      ),
    ).toBe(false);
  });

  it("evaluates tide direction", () => {
    expect(
      evaluateConditions(
        { tide_direction: "falling" },
        baseForecast,
        mockBeach,
      ),
    ).toBe(false);
    expect(
      evaluateConditions({ tide_direction: "rising" }, baseForecast, mockBeach),
    ).toBe(true);
  });

  it("blocks avoided tide statuses for sandy beginner windows", () => {
    expect(
      evaluateConditions(
        { swell_height_max: 3, avoid_tide_statuses: ["high"] },
        { ...baseForecast, wave_height: 1.5, tide_status: "High" },
        mockBeach,
      ),
    ).toBe(false);
    expect(
      evaluateConditions(
        { swell_height_max: 3, avoid_tide_statuses: ["high"] },
        { ...baseForecast, wave_height: 1.5, tide_status: "Rising" },
        mockBeach,
      ),
    ).toBe(true);
  });

  it("requires local morning windows when configured", () => {
    const conditions: AlertConditions = {
      local_time_start: "06:00",
      local_time_end: "10:00",
    };

    expect(
      evaluateConditions(
        conditions,
        { ...baseForecast, forecast_at: "2026-04-01T15:00:00Z" },
        mockBeach,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        conditions,
        { ...baseForecast, forecast_at: "2026-04-01T20:00:00Z" },
        mockBeach,
      ),
    ).toBe(false);
  });

  it("evaluates swell direction with degree wrapping", () => {
    expect(
      evaluateConditions(
        { swell_direction_min_deg: 315, swell_direction_max_deg: 45 },
        { ...baseForecast, swell_1_direction: 350 },
        mockBeach,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        { swell_direction_min_deg: 315, swell_direction_max_deg: 45 },
        { ...baseForecast, swell_1_direction: 180 },
        mockBeach,
      ),
    ).toBe(false);
  });

  it("returns true with empty conditions", () => {
    expect(evaluateConditions({}, baseForecast, mockBeach)).toBe(true);
  });

  it("handles null forecast values gracefully", () => {
    expect(
      evaluateConditions(
        { swell_height_min: 3 },
        { ...baseForecast, wave_height: null },
        mockBeach,
      ),
    ).toBe(false);
  });

  it("uses AND logic — all conditions must match", () => {
    expect(
      evaluateConditions(
        { swell_height_min: 3, wind_speed_max_kt: 3 },
        baseForecast,
        mockBeach,
      ),
    ).toBe(false);
  });
});
