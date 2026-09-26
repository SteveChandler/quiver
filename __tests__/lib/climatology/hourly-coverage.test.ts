import {
  daysInMonth,
  groupByStationMonth,
  overallCoverage,
  selectStationMonths,
  stationMonthKey,
} from "@/lib/climatology/coverage";
import { hourlyFromAsos, hourlyFromNdbc, localize } from "@/lib/climatology/hourly";
import type { NdbcRecord } from "@/lib/climatology/parse-ndbc";
import { localMonth } from "./fixtures/observations";

const ndbc = (minute: number, fields: Partial<NdbcRecord>): NdbcRecord => ({
  timeUtcMs: Date.UTC(2024, 0, 1, 0, minute),
  waveHeightM: null,
  dominantPeriodS: null,
  meanWaveDirDeg: null,
  waterTempC: null,
  windDirDeg: null,
  windSpeedMs: null,
  ...fields,
});

describe("hourlyFromNdbc", () => {
  it("collapses sub-hourly rows, keeping the first valid value per field", () => {
    const hours = hourlyFromNdbc([
      ndbc(56, { waveHeightM: 0.23, dominantPeriodS: 11 }),
      ndbc(26, { waveHeightM: 0.22 }),
    ]);

    expect(hours).toHaveLength(1);
    expect(hours[0]).toMatchObject({
      hourUtcMs: Date.UTC(2024, 0, 1, 0),
      waveHeightM: 0.22,
      dominantPeriodS: 11,
    });
  });

  it("converts NDBC wind from m/s to knots", () => {
    const [hour] = hourlyFromNdbc([ndbc(0, { windSpeedMs: 10, windDirDeg: 270 })]);
    expect(hour.windSpeedKt).toBeCloseTo(19.4384, 4);
    expect(hour.windDirDeg).toBe(270);
  });
});

describe("hourlyFromAsos", () => {
  it("floors :53 observations to their hour", () => {
    const [hour] = hourlyFromAsos([
      { timeUtcMs: Date.UTC(2024, 6, 1, 0, 53), windDirDeg: 190, windSpeedKt: 4 },
    ]);
    expect(hour).toMatchObject({ hourUtcMs: Date.UTC(2024, 6, 1, 0), windDirDeg: 190, windSpeedKt: 4 });
  });
});

describe("localize", () => {
  const base = {
    waveHeightM: null,
    dominantPeriodS: null,
    meanWaveDirDeg: null,
    waterTempC: null,
    windDirDeg: null,
    windSpeedKt: null,
  };
  const at = (utcMs: number, zone: string) => localize([{ hourUtcMs: utcMs, ...base }], zone)[0];

  it("puts early-January UTC hours in the previous local year for Los Angeles", () => {
    expect(at(Date.UTC(2025, 0, 1, 3), "America/Los_Angeles")).toMatchObject({
      year: 2024,
      month: 12,
      day: 31,
      hour: 19,
    });
  });

  it("follows the March DST jump", () => {
    expect(at(Date.UTC(2025, 2, 9, 9), "America/Los_Angeles").hour).toBe(1);
    expect(at(Date.UTC(2025, 2, 9, 10), "America/Los_Angeles").hour).toBe(3);
  });

  it("reports midnight as hour 0, not 24", () => {
    expect(at(Date.UTC(2025, 0, 1, 5), "America/New_York")).toMatchObject({ day: 1, hour: 0 });
  });

  it("has no DST in Honolulu", () => {
    expect(at(Date.UTC(2025, 6, 1, 0), "Pacific/Honolulu")).toMatchObject({ month: 6, day: 30, hour: 14 });
  });
});

describe("coverage rules", () => {
  it("counts leap-year February", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(stationMonthKey(2010, 9)).toBe("2010-09");
  });

  it("keeps a station-month at 70% coverage and drops it just below", () => {
    // 29 days x 24 h = 696 hours; 70% is 487.2 hours.
    const withValid = (validHours: number) =>
      localMonth(2024, 2, (day, hour) => ({
        waveHeightM: (day - 1) * 24 + hour < validHours ? 1 : null,
      }));
    const pick = (o: { waveHeightM: number | null }) => o.waveHeightM;

    const passing = selectStationMonths(groupByStationMonth(withValid(488), [2024, 2024]), 2, [2024, 2024], pick);
    expect(passing.qualifying).toHaveLength(1);
    expect(passing.excluded).toEqual([]);

    const failing = selectStationMonths(groupByStationMonth(withValid(487), [2024, 2024]), 2, [2024, 2024], pick);
    expect(failing.qualifying).toHaveLength(0);
    expect(failing.excluded).toEqual(["2024-02"]);
  });

  it("lists a missing year as an excluded station-month", () => {
    const groups = groupByStationMonth(localMonth(2023, 2, () => ({ waveHeightM: 1 })), [2023, 2024]);
    const result = selectStationMonths(groups, 2, [2023, 2024], (o) => o.waveHeightM);
    expect(result.qualifying).toHaveLength(1);
    expect(result.excluded).toEqual(["2024-02"]);
  });

  it("measures overall coverage against every hour in the year range", () => {
    const obs = localMonth(2024, 1, () => ({ waveHeightM: 1 }));
    expect(overallCoverage(obs, [2024, 2024], (o) => o.waveHeightM)).toBeCloseTo(744 / 8784, 6);
  });
});
