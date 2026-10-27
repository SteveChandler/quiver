/**
 * Hourly forecast bridge.
 *
 * enhanced_forecasts rows are 3-hourly on a UTC grid, so a scorer reading them never sees the
 * hours in between (a high tide at 10 AM between the 8 and 11 AM slots). This fills those hours
 * with synthetic rows, the way native's hourly-forecast-rows.ts and the alert expansion do:
 * linear magnitudes, circular directions, nearest-row text, and only whole-hour gaps of 2–3 h.
 * Tide comes from the hourly tide series, one source per hour. Pure: no I/O, inputs untouched.
 */

import { extractTideSchedule } from "@/lib/services/discovery/window-selector/tide-boundary-calculator";
import type { TideSeriesSample } from "@/lib/services/tide-series-loader";
import { degreeToCardinal } from "@/lib/utils/geo-utils";
import { getDirectionDegrees } from "@/lib/utils/number-parsing";
import type { EnhancedForecastEntity, HourlyBridgeProvenance, TideScheduleEntry } from "@/types/forecast";

const HOUR_MS = 60 * 60 * 1000;
const MIN_GAP_HOURS = 2;
const MAX_GAP_HOURS = 3;
/** next_tide_at and the schedule can differ by rounding; within a minute is the same event. */
const SAME_TIDE_EVENT_MS = 60 * 1000;
/** A number in a display string. A dash after a digit is a range ("1-2 ft"), not a sign. */
const NUMBER = /(?<![\d.])-?\d+(?:\.\d+)?/g;
const FIRST_NUMBER = /(?<![\d.])-?\d+(?:\.\d+)?/;
const COMPASS = /^[NSEW]{1,3}$/i;

/** One series for a single beach, or each beach's series by beach_id (loadTideSeriesByBeach). */
type HourlyBridgeTide =
  | ReadonlyMap<string, readonly TideSeriesSample[]>
  | readonly TideSeriesSample[]
  | null;

interface HourlyBridgeOptions {
  /** Longest gap filled, in hours; capped at 3. */
  maxGapHours?: number;
  /** Fill only hours at or after this instant. */
  startMs?: number;
  /** Fill only hours before this instant. */
  endMs?: number;
  /** Beach IANA timezone, to write a recomputed next_tide_time; without it that time is null. */
  timezone?: string;
}

type MeasurementField = "wave_height" | "wave_period" | "water_temp" | "air_temperature" | "wind_speed" | "ml_corrected_height";
type LinearOmField = "wave_height_om" | "wave_period_om" | "wind_wave_height_om";
type PartitionKeys = readonly [
  "swell_1_height" | "swell_2_height" | "wind_wave_height",
  "swell_1_period" | "swell_2_period" | "wind_wave_period",
  "swell_1_direction" | "swell_2_direction" | "wind_wave_direction",
];

const MEASUREMENT_FIELDS: readonly MeasurementField[] = [
  "wave_height", "wave_period", "water_temp", "air_temperature", "wind_speed", "ml_corrected_height",
];
const LINEAR_OM_FIELDS: readonly LinearOmField[] = ["wave_height_om", "wave_period_om", "wind_wave_height_om"];
const PARTITIONS: readonly PartitionKeys[] = [
  ["swell_1_height", "swell_1_period", "swell_1_direction"],
  ["swell_2_height", "swell_2_period", "swell_2_direction"],
  ["wind_wave_height", "wind_wave_period", "wind_wave_direction"],
];

interface SeriesTide {
  heightFt: number;
  rateFtPerHour: number;
  status: string;
}

interface NextTideFields {
  next_tide_time: string | null;
  next_tide_type: string | null;
  next_tide_height: string | null;
  next_tide_at: string | null;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpDegrees(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + delta * t) % 360) + 360) % 360;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function finiteMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Blends each number of two same-shaped strings ("1.6 ft", "12s", "1-2 ft") and keeps the shape.
 * Null when either side is missing; undefined when the shapes differ and no blend exists.
 */
function blendMeasurement(a: string | null | undefined, b: string | null | undefined, t: number): string | null | undefined {
  if (a == null || b == null) return null;
  const left = a.match(NUMBER)?.map(Number);
  const right = b.match(NUMBER)?.map(Number);
  if (!left || !right || left.length !== right.length) return undefined;
  if (a.replace(NUMBER, "#") !== b.replace(NUMBER, "#")) return undefined;
  let index = 0;
  return a.replace(NUMBER, () => {
    const value = round1(lerp(left[index], right[index], t));
    index += 1;
    return String(value);
  });
}

/** A blended string, or the nearest row's own string when the two can't be blended. */
function measurement(a: string | null | undefined, b: string | null | undefined, nearest: string | null | undefined, t: number): string | null {
  const blended = blendMeasurement(a, b, t);
  return blended === undefined ? nearest ?? null : blended;
}

function lerpNumber(a: number | null | undefined, b: number | null | undefined, t: number): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return lerp(a, b, t);
}

function lerpNumberDegrees(a: number | null | undefined, b: number | null | undefined, t: number): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return lerpDegrees(a, b, t);
}

function directionDegrees(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const degrees = getDirectionDegrees(trimmed, trimmed);
  return degrees != null && Number.isFinite(degrees) ? degrees : null;
}

/** Writes `degrees` in the template's own style: compass text stays compass, "270" stays numeric. */
function formatDirectionLike(template: string, degrees: number): string | null {
  const trimmed = template.trim();
  if (COMPASS.test(trimmed)) return degreeToCardinal(degrees);
  if (FIRST_NUMBER.test(trimmed)) return template.replace(FIRST_NUMBER, String(Math.round(degrees) % 360));
  return null;
}

function blendDirection(
  a: string | null | undefined,
  b: string | null | undefined,
  nearest: string | null | undefined,
  t: number,
): string | null {
  const left = directionDegrees(a);
  const right = directionDegrees(b);
  if (left == null || right == null || nearest == null) return null;
  return formatDirectionLike(nearest, lerpDegrees(left, right, t)) ?? nearest;
}

/** The partition parsePartition (discovery-adapter) would accept: height > 0, period > 0, a direction. */
function hasPartition(row: EnhancedForecastEntity, [heightKey, periodKey, directionKey]: PartitionKeys): boolean {
  const height = Number.parseFloat(row[heightKey] ?? "");
  const period = Number.parseFloat(row[periodKey] ?? "");
  return height > 0 && period > 0 && directionDegrees(row[directionKey]) != null;
}

/** Height, period and direction of one partition resolve together, never from different rows. */
function blendPartition(
  row: EnhancedForecastEntity,
  from: EnhancedForecastEntity,
  to: EnhancedForecastEntity,
  nearest: EnhancedForecastEntity,
  keys: PartitionKeys,
  t: number,
): void {
  const [heightKey, periodKey, directionKey] = keys;
  if (!hasPartition(from, keys) || !hasPartition(to, keys)) {
    row[heightKey] = null;
    row[periodKey] = null;
    row[directionKey] = null;
    return;
  }
  const height = blendMeasurement(from[heightKey], to[heightKey], t);
  const period = blendMeasurement(from[periodKey], to[periodKey], t);
  const left = directionDegrees(from[directionKey]);
  const right = directionDegrees(to[directionKey]);
  const template = nearest[directionKey];
  const direction = left != null && right != null && template != null
    ? formatDirectionLike(template, lerpDegrees(left, right, t))
    : null;
  if (height == null || period == null || direction == null) {
    row[heightKey] = nearest[heightKey] ?? null;
    row[periodKey] = nearest[periodKey] ?? null;
    row[directionKey] = nearest[directionKey] ?? null;
    return;
  }
  row[heightKey] = height;
  row[periodKey] = period;
  row[directionKey] = direction;
}

/** The Open-Meteo swell triple follows the same rule as the text partitions. */
function blendOmSwell(row: EnhancedForecastEntity, from: EnhancedForecastEntity, to: EnhancedForecastEntity, t: number): void {
  const present = (value: EnhancedForecastEntity): boolean =>
    (value.swell_height_om ?? 0) > 0 && (value.swell_period_om ?? 0) > 0
      && value.swell_direction_om != null && Number.isFinite(value.swell_direction_om);
  if (from.swell_height_om === undefined && to.swell_height_om === undefined) return;
  if (!present(from) || !present(to)) {
    row.swell_height_om = null;
    row.swell_period_om = null;
    row.swell_direction_om = null;
    return;
  }
  row.swell_height_om = lerpNumber(from.swell_height_om, to.swell_height_om, t);
  row.swell_period_om = lerpNumber(from.swell_period_om, to.swell_period_om, t);
  row.swell_direction_om = lerpNumberDegrees(from.swell_direction_om, to.swell_direction_om, t);
}

/** wind_direction text and wind_direction_deg come from the same blended degree. */
function blendWind(row: EnhancedForecastEntity, from: EnhancedForecastEntity, to: EnhancedForecastEntity, nearest: EnhancedForecastEntity, t: number): void {
  const left = getDirectionDegrees(from.wind_direction_deg, from.wind_direction);
  const right = getDirectionDegrees(to.wind_direction_deg, to.wind_direction);
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) {
    row.wind_direction = null;
    row.wind_direction_deg = null;
    return;
  }
  const degrees = lerpDegrees(left, right, t);
  row.wind_direction_deg = nearest.wind_direction_deg == null ? null : round1(degrees);
  row.wind_direction = nearest.wind_direction == null
    ? null
    : formatDirectionLike(nearest.wind_direction, degrees) ?? nearest.wind_direction;
}

/** Hourly heights keyed by UTC hour (selectTideSeries already keeps one row per hour). */
function indexSeries(samples: readonly TideSeriesSample[] | null): Map<number, number> {
  const index = new Map<number, number>();
  for (const sample of samples ?? []) {
    const ms = finiteMs(sample.ts);
    if (ms == null || !Number.isFinite(sample.heightFt)) continue;
    const hourMs = Math.floor(ms / HOUR_MS) * HOUR_MS;
    if (!index.has(hourMs)) index.set(hourMs, sample.heightFt);
  }
  return index;
}

/**
 * A local extremum of the hourly series is the turn: High or Low whatever the rate. Plain words,
 * because condition alerts match tide_status exactly against rising/falling/high/low.
 */
function seriesStatus(heightFt: number, prev: number | undefined, next: number | undefined, rate: number): string {
  if (prev !== undefined && next !== undefined) {
    if (heightFt > prev && heightFt > next) return "High";
    if (heightFt < prev && heightFt < next) return "Low";
  }
  if (rate > 0) return "Rising";
  if (rate < 0) return "Falling";
  return "Unknown";
}

/**
 * Height, status and rate at an exact UTC hour, all from the series. Rate is the central
 * difference, one-sided at an edge; an hour with no neighbour has no slope and is not covered.
 */
function seriesTideAt(index: ReadonlyMap<number, number>, hourMs: number): SeriesTide | null {
  const heightFt = index.get(hourMs);
  if (heightFt === undefined) return null;
  const prev = index.get(hourMs - HOUR_MS);
  const next = index.get(hourMs + HOUR_MS);
  let raw: number;
  if (prev !== undefined && next !== undefined) raw = (next - prev) / 2;
  else if (next !== undefined) raw = next - heightFt;
  else if (prev !== undefined) raw = heightFt - prev;
  else return null;
  const rateFtPerHour = round2(raw);
  return { heightFt, rateFtPerHour, status: seriesStatus(heightFt, prev, next, rateFtPerHour) };
}

/** The fallback when the series lacks the hour: the chord between the two rows. */
function rowLerpTide(from: EnhancedForecastEntity, to: EnhancedForecastEntity, t: number, gapHours: number): SeriesTide | null {
  const a = Number.parseFloat(from.tide_height ?? "");
  const b = Number.parseFloat(to.tide_height ?? "");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const rateFtPerHour = round2((b - a) / gapHours);
  const status = rateFtPerHour > 0 ? "Rising" : rateFtPerHour < 0 ? "Falling" : "Unknown";
  return { heightFt: lerp(a, b, t), rateFtPerHour, status };
}

function nextTideOf(row: EnhancedForecastEntity): NextTideFields {
  return {
    next_tide_time: row.next_tide_time ?? null,
    next_tide_type: row.next_tide_type ?? null,
    next_tide_height: row.next_tide_height ?? null,
    next_tide_at: row.next_tide_at ?? null,
  };
}

/** next_tide_time as forecast-builder getTideInfo writes it ("10:06 AM"); null without a valid zone. */
function formatNextTideTime(eventMs: number, timezone: string | undefined): string | null {
  if (!timezone) return null;
  try {
    return new Date(eventMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  } catch {
    // An unknown IANA zone throws a RangeError; the label stays empty rather than wrong.
    return null;
  }
}

/**
 * The next tide event after the hour, its four fields from one source. With a schedule the event
 * is the first one after the hour, and its fields come from whichever neighbour row already names
 * it, else from the schedule (next_tide_time needs the beach timezone). Without a schedule, the
 * neighbour whose next event is still ahead; failing that, the nearest row.
 */
function nextTideAt(
  from: EnhancedForecastEntity,
  to: EnhancedForecastEntity,
  nearest: EnhancedForecastEntity,
  schedule: readonly TideScheduleEntry[] | null,
  hourMs: number,
  timezone: string | undefined,
): NextTideFields {
  const event = schedule?.find((entry) => entry.time * 1000 > hourMs);
  if (event) {
    const eventMs = event.time * 1000;
    const naming = [from, to].find((row) => {
      const at = finiteMs(row.next_tide_at);
      return at != null && Math.abs(at - eventMs) <= SAME_TIDE_EVENT_MS;
    });
    if (naming) return nextTideOf(naming);
    return {
      next_tide_time: formatNextTideTime(eventMs, timezone),
      next_tide_type: event.type === "high" ? "High" : "Low",
      next_tide_height: `${round1(event.height)} ft`,
      next_tide_at: new Date(eventMs).toISOString(),
    };
  }
  const ahead = [from, to]
    .map((row) => ({ row, at: finiteMs(row.next_tide_at) }))
    .filter((value): value is { row: EnhancedForecastEntity; at: number } => value.at != null && value.at > hourMs)
    .sort((a, b) => a.at - b.at)[0];
  return nextTideOf(ahead?.row ?? nearest);
}

function bridgeRow(
  from: EnhancedForecastEntity,
  to: EnhancedForecastEntity,
  k: number,
  gapHours: number,
  hourMs: number,
  series: ReadonlyMap<number, number>,
  schedule: readonly TideScheduleEntry[] | null,
  timezone: string | undefined,
): EnhancedForecastEntity {
  const t = k / gapHours;
  const nearest = t < 0.5 ? from : to;
  const forecastAt = new Date(hourMs).toISOString();
  const row: EnhancedForecastEntity = {
    ...nearest,
    id: `${from.id}:h+${k}`,
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: forecastAt.slice(11, 19),
  };

  for (const field of MEASUREMENT_FIELDS) {
    if (from[field] === undefined && to[field] === undefined) continue;
    row[field] = measurement(from[field], to[field], nearest[field], t);
  }
  if (from.wave_direction !== undefined || to.wave_direction !== undefined) {
    row.wave_direction = blendDirection(from.wave_direction, to.wave_direction, nearest.wave_direction, t);
  }
  for (const keys of PARTITIONS) blendPartition(row, from, to, nearest, keys, t);
  for (const field of LINEAR_OM_FIELDS) {
    if (from[field] === undefined && to[field] === undefined) continue;
    row[field] = lerpNumber(from[field], to[field], t);
  }
  if (from.wave_direction_om !== undefined || to.wave_direction_om !== undefined) {
    row.wave_direction_om = lerpNumberDegrees(from.wave_direction_om, to.wave_direction_om, t);
  }
  blendOmSwell(row, from, to, t);
  blendWind(row, from, to, nearest, t);

  // Every tide field at the hour comes from one source; a series height never sits beside a row status.
  const fromSeries = seriesTideAt(series, hourMs);
  const tide = fromSeries ?? rowLerpTide(from, to, t, gapHours);
  const tideSource: HourlyBridgeProvenance["tide_source"] = fromSeries ? "series" : tide ? "row_lerp" : "none";
  row.tide_height = tide ? `${round1(tide.heightFt)} ft` : null;
  row.tide_status = tide?.status ?? null;
  row.tide_rate_ft_per_hour = tide?.rateFtPerHour ?? null;
  Object.assign(row, nextTideAt(from, to, nearest, schedule, hourMs, timezone));

  row.raw_forecast = {
    ...(nearest.raw_forecast ?? {}),
    hourly_bridge: { from: from.forecast_at, to: to.forecast_at, t, tide_source: tideSource },
  };
  return row;
}

/** A stored row with the series' rate at its hour; the row's own tide height and status stay. */
function withSeriesRate(row: EnhancedForecastEntity, series: ReadonlyMap<number, number>): EnhancedForecastEntity {
  const ms = finiteMs(row.forecast_at);
  const tide = ms == null ? null : seriesTideAt(series, ms);
  return tide ? { ...row, tide_rate_ft_per_hour: tide.rateFtPerHour } : row;
}

function isTideMap(tide: NonNullable<HourlyBridgeTide>): tide is ReadonlyMap<string, readonly TideSeriesSample[]> {
  return tide instanceof Map;
}

function sortedSchedule(schedule: TideScheduleEntry[] | null): TideScheduleEntry[] | null {
  return schedule ? [...schedule].sort((a, b) => a.time - b.time) : null;
}

/**
 * Stored rows plus synthetic rows for the whole UTC hours inside each 2–3 h gap between a beach's
 * consecutive rows, returned in forecast_at order. A longer gap or a missing row stays a gap.
 * Pass `tide` as a map by beach_id when rows hold several beaches.
 */
export function bridgeForecastsHourly(
  rows: readonly EnhancedForecastEntity[],
  tide: HourlyBridgeTide,
  opts: HourlyBridgeOptions = {},
): EnhancedForecastEntity[] {
  const maxGapHours = Math.min(MAX_GAP_HOURS, opts.maxGapHours ?? MAX_GAP_HOURS);
  const byBeach = new Map<string, EnhancedForecastEntity[]>();
  for (const row of rows) {
    const beachRows = byBeach.get(row.beach_id);
    if (beachRows) beachRows.push(row);
    else byBeach.set(row.beach_id, [row]);
  }
  if (tide != null && !isTideMap(tide) && byBeach.size > 1) {
    throw new Error("bridgeForecastsHourly: rows hold several beaches; pass tide as a map by beach_id");
  }

  const out: Array<{ row: EnhancedForecastEntity; ms: number; order: number }> = [];
  const push = (row: EnhancedForecastEntity): void => {
    out.push({ row, ms: finiteMs(row.forecast_at) ?? Number.POSITIVE_INFINITY, order: out.length });
  };

  for (const [beachId, beachRows] of byBeach) {
    const samples = tide == null ? null : isTideMap(tide) ? tide.get(beachId) ?? null : tide;
    const series = indexSeries(samples);
    const schedule = sortedSchedule(extractTideSchedule(beachRows));
    const sorted = [...beachRows].sort((a, b) =>
      (finiteMs(a.forecast_at) ?? Number.POSITIVE_INFINITY) - (finiteMs(b.forecast_at) ?? Number.POSITIVE_INFINITY));

    for (let index = 0; index < sorted.length; index += 1) {
      const from = sorted[index];
      push(withSeriesRate(from, series));
      const to = sorted[index + 1];
      if (!to) continue;
      const fromMs = finiteMs(from.forecast_at);
      const toMs = finiteMs(to.forecast_at);
      if (fromMs == null || toMs == null || fromMs % HOUR_MS !== 0) continue;
      const gapHours = (toMs - fromMs) / HOUR_MS;
      if (!Number.isInteger(gapHours) || gapHours < MIN_GAP_HOURS || gapHours > maxGapHours) continue;
      for (let k = 1; k < gapHours; k += 1) {
        const hourMs = fromMs + k * HOUR_MS;
        if (opts.startMs != null && hourMs < opts.startMs) continue;
        if (opts.endMs != null && hourMs >= opts.endMs) continue;
        push(bridgeRow(from, to, k, gapHours, hourMs, series, schedule, opts.timezone));
      }
    }
  }

  return out.sort((a, b) => a.ms - b.ms || a.order - b.order).map((value) => value.row);
}
