import { findMatchingWindows } from "@/lib/alerts/window-finder";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

const mockBeach: BeachAlertMeta = {
  id: "beach-1", name: "Test Beach", slug: "test", lat: 32.88, lon: -117.25,
  timezone: "America/Los_Angeles", wind_offshore_deg: 45, wind_offshore_tol_deg: 45,
  aspect_deg: 270, preferred_tide_ft_min: 2, preferred_tide_ft_max: 5,
  preferred_tide_direction: "rising", swell_window_center_deg: 270, swell_window_halfwidth_deg: 60,
};

function makeForecast(hour: number, overrides: Partial<ForecastHour> = {}): ForecastHour {
  return {
    forecast_at: `2026-04-01T${String(hour).padStart(2, "0")}:00:00Z`,
    wave_height: 4, wave_period: 12, wave_direction: "W",
    swell_1_height: 4, swell_1_period: 12, swell_1_direction: 250,
    wind_speed: 5, wind_direction_deg: 45,
    tide_height: 3.5, tide_status: "rising", ...overrides,
  };
}

describe("findMatchingWindows", () => {
  const conditions: AlertConditions = { swell_height_min: 3, wind_speed_max_kt: 10 };

  it("finds a single contiguous window", () => {
    const forecasts = [makeForecast(7), makeForecast(8), makeForecast(9)];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows).toHaveLength(1);
    expect(windows[0].window_start).toBe(forecasts[0].forecast_at);
    // window_end is the last hour's timestamp + 1h (each forecast hour
    // represents a 60-min interval), so the 9:00 hour ends at 10:00.
    expect(windows[0].window_end).toBe("2026-04-01T10:00:00.000Z");
  });

  it("single-hour window: window_end is start + 1h, not start itself", () => {
    const forecasts = [makeForecast(7)];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows).toHaveLength(1);
    expect(windows[0].window_start).toBe("2026-04-01T07:00:00Z");
    expect(windows[0].window_end).toBe("2026-04-01T08:00:00.000Z");
  });

  it("splits non-contiguous matches into separate windows", () => {
    const forecasts = [
      makeForecast(7),
      makeForecast(8, { wind_speed: 20 }),
      makeForecast(9),
    ];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows).toHaveLength(2);
  });

  it("does not merge sparse 3-hour forecast samples into a fake broad window", () => {
    const forecasts = [makeForecast(15), makeForecast(18)];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);

    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({
      window_start: "2026-04-01T15:00:00Z",
      window_end: "2026-04-01T16:00:00.000Z",
    });
    expect(windows[1]).toMatchObject({
      window_start: "2026-04-01T18:00:00Z",
      window_end: "2026-04-01T19:00:00.000Z",
    });
  });

  it("returns empty array when nothing matches", () => {
    const forecasts = [makeForecast(7, { wave_height: 1 })];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows).toHaveLength(0);
  });

  it("picks the best hour within a window", () => {
    const forecasts = [
      makeForecast(7, { wave_height: 3 }),
      makeForecast(8, { wave_height: 6 }),
      makeForecast(9, { wave_height: 4 }),
    ];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows[0].best_hour).toBe(forecasts[1].forecast_at);
  });

  it("snapshots conditions at best hour", () => {
    const forecasts = [makeForecast(8)];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows[0].conditions_snapshot).toHaveProperty("wave_height", 4);
    expect(windows[0].conditions_snapshot).toHaveProperty("wind_speed", 5);
  });
});
