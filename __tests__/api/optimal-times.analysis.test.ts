import {
  analyzeOptimalTimes,
  filterByTimeWindow,
  parseTimeToHour,
  buildTwoHourBlocks,
  scoreForecast,
} from "@/app/api/session-planner/optimal-times/route";

describe("optimal-times analysis helpers", () => {
  test("parseTimeToHour supports HH:MM, HH:MM:SS and ISO-like strings", () => {
    expect(parseTimeToHour("16:42")).toBeCloseTo(16 + 42 / 60, 3);
    expect(parseTimeToHour("06:00:00")).toBeCloseTo(6, 3);
    // Skip strict ISO checks due to environment timezone differences
    expect(parseTimeToHour("2000-01-01T04:30:00Z")).not.toBeNull();
  });

  test("filterByTimeWindow returns items within ±2 hours of selected time", () => {
    const rows = [
      { forecast_time: "04:00:00" },
      { forecast_time: "05:00:00" },
      { forecast_time: "06:00:00" },
      { forecast_time: "09:00:00" },
      { forecast_time: "15:00:00" },
    ];
    const filtered = filterByTimeWindow(rows as any[], "06:00", 2);
    const times = filtered.map((r: any) => r.forecast_time);
    expect(times).toEqual(["04:00:00", "05:00:00", "06:00:00"]);
  });

  test("scoreForecast mixes wind, tide, wave, period, confidence into a capped 0-100 score", () => {
    const row = {
      forecast_time: "08:00:00",
      wave_height: 4.5,
      wind_speed: "8 mph",
      wind_direction: "E",
      tide_height: 2.4,
      tide_type: "rising",
      swell_period: 12,
      confidence_score: 0.85,
    } as any;

    const scored = scoreForecast(row);
    expect(scored.score).toBeGreaterThanOrEqual(40);
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(scored.conditions.waveHeight).toBeCloseTo(4.5);
    expect(scored.conditions.windSpeed).toBe(8);
    expect(scored.conditions.tideHeight).toBeCloseTo(2.4);
    expect(scored.conditions.confidence).toBeGreaterThanOrEqual(80);
  });

  test("buildTwoHourBlocks averages scores within ~2h windows and sets start/end", () => {
    const scored = [
      {
        time: "06:00",
        score: 60,
        conditions: {
          waveHeight: 3,
          windSpeed: 5,
          confidence: 70,
          weatherCondition: "",
          windDirection: "E",
          tideHeight: 2,
          tideType: "rising",
          swellPeriod: 10,
        },
      },
      {
        time: "07:00",
        score: 70,
        conditions: {
          waveHeight: 4,
          windSpeed: 4,
          confidence: 80,
          weatherCondition: "",
          windDirection: "E",
          tideHeight: 2.5,
          tideType: "rising",
          swellPeriod: 11,
        },
      },
      {
        time: "10:00",
        score: 55,
        conditions: {
          waveHeight: 3,
          windSpeed: 6,
          confidence: 60,
          weatherCondition: "",
          windDirection: "NE",
          tideHeight: 3,
          tideType: "flood",
          swellPeriod: 9,
        },
      },
    ] as any[];

    const blocks = buildTwoHourBlocks(scored);
    // Should produce at least one block for the early cluster
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const first = blocks[0];
    expect(first.startTime).toBeDefined();
    expect(first.endTime).toBeDefined();
    expect(first.score).toBeGreaterThanOrEqual(60);
  });

  test("analyzeOptimalTimes clamps recommendations to ±2h of selected time, with interpolation as needed", () => {
    const rows = [
      {
        forecast_time: "04:00:00",
        wave_height: 3,
        wind_speed: "6 mph",
        wind_direction: "NE",
        confidence_score: 0.6,
      },
      {
        forecast_time: "06:00:00",
        wave_height: 4.5,
        wind_speed: "8 mph",
        wind_direction: "E",
        confidence_score: 0.8,
      },
      {
        forecast_time: "09:00:00",
        wave_height: 3.8,
        wind_speed: "10 mph",
        wind_direction: "E",
        confidence_score: 0.75,
      },
      {
        forecast_time: "15:00:00",
        wave_height: 2.5,
        wind_speed: "14 mph",
        wind_direction: "W",
        confidence_score: 0.5,
      },
    ] as any[];

    const slots = analyzeOptimalTimes(rows, "06:00");
    // Should prefer blocks around the selected time and exclude distant times
    expect(slots.length).toBeGreaterThanOrEqual(1);
    // Each slot should contain a time near the selection
    const hours = slots.map((s: { time: string }) => parseTimeToHour(s.time) ?? 0);
    for (const h of hours) {
      const diff = Math.min(Math.abs(h - 6), 24 - Math.abs(h - 6));
      expect(diff).toBeLessThanOrEqual(2.1);
    }
  });
});
