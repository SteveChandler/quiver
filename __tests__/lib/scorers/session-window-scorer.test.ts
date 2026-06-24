/**
 * @jest-environment node
 */
jest.mock("@/lib/analyzers/wind-analyzer", () => ({
  calculateOnOffshore: jest.fn(() => true),
  windAt: jest.fn(() => ({
    speed: 3,
    direction: 270,
    cardinal: "W",
    offshore: false,
    description: "light winds",
  })),
}));

import { bestWindowHeuristic } from "@/lib/scorers/session-window-scorer";
import type { ForecastSlice } from "@/types/morning-intel";

function forecast(
  overrides: Partial<ForecastSlice["forecasts"][number]> = {}
): ForecastSlice["forecasts"][number] {
  return {
    forecast_at: "2026-06-20T13:00:00.000Z",
    forecast_date: "2026-06-20",
    forecast_time: "13:00:00",
    wave_height: 3,
    wave_period: 14,
    wind_speed: 3,
    wind_direction: 270,
    tide_height: 3,
    tide_status: "rising",
    swell_period: 14,
    ...overrides,
  };
}

describe("bestWindowHeuristic", () => {
  it("uses the beach timezone when filtering morning forecast_at rows", () => {
    const result = bestWindowHeuristic(
      [
        forecast({
          forecast_at: "2026-06-20T09:00:00.000Z",
          forecast_time: "09:00:00",
        }),
        forecast({
          forecast_at: "2026-06-20T13:00:00.000Z",
          forecast_time: "13:00:00",
        }),
      ],
      [],
      "America/Los_Angeles"
    );

    expect(result).toMatch(/^06:00/);
    expect(result).not.toContain("09:00");
  });
});
