import type { LocalHourObservation } from "./types";

const STATION_MONTH_COVERAGE = 0.7;
export const MIN_STATION_MONTHS = 5;
export const GATE_COVERAGE = 0.9;

export type ValuePicker = (obs: LocalHourObservation) => number | null;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function stationMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function groupByStationMonth(
  obs: LocalHourObservation[],
  years: readonly [number, number],
): Map<string, LocalHourObservation[]> {
  const groups = new Map<string, LocalHourObservation[]>();
  for (const o of obs) {
    if (o.year < years[0] || o.year > years[1]) continue;
    const key = stationMonthKey(o.year, o.month);
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }
  return groups;
}

export function selectStationMonths(
  groups: Map<string, LocalHourObservation[]>,
  month: number,
  years: readonly [number, number],
  pick: ValuePicker,
): { qualifying: LocalHourObservation[][]; excluded: string[] } {
  const qualifying: LocalHourObservation[][] = [];
  const excluded: string[] = [];
  for (let year = years[0]; year <= years[1]; year += 1) {
    const key = stationMonthKey(year, month);
    const hours = groups.get(key) ?? [];
    const valid = hours.filter((o) => pick(o) !== null).length;
    if (valid / (daysInMonth(year, month) * 24) >= STATION_MONTH_COVERAGE) {
      qualifying.push(hours);
    } else {
      excluded.push(key);
    }
  }
  return { qualifying, excluded };
}

export function overallCoverage(
  obs: LocalHourObservation[],
  years: readonly [number, number],
  pick: ValuePicker,
): number {
  let possible = 0;
  for (let year = years[0]; year <= years[1]; year += 1) {
    for (let month = 1; month <= 12; month += 1) possible += daysInMonth(year, month) * 24;
  }
  const valid = obs.filter((o) => o.year >= years[0] && o.year <= years[1] && pick(o) !== null).length;
  return valid / possible;
}
