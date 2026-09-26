import { computeBuoyScore, derivePeak, scoreMonth } from "@/lib/climatology/score";

describe("computeBuoyScore (buoy-v1)", () => {
  // waterTempComfortScore(70) = round(70 + 5/13 * 30) = 82
  it("weights surf days, groundswell, clean mornings and water", () => {
    // 100 x (0.45*0.8 + 0.25*0.24 + 0.20*0.5 + 0.10*0.82) = 60.2
    expect(
      computeBuoyScore({ surfDayShare: 0.8, groundswellShare: 0.24, cleanMorningShare: 0.5, waterMedianF: 70 }),
    ).toBe(60);
  });

  it("rescales the other three parts when a city has no wind record", () => {
    // 100 x (0.36 + 0.06 + 0.082) / 0.8 = 62.75
    expect(
      computeBuoyScore({ surfDayShare: 0.8, groundswellShare: 0.24, cleanMorningShare: null, waterMedianF: 70 }),
    ).toBe(63);
  });
});

describe("scoreMonth", () => {
  const waves = {
    hsFt: { median: 3, p25: 2, p75: 4, p90: 5 },
    smallDayShare: 0.2,
    bigDayShare: 0.05,
    periodMix: { under8: 0.5, from8to10: 0.26, atLeast10: 0.24 },
    directionMix: { N: 0, NE: 0, E: 1, SE: 0, S: 0, SW: 0, W: 0, NW: 0 },
    threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0, NW: 0 },
    yearlyMedianFt: [],
    observedDays: 150,
    validHours: 3600,
    stationMonths: 5,
  };
  const water = { medianF: 70, p10F: 68, p90F: 72, validHours: 3600 };
  const wind = {
    dawn: { offshore: 0.5, cross: 0, onshore: 0, light: 0.5, medianKt: 5, hours: 450 },
    midday: { offshore: 0, cross: 1, onshore: 0, light: 0, medianKt: 10, hours: 450 },
    afternoon: { offshore: 0, cross: 0, onshore: 1, light: 0, medianKt: 12, hours: 450 },
    cleanMorningShare: 0.5,
    observedMornings: 150,
  };

  it("uses 1 - smallDayShare as the surf-day share", () => {
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water, wind }, true)).toBe(60);
  });

  it("returns null when waves or water are missing", () => {
    expect(scoreMonth({ month: 1, waves: null, comparisonWaves: null, water, wind }, true)).toBeNull();
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water: null, wind }, true)).toBeNull();
  });

  it("returns null when a wind city is missing that month's wind", () => {
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water, wind: null }, true)).toBeNull();
  });

  it("ignores wind for a city without a wind source", () => {
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water, wind }, false)).toBe(63);
  });
});

describe("derivePeak", () => {
  const scores = [40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50];
  const months = scores.map((score, index) => ({ month: index + 1, score }));

  it("picks the top month and every month within 10 points", () => {
    expect(derivePeak(months)).toEqual({ peakMonth: 10, peakBand: [9, 10, 11] });
  });

  it("breaks ties toward the earlier month and skips nulls", () => {
    expect(
      derivePeak([
        { month: 1, score: null },
        { month: 2, score: 70 },
        { month: 3, score: 70 },
      ]),
    ).toEqual({ peakMonth: 2, peakBand: [2, 3] });
  });

  it("returns no peak when nothing scored", () => {
    expect(derivePeak([{ month: 1, score: null }])).toEqual({ peakMonth: null, peakBand: [] });
  });
});
