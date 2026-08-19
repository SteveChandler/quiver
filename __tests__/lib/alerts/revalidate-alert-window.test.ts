import {
  parseEnhancedForecastHour,
  selectFreshAlertWindow,
} from "@/lib/alerts/revalidate-alert-window";
import type { AlertConditions } from "@/lib/alerts/types";
import type { AlertRevalidationBeachMeta } from "@/lib/alerts/payload-builder";

const missionBeach: AlertRevalidationBeachMeta = {
  id: "mission-beach-id",
  name: "Mission Beach",
  slug: "mission-beach",
  lat: 32.7701,
  lon: -117.2525,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
  aspect_deg: 270,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 6,
  preferred_tide_direction: "rising",
  swell_window_center_deg: 300,
  swell_window_halfwidth_deg: 45,
  break_type: "beach",
  skill_level: "intermediate",
};

const mellow: AlertConditions = {
  swell_height_min: 1.5,
  swell_height_max: 4,
  wind_speed_max_kt: 8,
};

describe("selectFreshAlertWindow", () => {
  it("selects the current matching hour from refreshed forecast rows", () => {
    const window = selectFreshAlertWindow({
      conditions: mellow,
      beach: missionBeach,
      now: new Date("2026-05-13T14:00:00Z"),
      forecastRows: [
        {
          id: "enhanced-forecast-15z",
          forecast_at: "2026-05-13T15:00:00Z",
          wave_height: "0.7 ft",
          wave_period: "8s",
          wave_direction: "W",
          swell_1_period: "8s",
          swell_1_direction: "270",
          wind_speed: "0 mph",
          wind_direction_deg: 225,
          tide_height: "2.5",
          tide_status: "Falling",
        },
        {
          id: "enhanced-forecast-18z",
          forecast_at: "2026-05-13T18:00:00Z",
          wave_height: "1.9 ft",
          wave_period: "8s",
          wave_direction: "W",
          swell_1_period: "8s",
          swell_1_direction: "270",
          wind_speed: "0 mph",
          wind_direction_deg: 225,
          tide_height: "3.2",
          tide_status: "Falling",
        },
      ],
    });

    expect(window).toMatchObject({
      window_start: "2026-05-13T18:00:00Z",
      window_end: "2026-05-13T19:00:00.000Z",
      best_hour: "2026-05-13T18:00:00Z",
      forecast_id: "enhanced-forecast-18z",
      conditions_snapshot: expect.objectContaining({ wave_height: 1.9 }),
    });
  });

  it("returns null when refreshed forecasts no longer match", () => {
    const window = selectFreshAlertWindow({
      conditions: mellow,
      beach: missionBeach,
      now: new Date("2026-05-13T14:00:00Z"),
      forecastRows: [
        {
          forecast_at: "2026-05-13T15:00:00Z",
          wave_height: "0.7 ft",
          wave_period: "8s",
          wind_speed: "0 mph",
        },
      ],
    });

    expect(window).toBeNull();
  });
});

describe("parseEnhancedForecastHour", () => {
  it("parses string forecast fields into alert-hour units", () => {
    const parsed = parseEnhancedForecastHour({
      forecast_at: "2026-05-13T18:00:00Z",
      wave_height: "1.9 ft",
      wave_period: "8s",
      wave_direction: "W",
      swell_1_height: "2.0 ft",
      swell_1_period: "10s",
      swell_1_direction: "W",
      wind_speed: "5 mph",
      wind_direction_deg: "225",
      tide_height: "3.2",
      tide_status: "Falling",
    });

    expect(parsed).toMatchObject({
      wave_height: 1.9,
      wave_period: 8,
      wave_direction: "W",
      swell_1_height: 2,
      swell_1_period: 10,
      swell_1_direction: 270,
      wind_direction_deg: 225,
      tide_height: 3.2,
      tide_status: "Falling",
    });
    expect(parsed.wind_speed).toBeCloseTo(4.34488, 4);
  });
});
