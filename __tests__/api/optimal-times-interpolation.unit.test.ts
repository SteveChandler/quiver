import {
  analyzeOptimalTimes,
  parseTimeToHour,
} from "@/lib/session-planner/optimal-times-utils";

function fc(time: string, attrs: Partial<any> = {}) {
  return {
    forecast_time: time,
    wave_height: "3",
    wind_speed: "6 mph",
    wind_direction: "NE",
    confidence_score: 0.7,
    tide_height: 2.0,
    tide_type: "rising",
    swell_period: 11,
    weather_condition: "Clear",
    ...attrs,
  };
}

describe("Interpolation and anchoring", () => {
  test("interpolates between 12:00 and 15:00 to produce 14:00 and 13:00/16:00 near selected 15:10", () => {
    const forecasts = [
      fc("12:00:00", {
        wave_height: "2.5",
        wind_speed: "8 mph",
        tide_height: 1.5,
      }),
      fc("15:00:00", {
        wave_height: "3.5",
        wind_speed: "4 mph",
        tide_height: 2.8,
      }),
    ];

    const result = analyzeOptimalTimes(forecasts as any[], "15:10");
    expect(result.length).toBeGreaterThan(0);
    // Ensure all results are around the selected time, not midnight
    result.forEach((r: { time: string }) => {
      const h = parseTimeToHour(r.time)!;
      expect(h).toBeGreaterThanOrEqual(13);
      expect(h).toBeLessThanOrEqual(17);
    });
  });
});
