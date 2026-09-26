import type { HourlyObservation, LocalHourObservation } from "@/lib/climatology/types";

const EMPTY_FIELDS = {
  waveHeightM: null,
  dominantPeriodS: null,
  meanWaveDirDeg: null,
  waterTempC: null,
  windDirDeg: null,
  windSpeedKt: null,
} as const;

type Fields = Partial<Omit<HourlyObservation, "hourUtcMs">>;

/** Every local hour of one month, with fields chosen per day and hour. */
export function localMonth(
  year: number,
  month: number,
  fields: (day: number, hour: number) => Fields,
): LocalHourObservation[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const hours: LocalHourObservation[] = [];
  for (let day = 1; day <= days; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      hours.push({
        hourUtcMs: Date.UTC(year, month - 1, day, hour),
        ...EMPTY_FIELDS,
        ...fields(day, hour),
        year,
        month,
        day,
        hour,
      });
    }
  }
  return hours;
}
