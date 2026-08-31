import {
  NATIVE_SKILL_THRESHOLDS,
  OUT_OF_BAND_SCORE_CEILING,
  pickBestNativeForecastSlot,
  scoreNativeConditionInputs,
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
  const pristineInputs = {
    windSpeedMph: 0,
    periodSec: 13,
    tideHeightFt: 3,
    tideStatus: "Rising",
  };

  it("preserves current in-band scores", () => {
    const cases = [
      { waveHeightFt: 1, expected: 55 },
      { waveHeightFt: 2, expected: 73 },
      { waveHeightFt: 3.5, expected: 100 },
      { waveHeightFt: 5, expected: 73 },
      { waveHeightFt: 6, expected: 55 },
    ];

    for (const { waveHeightFt, expected } of cases) {
      expect(
        scoreNativeConditionInputs(
          { waveHeightFt, ...pristineInputs },
          "intermediate",
        ),
      ).toBe(expected);
    }
  });

  it("keeps non-positive wave heights at 0", () => {
    expect(
      scoreNativeConditionInputs(
        { waveHeightFt: 0, ...pristineInputs },
        "intermediate",
      ),
    ).toBe(0);
  });

  it("softens the K-40 skill cliff without changing the advanced score", () => {
    const inputs = {
      waveHeightFt: 7.1,
      windSpeedMph: 10,
      periodSec: 17,
      tideHeightFt: 3,
      tideStatus: "Rising",
    };

    expect(scoreNativeConditionInputs(inputs, "intermediate")).toBe(28);
    expect(scoreNativeConditionInputs(inputs, "advanced")).toBe(73);
  });

  it("decreases with distance and poor wind above the band", () => {
    const { waveMaxFt } = NATIVE_SKILL_THRESHOLDS.intermediate;
    const slightOver = scoreNativeConditionInputs(
      { waveHeightFt: waveMaxFt + 0.5, ...pristineInputs },
      "intermediate",
    );
    const wayOver = scoreNativeConditionInputs(
      { waveHeightFt: waveMaxFt * 1.5, ...pristineInputs },
      "intermediate",
    );
    const wayOverWithJunkWind = scoreNativeConditionInputs(
      {
        waveHeightFt: waveMaxFt * 1.5,
        ...pristineInputs,
        windSpeedMph: 30,
      },
      "intermediate",
    );

    expect([slightOver, wayOver, wayOverWithJunkWind]).toEqual([39, 18, 10]);
  });

  it("mirrors attenuation below the band", () => {
    const { waveMinFt } = NATIVE_SKILL_THRESHOLDS.intermediate;
    const slightUnder = scoreNativeConditionInputs(
      { waveHeightFt: waveMinFt - 0.25, ...pristineInputs },
      "intermediate",
    );
    const farUnder = scoreNativeConditionInputs(
      { waveHeightFt: waveMinFt - 0.5, ...pristineInputs },
      "intermediate",
    );
    const verySmall = scoreNativeConditionInputs(
      { waveHeightFt: 0.3, ...pristineInputs },
      "intermediate",
    );

    expect([slightUnder, farUnder, verySmall]).toEqual([37, 18, 4]);
  });

  it("reaches 0 at and beyond 75% excess", () => {
    const { waveMaxFt } = NATIVE_SKILL_THRESHOLDS.intermediate;

    expect(
      scoreNativeConditionInputs(
        { waveHeightFt: waveMaxFt * 1.75, ...pristineInputs },
        "intermediate",
      ),
    ).toBe(0);
    expect(
      scoreNativeConditionInputs(
        { waveHeightFt: waveMaxFt * 2, ...pristineInputs },
        "intermediate",
      ),
    ).toBe(0);
  });

  it("caps pristine conditions just outside the band below RIDEABLE", () => {
    const { waveMaxFt } = NATIVE_SKILL_THRESHOLDS.intermediate;

    expect(
      scoreNativeConditionInputs(
        { waveHeightFt: waveMaxFt + 0.01, ...pristineInputs },
        "intermediate",
      ),
    ).toBe(OUT_OF_BAND_SCORE_CEILING);
  });

  it("is non-increasing as height moves farther outside either band edge", () => {
    const { waveMinFt, waveMaxFt } = NATIVE_SKILL_THRESHOLDS.intermediate;
    const heightSweeps = [
      [waveMaxFt + 0.01, waveMaxFt + 0.5, waveMaxFt * 1.25, waveMaxFt * 1.75, waveMaxFt * 2],
      [waveMinFt - 0.01, waveMinFt - 0.25, waveMinFt - 0.5, waveMinFt - 0.75, 0.01],
    ];

    for (const heights of heightSweeps) {
      const scores = heights.map((waveHeightFt) =>
        scoreNativeConditionInputs(
          { waveHeightFt, ...pristineInputs },
          "intermediate",
        ),
      );

      for (let index = 1; index < scores.length; index += 1) {
        expect(scores[index]).toBeLessThanOrEqual(scores[index - 1]);
      }
    }
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

  it("scores a longboard-sized advanced wave higher with the board band", () => {
    const row = forecast({ wave_height: "1.1 ft", wave_period: "13s" });
    const longboardBand = getRideabilityBand("advanced", "longboard");

    expect(scoreNativeForecastSlot(row, "advanced")).toBe(22);
    expect(scoreNativeForecastSlot(row, "advanced", longboardBand)).toBe(57);
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
    expect(scoreNativeForecastSlot(row, "advanced")).toBe(36);
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
