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

const blacksBeach: AlertRevalidationBeachMeta = {
  ...missionBeach, id: "blacks-id", name: "Blacks Beach", slug: "blacks-beach", lat: 32.8894, lon: -117.2538,
};
const watchBlacks: AlertConditions = {
  swell_height_min: 3, swell_height_max: 6, swell_period_min: 7, wind_speed_max_kt: 9,
  tide_height_min_ft: 0, tide_height_max_ft: 4, tide_direction: "rising",
};
// enhanced_forecasts rows in their stored string format (checked on prod 2026-10-01; bare/mph
// wind is read as mph by parseWindSpeedToKt). Blacks 2026-10-01 05:00 / 08:00 / 11:00 PDT.
const blacksRows = [
  { id: "r05", forecast_at: "2026-10-01T12:00:00+00:00", wave_height: "4-5 ft", wave_period: "12s", swell_1_period: "12s", wind_speed: "0 mph", tide_height: "2.5 ft", tide_status: "Rising" },
  { id: "r08", forecast_at: "2026-10-01T15:00:00+00:00", wave_height: "4-5 ft", wave_period: "12s", swell_1_period: "12s", wind_speed: "4 mph", tide_height: "3.9 ft", tide_status: "Rising" },
  { id: "r11", forecast_at: "2026-10-01T18:00:00+00:00", wave_height: "4-5 ft", wave_period: "12s", swell_1_period: "12s", wind_speed: "8 mph", tide_height: "5.2 ft", tide_status: "Rising" },
];
const blacksNoaa = [
  ["2026-10-01T12:00:00Z", 2.53], ["2026-10-01T13:00:00Z", 2.56], ["2026-10-01T14:00:00Z", 2.84],
  ["2026-10-01T15:00:00Z", 3.38], ["2026-10-01T16:00:00Z", 4.09], ["2026-10-01T17:00:00Z", 4.83], ["2026-10-01T18:00:00Z", 5.3],
].map(([time, heightFt]) => ({ time: time as string, heightFt: heightFt as number }));
const before = new Date("2026-10-01T12:30:00Z"); // 05:30 PDT, when the push would go out

describe("hourly alert windows (Blacks 2026-10-01)", () => {
  it("keeps today's one-hour window with the flag off", () => {
    const w = selectFreshAlertWindow({ conditions: watchBlacks, forecastRows: blacksRows, beach: blacksBeach, now: before });
    expect([w?.window_start, w?.window_end]).toEqual(["2026-10-01T15:00:00+00:00", "2026-10-01T16:00:00.000Z"]);
  });

  it("finds the real 7–9 AM stretch on hourly rows with NOAA tide", () => {
    const w = selectFreshAlertWindow({
      conditions: watchBlacks, forecastRows: blacksRows, beach: blacksBeach, now: before,
      hourly: true, tideSamples: blacksNoaa,
    });
    expect(new Date(w!.window_start).toISOString()).toBe("2026-10-01T14:00:00.000Z");
    expect(new Date(w!.window_end).toISOString()).toBe("2026-10-01T16:00:00.000Z");
    expect(w!.forecast_id).toMatch(/^r0[58]$/);
  });
});

describe("hourly alert windows: final review fixes", () => {
  it("still delivers the dawn window at the first deliver tick after sunrise (Blacks 07:00)", () => {
    const w = selectFreshAlertWindow({
      conditions: watchBlacks, forecastRows: blacksRows, beach: blacksBeach,
      now: new Date("2026-10-01T14:00:05Z"), hourly: true, tideSamples: blacksNoaa,
    });
    expect(w).not.toBeNull();
    expect(new Date(w!.window_start).toISOString()).toBe("2026-10-01T14:00:00.000Z");
  });

  it("judges a window's size by its own hours, not the hour after it", () => {
    const rows = [
      { id: "a", forecast_at: "2026-06-20T14:00:00+00:00", wave_height: "1 ft", wave_period: "10s", wind_speed: "0 mph" },
      { id: "b", forecast_at: "2026-06-20T15:00:00+00:00", wave_height: "1 ft", wave_period: "10s", wind_speed: "0 mph" },
      { id: "c", forecast_at: "2026-06-20T16:00:00+00:00", wave_height: "3 ft", wave_period: "10s", wind_speed: "20 mph" },
    ];
    const conditions: AlertConditions = { swell_height_min: 0.5, wind_speed_max_kt: 8 };
    // 14–16Z matches on 1 ft (Mission Beach needs 1.5 ft); the 3 ft hour at 16Z fails on wind.
    expect(selectFreshAlertWindow({ conditions, forecastRows: rows, beach: missionBeach, now: new Date("2026-06-20T12:00:00Z"), hourly: true })).toBeNull();
  });
});
