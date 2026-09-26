import {
  SWELL_EVENT_THRESHOLDS,
  detectBeachSwellEvents,
  detectSwellCrossing,
  exposureFactor,
  exposureLabel,
  isSwellEventCurrent,
  parseSwellPartitions,
  resolveEventKeys,
  swellPartitionFaceHeightFt,
  swellWindowForBeach,
  toSwellEventBeach,
  type BeachSwellEvent,
  type SwellCrossing,
  type SwellCrossingHistory,
  type SwellEventForecastRow,
  type SwellEventSnapshot,
} from '@/lib/alerts/swell-events';
import { parseSwellDirectionToDegrees, parseWindSpeedToKt } from '@/lib/alerts/forecast-parsers';
import { angleDifference, normalizeAngle } from '@/lib/domains/shared/angle-utils';
import { getRideabilityBand, type BoardClass } from '@/lib/domains/rideability';
import { getSkillLevelOrDefault, type SkillLevel } from '@/lib/domains/user-preferences';
import { createContextLogger } from '@/lib/logger';
import type { MajorEventHoldWeekScoutDay } from '@/lib/recommendations/major-event-hold/adapters/week-scout';
import { getLocalDateStr, getLocalHour } from '@/lib/services/discovery/window-selector/time-slot-utils';
import { degreeToCardinal } from '@/lib/utils/geo-utils';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const log = createContextLogger('WeekScoutSwells');

export interface WeekScoutSwell {
  eventKey: string;
  directionDeg: number;
  directionLabel: string;
  periodS: number;
  /** Offshore swell, NOT surf height. */
  peakOffshoreHeightFt: number;
  arrivalAt: string;
  peakAt: string;
  fadeAt: string | null;
  /** YYYY-MM-DD in `timezone`. */
  peakLocalDate: string;
  /** The request localTimezone. */
  timezone: string;
  confidence: 'on_the_radar' | 'likely' | 'locked';
  change: WeekScoutSwellChange | null;
  narrative: string;
  /** Ranked best first, max 8. */
  beaches: WeekScoutSwellBeach[];
  /** A second swell crossing this one at the lead beach. */
  crossing: WeekScoutSwellCrossing | null;
  /** Lead beach row nearest peakAt. */
  windAtPeak: { directionDeg: number; speedKt: number } | null;
}

export interface WeekScoutSwellCrossing {
  directionDeg: number;
  directionLabel: string;
  periodS: number;
  peakOffshoreHeightFt: number;
  /** Separation from the main swell, 0..180. */
  angleDeg: number;
  overlapStartAt: string;
  overlapEndAt: string;
  rarity: { crossingDaysInLast30: number; line: string } | null;
}

export interface WeekScoutSwellChange {
  kind: 'new' | 'upgraded' | 'downgraded' | 'earlier' | 'later' | 'steady';
  comparedToIssuedAt: string;
  previousPeakOffshoreHeightFt: number | null;
  previousPeakAt: string | null;
  summary: string;
}

export interface WeekScoutSwellBeach {
  beachId: string;
  beachName: string;
  exposure: number;
  exposureLabel: 'open' | 'partial' | 'shadowed';
  swellWindow: { centerDeg: number; halfWidthDeg: number } | null;
  peakFaceHeightFt: number | null;
  sizeFit: 'in_range' | 'above_range' | 'below_range' | 'unknown';
  bestWindow: {
    /** Equals a days[].windows[].id in the same response. */
    windowId: string;
    localDate: string;
    displayWindowStart: string;
    displayWindowEnd: string;
    verdict: 'worth_it' | 'maybe' | 'skip' | null;
    conditionScore: number | null;
    /** The window's forecast.waveHeight, exactly as the day strip shows it. */
    waveHeight: string | null;
  } | null;
}

export interface BuildWeekScoutSwellsInput {
  /** The final response days, so every bestWindow id is one the client received. */
  days: ReadonlyArray<Pick<MajorEventHoldWeekScoutDay, 'localDate' | 'windows'>>;
  beaches: readonly Beach[];
  forecastsByBeach: ReadonlyMap<string, readonly EnhancedForecastEntity[]>;
  /** Swell columns from the last 48 h, so a swell that already arrived keeps its baseline. */
  swellHistoryByBeach?: ReadonlyMap<string, readonly SwellEventForecastRow[]>;
  snapshots: readonly SwellEventSnapshot[];
  /** Last 30 days of snapshot history for these beaches; null when unavailable. */
  crossingHistory?: SwellCrossingHistory | null;
  userSkillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  now: Date;
  timezone: string;
}

interface RideableBand {
  min: number;
  max: number;
}

interface SwellGroup {
  lead: BeachSwellEvent;
  members: BeachSwellEvent[];
}

type Window = MajorEventHoldWeekScoutDay['windows'][number];

const HOUR_MS = 60 * 60 * 1000;
const RULES = {
  groupPeakHours: 36,
  groupPeriodS: 3,
  maxBeaches: 8,
  maxSwells: 3,
  previousRunMinAgeHours: 18,
  stablePeakHours: 12,
  stableHeightRatio: 0.3,
  changeHeightRatio: 0.15,
  changePeakHours: 6,
  lockedLeadHours: 36,
  likelyLeadHours: 120,
  nearestRowMaxHours: 3,
  openEndedSpanHours: 12,
  rarityMinHistoryDays: 14,
} as const;
const VERDICT_RANK: Record<NonNullable<Window['verdict']>, number> = { worth_it: 3, maybe: 2, skip: 1 };

/** The rideable bands Week Scout's `rideable` flag uses: any board's band counts. */
export function weekScoutRideableBands(
  skillLevel: SkillLevel | null,
  boardClasses: readonly BoardClass[],
): RideableBand[] {
  const skill = getSkillLevelOrDefault(skillLevel);
  if (boardClasses.length === 0) return [getRideabilityBand(skill, null).acceptable];
  return boardClasses.map((boardClass) => getRideabilityBand(skill, boardClass).acceptable);
}

/** A height string read by its first number, as Week Scout's `rideable` flag reads it. */
export function weekScoutWaveHeightFt(raw: unknown): number | null {
  const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function sizeFitFor(faceHeightFt: number | null, bands: readonly RideableBand[]): WeekScoutSwellBeach['sizeFit'] {
  if (faceHeightFt === null || bands.length === 0) return 'unknown';
  if (bands.some((band) => faceHeightFt >= band.min && faceHeightFt <= band.max)) return 'in_range';
  let nearest: { distance: number; fit: 'above_range' | 'below_range' } | null = null;
  for (const band of bands) {
    const candidate = faceHeightFt > band.max
      ? { distance: faceHeightFt - band.max, fit: 'above_range' as const }
      : { distance: band.min - faceHeightFt, fit: 'below_range' as const };
    if (!nearest || candidate.distance < nearest.distance) nearest = candidate;
  }
  return nearest?.fit ?? 'unknown';
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function hoursBetween(left: string, right: string): number {
  return Math.abs(Date.parse(left) - Date.parse(right)) / HOUR_MS;
}

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();
function weekdayName(date: Date, timezone: string): string {
  let formatter = weekdayFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone });
    weekdayFormatters.set(timezone, formatter);
  }
  return formatter.format(date);
}

function whenPhrase(iso: string, timezone: string): string {
  const date = new Date(iso);
  const weekday = weekdayName(date, timezone);
  const hour = (getLocalHour(date, timezone) ?? 12) % 24;
  if (hour < 5) return `early ${weekday} morning`;
  if (hour < 12) return `${weekday} morning`;
  if (hour < 17) return `${weekday} afternoon`;
  if (hour < 21) return `${weekday} evening`;
  return `${weekday} night`;
}

function formatNumber(value: number): string {
  return String(round(value, 1));
}

function listNames(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function weightedCircularMeanDeg(events: readonly BeachSwellEvent[]): number {
  let x = 0;
  let y = 0;
  for (const event of events) {
    const radians = (event.directionDeg * Math.PI) / 180;
    x += event.peakEnergy * Math.cos(radians);
    y += event.peakEnergy * Math.sin(radians);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return events[0].directionDeg;
  return normalizeAngle((Math.atan2(y, x) * 180) / Math.PI);
}

/** Past swell rows followed by the forecast, without repeating a timestamp. */
function swellRowsFor(input: BuildWeekScoutSwellsInput, beachId: string): SwellEventForecastRow[] {
  const forecasts = input.forecastsByBeach.get(beachId) ?? [];
  const history = input.swellHistoryByBeach?.get(beachId) ?? [];
  if (history.length === 0) return [...forecasts];
  const seen = new Set(forecasts.map((row) => Date.parse(row.forecast_at)));
  return [...history.filter((row) => !seen.has(Date.parse(row.forecast_at))), ...forecasts];
}

function detectCandidateEvents(input: BuildWeekScoutSwellsInput): BeachSwellEvent[] {
  const snapshotsByBeach = new Map<string, SwellEventSnapshot[]>();
  for (const snapshot of input.snapshots) {
    const list = snapshotsByBeach.get(snapshot.beachId) ?? [];
    list.push(snapshot);
    snapshotsByBeach.set(snapshot.beachId, list);
  }
  const events: BeachSwellEvent[] = [];
  for (const beach of input.beaches) {
    try {
      const detected = detectBeachSwellEvents({
        beach: toSwellEventBeach(beach),
        forecasts: swellRowsFor(input, beach.id),
        now: input.now,
        timezone: resolveBeachTimezone(beach.timezone),
      });
      events.push(...resolveEventKeys(detected, snapshotsByBeach.get(beach.id) ?? [])
        .filter((event) => isSwellEventCurrent(event, input.now)));
    } catch (error) {
      log.warn('Skipped a beach while detecting Week Scout swells', {
        beachId: beach.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return events;
}

function groupEvents(events: readonly BeachSwellEvent[]): SwellGroup[] {
  const groups: SwellGroup[] = [];
  // Highest energy first, so each group's first member is its lead.
  for (const event of [...events].sort((left, right) => right.peakEnergy - left.peakEnergy)) {
    // Angle, not band: one swell at 200° and 205° must not split into S and SW cards.
    const group = groups.find((candidate) => (
      angleDifference(candidate.lead.directionDeg, event.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
      && hoursBetween(candidate.lead.peakAt, event.peakAt) <= RULES.groupPeakHours
      && Math.abs(candidate.lead.periodS - event.periodS) <= RULES.groupPeriodS
      && !candidate.members.some((member) => member.beachId === event.beachId)
    ));
    if (group) group.members.push(event);
    else groups.push({ lead: event, members: [event] });
  }
  return groups;
}

function verdictRank(verdict: Window['verdict']): number {
  return verdict ? VERDICT_RANK[verdict] : 0;
}

/** The swell's span: arrival to fade, or 12 h past the peak without a fade. */
function swellSpan(event: Pick<BeachSwellEvent, 'arrivalAt' | 'peakAt' | 'fadeAt'>): { start: number; end: number } {
  return {
    start: Date.parse(event.arrivalAt),
    end: event.fadeAt ? Date.parse(event.fadeAt) : Date.parse(event.peakAt) + RULES.openEndedSpanHours * HOUR_MS,
  };
}

function bestWindowInSpan(
  days: BuildWeekScoutSwellsInput['days'],
  beachId: string,
  span: { start: number; end: number },
): WeekScoutSwellBeach['bestWindow'] {
  let best: { localDate: string; window: Window } | null = null;
  for (const day of days) {
    for (const window of day.windows) {
      if (window.beachId !== beachId || window.isBeachDayBest !== true || window.verdict === null) continue;
      // Windows are [start, end); the swell has to be in the water during one.
      if (Date.parse(window.start) >= span.end || Date.parse(window.end) <= span.start) continue;
      const better = !best
        || verdictRank(window.verdict) > verdictRank(best.window.verdict)
        || (
          verdictRank(window.verdict) === verdictRank(best.window.verdict)
          && (window.conditionScore ?? -1) > (best.window.conditionScore ?? -1)
        );
      if (better) best = { localDate: day.localDate, window };
    }
  }
  if (!best) return null;
  return {
    windowId: best.window.id,
    localDate: best.localDate,
    displayWindowStart: best.window.displayWindowStart,
    displayWindowEnd: best.window.displayWindowEnd,
    verdict: best.window.verdict,
    conditionScore: best.window.conditionScore,
    waveHeight: best.window.forecast.waveHeight ?? null,
  };
}

function nearestRow(
  forecasts: readonly EnhancedForecastEntity[],
  at: string,
): EnhancedForecastEntity | null {
  const target = Date.parse(at);
  let nearest: EnhancedForecastEntity | null = null;
  let nearestDiff = Number.POSITIVE_INFINITY;
  for (const row of forecasts) {
    const diff = Math.abs(Date.parse(row.forecast_at) - target);
    if (Number.isFinite(diff) && diff < nearestDiff) {
      nearest = row;
      nearestDiff = diff;
    }
  }
  return nearest && nearestDiff <= RULES.nearestRowMaxHours * HOUR_MS ? nearest : null;
}

function nearestFaceHeightFt(
  beach: Beach,
  forecasts: readonly EnhancedForecastEntity[],
  peakAt: string,
  directionDeg: number,
): number | null {
  const nearest = nearestRow(forecasts, peakAt);
  if (!nearest) return null;
  const partitions = parseSwellPartitions(nearest).filter((partition) => (
    angleDifference(partition.directionDeg, directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
  ));
  return swellPartitionFaceHeightFt(partitions, toSwellEventBeach(beach));
}

function compareBeaches(left: WeekScoutSwellBeach, right: WeekScoutSwellBeach): number {
  return verdictRank(right.bestWindow?.verdict ?? null) - verdictRank(left.bestWindow?.verdict ?? null)
    || (right.bestWindow?.conditionScore ?? -1) - (left.bestWindow?.conditionScore ?? -1)
    || right.exposure * (right.peakFaceHeightFt ?? 0) - left.exposure * (left.peakFaceHeightFt ?? 0);
}

function beachRows(
  group: SwellGroup,
  directionDeg: number,
  input: BuildWeekScoutSwellsInput,
  bands: readonly RideableBand[],
): WeekScoutSwellBeach[] {
  const rows: WeekScoutSwellBeach[] = [];
  for (const beach of input.beaches) {
    try {
      const member = group.members.find((event) => event.beachId === beach.id) ?? null;
      const window = swellWindowForBeach(beach);
      const windowExposure = window ? exposureFactor(directionDeg, window) : null;
      const bestWindow = bestWindowInSpan(input.days, beach.id, swellSpan(group.lead));
      const listed = member !== null
        || (windowExposure !== null && windowExposure > 0)
        || bestWindow?.verdict === 'worth_it';
      if (!listed) continue;

      // A beach with no measured window is treated as fully open, the same
      // degradation the face-height transformer applies to it.
      const exposure = round(member?.exposure ?? windowExposure ?? 1, 2);
      const faceHeightFt = member
        ? member.peakFaceHeightFt
        : nearestFaceHeightFt(beach, input.forecastsByBeach.get(beach.id) ?? [], group.lead.peakAt, directionDeg);
      rows.push({
        beachId: beach.id,
        beachName: beach.name,
        exposure,
        exposureLabel: exposureLabel(exposure),
        swellWindow: window ? { centerDeg: window.centerDeg, halfWidthDeg: window.halfWidthDeg } : null,
        peakFaceHeightFt: faceHeightFt === null ? null : round(faceHeightFt, 1),
        // The window's own height is the one this row shows next to the fit;
        // the swell's face height stands in only when there is no window.
        sizeFit: sizeFitFor(bestWindow ? weekScoutWaveHeightFt(bestWindow.waveHeight) : faceHeightFt, bands),
        bestWindow,
      });
    } catch (error) {
      log.warn('Skipped a beach while listing a Week Scout swell', {
        beachId: beach.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return rows.sort(compareBeaches).slice(0, RULES.maxBeaches);
}

function windAtPeakFor(
  forecasts: readonly EnhancedForecastEntity[],
  peakAt: string,
): WeekScoutSwell['windAtPeak'] {
  const row = nearestRow(forecasts, peakAt);
  // An explicit null source means the pipeline only had default wind values.
  if (!row || row.wind_source === null) return null;
  const directionDeg = typeof row.wind_direction_deg === 'number' && Number.isFinite(row.wind_direction_deg)
    ? row.wind_direction_deg
    : parseSwellDirectionToDegrees(row.wind_direction ?? null);
  const speedKt = parseWindSpeedToKt(row.wind_speed ?? null);
  if (directionDeg === null || !Number.isFinite(directionDeg) || speedKt === null || !Number.isFinite(speedKt)) {
    return null;
  }
  return { directionDeg: Math.round(normalizeAngle(directionDeg)) % 360, speedKt: round(speedKt, 1) };
}

function rarityFor(
  history: SwellCrossingHistory | null | undefined,
  lead: Pick<BeachSwellEvent, 'beachId' | 'eventKey'>,
): WeekScoutSwellCrossing['rarity'] {
  // Without enough run history a rarity claim would be a guess.
  if (!history || history.historyDays < RULES.rarityMinHistoryDays) return null;
  const days = new Set(history.crossings
    .filter((crossing) => crossing.beachId === lead.beachId && crossing.eventKey !== lead.eventKey)
    .map((crossing) => crossing.peakDate)).size;
  return {
    crossingDaysInLast30: days,
    line: days === 0
      ? 'First crossed swell here in 30 days'
      : `Crossed swells showed up on ${days} of the last 30 days`,
  };
}

function toResponseCrossing(
  crossing: SwellCrossing | null,
  history: SwellCrossingHistory | null | undefined,
  lead: Pick<BeachSwellEvent, 'beachId' | 'eventKey'>,
): WeekScoutSwellCrossing | null {
  if (!crossing) return null;
  return {
    directionDeg: Math.round(crossing.directionDeg) % 360,
    directionLabel: crossing.directionLabel,
    periodS: round(crossing.periodS, 1),
    peakOffshoreHeightFt: round(crossing.peakOffshoreHeightFt, 1),
    angleDeg: Math.round(crossing.angleDeg),
    overlapStartAt: crossing.overlapStartAt,
    overlapEndAt: crossing.overlapEndAt,
    rarity: rarityFor(history, lead),
  };
}

function periodClass(periodS: number): string {
  if (periodS >= 13) return 'long-period';
  if (periodS >= 10) return 'mid-period';
  return 'short-period';
}

function isPreviousRun(snapshot: SwellEventSnapshot, now: Date): boolean {
  return now.getTime() - Date.parse(snapshot.detectedAt) >= RULES.previousRunMinAgeHours * HOUR_MS;
}

function confidenceFor(
  lead: BeachSwellEvent,
  previousRuns: readonly SwellEventSnapshot[],
  now: Date,
): WeekScoutSwell['confidence'] {
  const leadHours = (Date.parse(lead.peakAt) - now.getTime()) / HOUR_MS;
  const stable = previousRuns.some((snapshot) => (
    hoursBetween(snapshot.peakAt, lead.peakAt) <= RULES.stablePeakHours
    && Math.abs(lead.peakOffshoreHeightFt - snapshot.peakOffshoreHeightFt)
      <= RULES.stableHeightRatio * snapshot.peakOffshoreHeightFt
  ));
  if (leadHours <= RULES.lockedLeadHours) return stable ? 'locked' : 'likely';
  if (leadHours <= RULES.likelyLeadHours) return stable ? 'likely' : 'on_the_radar';
  return 'on_the_radar';
}

function sincePhrase(issuedAt: string, now: Date, timezone: string): string {
  const ageHours = (now.getTime() - Date.parse(issuedAt)) / HOUR_MS;
  return ageHours < 42 ? 'yesterday' : weekdayName(new Date(issuedAt), timezone);
}

function changeFor(
  lead: BeachSwellEvent,
  previousRuns: readonly SwellEventSnapshot[],
  allSnapshots: readonly SwellEventSnapshot[],
  now: Date,
  timezone: string,
): WeekScoutSwellChange | null {
  const previous = [...previousRuns].sort((left, right) => Date.parse(right.detectedAt) - Date.parse(left.detectedAt))[0];
  if (!previous) {
    // "New" needs proof an earlier run looked and did not see it.
    const earlierRun = allSnapshots
      .filter((snapshot) => isPreviousRun(snapshot, now))
      .sort((left, right) => Date.parse(right.detectedAt) - Date.parse(left.detectedAt))[0];
    if (!earlierRun) return null;
    const since = sincePhrase(earlierRun.detectedAt, now, timezone);
    return {
      kind: 'new',
      comparedToIssuedAt: earlierRun.detectedAt,
      previousPeakOffshoreHeightFt: null,
      previousPeakAt: null,
      summary: `Not in ${since}'s forecast`,
    };
  }

  const since = sincePhrase(previous.detectedAt, now, timezone);
  const heightChange = (lead.peakOffshoreHeightFt - previous.peakOffshoreHeightFt) / previous.peakOffshoreHeightFt;
  const peakShiftHours = (Date.parse(lead.peakAt) - Date.parse(previous.peakAt)) / HOUR_MS;
  const base = {
    comparedToIssuedAt: previous.detectedAt,
    previousPeakOffshoreHeightFt: round(previous.peakOffshoreHeightFt, 1),
    previousPeakAt: previous.peakAt,
  };
  if (heightChange >= RULES.changeHeightRatio) {
    return { ...base, kind: 'upgraded', summary: `Up from ${formatNumber(previous.peakOffshoreHeightFt)} ft since ${since}` };
  }
  if (heightChange <= -RULES.changeHeightRatio) {
    return { ...base, kind: 'downgraded', summary: `Down from ${formatNumber(previous.peakOffshoreHeightFt)} ft since ${since}` };
  }
  if (Math.abs(peakShiftHours) >= RULES.changePeakHours) {
    return {
      ...base,
      kind: peakShiftHours < 0 ? 'earlier' : 'later',
      summary: `Peak moved to ${whenPhrase(lead.peakAt, timezone)}`,
    };
  }
  return { ...base, kind: 'steady', summary: `Holding steady since ${since}` };
}

function narrativeFor(
  swell: Pick<WeekScoutSwell, 'directionLabel' | 'periodS' | 'peakOffshoreHeightFt' | 'arrivalAt' | 'peakAt' | 'crossing'>,
  beaches: readonly WeekScoutSwellBeach[],
  now: Date,
  timezone: string,
): string {
  const peakWhen = whenPhrase(swell.peakAt, timezone);
  const arrivalWhen = whenPhrase(swell.arrivalAt, timezone);
  const timing = Date.parse(swell.peakAt) <= now.getTime()
    ? `peaked ${peakWhen} and is easing`
    : Date.parse(swell.arrivalAt) <= now.getTime()
    ? `is building now and peaks ${peakWhen}`
    : arrivalWhen === peakWhen
      ? `peaks ${peakWhen}`
      : `builds ${arrivalWhen} and peaks ${peakWhen}`;
  const sentences = [
    `${swell.directionLabel} swell, ${formatNumber(swell.peakOffshoreHeightFt)} ft at ${Math.round(swell.periodS)} s, ${timing}.`,
  ];
  if (swell.crossing) {
    sentences.push(
      `Two swells about ${Math.round(swell.crossing.angleDeg / 10) * 10}° apart: `
      + `a ${periodClass(swell.periodS)} ${swell.directionLabel} and `
      + `a ${periodClass(swell.crossing.periodS)} ${swell.crossing.directionLabel}.`,
    );
  }

  // Exposure is only claimed for beaches with a measured swell window.
  const measured = beaches.filter((beach) => beach.swellWindow !== null);
  const names = (label: WeekScoutSwellBeach['exposureLabel']): string[] =>
    measured.filter((beach) => beach.exposureLabel === label).slice(0, 2).map((beach) => beach.beachName);
  const verb = (count: number, one: string, many: string): string => (count === 1 ? one : many);
  const open = names('open');
  const partial = names('partial');
  const shadowed = names('shadowed');
  const clauses = [
    open.length > 0 ? `${listNames(open)} ${verb(open.length, 'faces', 'face')} it most directly` : null,
    partial.length > 0
      ? `${listNames(partial)} ${verb(partial.length, 'is', 'are')} partly blocked, so expect smaller surf there`
      : null,
    shadowed.length > 0
      ? `${listNames(shadowed)} ${verb(shadowed.length, 'is', 'are')} mostly blocked from this direction, so expect little of it there`
      : null,
  ].filter((clause): clause is string => clause !== null);
  if (clauses.length > 0) sentences.push(`${clauses.slice(0, 2).join('; ')}.`);

  const top = beaches[0];
  if (top?.sizeFit === 'above_range') {
    // Only suggest a beach this response actually recommends a window at.
    const fit = beaches.find((beach) => (
      beach.sizeFit === 'in_range'
      && (beach.bestWindow?.verdict === 'worth_it' || beach.bestWindow?.verdict === 'maybe')
    ));
    sentences.push(fit
      ? `It may run above your usual range at ${top.beachName}; ${fit.beachName} is the better size for you.`
      : 'It may run above your usual range at these spots.');
  }
  return sentences.join(' ');
}

function toWeekScoutSwell(
  group: SwellGroup,
  input: BuildWeekScoutSwellsInput,
  bands: readonly RideableBand[],
): WeekScoutSwell | null {
  const directionDeg = weightedCircularMeanDeg(group.members);
  const beaches = beachRows(group, directionDeg, input, bands);
  if (!beaches.some((beach) => beach.bestWindow !== null && beach.bestWindow.verdict !== null)) return null;

  const { lead } = group;
  const leadBeach = input.beaches.find((beach) => beach.id === lead.beachId);
  const leadForecasts = input.forecastsByBeach.get(lead.beachId) ?? [];
  const crossing = leadBeach
    ? detectSwellCrossing({
      beach: toSwellEventBeach(leadBeach),
      forecasts: swellRowsFor(input, lead.beachId),
      main: lead,
      referenceDirectionDeg: directionDeg,
      timezone: resolveBeachTimezone(leadBeach.timezone),
    })
    : null;
  const previousRuns = input.snapshots.filter((snapshot) => (
    snapshot.beachId === lead.beachId && snapshot.eventKey === lead.eventKey && isPreviousRun(snapshot, input.now)
  ));
  const swell = {
    eventKey: lead.eventKey,
    directionDeg: Math.round(directionDeg) % 360,
    directionLabel: degreeToCardinal(directionDeg),
    periodS: round(lead.periodS, 1),
    peakOffshoreHeightFt: round(lead.peakOffshoreHeightFt, 1),
    arrivalAt: lead.arrivalAt,
    peakAt: lead.peakAt,
    fadeAt: lead.fadeAt,
    peakLocalDate: getLocalDateStr(new Date(lead.peakAt), input.timezone),
    timezone: input.timezone,
    crossing: toResponseCrossing(crossing, input.crossingHistory, lead),
  };
  return {
    ...swell,
    confidence: confidenceFor(lead, previousRuns, input.now),
    change: changeFor(lead, previousRuns, input.snapshots, input.now, input.timezone),
    narrative: narrativeFor(swell, beaches, input.now, input.timezone),
    beaches,
    windAtPeak: windAtPeakFor(leadForecasts, lead.peakAt),
  };
}

/**
 * When two detected swells cross, the crossing belongs on the stronger one;
 * the weaker keeps its own card without pointing back.
 */
function crossingOnStrongerOnly(
  entries: Array<{ swell: WeekScoutSwell; energy: number }>,
  input: Pick<BuildWeekScoutSwellsInput, 'now' | 'timezone'>,
): void {
  for (const entry of entries) {
    const crossing = entry.swell.crossing;
    if (!crossing) continue;
    const stronger = entries.some((other) => (
      other !== entry
      && other.energy > entry.energy
      && tracksComponent(other.swell, crossing)
      && Date.parse(other.swell.arrivalAt) <= Date.parse(crossing.overlapEndAt)
      && Date.parse(other.swell.fadeAt ?? other.swell.peakAt) >= Date.parse(crossing.overlapStartAt)
    ));
    if (!stronger) continue;
    entry.swell.crossing = null;
    entry.swell.narrative = narrativeFor(entry.swell, entry.swell.beaches, input.now, input.timezone);
  }
}

function tracksComponent(
  left: Pick<WeekScoutSwell, 'directionDeg' | 'periodS'>,
  right: Pick<WeekScoutSwellCrossing, 'directionDeg' | 'periodS'>,
): boolean {
  return angleDifference(left.directionDeg, right.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    && Math.abs(left.periodS - right.periodS) <= SWELL_EVENT_THRESHOLDS.trackPeriodS;
}

/**
 * Week Scout's "Swells this week": detected swell events grouped across the
 * candidate beaches, joined to the windows this response already names.
 * Pure; the caller supplies snapshots and owns failure isolation.
 */
export function buildWeekScoutSwells(unfiltered: BuildWeekScoutSwellsInput): WeekScoutSwell[] {
  // A beach held for water quality or a major event has no window with a
  // verdict in the response; it must not be listed, lead, or be suggested.
  const recommendable = new Set(unfiltered.days.flatMap((day) => day.windows
    .filter((window) => window.verdict !== null)
    .map((window) => window.beachId)));
  const input = { ...unfiltered, beaches: unfiltered.beaches.filter((beach) => recommendable.has(beach.id)) };
  const bands = weekScoutRideableBands(input.userSkillLevel, input.boardClasses);
  const entries: Array<{ swell: WeekScoutSwell; energy: number }> = [];
  for (const group of groupEvents(detectCandidateEvents(input))) {
    try {
      const swell = toWeekScoutSwell(group, input, bands);
      if (swell) entries.push({ swell, energy: group.lead.peakEnergy });
    } catch (error) {
      log.warn('Skipped a Week Scout swell group', {
        eventKey: group.lead.eventKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  crossingOnStrongerOnly(entries, input);
  return entries
    .map((entry) => entry.swell)
    .sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt))
    .slice(0, RULES.maxSwells);
}
