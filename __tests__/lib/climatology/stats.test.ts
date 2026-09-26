import {
  angularDistance,
  classifyWind,
  percentile,
  sectorOf,
  waterMonthStats,
  waveMonthStats,
  windMonthStats,
} from "@/lib/climatology/stats";
import { localMonth } from "./__fixtures__/observations";

const YEARS = [2020, 2021, 2022, 2023, 2024];

describe("percentile (nearest rank)", () => {
  it.each([
    [25, 1],
    [50, 2],
    [75, 3],
    [90, 4],
  ])("p%s of [4,1,3,2] is %s", (p, expected) => {
    expect(percentile([4, 1, 3, 2], p)).toBe(expected);
  });
});

describe("sectorOf", () => {
  it.each([
    [0, "N"],
    [22.4, "N"],
    [22.5, "NE"],
    [315, "NW"],
    [337.5, "N"],
    [359, "N"],
    [-45, "NW"],
  ])("%s° is %s", (deg, sector) => {
    expect(sectorOf(deg)).toBe(sector);
  });
});

describe("classifyWind", () => {
  it("classifies relative to Cocoa's 87° shore normal", () => {
    expect(classifyWind(267, 10, 87)).toBe("offshore");
    expect(classifyWind(87, 10, 87)).toBe("onshore");
    expect(classifyWind(177, 10, 87)).toBe("cross");
    expect(classifyWind(154.5, 10, 87)).toBe("onshore");
    expect(classifyWind(0, 3, 87)).toBe("light");
  });

  it("wraps around north for Newport's 217° normal", () => {
    expect(angularDistance(350, 217)).toBe(133);
    expect(angularDistance(10, 217)).toBe(153);
    expect(classifyWind(350, 12, 217)).toBe("offshore");
    expect(classifyWind(10, 12, 217)).toBe("offshore");
    expect(classifyWind(300, 12, 217)).toBe("cross");
  });

  it("returns null when a needed value is missing", () => {
    expect(classifyWind(null, 10, 87)).toBeNull();
    expect(classifyWind(100, null, 87)).toBeNull();
  });
});

describe("waveMonthStats", () => {
  // Days 1-10 are small (0.3 m), days 11-31 are 1.0 m, days 11-13 have four
  // 2.0 m hours before dawn, and days 21-31 carry 12 s swell.
  const januaries = YEARS.map((year) =>
    localMonth(year, 1, (day, hour) => ({
      waveHeightM: day <= 10 ? 0.3 : day <= 13 && hour < 4 ? 2.0 : 1.0,
      dominantPeriodS: day >= 21 ? 12 : 6,
      meanWaveDirDeg: 270,
    })),
  );

  it("summarises height, small and big days, period and direction", () => {
    const stats = waveMonthStats(januaries);

    expect(stats).toEqual({
      hsFt: { median: 3.3, p25: 1, p75: 3.3, p90: 3.3 },
      smallDayShare: 0.32,
      bigDayShare: 0.1,
      periodMix: { under8: 0.65, from8to10: 0, atLeast10: 0.35 },
      directionMix: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 1, NW: 0 },
      threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0.68, NW: 0 },
      yearlyMedianFt: YEARS.map((year) => ({ year, medianFt: 3.3 })),
      observedDays: 155,
      validHours: 3720,
      stationMonths: 5,
    });
  });

  it("needs five qualifying station-months", () => {
    expect(waveMonthStats(januaries.slice(0, 4))).toBeNull();
  });

  it("skips a day with fewer than 10 daytime readings", () => {
    const withGap = YEARS.map((year) =>
      localMonth(year, 1, (day, hour) => ({
        waveHeightM: day === 1 && hour >= 6 && hour <= 9 ? null : 1.0,
      })),
    );
    expect(waveMonthStats(withGap)?.observedDays).toBe(150);
  });

  it("groups 3 ft+ days by the day's most common swell direction", () => {
    // Days 1-10: 1.2 m (3.9 ft) from the south all day.
    // Days 11-20: 1.2 m; daytime hours 6-13 from the west (8 h), 14-18 from the south (5 h).
    // Days 21-31: 0.5 m (1.6 ft), below 3 ft.
    const months = YEARS.map((year) =>
      localMonth(year, 1, (day, hour) => ({
        waveHeightM: day <= 20 ? 1.2 : 0.5,
        meanWaveDirDeg: day > 10 && day <= 20 && hour >= 6 && hour <= 13 ? 270 : 180,
      })),
    );

    expect(waveMonthStats(months)?.threeFootDaysBySector).toEqual({
      N: 0, NE: 0, E: 0, SE: 0, S: 0.32, SW: 0, W: 0.32, NW: 0,
    });
  });
});

describe("waterMonthStats", () => {
  it("converts to °F", () => {
    const months = YEARS.map((year) => localMonth(year, 7, () => ({ waterTempC: 20 })));
    expect(waterMonthStats(months)).toEqual({ medianF: 68, p10F: 68, p90F: 68, validHours: 3720 });
  });
});

describe("windMonthStats", () => {
  const pattern = (dawn: number, speed: number) =>
    YEARS.map((year) =>
      localMonth(year, 7, (_day, hour) => {
        if (hour >= 6 && hour <= 8) return { windDirDeg: dawn, windSpeedKt: speed };
        if (hour >= 11 && hour <= 13) return { windDirDeg: 177, windSpeedKt: 10 };
        if (hour >= 15 && hour <= 17) return { windDirDeg: 87, windSpeedKt: 12 };
        return { windDirDeg: 0, windSpeedKt: 3 };
      }),
    );

  it("splits dawn, midday and afternoon and counts clean mornings", () => {
    const stats = windMonthStats(pattern(267, 10), 87);

    expect(stats?.dawn).toEqual({ offshore: 1, cross: 0, onshore: 0, light: 0, medianKt: 10, hours: 465 });
    expect(stats?.midday.cross).toBe(1);
    expect(stats?.afternoon.onshore).toBe(1);
    expect(stats?.cleanMorningShare).toBe(1);
    expect(stats?.observedMornings).toBe(155);
  });

  it("does not count an onshore morning as clean", () => {
    expect(windMonthStats(pattern(87, 8), 87)?.cleanMorningShare).toBe(0);
  });
});
