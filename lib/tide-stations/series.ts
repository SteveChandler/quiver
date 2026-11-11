import type { StoredTideConstituent } from "./types";

export interface TideHeightPoint {
  ts: string;
  heightM: number;
}

export interface TideExtremePoint {
  ts: string;
  type: "high" | "low";
  heightM: number;
}

export type TideType = "semidiurnal" | "mixed-semidiurnal" | "mixed-diurnal" | "diurnal";

export interface TideTypeResult {
  type: TideType;
  /** Form factor (K1+O1)/(M2+S2) when constants are known. */
  formFactor: number | null;
  basis: "constituents" | "predicted-extremes";
}

const TIDAL_DAY_MS = 24.8412 * 3_600_000;
const M_TO_FT = 3.28084;

export const metresToFeet = (m: number): number => m * M_TO_FT;

/** Courtier form factor bands, the standard tide-type split. */
export function classifyFormFactor(formFactor: number): TideType {
  if (formFactor < 0.25) return "semidiurnal";
  if (formFactor < 1.5) return "mixed-semidiurnal";
  if (formFactor < 3) return "mixed-diurnal";
  return "diurnal";
}

export function classifyTideTypeFromConstituents(constituents: StoredTideConstituent[]): TideTypeResult | null {
  const amp = (name: string): number =>
    constituents.find((c) => c.name.toUpperCase() === name)?.amplitudeM ?? 0;
  const semidiurnal = amp("M2") + amp("S2");
  const diurnal = amp("K1") + amp("O1");
  if (semidiurnal <= 0 && diurnal <= 0) return null;
  if (semidiurnal <= 0) return { type: "diurnal", formFactor: null, basis: "constituents" };
  const formFactor = Math.round((diurnal / semidiurnal) * 100) / 100;
  return { type: classifyFormFactor(formFactor), formFactor, basis: "constituents" };
}

/**
 * Tide type from a run of predicted highs and lows, for stations with no stored
 * constants (NOAA subordinate stations publish only offsets). One high per
 * tidal day is diurnal; two highs of clearly unequal height is mixed.
 */
export function classifyTideTypeFromExtremes(extremes: TideExtremePoint[]): TideTypeResult | null {
  const sorted = [...extremes].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const highs = sorted.filter((e) => e.type === "high");
  if (highs.length < 3 || sorted.length < 6) return null;

  const spanMs = Date.parse(sorted[sorted.length - 1].ts) - Date.parse(sorted[0].ts);
  const highsPerTidalDay = highs.length / (spanMs / TIDAL_DAY_MS);
  if (highsPerTidalDay < 1.25) return { type: "diurnal", formFactor: null, basis: "predicted-extremes" };

  const ranges: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].type !== sorted[i - 1].type) ranges.push(Math.abs(sorted[i].heightM - sorted[i - 1].heightM));
  }
  const meanRange = ranges.reduce((sum, r) => sum + r, 0) / Math.max(1, ranges.length);
  if (meanRange <= 0) return null;

  let inequality = 0;
  for (let i = 1; i < highs.length; i++) inequality += Math.abs(highs[i].heightM - highs[i - 1].heightM);
  const ratio = inequality / (highs.length - 1) / meanRange;
  if (highsPerTidalDay < 1.75) return { type: "mixed-diurnal", formFactor: null, basis: "predicted-extremes" };
  if (ratio > 0.2) return { type: "mixed-semidiurnal", formFactor: null, basis: "predicted-extremes" };
  return { type: "semidiurnal", formFactor: null, basis: "predicted-extremes" };
}

interface TideRangeSummary {
  meanRangeM: number;
  maxRangeM: number;
  minRangeM: number;
  highestM: number;
  lowestM: number;
}

/** Ranges between consecutive high/low pairs across the window. */
export function summarizeRange(extremes: TideExtremePoint[]): TideRangeSummary | null {
  const sorted = [...extremes].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const ranges: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].type !== sorted[i - 1].type) ranges.push(Math.abs(sorted[i].heightM - sorted[i - 1].heightM));
  }
  if (!ranges.length) return null;
  const heights = sorted.map((e) => e.heightM);
  return {
    meanRangeM: ranges.reduce((sum, r) => sum + r, 0) / ranges.length,
    maxRangeM: Math.max(...ranges),
    minRangeM: Math.min(...ranges),
    highestM: Math.max(...heights),
    lowestM: Math.min(...heights),
  };
}

interface TideStateNow {
  direction: "rising" | "falling";
  next: TideExtremePoint;
  previous: TideExtremePoint | null;
}

/** Rising or falling at `nowMs`, from the extremes either side of it. */
export function tideStateAt(extremes: TideExtremePoint[], nowMs: number): TideStateNow | null {
  const sorted = [...extremes].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const nextIndex = sorted.findIndex((e) => Date.parse(e.ts) > nowMs);
  if (nextIndex < 0) return null;
  const next = sorted[nextIndex];
  return {
    direction: next.type === "high" ? "rising" : "falling",
    next,
    previous: nextIndex > 0 ? sorted[nextIndex - 1] : null,
  };
}

/** Local calendar date (YYYY-MM-DD) of an instant in `timeZone`. */
export function localDateKey(ts: string | number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(ts)
  );
}

export interface TideDay {
  dateKey: string;
  extremes: TideExtremePoint[];
}

/** Group extremes into local days, starting at the local day of `fromMs`, for `days` days. */
export function groupExtremesByLocalDay(
  extremes: TideExtremePoint[],
  timeZone: string,
  fromMs: number,
  days: number
): TideDay[] {
  const startKey = localDateKey(fromMs, timeZone);
  const byDay = new Map<string, TideExtremePoint[]>();
  for (const extreme of [...extremes].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))) {
    const key = localDateKey(extreme.ts, timeZone);
    if (key < startKey) continue;
    const list = byDay.get(key) ?? [];
    list.push(extreme);
    byDay.set(key, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, days)
    .map(([dateKey, list]) => ({ dateKey, extremes: list }));
}
