/**
 * @jest-environment node
 */
import { buildHourlyChart } from "@/lib/utils/beach-hourly-chart";
import type { PublicForecastHour } from "@/lib/services/spot-surf-report-service";

function hour(at: string, extra: Partial<PublicForecastHour> = {}): PublicForecastHour {
  return { forecast_at: at, wave_height: "2.5 ft", wind_speed: "9 mph", wind_direction: "WNW",
    tide_height: "4.0", tide_status: "Falling", confidence_score: 90,
    swell_1_height: null, swell_1_period: null, swell_1_direction: null,
    swell_2_height: null, swell_2_period: null, swell_2_direction: null, ...extra } as PublicForecastHour;
}

describe("buildHourlyChart", () => {
  it("reads the top of a range as the bar height", () => {
    const chart = buildHourlyChart([hour("2026-09-27T18:00:00.000Z", { wave_height: "2-3 ft" })], { start: null, end: null });
    expect(chart.points[0].heightFt).toBe(3);
    expect(chart.maxHeightFt).toBe(3);
  });

  it("marks the hours inside the best window", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T17:00:00.000Z"), hour("2026-09-27T18:00:00.000Z"), hour("2026-09-27T20:30:00.000Z")],
      { start: "2026-09-27T18:00:00.000Z", end: "2026-09-27T20:30:00.000Z" },
    );
    expect(chart.points.map((p) => p.inBestWindow)).toEqual([false, true, false]);
    expect(chart.bestWindow).toEqual({ start: "2026-09-27T18:00:00.000Z", end: "2026-09-27T20:30:00.000Z" });
  });

  it("parses compass and numeric wind directions", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T18:00:00.000Z"), hour("2026-09-27T19:00:00.000Z", { wind_direction: "300" })],
      { start: null, end: null },
    );
    expect(chart.points[0].windFromDeg).toBe(292.5);
    expect(chart.points[1].windFromDeg).toBe(300);
  });

  it("keeps unreadable values as null and the range empty", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T18:00:00.000Z", { wave_height: null, tide_height: null, wind_direction: null })],
      { start: null, end: null },
    );
    expect(chart.points[0]).toMatchObject({ heightFt: null, tideFt: null, windFromDeg: null });
    expect(chart.tideRange).toBeNull();
    expect(chart.maxHeightFt).toBe(0);
  });

  it("sorts points by time", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T20:00:00.000Z"), hour("2026-09-27T14:00:00.000Z")],
      { start: null, end: null },
    );
    expect(chart.points.map((p) => p.at)).toEqual(["2026-09-27T14:00:00.000Z", "2026-09-27T20:00:00.000Z"]);
  });
});
