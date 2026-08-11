import {
  pickBestNativeForecastSlot,
  scoreNativeForecastSlot,
} from "@/lib/scoring/native-condition-score";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { getRideabilityBand } from "@/lib/domains/rideability";

function forecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "forecast-1",
    beach_id: "beach-1",
    forecast_at: "2026-05-01T18:00:00Z",
    wave_height: "3.5 ft",
    wave_period: "13s",
    swell_1_period: "13",
    wind_speed: "0 mph",
    tide_height: "3 ft",
    tide_status: "Rising",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  } as EnhancedForecastEntity;
}

describe("native-condition-score", () => {
  it("returns 0 when wave is below skill min", () => {
    expect(
      scoreNativeForecastSlot(
        forecast({ wave_height: "0.3 ft", wind_speed: "0 mph" }),
        "intermediate"
      )
    ).toBe(0);
  });

  it("returns 0 when wave is above skill max", () => {
    expect(
      scoreNativeForecastSlot(
        forecast({ wave_height: "20 ft", wind_speed: "0 mph" }),
        "intermediate"
      )
    ).toBe(0);
  });

  it("peaks at 100 near the ideal midpoint with calm wind, long period, and good tide", () => {
    expect(scoreNativeForecastSlot(forecast(), "intermediate")).toBe(100);
  });

  it("scores the ideal midpoint higher than an acceptable shoulder", () => {
    const idealMidpoint = forecast({ wave_height: "3.5 ft" });
    const acceptableShoulder = forecast({ wave_height: "5.5 ft" });

    expect(scoreNativeForecastSlot(idealMidpoint, "intermediate")).toBeGreaterThan(
      scoreNativeForecastSlot(acceptableShoulder, "intermediate")
    );
  });

  it("scores a head-high clean day higher for advanced than beginner", () => {
    const row = forecast({ wave_height: "7 ft" });

    expect(scoreNativeForecastSlot(row, "advanced")).toBeGreaterThan(
      scoreNativeForecastSlot(row, "beginner")
    );
  });

  it("scores a small clean day higher for beginner than advanced", () => {
    const row = forecast({ wave_height: "2 ft" });

    expect(scoreNativeForecastSlot(row, "beginner")).toBeGreaterThan(
      scoreNativeForecastSlot(row, "advanced")
    );
  });

  it("keeps the no-board score unchanged while accepting a longboard-sized advanced wave", () => {
    const row = forecast({ wave_height: "1.1 ft", wave_period: "13s" });
    const longboardBand = getRideabilityBand("advanced", "longboard");

    expect(scoreNativeForecastSlot(row, "advanced")).toBe(0);
    expect(scoreNativeForecastSlot(row, "advanced", longboardBand)).toBeGreaterThan(0);
  });

  it("drops sharply with high wind", () => {
    expect(
      scoreNativeForecastSlot(
        forecast({ wind_speed: "14 mph" }),
        "intermediate"
      )
    ).toBe(75);
  });

  it("handles missing period gracefully", () => {
    expect(
      scoreNativeForecastSlot(
        forecast({ swell_1_period: null, wave_period: null }),
        "intermediate"
      )
    ).toBe(80);
  });

  it("matches the Ocean Beach Pier beginner-practice case", () => {
    const row = forecast({
      wave_height: "1.6 ft",
      wave_period: "17s",
      swell_1_period: "17s",
      wind_speed: "4 mph",
      tide_height: "3 ft",
      tide_status: "Rising",
    });

    expect(scoreNativeForecastSlot(row, "beginner")).toBe(80);
    expect(scoreNativeForecastSlot(row, "advanced")).toBe(0);
  });

  it("selects the highest-scored slot from a group", () => {
    const weak = forecast({ id: "weak", wave_height: "0.3 ft" });
    const best = forecast({ id: "best", wave_height: "2 ft" });

    expect(pickBestNativeForecastSlot([weak, best], "beginner")).toMatchObject({
      forecast: { id: "best" },
      score: 100,
    });
  });

  it("selects from daylight rows when a beach timezone is provided", () => {
    const night = forecast({
      id: "night",
      forecast_at: "2026-07-29T09:00:00Z",
    });
    const afternoon = forecast({
      id: "afternoon",
      forecast_at: "2026-07-29T21:00:00Z",
      wind_speed: "8 mph",
      wave_period: "10s",
      swell_1_period: "10s",
    });

    expect(
      pickBestNativeForecastSlot([night, afternoon], "intermediate", {
        beachTz: "America/Los_Angeles",
      }),
    ).toMatchObject({
      forecast: { id: "afternoon" },
    });
  });

  it("falls back to night rows when no daylight ranking row exists", () => {
    const night = forecast({
      id: "night",
      forecast_at: "2026-07-29T09:00:00Z",
    });

    expect(
      pickBestNativeForecastSlot([night], "intermediate", {
        beachTz: "America/Los_Angeles",
      }),
    ).toMatchObject({
      forecast: { id: "night" },
    });
  });
});
