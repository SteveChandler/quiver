import {
  computeSummary,
  type CoastPulseSummaryItem,
} from "@/lib/utils/coast-pulse-summary";

describe("computeSummary wind selection", () => {
  it("prefers structured beach wind over offshore buoy wind", () => {
    const items: CoastPulseSummaryItem[] = [
      {
        source: { type: "ndbc", credibility: 90 },
        message: "4ft @ 12s, 18kt W",
        timestamp: new Date(),
      },
      {
        source: { type: "forecast", credibility: 75 },
        message: "3-4ft @ 12s SW, light offshore",
        timestamp: new Date(),
        windSpeedMph: 7.4,
        windDirection: "E",
      },
    ];

    expect(computeSummary(items).windSpeed).toBe("7 mph E");
  });

  it("falls back to buoy wind when beach wind is unavailable", () => {
    const items: CoastPulseSummaryItem[] = [
      {
        source: { type: "ndbc", credibility: 90 },
        message: "Long-period swell, 4ft @ 12s",
        timestamp: new Date(),
        windSpeedMph: 12.6,
        windDirection: "W",
      },
    ];

    expect(computeSummary(items).windSpeed).toBe("13 mph W");
  });
});
