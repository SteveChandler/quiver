import {
  buildMonotoneCurvePath,
  buildTideChartXTicks,
  formatPanelTideHeight,
  tideHeightOnCurve,
  tideYDomain,
} from "@/lib/tides/tide-panel";

const HOUR = 3_600_000;
const HONOLULU = "Pacific/Honolulu";
// 2026-11-12 14:00 HST
const START = Date.parse("2026-11-13T00:00:00Z");

describe("tideYDomain", () => {
  it("matches native: includes zero and rounds out to half feet", () => {
    expect(tideYDomain([{ timestamp: 0, heightFt: 0.1 }, { timestamp: 1, heightFt: 1.6 }])).toEqual([-0.5, 2.5]);
  });

  it("falls back to [-1, 1] with no points", () => {
    expect(tideYDomain([])).toEqual([-1, 1]);
  });
});

describe("buildTideChartXTicks", () => {
  it("labels 24 hours in the beach's zone, not the viewer's", () => {
    const ticks = buildTideChartXTicks(START, START + 24 * HOUR, HONOLULU);
    expect(ticks.map((t) => t.label)).toEqual(["2PM", "6PM", "10PM", "2AM", "6AM", "10AM", "2PM"]);
  });

  it("names days past 36 hours", () => {
    const ticks = buildTideChartXTicks(START, START + 72 * HOUR, HONOLULU);
    expect(ticks.map((t) => t.label)).toEqual(["THU", "FRI", "SAT", "SUN"]);
  });
});

describe("monotone curve", () => {
  const points = [
    { timestamp: 0, heightFt: 0.5 },
    { timestamp: 4 * HOUR, heightFt: 0.1 },
    { timestamp: 9 * HOUR, heightFt: 1.6 },
  ];

  it("passes through every point and never overshoots the extremes", () => {
    expect(tideHeightOnCurve(points, 4 * HOUR)).toBeCloseTo(0.1, 6);
    for (let t = 0; t <= 9 * HOUR; t += HOUR / 4) {
      const h = tideHeightOnCurve(points, t)!;
      expect(h).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(h).toBeLessThanOrEqual(1.6 + 1e-9);
    }
  });

  it("is null outside the points", () => {
    expect(tideHeightOnCurve(points, -1)).toBeNull();
  });

  it("builds a cubic path", () => {
    expect(buildMonotoneCurvePath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toMatch(/^M0,0 C /);
  });
});

describe("formatPanelTideHeight", () => {
  it("never prints -0.0", () => {
    expect(formatPanelTideHeight(-0.02)).toBe("0.0 ft");
    expect(formatPanelTideHeight(1.64)).toBe("1.6 ft");
  });
});
