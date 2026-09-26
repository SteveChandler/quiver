import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import {
  parsePeriodSeconds,
  parseSwellDirectionToDegrees,
  parseWaveHeightMidpointFt,
} from "@/lib/alerts/forecast-parsers";
import { angleDifference, normalizeAngle } from "@/lib/domains/shared/angle-utils";
import { degreeToCardinal, degreesToCardinal } from "@/lib/utils/geo-utils";
import { shouldForceNoDecay } from "@/lib/flags/decay-off";
import {
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
  type ShoalingFactors,
} from "@/lib/utils/wave-height-transformer";
import {
  getLocalDateStr,
  getLocalHour,
} from "@/lib/services/discovery/window-selector/time-slot-utils";

import {
  SWELL_EVENT_THRESHOLDS,
  exposureFactor,
  swellWindowForBeach,
  type SwellWindow,
} from "./exposure";

export type SwellEventBeach = BeachTerrainConfig & {
  id: string;
  name: string;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
};

/** The only forecast columns detection reads; full forecast rows satisfy it. */
export type SwellEventForecastRow = Pick<
  EnhancedForecastEntity,
  | "forecast_at"
  | "swell_1_height"
  | "swell_1_period"
  | "swell_1_direction"
  | "swell_2_height"
  | "swell_2_period"
  | "swell_2_direction"
>;

export interface BeachSwellEvent {
  beachId: string;
  eventKey: string;
  directionDeg: number;
  directionBand: string;
  directionLabel: string;
  periodS: number;
  peakOffshoreHeightFt: number;
  peakFaceHeightFt: number;
  baselineFaceHeightFt: number;
  peakEnergy: number;
  baselineEnergy: number;
  energyRatio: number;
  exposure: number;
  arrivalAt: string;
  peakAt: string;
  fadeAt: string | null;
  peakLocalDate: string;
}

interface SwellPartition {
  heightFt: number;
  periodS: number;
  directionDeg: number;
}

export interface ExposedSwellPartition extends SwellPartition {
  exposure: number;
  /** exposure · H² · T */
  energy: number;
}

interface ExposedSwellRow {
  at: number;
  iso: string;
  localDate: string;
  daylight: boolean;
  partitions: ExposedSwellPartition[];
}

interface DayPeak {
  localDate: string;
  rowIndex: number;
  partition: ExposedSwellPartition | null;
  energy: number;
  faceHeightFt: number;
}

interface TrackPoint {
  rowIndex: number;
  partition: ExposedSwellPartition;
}

/** Callers pass forecast rows from at least this far back; detection uses them as baseline. */
export const SWELL_EVENT_BASELINE_LOOKBACK_HOURS = 48;
const CURRENT_AFTER_PEAK_MS = 12 * 60 * 60 * 1000;

// A zero baseline (nothing reached the beach) would make the ratio infinite;
// the cap keeps it finite for JSON and the snapshot table.
const MAX_ENERGY_RATIO = 99;
// A component can drop out of the two reported partitions for up to a day
// (a third swell outranks it); longer than this, a return is a new swell.
const TRACK_MAX_GAP_MS = 48 * 60 * 60 * 1000;
// Matches the cross-run key-reuse window: closer than this is the same swell.
const DUPLICATE_PEAK_MS = 36 * 60 * 60 * 1000;

function numberFrom(raw: unknown, parse: (value: string) => number | null): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") return parse(raw);
  return null;
}

function partitionFrom(height: unknown, period: unknown, direction: unknown): SwellPartition | null {
  const heightFt = parseWaveHeightMidpointFt(height);
  const periodS = numberFrom(period, parsePeriodSeconds);
  const directionDeg = numberFrom(direction, parseSwellDirectionToDegrees);
  if (heightFt === null || heightFt <= 0) return null;
  if (periodS === null || periodS <= 0) return null;
  if (directionDeg === null || !Number.isFinite(directionDeg)) return null;
  return { heightFt, periodS, directionDeg: normalizeAngle(directionDeg) };
}

/** Swell partitions of one forecast row; wind waves are ignored. */
export function parseSwellPartitions(row: SwellEventForecastRow): SwellPartition[] {
  return [
    partitionFrom(row.swell_1_height, row.swell_1_period, row.swell_1_direction),
    partitionFrom(row.swell_2_height, row.swell_2_period, row.swell_2_direction),
  ].filter((partition): partition is SwellPartition => partition !== null);
}

/** Projected surf face height for swell partitions, via the shared transformer. */
export function swellPartitionFaceHeightFt(
  partitions: readonly SwellPartition[],
  beach: BeachTerrainConfig,
): number | null {
  if (partitions.length === 0) return null;
  const largest = partitions.reduce((max, partition) => (partition.heightFt > max.heightFt ? partition : max));
  const result = transformToFaceHeightDecomposed({
    components: partitions.map((partition) => ({ ...partition, partition: "swell" as const })),
    beach,
    // Partitions are model swell (WW3 / Open-Meteo), never a calibrated buoy Hs.
    source: "model_swell",
    rawHeightFt: largest.heightFt,
    periodS: largest.periodS,
    swellDirectionDeg: largest.directionDeg,
  });
  return Number.isFinite(result.faceHeightFt) ? result.faceHeightFt : null;
}

/** Adapts a beaches row to the detector's beach shape, matching the forecast builder's terrain config. */
export function toSwellEventBeach(
  beach: Pick<
    Beach,
    | "id"
    | "name"
    | "slug"
    | "swell_window_center_deg"
    | "swell_window_halfwidth_deg"
    | "swell_access_factors"
    | "terrain_enabled"
    | "shoaling_factors"
    | "deepwater_decay_factor"
  >,
): SwellEventBeach {
  return {
    id: beach.id,
    name: beach.name,
    swell_window_center_deg: beach.swell_window_center_deg ?? null,
    swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
    swell_access_factors: beach.swell_access_factors ?? null,
    terrain_enabled: beach.terrain_enabled ?? false,
    shoaling_factors: (beach.shoaling_factors ?? null) as ShoalingFactors | null,
    deepwater_decay_factor: shouldForceNoDecay(beach) ? null : beach.deepwater_decay_factor ?? null,
  };
}

/** Same swell component: within trackDirectionDeg and trackPeriodS. */
type SwellComponentShape = Pick<SwellPartition, "directionDeg" | "periodS">;

export function tracksSwellComponent(previous: SwellComponentShape, next: SwellComponentShape): boolean {
  return angleDifference(previous.directionDeg, next.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    && Math.abs(previous.periodS - next.periodS) <= SWELL_EVENT_THRESHOLDS.trackPeriodS;
}

function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Parses and exposure-weights forecast rows, chronologically. Bad rows are
 * skipped; `range` limits rows to local dates inside it.
 */
export function exposedSwellRows(
  forecasts: readonly SwellEventForecastRow[],
  window: SwellWindow,
  timezone: string,
  range?: { firstDate: string; lastDate: string },
): ExposedSwellRow[] {
  const rows: ExposedSwellRow[] = [];
  for (const forecast of forecasts) {
    try {
      const at = Date.parse(forecast.forecast_at);
      if (!Number.isFinite(at)) continue;
      const time = new Date(at);
      const localDate = getLocalDateStr(time, timezone);
      if (range && (localDate < range.firstDate || localDate > range.lastDate)) continue;
      const hour = getLocalHour(time, timezone);
      rows.push({
        at,
        iso: time.toISOString(),
        localDate,
        daylight: hour !== null
          && hour >= SWELL_EVENT_THRESHOLDS.daylightStartHour
          && hour < SWELL_EVENT_THRESHOLDS.daylightEndHour,
        partitions: parseSwellPartitions(forecast).map((partition) => {
          const exposure = exposureFactor(partition.directionDeg, window) ?? 0;
          return {
            ...partition,
            exposure,
            energy: exposure * partition.heightFt * partition.heightFt * partition.periodS,
          };
        }),
      });
    } catch {
      // One malformed row must not void the beach; skip it.
    }
  }
  return rows.sort((left, right) => left.at - right.at);
}

/**
 * Links partitions row to row into swell components. The swell_1 / swell_2
 * slots are not identities (upstream orders them by size), so continuity of
 * direction and period decides which component a partition belongs to.
 */
function buildTracks(rows: readonly ExposedSwellRow[]): TrackPoint[][] {
  const tracks: TrackPoint[][] = [];
  rows.forEach((row, rowIndex) => {
    const live = tracks.filter((track) => row.at - rows[track[track.length - 1].rowIndex].at <= TRACK_MAX_GAP_MS);
    const pairs: Array<{ partitionIndex: number; track: TrackPoint[]; cost: number }> = [];
    row.partitions.forEach((partition, partitionIndex) => {
      for (const track of live) {
        const last = track[track.length - 1].partition;
        if (!tracksSwellComponent(last, partition)) continue;
        const cost = angleDifference(last.directionDeg, partition.directionDeg) / SWELL_EVENT_THRESHOLDS.trackDirectionDeg
          + Math.abs(last.periodS - partition.periodS) / SWELL_EVENT_THRESHOLDS.trackPeriodS;
        pairs.push({ partitionIndex, track, cost });
      }
    });
    pairs.sort((left, right) => left.cost - right.cost);
    const claimedPartitions = new Set<number>();
    const claimedTracks = new Set<TrackPoint[]>();
    for (const pair of pairs) {
      if (claimedPartitions.has(pair.partitionIndex) || claimedTracks.has(pair.track)) continue;
      pair.track.push({ rowIndex, partition: row.partitions[pair.partitionIndex] });
      claimedPartitions.add(pair.partitionIndex);
      claimedTracks.add(pair.track);
    }
    row.partitions.forEach((partition, partitionIndex) => {
      if (!claimedPartitions.has(partitionIndex)) tracks.push([{ rowIndex, partition }]);
    });
  });
  return tracks;
}

function componentDays(
  rows: readonly ExposedSwellRow[],
  track: readonly TrackPoint[],
  beach: SwellEventBeach,
): DayPeak[] {
  const byDate = new Map<string, DayPeak>();
  // A day with no parsed partitions is unknown, not flat: treating it as a
  // zero baseline would turn a data gap into a fake rise. A day with data but
  // without this component is a real zero only outside the component's life;
  // a gap inside it is the component going unreported, so it is unknown too.
  const firstDate = rows[track[0].rowIndex].localDate;
  const lastDate = rows[track[track.length - 1].rowIndex].localDate;
  const daylightDates = new Set(track
    .filter((point) => rows[point.rowIndex].daylight)
    .map((point) => rows[point.rowIndex].localDate));
  for (const row of rows) {
    if (!row.daylight || row.partitions.length === 0 || byDate.has(row.localDate)) continue;
    const insideLife = row.localDate >= firstDate && row.localDate <= lastDate;
    if (insideLife && !daylightDates.has(row.localDate)) continue;
    byDate.set(row.localDate, { localDate: row.localDate, rowIndex: -1, partition: null, energy: 0, faceHeightFt: 0 });
  }
  for (const point of track) {
    const row = rows[point.rowIndex];
    const day = byDate.get(row.localDate);
    if (!row.daylight || !day || point.partition.energy <= day.energy) continue;
    day.rowIndex = point.rowIndex;
    day.partition = point.partition;
    day.energy = point.partition.energy;
  }
  const days = [...byDate.values()].sort((left, right) => left.localDate.localeCompare(right.localDate));
  for (const day of days) {
    day.faceHeightFt = day.partition ? swellPartitionFaceHeightFt([day.partition], beach) ?? 0 : 0;
  }
  return days;
}

function baselineOf(days: readonly DayPeak[], start: number, end: number): DayPeak | null {
  let baseline: DayPeak | null = null;
  for (let index = start; index < end; index += 1) {
    if (!baseline || days[index].energy < baseline.energy) baseline = days[index];
  }
  return baseline;
}

function energyRatio(peak: number, baseline: number): number {
  if (baseline <= 0) return peak > 0 ? MAX_ENERGY_RATIO : 1;
  return Math.min(MAX_ENERGY_RATIO, peak / baseline);
}

function qualifies(day: DayPeak, baseline: DayPeak): boolean {
  const thresholds = SWELL_EVENT_THRESHOLDS;
  if (!day.partition) return false;
  if (day.faceHeightFt < thresholds.minPeakFaceHeightFt) return false;
  if (day.partition.periodS < thresholds.minPeriodS) return false;
  return day.faceHeightFt - baseline.faceHeightFt >= thresholds.minFaceRiseFt
    || energyRatio(day.energy, baseline.energy) >= thresholds.minEnergyRatio;
}

function continuesEvent(previous: DayPeak, next: DayPeak, baseline: DayPeak): boolean {
  if (!previous.partition || !next.partition) return false;
  return next.localDate === addLocalDays(previous.localDate, 1)
    && qualifies(next, baseline)
    && tracksSwellComponent(previous.partition, next.partition);
}

/** Exposed energy in a row of the component that `reference` belongs to. */
export function componentEnergy(row: ExposedSwellRow, reference: SwellComponentShape): number {
  return row.partitions.reduce((max, partition) => (
    tracksSwellComponent(reference, partition) && partition.energy > max ? partition.energy : max
  ), 0);
}

function buildEvent(args: {
  beach: SwellEventBeach;
  rows: readonly ExposedSwellRow[];
  eventDays: readonly DayPeak[];
  baseline: DayPeak;
  firstRowIndex: number;
}): BeachSwellEvent | null {
  const peakDay = args.eventDays.reduce((max, day) => (day.energy > max.energy ? day : max));
  const peak = peakDay.partition;
  if (!peak) return null;

  const onset = args.baseline.energy + 0.5 * (peakDay.energy - args.baseline.energy);
  let arrivalIndex = peakDay.rowIndex;
  while (arrivalIndex - 1 >= args.firstRowIndex && componentEnergy(args.rows[arrivalIndex - 1], peak) >= onset) {
    arrivalIndex -= 1;
  }
  let fadeAt: string | null = null;
  for (let index = peakDay.rowIndex + 1; index < args.rows.length; index += 1) {
    if (componentEnergy(args.rows[index], peak) < onset) {
      fadeAt = args.rows[index].iso;
      break;
    }
  }

  const directionBand = degreesToCardinal(peak.directionDeg);
  return {
    beachId: args.beach.id,
    eventKey: `${args.beach.id}:${directionBand}:${peakDay.localDate}`,
    directionDeg: peak.directionDeg,
    directionBand,
    directionLabel: degreeToCardinal(peak.directionDeg),
    periodS: peak.periodS,
    peakOffshoreHeightFt: peak.heightFt,
    peakFaceHeightFt: peakDay.faceHeightFt,
    baselineFaceHeightFt: args.baseline.faceHeightFt,
    peakEnergy: peakDay.energy,
    baselineEnergy: args.baseline.energy,
    energyRatio: energyRatio(peakDay.energy, args.baseline.energy),
    exposure: peak.exposure,
    arrivalAt: args.rows[arrivalIndex].iso,
    peakAt: args.rows[peakDay.rowIndex].iso,
    fadeAt,
    peakLocalDate: peakDay.localDate,
  };
}

function componentEvents(
  rows: readonly ExposedSwellRow[],
  days: readonly DayPeak[],
  beach: SwellEventBeach,
): BeachSwellEvent[] {
  const events: BeachSwellEvent[] = [];
  let baselineStart = 0;
  let index = 0;
  while (index < days.length) {
    const baseline = baselineOf(days, baselineStart, index);
    if (!baseline || !qualifies(days[index], baseline)) {
      index += 1;
      continue;
    }

    const eventDays = [days[index]];
    let next = index + 1;
    while (next < days.length && continuesEvent(days[next - 1], days[next], baseline)) {
      eventDays.push(days[next]);
      next += 1;
    }

    const firstRowIndex = rows.findIndex((row) => row.localDate >= days[baselineStart].localDate);
    const event = buildEvent({ beach, rows, eventDays, baseline, firstRowIndex });
    if (event) events.push(event);

    // A fresh baseline starts after the event, so a later swell is measured
    // against the lull that follows this one rather than the pre-event flat.
    baselineStart = next;
    index = next;
  }
  return events;
}

/** Still worth showing: not yet faded (or, without a fade, within 12 h of its peak). */
export function isSwellEventCurrent(
  event: Pick<BeachSwellEvent, "peakAt" | "fadeAt">,
  now: Date,
): boolean {
  const end = event.fadeAt ? Date.parse(event.fadeAt) : Date.parse(event.peakAt) + CURRENT_AFTER_PEAK_MS;
  return end >= now.getTime();
}

/**
 * Swell events per component (swell_1 / swell_2 tracked independently), so
 * two swells from different directions can overlap in time. The baseline spans
 * [now − 48 h, candidate day], so recent past events are returned too; callers
 * filter by time. Chronological by peak; [] without a swell window or partitions.
 */
export function detectBeachSwellEvents(input: {
  beach: SwellEventBeach;
  forecasts: readonly SwellEventForecastRow[];
  now: Date;
  timezone: string;
}): BeachSwellEvent[] {
  const window = swellWindowForBeach(input.beach);
  if (!window) return [];

  const today = getLocalDateStr(input.now, input.timezone);
  // The baseline reaches back before today, so a swell that has already
  // arrived is still measured against the lull before it, not against itself.
  const baselineStart = new Date(input.now.getTime() - SWELL_EVENT_BASELINE_LOOKBACK_HOURS * 60 * 60 * 1000);
  const rows = exposedSwellRows(input.forecasts, window, input.timezone, {
    firstDate: getLocalDateStr(baselineStart, input.timezone),
    lastDate: addLocalDays(today, SWELL_EVENT_THRESHOLDS.maxHorizonDays - 1),
  });
  const events = buildTracks(rows)
    .flatMap((track) => componentEvents(rows, componentDays(rows, track, input.beach), input.beach))
    .sort((left, right) => right.peakEnergy - left.peakEnergy);

  // Two tracks can split one swell (e.g. a period jump between rows); keep the
  // stronger. Overlapping events are only kept when they are different swells.
  const kept: BeachSwellEvent[] = [];
  for (const event of events) {
    const duplicate = kept.some((other) => (
      tracksSwellComponent(other, event)
      && Math.abs(Date.parse(other.peakAt) - Date.parse(event.peakAt)) <= DUPLICATE_PEAK_MS
    ));
    if (!duplicate) kept.push(event);
  }
  return kept.sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
}
