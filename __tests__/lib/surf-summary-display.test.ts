import {
  buildCompactSurfSummary,
  formatCompactWaveHeight,
} from "@/lib/surf-summary-display";

describe("surf summary display contract", () => {
  it("normalizes broad decimal wave ranges for compact headline display", () => {
    expect(formatCompactWaveHeight("0.5-5.5 ft")).toBe("3ft");
  });

  it("keeps clean compact integer ranges stable", () => {
    expect(formatCompactWaveHeight("3-4 ft")).toBe("3-4 ft");
  });

  it("builds a scannable wave, wind, swell, and tide summary", () => {
    const summary = buildCompactSurfSummary({
      waveHeight: "0.5-5.5 ft",
      windSpeed: "8 mph",
      windDirection: "NW",
      swellPeriod: "14s",
      swellDirection: "WNW",
      tideHeight: "3.2 ft",
      tideStatus: "rising",
      why: "Clean enough early before wind fills in.",
    });

    expect(summary).toMatchObject({
      waveHeightHeadline: "3ft",
      windSummary: "Wind NW 8 mph",
      swellSummary: "Swell WNW @ 14s",
      tideSummary: "Tide 3.2 ft rising",
      whySummary: "Clean enough early before wind fills in.",
    });
    expect(summary.conditionLine).toBe(
      "3ft · Wind NW 8 mph · Swell WNW @ 14s · Tide 3.2 ft rising"
    );
  });
});
