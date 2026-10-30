import type { EnhancedForecastEntity } from "@/types/forecast";
import type { RegionBeachRating, RegionSwellConfidence, RegionSwellEvent } from "@/types/region-swell-events";
import { SKILL_WAVE_RANGES, type SkillLevel } from "@/lib/domains/user-preferences";
import { formatWindowLabel } from "@/lib/notifications/copy/daily-call-copy";
import {
  nativeScoreInputsFromForecast,
  scoreNativeConditionBreakdown,
  type NativeConditionScoreBreakdown,
} from "@/lib/scoring/native-condition-score";
import { getLocalDateStr, getLocalHour } from "@/lib/services/discovery/window-selector/time-slot-utils";
import { formatCompactWaveHeight } from "@/lib/surf-summary-display";
import { scoreLabel } from "@/lib/utils/score-color-utils";

import { SWELL_EVENT_THRESHOLDS, exposureFactor, exposureLabel, swellWindowForBeach } from "./exposure";
import type { InternalRegionEvent, RatingRow, RegionBeach, RegionBuild } from "./regional";

type Exposure = RegionBeachRating["exposure"];
type ScoreInputs = ReturnType<typeof nativeScoreInputsFromForecast>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_WORKING = 5;
const MAX_NOT_WORKING = 3;
const CLOSING_OUT_FACE_FT = 8;
// Early looks have no rating: an open beach is "likely" to work.
const LIKELY = "LIKELY";
const EARLY_LOOK = "EARLY LOOK";
/** Working labels, best first. EPIC only appears if the label is ever switched on. */
const WORKING_RANK: Readonly<Record<string, number>> = { EPIC: 0, GOOD: 1, FAIR: 2, [LIKELY]: 3 };
// Each component's ceiling in scoreNativeConditionBreakdown, so components compare as shares, not raw points.
const COMPONENT_MAX = { waveFit: 45, period: 20, wind: 25, tide: 10 } as const;

const BLOWN_OUT = "blown out";
const TOO_BIG = "too big for most";
const SHELTERED = "small, sheltered";
const CLOSING_OUT = "closing out";
const EXPOSURE_UNKNOWN = "exposure unknown";
const REASON_ORDER = [BLOWN_OUT, TOO_BIG, SHELTERED, CLOSING_OUT, EXPOSURE_UNKNOWN];

interface ScoredHour {
  row: RatingRow;
  inputs: ScoreInputs;
  breakdown: NativeConditionScoreBreakdown;
  label: string;
}

/** A beach's rating plus what orders it: the score, or the exposure factor for an early look. */
interface RankedRating extends RegionBeachRating {
  rank: number;
}

/** Lead days from the region's local today to the peak date: 0-4, 5-9, 10-14. */
export function confidenceFor(leadDays: number): RegionSwellConfidence {
  if (leadDays <= 4) return "on_the_way";
  if (leadDays <= 9) return "likely";
  return "early_look";
}

function isWorking(label: string): boolean {
  return WORKING_RANK[label] !== undefined;
}

function exposureOf(beach: RegionBeach, directionDeg: number | null): { label: Exposure; factor: number } {
  const factor = directionDeg === null ? null : exposureFactor(directionDeg, swellWindowForBeach(beach));
  return factor === null ? { label: null, factor: 0 } : { label: exposureLabel(factor), factor };
}

/** "3-4 ft", the face the app shows for that hour. */
function faceText(waveHeight: RatingRow["wave_height"]): string | null {
  return formatCompactWaveHeight(waveHeight)?.replace(/\s*ft$/i, " ft") ?? null;
}

/**
 * Why a rated beach isn't working, from its weakest score component and its exposure, in this
 * order: wind, size over the skill's range, unknown exposure, sheltered, big on an open beach.
 * Null when none fits.
 */
function notWorkingReason(hour: ScoredHour, exposure: Exposure, skill: SkillLevel): string | null {
  const { components } = hour.breakdown;
  const windKnown = hour.inputs.windSpeedMph !== null;
  const sizeShare = components.waveFit / COMPONENT_MAX.waveFit;
  const windShare = components.wind / COMPONENT_MAX.wind;
  // Unknown wind is reported at half marks; it says nothing about the wind, so it can't be weakest.
  const weakest = Math.min(
    sizeShare,
    components.period / COMPONENT_MAX.period,
    components.tide / COMPONENT_MAX.tide,
    windKnown ? windShare : Infinity,
  );
  const faceFt = hour.inputs.waveHeightFt;
  if (windKnown && windShare === weakest) return BLOWN_OUT;
  if (sizeShare === weakest && faceFt > SKILL_WAVE_RANGES[skill].ideal.max) return TOO_BIG;
  if (exposure === null) return EXPOSURE_UNKNOWN;
  if (exposure === "shadowed") return SHELTERED;
  if (exposure === "open" && faceFt >= CLOSING_OUT_FACE_FT) return CLOSING_OUT;
  return null;
}

/**
 * Where the last row of a run stops counting: at the next row, else one row spacing later (rows
 * are hourly or 3-hourly) but never past the end of daylight.
 */
function runEndMs(hours: readonly ScoredHour[], last: number, timezone: string): number {
  const next = hours[last + 1];
  if (next) return Date.parse(next.row.forecast_at);
  const lastMs = Date.parse(hours[last].row.forecast_at);
  const spacingMs = last > 0 ? lastMs - Date.parse(hours[last - 1].row.forecast_at) : HOUR_MS;
  const hour = getLocalHour(new Date(lastMs), timezone) ?? SWELL_EVENT_THRESHOLDS.daylightEndHour - 1;
  return lastMs + Math.max(HOUR_MS, Math.min(spacingMs, (SWELL_EVENT_THRESHOLDS.daylightEndHour - hour) * HOUR_MS));
}

/** "Mon 9 AM–3 PM": the longest run of rows at `label` (the earliest on a tie). */
function windowFor(hours: readonly ScoredHour[], label: string, timezone: string): string | null {
  let run: { first: number; last: number } | null = null;
  for (let index = 0; index < hours.length; index += 1) {
    if (hours[index].label !== label) continue;
    let last = index;
    while (last + 1 < hours.length && hours[last + 1].label === label) last += 1;
    if (!run || last - index > run.last - run.first) run = { first: index, last };
    index = last;
  }
  if (!run) return null;
  const startIso = hours[run.first].row.forecast_at;
  const endIso = new Date(runEndMs(hours, run.last, timezone)).toISOString();
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone }).format(new Date(startIso));
  return `${weekday} ${formatWindowLabel(startIso, endIso, timezone, { forBody: true })}`;
}

/**
 * The best daylight hour on the peak day, scored for this skill. Null without rows that day, or
 * when the best hour has no usable height: every component reads 0 then, which would say "blown out".
 */
function rateBeach(
  beach: RegionBeach,
  rows: readonly RatingRow[],
  event: InternalRegionEvent,
  skill: SkillLevel,
  timezone: string,
): RankedRating | null {
  if (rows.length === 0) return null;
  const hours: ScoredHour[] = [...rows]
    .sort((left, right) => Date.parse(left.forecast_at) - Date.parse(right.forecast_at))
    .map((row) => {
      const inputs = nativeScoreInputsFromForecast(row as EnhancedForecastEntity);
      const breakdown = scoreNativeConditionBreakdown(inputs, skill);
      return { row, inputs, breakdown, label: scoreLabel(breakdown.score) };
    });
  const best = hours.reduce((max, hour) => (hour.breakdown.score > max.breakdown.score ? hour : max));
  if (best.inputs.waveHeightFt <= 0) return null;
  const exposure = exposureOf(beach, event.directionDeg).label;
  const working = isWorking(best.label);
  return {
    beachId: beach.id,
    beachName: beach.name,
    label: best.label,
    window: windowFor(hours, best.label, timezone),
    faceFt: faceText(best.row.wave_height),
    // A working beach's own line still says when its exposure is unknown; its `working` row won't.
    reason: working ? (exposure === null ? EXPOSURE_UNKNOWN : null) : notWorkingReason(best, exposure, skill),
    exposure,
    rank: best.breakdown.score,
  };
}

/** No forecast rows reach an early look, so only exposure speaks: open beaches are likely to work. */
function earlyLookRating(beach: RegionBeach, event: InternalRegionEvent): RankedRating {
  const exposure = exposureOf(beach, event.directionDeg);
  return {
    beachId: beach.id,
    beachName: beach.name,
    label: exposure.label === "open" ? LIKELY : EARLY_LOOK,
    window: null,
    faceFt: null,
    reason: exposure.label === null ? EXPOSURE_UNKNOWN : exposure.label === "shadowed" ? SHELTERED : null,
    exposure: exposure.label,
    rank: exposure.factor,
  };
}

function publicRating({ rank: _rank, ...rating }: RankedRating): RegionBeachRating {
  return rating;
}

function byRank(left: RankedRating, right: RankedRating): number {
  return right.rank - left.rank || left.beachName.localeCompare(right.beachName);
}

/** One row per reason first, so three beaches don't all say "blown out", then the rest by score. */
function notWorkingList(ratings: readonly RankedRating[]): RankedRating[] {
  const candidates = ratings.filter((rating) => !isWorking(rating.label) && rating.reason !== null).sort(byRank);
  const picked = REASON_ORDER.flatMap((reason) => candidates.find((rating) => rating.reason === reason) ?? []);
  return [...picked, ...candidates.filter((rating) => !picked.includes(rating))].slice(0, MAX_NOT_WORKING);
}

function localDayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Rates every region beach for every event with this user's skill; events whose peak day has passed drop out. */
export function rateRegionEvents(
  built: RegionBuild,
  input: { beachId: string; skill: SkillLevel; now: Date },
): RegionSwellEvent[] {
  const today = getLocalDateStr(input.now, built.timezone);
  const rowsByBeachDate = new Map(built.beaches.map((beach) => [
    beach.id,
    Map.groupBy(built.rowsByBeach[beach.id] ?? [], (row) => getLocalDateStr(new Date(row.forecast_at), built.timezone)),
  ]));

  return built.events.flatMap((event): RegionSwellEvent[] => {
    const leadDays = localDayDiff(today, event.peakLocalDate);
    if (leadDays < 0) return [];
    const ratings = built.beaches.flatMap((beach) => {
      const rating = event.source === "wam"
        ? earlyLookRating(beach, event)
        : rateBeach(beach, rowsByBeachDate.get(beach.id)?.get(event.peakLocalDate) ?? [], event, input.skill, built.timezone);
      return rating ? [rating] : [];
    });
    const here = ratings.find((rating) => rating.beachId === input.beachId);
    const working = ratings
      .filter((rating) => isWorking(rating.label))
      .sort((left, right) => WORKING_RANK[left.label] - WORKING_RANK[right.label] || byRank(left, right))
      .slice(0, MAX_WORKING);

    return [{
      key: event.key,
      kind: event.kind,
      source: event.source,
      confidence: confidenceFor(leadDays),
      leadDays,
      directionLabel: event.directionLabel,
      periodS: event.periodS,
      arrivalAt: event.arrivalAt,
      peakAt: event.peakAt,
      fadeAt: event.fadeAt,
      peakLocalDate: event.peakLocalDate,
      offshoreFt: event.offshoreFt,
      history: event.history,
      here: here ? publicRating(here) : null,
      // Reasons explain what isn't working; a working row carries none.
      working: working.map((rating) => ({ ...publicRating(rating), reason: null })),
      notWorking: event.source === "wam" ? [] : notWorkingList(ratings).map(publicRating),
    }];
  });
}
