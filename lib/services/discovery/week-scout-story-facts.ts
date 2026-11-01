import { parseSwellDirectionToDegrees, parseWaveHeightRangeFt } from "@/lib/alerts/forecast-parsers";
import { exposureFactor, exposureLabel, swellWindowForBeach } from "@/lib/alerts/swell-events/exposure";
import type { RatingRow, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { CLOSING_OUT_FACE_FT, ratingWindow } from "@/lib/alerts/swell-events/regional-rating";
import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { resolveWindOrientation, type WindOrientationSource } from "@/lib/domains/shared/wind-orientation";
import { parseWindSpeedOrNull } from "@/lib/utils/number-parsing";
import { getLocalDateStr, getLocalHour } from "./window-selector/time-slot-utils";
import type { RegionalSwellEvent } from "./week-scout-story-candidates";

export type SizeWord = "knee" | "waist" | "chest" | "shoulder" | "head" | "overhead" | "double overhead";
export interface FaceRange { min: number; max: number }
export interface WindHour { hour: number; relation: "offshore" | "onshore" | "cross" | null; mph: number | null }
export interface BreakerFacts { character: "pitching" | "crumbly" | null; feel: "punchy" | "soft" | null; closingOut: boolean }
export interface CandidateFacts {
  faceFt: FaceRange | null;
  sizes: SizeWord[];
  standoutFt?: FaceRange;
  standoutSizes?: SizeWord[];
  windHours?: WindHour[];
  breaker: BreakerFacts | null;
}

export const SIZE_BUCKETS: ReadonlyArray<readonly [SizeWord, number, number]> = [
  ["knee", 0, 2], ["waist", 2, 3], ["chest", 3, 5], ["shoulder", 4, 5],
  ["head", 5, 7], ["overhead", 7, 12], ["double overhead", 12, 100],
];
export const LIGHT_WIND_MPH = 8;

export function faceRangeFt(waveHeights: ReadonlyArray<string | null>): FaceRange | null {
  const ranges = waveHeights.flatMap((height) => parseWaveHeightRangeFt(height) ?? []);
  if (ranges.length === 0) return null;
  return { min: Math.round(Math.min(...ranges.map((range) => range.min))), max: Math.round(Math.max(...ranges.map((range) => range.max))) };
}

export function sizeWordsFor(range: FaceRange | null): SizeWord[] {
  if (!range) return [];
  return SIZE_BUCKETS.filter(([, lo, hi]) => range.min === range.max
    ? lo <= range.min && hi > range.min
    : lo < range.max && hi > range.min).map(([word]) => word);
}

export function breakerCharacter(kind: "swell" | "storm", periodS: number | null): BreakerFacts["character"] {
  if (kind === "storm") return "crumbly";
  if (periodS === null || !Number.isFinite(periodS)) return null;
  return periodS >= 13 ? "pitching" : periodS < 10 ? "crumbly" : null;
}

export function beachFeel(character: BreakerFacts["character"], punchiness: number | null): BreakerFacts["feel"] {
  if (character === null || punchiness === null || !Number.isFinite(punchiness)) return null;
  if (character === "pitching" && punchiness >= 0.2) return "punchy";
  return character === "crumbly" || punchiness <= -0.2 ? "soft" : null;
}

export function windHoursFor(
  rows: ReadonlyArray<{ forecast_at: string; wind_direction: string | null; wind_speed: string | null }>,
  beach: WindOrientationSource,
  timezone: string,
): WindHour[] {
  const { offshoreDeg, toleranceDeg } = resolveWindOrientation(beach);
  return [...rows].sort((left, right) => Date.parse(left.forecast_at) - Date.parse(right.forecast_at)).flatMap((row) => {
    const hour = getLocalHour(new Date(row.forecast_at), timezone);
    if (hour === null) return [];
    const direction = parseSwellDirectionToDegrees(row.wind_direction);
    const relation = direction === null || offshoreDeg === null ? null
      : angleDifference(direction, offshoreDeg) <= toleranceDeg ? "offshore"
        : angleDifference(direction, offshoreDeg + 180) <= toleranceDeg ? "onshore" : "cross";
    return [{ hour, relation, mph: parseWindSpeedOrNull(row.wind_speed) }];
  });
}

const rowsByBuild = new WeakMap<RegionBuild["rowsByBeach"], Map<string, Map<string, RatingRow[]>>>();

/** Daylight rows indexed once per beach and local date for this region build. */
export function beachRowsByLocalDate(build: RegionBuild, beachId: string): ReadonlyMap<string, readonly RatingRow[]> {
  let byBeach = rowsByBuild.get(build.rowsByBeach);
  if (!byBeach) {
    byBeach = new Map();
    rowsByBuild.set(build.rowsByBeach, byBeach);
  }
  const cached = byBeach.get(beachId);
  if (cached) return cached;
  const days = new Map<string, RatingRow[]>();
  for (const row of build.rowsByBeach[beachId] ?? []) {
    const at = new Date(row.forecast_at);
    if (!Number.isFinite(at.getTime())) continue;
    const date = getLocalDateStr(at, build.timezone);
    const rows = days.get(date);
    if (rows) rows.push(row);
    else days.set(date, [row]);
  }
  byBeach.set(beachId, days);
  return days;
}

function beachDayRows(build: RegionBuild, event: RegionalSwellEvent, beachId: string, localDate: string): RatingRow[] {
  const { startMs, endMs } = ratingWindow(event);
  return [...(beachRowsByLocalDate(build, beachId).get(localDate) ?? [])]
    .filter((row) => Date.parse(row.forecast_at) >= startMs && Date.parse(row.forecast_at) < endMs);
}

function exposure(build: RegionBuild, event: RegionalSwellEvent, beachId: string): "open" | "partial" | "shadowed" | null {
  const beach = build.beaches.find((item) => item.id === beachId);
  const factor = beach ? exposureFactor(event.directionDeg, swellWindowForBeach(beach)) : null;
  return factor === null ? null : exposureLabel(factor);
}

export function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function eventFactsFromBuild(build: RegionBuild, event: RegionalSwellEvent): CandidateFacts | null {
  const peakDate = getLocalDateStr(new Date(event.peakAt), build.timezone);
  const peaks = build.beaches.flatMap((beach) => {
    const reached = exposure(build, event, beach.id);
    if (reached !== "open" && reached !== "partial") return [];
    const ranges = beachDayRows(build, event, beach.id, peakDate)
      .flatMap((row) => parseWaveHeightRangeFt(row.wave_height) ?? []);
    return ranges.length ? [ranges.reduce((peak, range) => range.max > peak.max ? range : peak)] : [];
  });
  if (peaks.length < 3) return null;
  const faceFt = { min: Math.round(median(peaks.map((peak) => peak.min))), max: Math.round(median(peaks.map((peak) => peak.max))) };
  const standouts = [...peaks].sort((a, b) => b.max - a.max).slice(0, 2);
  const standoutFt = { min: Math.round(Math.min(...standouts.map((peak) => peak.min))), max: Math.round(Math.max(...standouts.map((peak) => peak.max))) };
  return { faceFt, sizes: sizeWordsFor(faceFt),
    ...(standoutFt.max > faceFt.max ? { standoutFt, standoutSizes: sizeWordsFor(standoutFt) } : {}),
    breaker: { character: breakerCharacter(event.kind, event.periodS), feel: null,
      closingOut: Math.max(faceFt.max, standoutFt.max) >= CLOSING_OUT_FACE_FT } };
}

export function beachDayFactsFromBuild(build: RegionBuild, event: RegionalSwellEvent, beachId: string, localDate: string): CandidateFacts | null {
  const beach = build.beaches.find((item) => item.id === beachId);
  if (!beach) return null;
  const rows = beachDayRows(build, event, beachId, localDate);
  if (rows.length === 0) return null;
  const faceFt = faceRangeFt(rows.map((row) => row.wave_height));
  const character = breakerCharacter(event.kind, event.periodS);
  return { faceFt, sizes: sizeWordsFor(faceFt), windHours: windHoursFor(rows, beach, build.timezone),
    breaker: { character, feel: beachFeel(character, beach.punchiness),
      closingOut: exposure(build, event, beachId) === "open" && faceFt !== null && faceFt.max >= CLOSING_OUT_FACE_FT } };
}
