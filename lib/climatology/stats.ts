import { MIN_STATION_MONTHS } from "./coverage";
import {
  SECTORS,
  type LocalHourObservation,
  type Sector,
  type WaterMonthStats,
  type WaveMonthStats,
  type WindBlockStats,
  type WindClass,
  type WindMonthStats,
} from "./types";

const M_TO_FT = 3.28084;
export const LIGHT_WIND_KT = 6;
const ONSHORE_HALF_WIDTH_DEG = 67.5;
export const WIND_BLOCKS = {
  dawn: [6, 7, 8],
  midday: [11, 12, 13],
  afternoon: [15, 16, 17],
} as const;

export const SMALL_DAY_FT = 2;
export const THREE_FOOT_DAY_FT = 3;
export const BIG_DAY_FT = 6;
export const BIG_DAY_MIN_HOURS = 3;
export const LONG_PERIOD_S = 10;
const DAYTIME_FIRST_HOUR = 6;
const DAYTIME_LAST_HOUR = 18;
const MIN_DAYTIME_HOURS = 10; // 70% of the 13 daytime hours
const MIN_MORNING_HOURS = 2;

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const share = (count: number, total: number): number => (total === 0 ? 0 : round2(count / total));

export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("percentile of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export function sectorOf(deg: number): Sector {
  const normalized = ((deg % 360) + 360) % 360;
  return SECTORS[Math.round(normalized / 45) % SECTORS.length];
}

export function angularDistance(a: number, b: number): number {
  const diff = (((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Wind direction is where it blows from; the shore normal points out to sea. */
export function classifyWind(
  dirDeg: number | null,
  speedKt: number | null,
  shoreNormalDeg: number,
): WindClass | null {
  if (speedKt === null) return null;
  if (speedKt < LIGHT_WIND_KT) return "light";
  if (dirDeg === null) return null;
  const fromNormal = angularDistance(dirDeg, shoreNormalDeg);
  if (fromNormal <= ONSHORE_HALF_WIDTH_DEG) return "onshore";
  if (fromNormal >= 180 - ONSHORE_HALF_WIDTH_DEG) return "offshore";
  return "cross";
}

function values(hours: LocalHourObservation[], pick: (o: LocalHourObservation) => number | null): number[] {
  return hours.flatMap((o) => {
    const value = pick(o);
    return value === null ? [] : [value];
  });
}

function groupByDay(hours: LocalHourObservation[]): LocalHourObservation[][] {
  const days = new Map<string, LocalHourObservation[]>();
  for (const hour of hours) {
    const key = `${hour.year}-${hour.month}-${hour.day}`;
    const list = days.get(key) ?? [];
    list.push(hour);
    days.set(key, list);
  }
  return [...days.values()];
}

const heightFt = (o: LocalHourObservation): number | null =>
  o.waveHeightM === null ? null : o.waveHeightM * M_TO_FT;

// The day's most common daytime swell direction; ties go to the earlier sector.
function dominantSector(hours: LocalHourObservation[]): Sector | null {
  const counts = new Map<Sector, number>();
  for (const o of hours) {
    if (o.meanWaveDirDeg === null) continue;
    const sector = sectorOf(o.meanWaveDirDeg);
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }
  let best: Sector | null = null;
  for (const sector of SECTORS) {
    const count = counts.get(sector) ?? 0;
    if (count > 0 && (best === null || count > (counts.get(best) ?? 0))) best = sector;
  }
  return best;
}

export function waveMonthStats(stationMonths: LocalHourObservation[][]): WaveMonthStats | null {
  if (stationMonths.length < MIN_STATION_MONTHS) return null;
  const hours = stationMonths.flat();
  const heights = values(hours, heightFt);
  if (heights.length === 0) return null;

  let observedDays = 0;
  let smallDays = 0;
  let bigDays = 0;
  const threeFootDays = Object.fromEntries(SECTORS.map((sector) => [sector, 0])) as Record<Sector, number>;
  for (const month of stationMonths) {
    for (const day of groupByDay(month)) {
      const daytimeHours = day.filter((o) => o.hour >= DAYTIME_FIRST_HOUR && o.hour <= DAYTIME_LAST_HOUR);
      const daytime = values(daytimeHours, heightFt);
      if (daytime.length < MIN_DAYTIME_HOURS) continue;
      observedDays += 1;
      const dayMedianFt = percentile(daytime, 50);
      if (dayMedianFt < SMALL_DAY_FT) smallDays += 1;
      if (dayMedianFt >= THREE_FOOT_DAY_FT) {
        const sector = dominantSector(daytimeHours);
        if (sector) threeFootDays[sector] += 1;
      }
      if (values(day, heightFt).filter((ft) => ft >= BIG_DAY_FT).length >= BIG_DAY_MIN_HOURS) bigDays += 1;
    }
  }

  const periods = values(hours, (o) => o.dominantPeriodS);
  const directions = values(hours, (o) => o.meanWaveDirDeg);
  const directionMix = Object.fromEntries(
    SECTORS.map((sector) => [sector, share(directions.filter((d) => sectorOf(d) === sector).length, directions.length)]),
  ) as Record<Sector, number>;

  return {
    hsFt: {
      median: round1(percentile(heights, 50)),
      p25: round1(percentile(heights, 25)),
      p75: round1(percentile(heights, 75)),
      p90: round1(percentile(heights, 90)),
    },
    smallDayShare: share(smallDays, observedDays),
    bigDayShare: share(bigDays, observedDays),
    periodMix: {
      under8: share(periods.filter((p) => p < 8).length, periods.length),
      from8to10: share(periods.filter((p) => p >= 8 && p < LONG_PERIOD_S).length, periods.length),
      atLeast10: share(periods.filter((p) => p >= LONG_PERIOD_S).length, periods.length),
    },
    directionMix,
    threeFootDaysBySector: Object.fromEntries(
      SECTORS.map((sector) => [sector, share(threeFootDays[sector], observedDays)]),
    ) as Record<Sector, number>,
    yearlyMedianFt: stationMonths.map((month) => ({
      year: month[0].year,
      medianFt: round1(percentile(values(month, heightFt), 50)),
    })),
    observedDays,
    validHours: heights.length,
    stationMonths: stationMonths.length,
  };
}

export function waterMonthStats(stationMonths: LocalHourObservation[][]): WaterMonthStats | null {
  if (stationMonths.length < MIN_STATION_MONTHS) return null;
  const temps = values(stationMonths.flat(), (o) => (o.waterTempC === null ? null : (o.waterTempC * 9) / 5 + 32));
  if (temps.length === 0) return null;
  return {
    medianF: Math.round(percentile(temps, 50)),
    p10F: Math.round(percentile(temps, 10)),
    p90F: Math.round(percentile(temps, 90)),
    validHours: temps.length,
  };
}

function blockStats(hours: LocalHourObservation[], blockHours: readonly number[], shoreNormalDeg: number): WindBlockStats {
  const inBlock = hours.filter((o) => blockHours.includes(o.hour));
  const classes = inBlock.flatMap((o) => {
    const windClass = classifyWind(o.windDirDeg, o.windSpeedKt, shoreNormalDeg);
    return windClass === null ? [] : [windClass];
  });
  const speeds = values(inBlock, (o) => o.windSpeedKt);
  const count = (target: WindClass) => classes.filter((c) => c === target).length;
  return {
    offshore: share(count("offshore"), classes.length),
    cross: share(count("cross"), classes.length),
    onshore: share(count("onshore"), classes.length),
    light: share(count("light"), classes.length),
    medianKt: speeds.length === 0 ? 0 : Math.round(percentile(speeds, 50)),
    hours: classes.length,
  };
}

// A morning is clean when its mean wind is light, or its speed-weighted mean
// direction is offshore.
function isCleanMorning(morning: LocalHourObservation[], shoreNormalDeg: number): boolean | null {
  const readings = morning.filter((o) => o.windSpeedKt !== null);
  if (readings.length < MIN_MORNING_HOURS) return null;
  const meanSpeed = readings.reduce((sum, o) => sum + (o.windSpeedKt ?? 0), 0) / readings.length;
  if (meanSpeed < LIGHT_WIND_KT) return true;

  const directional = readings.filter((o) => o.windDirDeg !== null);
  if (directional.length === 0) return null;
  let east = 0;
  let north = 0;
  for (const o of directional) {
    const radians = ((o.windDirDeg ?? 0) * Math.PI) / 180;
    east += (o.windSpeedKt ?? 0) * Math.sin(radians);
    north += (o.windSpeedKt ?? 0) * Math.cos(radians);
  }
  const meanDir = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
  return classifyWind(meanDir, meanSpeed, shoreNormalDeg) === "offshore";
}

export function windMonthStats(
  stationMonths: LocalHourObservation[][],
  shoreNormalDeg: number,
): WindMonthStats | null {
  if (stationMonths.length < MIN_STATION_MONTHS) return null;
  const hours = stationMonths.flat();

  let observedMornings = 0;
  let cleanMornings = 0;
  for (const month of stationMonths) {
    for (const day of groupByDay(month)) {
      const clean = isCleanMorning(
        day.filter((o) => (WIND_BLOCKS.dawn as readonly number[]).includes(o.hour)),
        shoreNormalDeg,
      );
      if (clean === null) continue;
      observedMornings += 1;
      if (clean) cleanMornings += 1;
    }
  }

  return {
    dawn: blockStats(hours, WIND_BLOCKS.dawn, shoreNormalDeg),
    midday: blockStats(hours, WIND_BLOCKS.midday, shoreNormalDeg),
    afternoon: blockStats(hours, WIND_BLOCKS.afternoon, shoreNormalDeg),
    cleanMorningShare: share(cleanMornings, observedMornings),
    observedMornings,
  };
}
