import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { resolveWindOrientation } from "@/lib/domains/shared/wind-orientation";
import { extractNumericWaveHeight } from "@/lib/utils/wave-formatters";
import { briefingInputHash, canonicalJson, sha256Hex } from "./swell-briefing-hash";
import { loadLatestBriefingInput, saveBriefingInput } from "./swell-briefing-store";
import {
  MAX_BRIEFING_COPY_FACTS,
  type BriefingCopyFact,
  type BriefingExposure,
  type BriefingExposureKey,
  type BriefingNext48Day,
  type BriefingSizeRange,
  type BriefingWeekDay,
  type BriefingWindKind,
  type BriefingWindPeriod,
  type SwellBriefing,
  type SwellBriefingInputSnapshot,
} from "./swell-briefing-types";

type Client = SupabaseClient<Database>;

/** Bumped when the shape of a built snapshot changes, invalidating deduplication. */
export const BRIEFING_INPUT_VERSION = "1";

const WEEK_DAYS = 7;
const NEXT_48_DAYS = 2;
/** Local hours that count as the morning and afternoon halves of a day. */
const AM_HOURS: [number, number] = [6, 11];
const PM_HOURS: [number, number] = [12, 17];

export interface BriefingRegion {
  slug: string;
  label: string;
  timezone: string;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

export const BRIEFING_REGIONS: Record<string, BriefingRegion> = {
  "san-diego": {
    slug: "san-diego",
    label: "San Diego",
    timezone: "America/Los_Angeles",
    bounds: { minLat: 32.4, maxLat: 33.3, minLon: -117.6, maxLon: -117.0 },
  },
};

export class BriefingInputError extends Error {
  readonly status: number;

  constructor(code: string, status = 503) {
    super(code);
    this.name = "BriefingInputError";
    this.status = status;
  }
}

interface BeachRow {
  id: string;
  name: string;
  aspect_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
}

interface ForecastRow {
  beach_id: string;
  forecast_at: string;
  wave_height: string | null;
  swell_period_om: number | null;
  swell_direction_om: number | null;
  wind_speed: string | null;
  wind_direction_deg: string | number | null;
  om_fetched_at: string | null;
  wind_model_run_at: string | null;
  updated_at: string | null;
}

/* ------------------------------------------------------------------ dates */

/** The calendar day at a timezone, as YYYY-MM-DD. */
export function localDate(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The hour of day at a timezone, 0-23. */
function localHour(at: Date, timezone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(at),
  );
}

/**
 * The UTC offset of a timezone at an instant, in milliseconds.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return asUtc - at.getTime();
}

/**
 * A wall-clock time in a timezone, as a UTC instant.
 *
 * `new Date('2026-10-26T23:59:59Z')` is the end of the day in UTC, which in
 * California is the afternoon of the same day - an edition built that way
 * expires about seven hours early. The offset is resolved twice because it can
 * itself change across a DST boundary.
 */
function zonedWallClockToUtc(date: string, time: string, timeZone: string): string {
  const guess = new Date(`${date}T${time}Z`);
  const firstPass = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(firstPass, timeZone)).toISOString();
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/* ------------------------------------------------------- measurement reads */

function heightFt(row: ForecastRow): number | null {
  const value = extractNumericWaveHeight(row.wave_height ?? "");
  return value !== null && Number.isFinite(value) ? value : null;
}

function windMph(row: ForecastRow): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(row.wind_speed ?? "");
  return match ? Number(match[1]) : null;
}

function windDeg(row: ForecastRow): number | null {
  // `Number(null)` and `Number("")` are 0, which would read a missing
  // direction as a north wind.
  const raw = row.wind_direction_deg;
  if (raw === null || (typeof raw === "string" && raw.trim() === "")) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? ((value % 360) + 360) % 360 : null;
}

/** The range of heights across a set of rows; null when nothing reads. */
function rangeOf(rows: ForecastRow[]): BriefingSizeRange | null {
  const heights = rows.map(heightFt).filter((value): value is number => value !== null);
  if (heights.length === 0) return null;
  const round = (value: number): number => Math.round(value * 10) / 10;
  return { min: round(Math.min(...heights)), max: round(Math.max(...heights)) };
}

/* ------------------------------------------------------------ body scale */

const BODY_SCALE: Array<[number, string]> = [
  [1, "ankle"],
  [2, "knee"],
  [3, "waist"],
  [4, "chest"],
  [5, "shoulder"],
  [7, "head high"],
  [10, "overhead"],
];

function bodyWord(ft: number): string {
  for (const [ceiling, word] of BODY_SCALE) {
    if (ft < ceiling) return word;
  }
  return "well overhead";
}

/**
 * `waist high` or `waist - chest`. An en dash is used in the native copy, so it
 * is written here rather than left for the client to insert.
 */
export function bodyScalePhrase(range: BriefingSizeRange | null): string | null {
  if (range === null) return null;
  const low = bodyWord(range.min);
  const high = bodyWord(range.max);
  if (low === high) return low.includes("high") || low.includes("overhead") ? low : `${low} high`;
  return `${low} – ${high}`;
}

/* ----------------------------------------------------------------- wind */

/**
 * Offshore, onshore or cross, from the beach's own orientation. The shared
 * resolver is used rather than a compass default, because east is offshore on
 * this coast and onshore on the other one.
 */
export function windKindFor(beach: BeachRow, directionDeg: number | null, speedMph: number | null): BriefingWindKind {
  if (speedMph !== null && speedMph < 4) return "light_variable";
  if (directionDeg === null) return "unknown";
  const { offshoreDeg, toleranceDeg } = resolveWindOrientation(beach);
  if (offshoreDeg === null) return "unknown";
  // `offshoreDeg` is the bearing offshore wind blows *from*, so the angular
  // difference to the wind's own bearing is the whole test: near zero is
  // offshore, near opposite is onshore.
  const difference = Math.abs(((directionDeg - offshoreDeg + 540) % 360) - 180);
  if (difference <= toleranceDeg) return "offshore";
  if (difference >= 180 - toleranceDeg) return "onshore";
  return "cross";
}

const WIND_LABELS: Record<BriefingWindKind, string> = {
  offshore: "OFFSHORE",
  onshore: "ONSHORE",
  cross: "CROSS-SHORE",
  light_variable: "LIGHT / VARIABLE",
  unknown: "WIND UNKNOWN",
};

/** `5 - 10 mph` across a half-day, or `up to 20 mph` when it only has a ceiling. */
function speedLabel(speeds: number[]): string | null {
  if (speeds.length === 0) return null;
  const min = Math.round(Math.min(...speeds));
  const max = Math.round(Math.max(...speeds));
  if (min === max) return `${max} mph`;
  if (min <= 3) return `up to ${max} mph`;
  return `${min} – ${max} mph`;
}

/* ------------------------------------------------------------- exposures */

/**
 * San Diego's coast faces roughly southwest through west-northwest, so the
 * facing angle is what separates a south-facing break from a west-facing one.
 * Beaches without a stored aspect are left out rather than guessed at.
 */
export function exposureFor(aspectDeg: number | null): BriefingExposureKey | null {
  if (aspectDeg === null || !Number.isFinite(aspectDeg)) return null;
  const aspect = ((aspectDeg % 360) + 360) % 360;
  if (aspect >= 180 && aspect < 247.5) return "south_facing";
  if (aspect >= 247.5 && aspect < 285) return "west_facing";
  if (aspect >= 285 && aspect < 330) return "northwest_facing";
  return null;
}

const EXPOSURE_LABELS: Record<BriefingExposureKey, string> = {
  south_facing: "South-facing",
  west_facing: "West-facing",
  northwest_facing: "Northwest-facing",
};

const EXPOSURE_ORDER: BriefingExposureKey[] = ["south_facing", "west_facing", "northwest_facing"];

/* ------------------------------------------------------------------ week */

function trendFor(today: BriefingSizeRange | null, previous: BriefingSizeRange | null): BriefingWeekDay["trend"] {
  if (today === null) return "uncertain";
  if (previous === null) return today.max >= 4 ? "bigger" : "small";
  const change = today.max - previous.max;
  if (change >= 1.5) return "bigger";
  if (change >= 0.5) return "building";
  if (change <= -1) return "easing";
  return today.max >= 4 ? "bigger" : "small";
}

const TREND_LABELS: Record<BriefingWeekDay["trend"], string> = {
  flat: "Flat",
  small: "Small",
  building: "Building",
  bigger: "More size",
  easing: "Easing",
  uncertain: "Uncertain",
};

/* ----------------------------------------------------------------- build */

function groupByDay(rows: ForecastRow[], timezone: string): Map<string, ForecastRow[]> {
  const byDay = new Map<string, ForecastRow[]>();
  for (const row of rows) {
    const at = new Date(row.forecast_at);
    if (!Number.isFinite(at.getTime())) continue;
    const day = localDate(at, timezone);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(row);
    else byDay.set(day, [row]);
  }
  return byDay;
}

function inHours(row: ForecastRow, timezone: string, [from, to]: [number, number]): boolean {
  const hour = localHour(new Date(row.forecast_at), timezone);
  return hour >= from && hour <= to;
}

/**
 * One representative break per exposure, with its own numbers.
 *
 * The size shown beside "South-facing" and the break the row opens have to
 * describe the same place. Aggregating the range across every south-facing
 * beach while naming whichever one happened to come back first lets the two
 * disagree - the row can read "waist - chest at Cardiff Reef" when that range
 * belongs to a different break entirely.
 */
function buildExposures(
  todayRows: ForecastRow[],
  beaches: Map<string, BeachRow>,
): BriefingExposure[] {
  const byExposure = new Map<BriefingExposureKey, Map<string, ForecastRow[]>>();

  for (const row of todayRows) {
    const beach = beaches.get(row.beach_id);
    if (!beach) continue;
    const exposure = exposureFor(beach.aspect_deg);
    if (exposure === null) continue;
    const perBeach = byExposure.get(exposure) ?? new Map<string, ForecastRow[]>();
    const rows = perBeach.get(beach.id) ?? [];
    rows.push(row);
    perBeach.set(beach.id, rows);
    byExposure.set(exposure, perBeach);
  }

  return EXPOSURE_ORDER.flatMap((exposure): BriefingExposure[] => {
    const perBeach = byExposure.get(exposure);
    if (!perBeach || perBeach.size === 0) return [];

    // Best-covered break wins, with the id breaking ties so the same edition
    // is produced twice from the same data.
    const [beachId, rows] = [...perBeach.entries()].sort(
      (a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0]),
    )[0];
    const beach = beaches.get(beachId);
    if (!beach) return [];

    const surfFt = rangeOf(rows);
    return [{
      exposure,
      label: EXPOSURE_LABELS[exposure],
      surfFt,
      surfLabel: bodyScalePhrase(surfFt),
      beach: { id: beach.id, name: beach.name },
    }];
  });
}

/**
 * The wind a half-day reads as, from each row classified on its own.
 *
 * Averaging the bearings first hides the real read: a morning offshore at
 * 08:00 and onshore by 11:00 averages to nothing and printed WIND UNKNOWN. The
 * most frequent kind wins; a tie goes to the kind seen first, because dawn is
 * when most surfers go. The bearing is the earliest reading of that kind.
 */
function periodWind(
  rows: ForecastRow[],
  beach: BeachRow,
): { kind: BriefingWindKind; directionDeg: number | null } {
  const readings = rows
    .map((row) => ({ at: Date.parse(row.forecast_at), deg: windDeg(row), mph: windMph(row) }))
    .filter((reading) => Number.isFinite(reading.at))
    .sort((a, b) => a.at - b.at)
    .map((reading) => ({ ...reading, kind: windKindFor(beach, reading.deg, reading.mph) }))
    .filter((reading) => reading.kind !== "unknown");

  // Map iteration follows insertion order, which is time order here, so the
  // strict comparison leaves a tie with the kind seen first.
  const counts = new Map<BriefingWindKind, number>();
  for (const reading of readings) counts.set(reading.kind, (counts.get(reading.kind) ?? 0) + 1);
  let kind: BriefingWindKind = "unknown";
  let best = 0;
  for (const [candidate, count] of counts) {
    if (count > best) {
      kind = candidate;
      best = count;
    }
  }

  const earliest = readings.find((reading) => reading.kind === kind && reading.deg !== null);
  // Whole degrees, as the field has always been issued.
  const directionDeg = earliest?.deg == null ? null : Math.round(earliest.deg) % 360;
  return { kind, directionDeg };
}

function buildPeriod(
  period: "am" | "pm",
  rows: ForecastRow[],
  beach: BeachRow,
): BriefingWindPeriod | null {
  if (rows.length === 0) return null;
  const speeds = rows.map(windMph).filter((value): value is number => value !== null);
  const topSpeed = speeds.length > 0 ? Math.max(...speeds) : null;
  const { kind, directionDeg } = periodWind(rows, beach);
  const surfFt = rangeOf(rows);

  return {
    period,
    kind,
    label: WIND_LABELS[kind],
    speedLabel: kind === "light_variable" ? null : speedLabel(speeds),
    speedMph: topSpeed === null ? null : Math.round(topSpeed),
    directionDeg,
    surfFt,
    surfLabel: bodyScalePhrase(surfFt),
  };
}

function buildNext48(
  byDay: Map<string, ForecastRow[]>,
  editionDate: string,
  timezone: string,
  homeBeach: BeachRow,
): BriefingNext48Day[] {
  const days: BriefingNext48Day[] = [];
  for (let offset = 1; offset <= NEXT_48_DAYS; offset += 1) {
    const date = addDays(editionDate, offset);
    const rows = (byDay.get(date) ?? []).filter((row) => row.beach_id === homeBeach.id);
    if (rows.length === 0) continue;
    const periods = [
      buildPeriod("am", rows.filter((row) => inHours(row, timezone, AM_HOURS)), homeBeach),
      buildPeriod("pm", rows.filter((row) => inHours(row, timezone, PM_HOURS)), homeBeach),
    ].filter((period): period is BriefingWindPeriod => period !== null);
    if (periods.length === 0) continue;

    // The note states the clean window only when the morning actually is clean;
    // it is never asserted on the model's behalf.
    const morning = periods.find((period) => period.period === "am");
    const note = morning?.kind === "offshore" ? "Cleanest early." : null;
    days.push({ date, periods, note });
  }
  return days;
}

function buildWeek(
  byDay: Map<string, ForecastRow[]>,
  editionDate: string,
  beaches: Map<string, BeachRow>,
): BriefingWeekDay[] {
  const week: BriefingWeekDay[] = [];
  let previous: BriefingSizeRange | null = null;

  for (let offset = 0; offset < WEEK_DAYS; offset += 1) {
    const date = addDays(editionDate, offset);
    const rows = byDay.get(date) ?? [];
    const surfFt = rangeOf(rows);
    const trend = trendFor(surfFt, previous);
    // A day the forecast does not reach is marked uncertain rather than drawn
    // as flat, which would read as a confident call of "nothing".
    const uncertain = surfFt === null;
    const biggest = rows
      .map((row) => ({ row, ft: heightFt(row) }))
      .filter((entry): entry is { row: ForecastRow; ft: number } => entry.ft !== null)
      .sort((a, b) => b.ft - a.ft)[0];
    const beach = biggest ? beaches.get(biggest.row.beach_id) ?? null : null;

    week.push({
      date,
      surfFt,
      trend,
      label: TREND_LABELS[trend],
      uncertain,
      highlightLabel: null,
      caveat: null,
      beach: beach ? { id: beach.id, name: beach.name } : null,
    });
    if (surfFt !== null) previous = surfFt;
  }

  // One call-out, on the biggest confident day, and only when it stands out.
  const peak = week
    .filter((day) => !day.uncertain && day.surfFt !== null)
    .sort((a, b) => (b.surfFt!.max - a.surfFt!.max))[0];
  if (peak && peak.surfFt!.max >= 4) {
    const weekday = new Date(`${peak.date}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
    peak.highlightLabel = `WATCH ${weekday.toUpperCase()}`;
  }

  return week;
}

/**
 * Copy the model may choose between. Every candidate is derived from the same
 * measurements the edition already carries, and each is written to stay true if
 * the numbers move within the band that produced it. The model picks an id; it
 * never writes text.
 */
function buildCopyFacts(briefing: SwellBriefing): BriefingCopyFact[] {
  const facts: BriefingCopyFact[] = [];
  const peak = briefing.week.find((day) => day.highlightLabel !== null);
  const sizes = briefing.today.exposures
    .map((exposure) => exposure.surfFt?.max)
    .filter((value): value is number => value !== undefined);
  const todayMax = sizes.length > 0 ? Math.max(...sizes) : null;
  const weekMax = briefing.week
    .map((day) => day.surfFt?.max ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  // Every candidate is gated on the measurements it describes. The validator
  // accepts any offered text, so an ungated candidate is a licence for the
  // model to call a six foot day "small and steady" - the gate here is what
  // actually keeps the copy true.
  if (todayMax !== null && todayMax < 3) {
    facts.push({ id: "headline-small", slot: "headline", text: "Small to start the week." });
  }
  if (todayMax !== null && todayMax < 3 && peak) {
    facts.push({ id: "headline-builds", slot: "headline", text: "Small now. More size later in the week." });
  }
  if (todayMax !== null && todayMax >= 4) {
    facts.push({ id: "headline-size", slot: "headline", text: "Size on tap today." });
  }
  if (todayMax !== null && todayMax >= 3 && todayMax < 4) {
    facts.push({ id: "headline-fun", slot: "headline", text: "Rideable surf across the region." });
  }
  // At least one headline candidate is required, and it must still be true
  // when nothing above fits - including when today has no measurement at all.
  if (facts.length === 0) {
    facts.push({ id: "headline-neutral", slot: "headline", text: "Today's surf across the region." });
  }

  // "Before the wind comes up" is only honest when it actually does.
  const windBuilds = briefing.next48.some((day) => {
    const morning = day.periods.find((period) => period.period === "am");
    const afternoon = day.periods.find((period) => period.period === "pm");
    return afternoon?.kind === "onshore" && morning?.kind !== "onshore";
  });
  if (windBuilds) {
    facts.push({
      id: "today-before-wind",
      slot: "todayCall",
      text: "Worth a look early before the wind comes up.",
    });
  }
  if (todayMax !== null && todayMax >= 2) {
    facts.push({ id: "today-qualified", slot: "todayCall", text: "An early check may be worthwhile." });
  }
  if (todayMax !== null && todayMax < 2 && weekMax >= 4) {
    facts.push({ id: "today-wait", slot: "todayCall", text: "Little on offer today; the week has more." });
  }

  for (const day of briefing.next48) {
    const morning = day.periods.find((period) => period.period === "am");
    if (morning?.kind === "offshore") {
      facts.push({ id: `next48-clean-${day.date}`, slot: `next48:${day.date}`, text: "Cleanest early." });
    }
  }

  return facts.slice(0, MAX_BRIEFING_COPY_FACTS);
}

/** The newest moment the data behind this edition was published or fetched. */
function sourcePublishedAt(rows: ForecastRow[]): string | null {
  const times = rows
    .map((row) => row.wind_model_run_at ?? row.om_fetched_at ?? row.updated_at)
    .map((value) => (value === null ? Number.NaN : Date.parse(value)))
    .filter((value) => Number.isFinite(value));
  return times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
}

/**
 * A hash of the measurements the edition rests on, with no timestamps in it.
 *
 * Refetching unchanged data must not issue a new input: the worker deduplicates
 * on the input hash, and a fetch time moving every hour would make it
 * regenerate an identical edition. The revision changes only when a number the
 * reader would see changes.
 */
function sourceRevision(briefing: SwellBriefing): string {
  return sha256Hex(
    canonicalJson({
      today: briefing.today,
      next48: briefing.next48,
      week: briefing.week,
      version: BRIEFING_INPUT_VERSION,
    }),
  );
}

/** Matches PostgREST's `max_rows` (supabase/config.toml), the most one response returns. */
const FORECAST_PAGE_SIZE = 1000;

/**
 * Every forecast row in the window, read a page at a time.
 *
 * PostgREST truncates a response at `max_rows` without an error. One read of
 * the region's ~53 beaches over the week is ~3,500 rows, so it stopped early on
 * Wednesday and the rest of the week came out uncertain. `(beach_id,
 * forecast_at)` is unique, so ordering on both is total and no row can fall
 * between pages or land on two of them.
 */
async function loadForecastRows(
  client: Client,
  beachIds: string[],
  from: Date,
  to: Date,
): Promise<ForecastRow[]> {
  const rows: ForecastRow[] = [];
  for (let offset = 0; ; offset += FORECAST_PAGE_SIZE) {
    const { data, error } = await client
      .from("enhanced_forecasts")
      .select(
        "beach_id, forecast_at, wave_height, swell_period_om, swell_direction_om, wind_speed, wind_direction_deg, om_fetched_at, wind_model_run_at, updated_at",
      )
      .in("beach_id", beachIds)
      .gte("forecast_at", from.toISOString())
      .lte("forecast_at", to.toISOString())
      .order("forecast_at", { ascending: true })
      .order("beach_id", { ascending: true })
      .range(offset, offset + FORECAST_PAGE_SIZE - 1);

    if (error) throw new BriefingInputError("forecast_read_failed");
    const page = (data ?? []) as unknown as ForecastRow[];
    rows.push(...page);
    if (page.length < FORECAST_PAGE_SIZE) return rows;
  }
}

export async function buildBriefingInput(args: {
  client: Client;
  userId: string;
  regionSlug: string;
  now: Date;
}): Promise<SwellBriefingInputSnapshot> {
  const region = BRIEFING_REGIONS[args.regionSlug];
  if (!region) throw new BriefingInputError("unknown_region", 400);

  const { client, userId, now } = args;
  const editionDate = localDate(now, region.timezone);

  const { data: beachRows, error: beachError } = await client
    .from("beaches")
    .select("id, name, aspect_deg, wind_offshore_deg, wind_offshore_tol_deg")
    .gte("lat", region.bounds.minLat)
    .lte("lat", region.bounds.maxLat)
    .gte("lon", region.bounds.minLon)
    .lte("lon", region.bounds.maxLon);

  if (beachError) throw new BriefingInputError("beach_read_failed");
  const beaches = new Map<string, BeachRow>(
    ((beachRows ?? []) as unknown as BeachRow[]).map((beach) => [beach.id, beach]),
  );
  if (beaches.size === 0) throw new BriefingInputError("region_has_no_beaches", 409);

  // The home beach anchors the day-by-day wind read; the region as a whole
  // supplies the exposure and week ranges.
  const { data: profile } = await client
    .from("profiles")
    .select("home_beach_id")
    .eq("id", userId)
    .maybeSingle();
  const homeBeachId = (profile as { home_beach_id: string | null } | null)?.home_beach_id ?? null;
  const homeBeach = (homeBeachId && beaches.get(homeBeachId)) || [...beaches.values()][0];

  const horizonEnd = new Date(now.getTime());
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + WEEK_DAYS + 1);

  const rows = await loadForecastRows(
    client,
    [...beaches.keys()],
    new Date(now.getTime() - 12 * 60 * 60 * 1000),
    horizonEnd,
  );
  if (rows.length === 0) throw new BriefingInputError("no_forecast_data", 409);

  const byDay = groupByDay(rows, region.timezone);
  const todayRows = byDay.get(editionDate) ?? [];

  // The dominant swell today, read from the largest rows rather than averaged,
  // so the direction belongs to the swell the reader is being told about.
  const dominant = todayRows
    .map((row) => ({ row, ft: heightFt(row) }))
    .filter((entry): entry is { row: ForecastRow; ft: number } => entry.ft !== null)
    .sort((a, b) => b.ft - a.ft)[0]?.row;

  const briefing: SwellBriefing = {
    editionDate,
    regionLabel: region.label,
    headline: "Today's surf across the region.",
    generatedAt: now.toISOString(),
    dataAt: sourcePublishedAt(rows) ?? now.toISOString(),
    // Serving recomputes this; the stored value is only a starting point.
    freshness: "fresh",
    photo: null,
    today: {
      date: editionDate,
      exposures: buildExposures(todayRows, beaches),
      primaryDirectionDeg: dominant?.swell_direction_om ?? null,
      primaryDirectionLabel: dominant?.swell_direction_om != null
        ? `${compassLabel(dominant.swell_direction_om)} SWELL`
        : null,
      primaryPeriodS: dominant?.swell_period_om ?? null,
      call: null,
    },
    next48: buildNext48(byDay, editionDate, region.timezone, homeBeach),
    week: buildWeek(byDay, editionDate, beaches),
    advisories: [],
  };

  const revision = sourceRevision(briefing);

  // Unchanged measurements reuse the issued snapshot, so a refetch does not
  // invalidate the worker's deduplication or churn a new edition.
  const existing = await loadLatestBriefingInput(client, userId, region.slug, editionDate);
  if (existing && existing.provenance?.sourceHashes?.[0] === revision) return existing;

  const published = sourcePublishedAt(rows) ?? now.toISOString();
  const snapshot: SwellBriefingInputSnapshot = {
    schemaVersion: 1,
    userId,
    region: region.slug,
    editionDate,
    sourcePublishedAt: published,
    // An edition is good until the end of the following local day; after that
    // the saved briefing is withheld rather than shown as current.
    validUntil: zonedWallClockToUtc(addDays(editionDate, 1), "23:59:59.000", region.timezone),
    briefing,
    copyFacts: buildCopyFacts(briefing),
    provenance: {
      sourceIds: [`enhanced_forecasts:${region.slug}:${editionDate}`],
      sourceHashes: [revision],
      generationInputVersion: BRIEFING_INPUT_VERSION,
    },
    inputHash: "",
  };
  snapshot.inputHash = briefingInputHash(snapshot as unknown as Record<string, unknown>);

  await saveBriefingInput(client, snapshot);
  return snapshot;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function compassLabel(deg: number): string {
  const index = Math.round((((deg % 360) + 360) % 360) / 22.5) % COMPASS.length;
  return COMPASS[index];
}
