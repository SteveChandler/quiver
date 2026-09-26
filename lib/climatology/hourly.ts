import type { AsosRecord } from "./parse-iem-asos";
import type { NdbcRecord } from "./parse-ndbc";
import type { HourlyObservation, LocalHourObservation } from "./types";

const HOUR_MS = 3_600_000;
const KNOTS_PER_M_PER_S = 1.94384;

type ObservationField = Exclude<keyof HourlyObservation, "hourUtcMs">;
type FieldValues = Partial<Record<ObservationField, number | null>>;

function emptyHour(hourUtcMs: number): HourlyObservation {
  return {
    hourUtcMs,
    waveHeightM: null,
    dominantPeriodS: null,
    meanWaveDirDeg: null,
    waterTempC: null,
    windDirDeg: null,
    windSpeedKt: null,
  };
}

// Newer NDBC files report every 30 minutes and often leave one of the two
// readings empty, so each field keeps the first valid value in its hour.
function collapse(records: Array<{ timeUtcMs: number; values: FieldValues }>): HourlyObservation[] {
  const byHour = new Map<number, HourlyObservation>();
  const ordered = [...records].sort((a, b) => a.timeUtcMs - b.timeUtcMs);
  for (const record of ordered) {
    const hourUtcMs = Math.floor(record.timeUtcMs / HOUR_MS) * HOUR_MS;
    const hour = byHour.get(hourUtcMs) ?? emptyHour(hourUtcMs);
    for (const [field, value] of Object.entries(record.values) as Array<[ObservationField, number | null | undefined]>) {
      if (hour[field] === null && value !== null && value !== undefined) {
        hour[field] = value;
      }
    }
    byHour.set(hourUtcMs, hour);
  }
  return [...byHour.values()].sort((a, b) => a.hourUtcMs - b.hourUtcMs);
}

export function hourlyFromNdbc(records: NdbcRecord[]): HourlyObservation[] {
  return collapse(
    records.map((record) => ({
      timeUtcMs: record.timeUtcMs,
      values: {
        waveHeightM: record.waveHeightM,
        dominantPeriodS: record.dominantPeriodS,
        meanWaveDirDeg: record.meanWaveDirDeg,
        waterTempC: record.waterTempC,
        windDirDeg: record.windDirDeg,
        windSpeedKt: record.windSpeedMs === null ? null : record.windSpeedMs * KNOTS_PER_M_PER_S,
      },
    })),
  );
}

export function hourlyFromAsos(records: AsosRecord[]): HourlyObservation[] {
  return collapse(
    records.map((record) => ({
      timeUtcMs: record.timeUtcMs,
      values: { windDirDeg: record.windDirDeg, windSpeedKt: record.windSpeedKt },
    })),
  );
}

export function localize(hours: HourlyObservation[], timeZone: string): LocalHourObservation[] {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  });
  return hours.map((obs) => {
    const parts = formatter.formatToParts(new Date(obs.hourUtcMs));
    const part = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((candidate) => candidate.type === type)?.value);
    return { ...obs, year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
  });
}
