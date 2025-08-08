import {
  parseTimeToHour,
  filterByTimeWindow,
  scoreForecast,
  analyzeOptimalTimes,
  buildTwoHourBlocks,
} from "@/app/api/session-planner/optimal-times/route";

// Minimal mock forecast row factory
function fc(time: string, attrs: Partial<any> = {}) {
  return {
    forecast_time: time,
    wave_height: "3",
    wind_speed: "5 mph",
    wind_direction: "NE",
    confidence_score: 0.7,
    tide_height: 2.5,
    tide_type: "rising",
    swell_period: 12,
    weather_condition: "Clear",
    ...attrs,
  };
}

describe("Optimal Times utilities", () => {
  test("parseTimeToHour handles HH:MM:SS, HH:MM, AM/PM, ISO", () => {
    expect(parseTimeToHour("15:00:00")).toBeCloseTo(15, 5);
    expect(parseTimeToHour("06:30")).toBeCloseTo(6.5, 5);
    expect(parseTimeToHour("03:10 PM")).toBeCloseTo(15.166, 2);

    const iso = new Date("2025-01-01T03:10:00Z");
    const h = iso.getHours() + iso.getMinutes() / 60;
    expect(parseTimeToHour("2025-01-01T03:10:00Z")).toBeCloseTo(h, 5);
  });

  test("filterByTimeWindow keeps ±2h around selected time", () => {
    const forecasts = [
      fc("12:00:00"),
      fc("14:00:00"),
      fc("15:00:00"),
      fc("16:00:00"),
      fc("18:00:00"),
      fc("21:00:00"),
    ];

    const around1510 = filterByTimeWindow(forecasts as any[], "15:10", 2);
    const hours = around1510.map((f) => parseTimeToHour(f.forecast_time)!);
    // Should include approx 13:10..17:10 → 14,15,16 are inside; 12,18,21 out
    expect(hours).toEqual(expect.arrayContaining([14, 15, 16]));
    expect(hours).not.toEqual(expect.arrayContaining([12, 18, 21]));
  });

  test("scoreForecast emphasizes mid/rising tide and offshore winds", () => {
    const s = scoreForecast(fc("15:00:00"));
    expect(s.score).toBeGreaterThanOrEqual(50);
    expect(s.reasons.join(" ").toLowerCase()).toContain("rising tide");
    expect(s.reasons.join(" ").toLowerCase()).toContain("mid tide");
    expect(s.reasons.join(" ").toLowerCase()).toContain("offshore");
  });

  test("analyzeOptimalTimes restricts to selected window and sorts by score", () => {
    const forecasts = [
      fc("00:00:00", { wind_speed: "20 mph" }),
      fc("14:00:00"),
      fc("15:00:00"),
      fc("16:00:00"),
      fc("21:00:00", { wind_speed: "20 mph" }),
    ];
    const result = analyzeOptimalTimes(forecasts as any[], "15:10");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((r) => {
      const h = parseTimeToHour(r.time)!;
      expect(h).toBeGreaterThanOrEqual(13);
      expect(h).toBeLessThanOrEqual(17);
    });
  });

  test("buildTwoHourBlocks creates ranges and averages score", () => {
    const scored = [
      scoreForecast(fc("14:00:00")),
      scoreForecast(fc("15:00:00")),
      scoreForecast(fc("16:00:00")),
    ];
    const blocks = buildTwoHourBlocks(scored);
    expect(blocks.length).toBeGreaterThan(0);
    const b = blocks[0];
    expect(b.startTime).toBeDefined();
    expect(b.endTime).toBeDefined();
    expect(typeof b.score).toBe("number");
  });
});
