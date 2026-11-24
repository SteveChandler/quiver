/**
 * Backtests the opt-in storm class (STORM_EVENT_THRESHOLDS) on San Diego buoy history: runs the
 * swell-event detector over the last three Nov-Mar winters of NDBC 46224 (Oceanside Offshore) and
 * 46266 (Del Mar Nearshore) and checks it against the stored big swells in lib/data/big-swells.json.
 *
 *   node --import tsx scripts/backtest-storm-class.ts [--face=5] [--rise=3] [--ratio=2.5] [--period=7]
 *
 * Each buoy reading becomes one forecast row with a single partition (Hs in ft, dominant period,
 * mean wave direction) at a test beach with a wide W/SW window, so the run measures the class
 * rules rather than exposure. Downloads are cached in .cache/big-swells/, shared with
 * scripts/big-swells/build-big-swells.ts. No database access, no credentials.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { gunzipSync } from "node:zlib";

import { parseNdbcStdmet, type NdbcRecord } from "@/lib/climatology/parse-ndbc";
import {
  detectBeachSwellEvents,
  swellPartitionFaceHeightFt,
  type BeachSwellEvent,
  type SwellEventBeach,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events/detector";
import { STORM_EVENT_THRESHOLDS, SWELL_EVENT_THRESHOLDS } from "@/lib/alerts/swell-events/exposure";

const CACHE_DIR = ".cache/big-swells";
const BIG_SWELLS = "lib/data/big-swells.json";
const NDBC = "https://www.ndbc.noaa.gov";
const USER_AGENT = "QuiverSurf/1.0 (https://www.quiversurf.app; storm-class-backtest)";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_CODES = "123456789abc";

const STATIONS = ["46224", "46266"];
const WINTER_START_YEARS = [2023, 2024, 2025];
const TIMEZONE = "America/Los_Angeles";
const M_TO_FT = 3.28084;
const HOUR_MS = 3_600_000;
const MATCH_MS = 36 * HOUR_MS;
const BASELINE_LOOKBACK_MS = 48 * HOUR_MS;
const MAX_STORM_EVENTS_PER_MONTH = 4;
// Misses traced to the detector's shared baseline gap (the first day with data after an event has no
// baseline, in both passes) are not the storm class's fault, so criterion 1 leaves them out. See the doc.
const DETECTOR_GAP_MISSES = new Set(["46224 2024-01-07T14:56:00.000Z"]);

const OVERRIDE_FLAGS = {
  face: "minPeakFaceHeightFt",
  rise: "minFaceRiseFt",
  ratio: "minEnergyRatio",
  period: "minPeriodS",
} as const;

const BEACH: SwellEventBeach = {
  id: "storm-class-backtest",
  name: "Backtest beach (W/SW window)",
  swell_window_center_deg: 250,
  swell_window_halfwidth_deg: 90,
  swell_access_factors: null,
  terrain_enabled: false,
  shoaling_factors: null,
  deepwater_decay_factor: null,
};

interface StoredBigSwell {
  at: string;
  hsM: number;
  periodS: number;
  dirDeg: number | null;
  name?: string;
}

interface StoredStation {
  id: string;
  name: string;
  biggest: StoredBigSwell[];
  recent: StoredBigSwell[];
}

interface Winter {
  label: string;
  startMs: number;
  endMs: number;
}

interface CompleteReading {
  timeUtcMs: number;
  waveHeightM: number;
  dominantPeriodS: number;
  meanWaveDirDeg: number;
}

interface MatchSummary {
  matched: number;
  total: number;
  gapMisses: number;
}

interface StationRun {
  id: string;
  name: string;
  sources: string[];
  readings: CompleteReading[];
  events: BeachSwellEvent[];
}

const localParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function local(ms: number): { date: string; month: string; hour: number; label: string } {
  const parts = Object.fromEntries(localParts.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, month: date.slice(0, 7), hour: Number(parts.hour), label: `${date} ${parts.hour}:${parts.minute}` };
}

// All three Nov 1 and Apr 1 local midnights fall in PDT (UTC-7).
function winters(): Winter[] {
  return WINTER_START_YEARS.map((year) => ({
    label: `Nov ${year}-Mar ${year + 1}`,
    startMs: Date.UTC(year, 10, 1, 7),
    endMs: Date.UTC(year + 1, 3, 1, 7),
  }));
}

async function fetchStdmet(url: string, file: string): Promise<NdbcRecord[] | null> {
  const path = join(CACHE_DIR, file);
  let body: Buffer;
  if (existsSync(path)) {
    body = await readFile(path);
  } else {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    await delay(300);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
    body = Buffer.from(await response.arrayBuffer());
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path, body);
  }
  return parseNdbcStdmet(gunzipSync(body).toString("utf8"));
}

/** The yearly archive when NDBC has published it, else that year's closed monthly files. */
async function loadYear(id: string, year: number, monthIndexes: number[], sources: string[]): Promise<NdbcRecord[]> {
  const yearlyFile = `${id}h${year}.txt.gz`;
  const yearly = await fetchStdmet(`${NDBC}/data/historical/stdmet/${yearlyFile}`, yearlyFile);
  if (yearly) {
    sources.push(`historical/stdmet/${yearlyFile}`);
    return yearly;
  }
  const records: NdbcRecord[] = [];
  for (const index of monthIndexes) {
    const file = `${id}${MONTH_CODES[index]}${year}.txt.gz`;
    const monthly = await fetchStdmet(`${NDBC}/data/stdmet/${MONTHS[index]}/${file}`, file);
    if (!monthly) {
      sources.push(`stdmet/${MONTHS[index]}/${file} (not published)`);
      continue;
    }
    sources.push(`stdmet/${MONTHS[index]}/${file}`);
    records.push(...monthly);
  }
  return records;
}

function isComplete(record: NdbcRecord): record is NdbcRecord & CompleteReading {
  return record.waveHeightM !== null && record.waveHeightM > 0
    && record.dominantPeriodS !== null && record.dominantPeriodS > 0
    && record.meanWaveDirDeg !== null;
}

async function loadReadings(id: string, sources: string[]): Promise<CompleteReading[]> {
  const winterMonths = [10, 11];
  const springMonths = [0, 1, 2];
  const years = new Set(WINTER_START_YEARS.flatMap((year) => [year, year + 1]));
  const records: NdbcRecord[] = [];
  for (const year of [...years].sort()) {
    const monthIndexes = [
      ...(WINTER_START_YEARS.includes(year - 1) ? springMonths : []),
      ...(WINTER_START_YEARS.includes(year) ? winterMonths : []),
    ];
    records.push(...await loadYear(id, year, monthIndexes, sources));
  }
  const byTime = new Map(records.filter(isComplete).map((record) => [record.timeUtcMs, record]));
  return [...byTime.values()]
    .map(({ timeUtcMs, waveHeightM, dominantPeriodS, meanWaveDirDeg }) => ({ timeUtcMs, waveHeightM, dominantPeriodS, meanWaveDirDeg }))
    .sort((left, right) => left.timeUtcMs - right.timeUtcMs);
}

function toForecastRow(reading: CompleteReading): SwellEventForecastRow {
  return {
    forecast_at: new Date(reading.timeUtcMs).toISOString(),
    swell_1_height: `${(reading.waveHeightM * M_TO_FT).toFixed(2)} ft`,
    swell_1_period: String(reading.dominantPeriodS),
    swell_1_direction: String(reading.meanWaveDirDeg),
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
  };
}

function faceFt(reading: CompleteReading): number {
  return swellPartitionFaceHeightFt(
    [{ heightFt: reading.waveHeightM * M_TO_FT, periodS: reading.dominantPeriodS, directionDeg: reading.meanWaveDirDeg }],
    BEACH,
  ) ?? 0;
}

function isDaylight(ms: number): boolean {
  const { hour } = local(ms);
  return hour >= SWELL_EVENT_THRESHOLDS.daylightStartHour && hour < SWELL_EVENT_THRESHOLDS.daylightEndHour;
}

function detectWinter(readings: CompleteReading[], winter: Winter): BeachSwellEvent[] {
  const forecasts = readings
    .filter((reading) => reading.timeUtcMs >= winter.startMs - BASELINE_LOOKBACK_MS && reading.timeUtcMs < winter.endMs)
    .map(toForecastRow);
  return detectBeachSwellEvents(
    { beach: BEACH, forecasts, now: new Date(winter.startMs), timezone: TIMEZONE },
    { stormClass: true, horizonDays: 400 },
  ).filter((event) => {
    const peak = Date.parse(event.peakAt);
    return peak >= winter.startMs && peak < winter.endMs;
  });
}

/** Storm events whose peaks sit within 36 h of each other, as one weather episode. */
function stormEpisodes(events: BeachSwellEvent[]): BeachSwellEvent[][] {
  const episodes: BeachSwellEvent[][] = [];
  for (const event of events.filter((candidate) => candidate.kind === "storm")) {
    const last = episodes[episodes.length - 1];
    const lastPeak = last ? Date.parse(last[last.length - 1].peakAt) : -Infinity;
    if (last && Date.parse(event.peakAt) - lastPeak <= MATCH_MS) last.push(event);
    else episodes.push([event]);
  }
  return episodes;
}

function fixed(value: number, digits = 1): string {
  return value.toFixed(digits);
}

function hoursBetween(fromMs: number, toMs: number): string {
  const hours = Math.round((toMs - fromMs) / HOUR_MS);
  return `${hours >= 0 ? "+" : ""}${hours} h`;
}

function table(headers: string[], rows: string[][]): string {
  const lines = [headers, headers.map(() => "---"), ...rows];
  return lines.map((cells) => `| ${cells.join(" | ")} |`).join("\n");
}

function monthsOf(winter: Winter): string[] {
  const start = new Date(winter.startMs);
  return Array.from({ length: 5 }, (_, offset) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
    return date.toISOString().slice(0, 7);
  });
}

function nearest(events: BeachSwellEvent[], atMs: number): BeachSwellEvent | null {
  let best: BeachSwellEvent | null = null;
  for (const event of events) {
    if (!best || Math.abs(Date.parse(event.peakAt) - atMs) < Math.abs(Date.parse(best.peakAt) - atMs)) best = event;
  }
  return best;
}

function describeNearest(event: BeachSwellEvent | null, atMs: number): string {
  if (!event) return "none";
  const kind = event.kind ?? "swell";
  return `${kind} ${event.peakLocalDate} ${fixed(event.periodS)} s ${fixed(event.peakFaceHeightFt)} ft (${hoursBetween(atMs, Date.parse(event.peakAt))})`;
}

function printEvents(run: StationRun, winter: Winter): void {
  const events = run.events.filter((event) => Date.parse(event.peakAt) >= winter.startMs && Date.parse(event.peakAt) < winter.endMs);
  console.log(`\n### ${run.id} ${winter.label}: ${events.filter((e) => e.kind === "storm").length} storm, ${events.filter((e) => e.kind !== "storm").length} swell events\n`);
  console.log(table(
    ["kind", "peak (PT)", "band", "dir", "period s", "Hs ft", "face ft", "base face ft", "ratio", "key"],
    events.map((event) => [
      event.kind ?? "swell",
      local(Date.parse(event.peakAt)).label,
      event.directionBand,
      fixed(event.directionDeg, 0),
      fixed(event.periodS, 2),
      fixed(event.peakOffshoreHeightFt),
      fixed(event.peakFaceHeightFt),
      fixed(event.baselineFaceHeightFt),
      fixed(event.energyRatio),
      event.eventKey.slice(BEACH.id.length + 1),
    ]),
  ));
}

function printMatches(runs: StationRun[], stored: StoredStation[], seasons: Winter[]): MatchSummary {
  const summary: MatchSummary = { matched: 0, total: 0, gapMisses: 0 };
  const excluded: string[][] = [];
  console.log("\n## (b) Stored big swells inside the winters (period < 11 s must match a storm event within 36 h)\n");
  const rows: string[][] = [];
  for (const run of runs) {
    const station = stored.find((candidate) => candidate.id === run.id);
    if (!station) throw new Error(`${run.id} missing from ${BIG_SWELLS}`);
    const entries = new Map<string, StoredBigSwell & { lists: string[] }>();
    for (const [list, swells] of [["recent", station.recent], ["biggest", station.biggest]] as const) {
      for (const swell of swells) {
        const entry = entries.get(swell.at) ?? { ...swell, lists: [] };
        entry.lists.push(list);
        entries.set(swell.at, entry);
      }
    }
    const inside = [...entries.values()]
      .filter((entry) => seasons.some((winter) => Date.parse(entry.at) >= winter.startMs && Date.parse(entry.at) < winter.endMs))
      .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
    const storms = run.events.filter((event) => event.kind === "storm");
    for (const entry of inside) {
      const atMs = Date.parse(entry.at);
      const nearestAny = nearest(run.events, atMs);
      if (entry.periodS >= SWELL_EVENT_THRESHOLDS.minPeriodS) {
        const matched = nearestAny && Math.abs(Date.parse(nearestAny.peakAt) - atMs) <= MATCH_MS;
        excluded.push([run.id, local(atMs).label, entry.lists.join("+"), fixed(entry.hsM, 2), fixed(entry.periodS, 2), String(entry.dirDeg ?? "-"), matched ? "yes" : "no", describeNearest(nearestAny, atMs)]);
        continue;
      }
      const nearestStorm = nearest(storms, atMs);
      const matched = nearestStorm !== null && Math.abs(Date.parse(nearestStorm.peakAt) - atMs) <= MATCH_MS;
      const gapMiss = !matched && DETECTOR_GAP_MISSES.has(`${run.id} ${entry.at}`);
      summary.total += 1;
      if (matched) summary.matched += 1;
      if (gapMiss) summary.gapMisses += 1;
      const around = run.readings.filter((reading) => Math.abs(reading.timeUtcMs - atMs) <= MATCH_MS && isDaylight(reading.timeUtcMs));
      const best = around.reduce<{ face: number; reading: CompleteReading | null }>((max, reading) => {
        const face = faceFt(reading);
        return face > max.face ? { face, reading } : max;
      }, { face: 0, reading: null });
      const stormBand = around.filter((reading) => reading.dominantPeriodS >= STORM_EVENT_THRESHOLDS.minPeriodS && reading.dominantPeriodS < SWELL_EVENT_THRESHOLDS.minPeriodS);
      const bestStormBandFace = stormBand.reduce((max, reading) => Math.max(max, faceFt(reading)), 0);
      rows.push([
        run.id,
        local(atMs).label,
        entry.lists.join("+"),
        fixed(entry.hsM, 2),
        fixed(entry.periodS, 2),
        String(entry.dirDeg ?? "-"),
        matched ? "**yes**" : gapMiss ? "NO (detector gap, excluded)" : "**NO**",
        describeNearest(nearestStorm, atMs),
        describeNearest(nearestAny, atMs),
        best.reading ? `${fixed(best.face)} ft @ ${fixed(best.reading.dominantPeriodS, 2)} s` : "no daylight data",
        stormBand.length > 0 ? `${fixed(bestStormBandFace)} ft` : `no ${STORM_EVENT_THRESHOLDS.minPeriodS}-11 s hour`,
      ]);
    }
  }
  console.log(table(
    ["station", "stored peak (PT)", "list", "Hs m", "DPD s", "MWD", "storm match", "nearest storm event", "nearest any event", "max daylight face ±36 h", `max daylight face ±36 h, ${STORM_EVENT_THRESHOLDS.minPeriodS}-11 s`],
    rows,
  ));
  console.log("\nExcluded from the storm criterion (period >= 11 s); any-event match shown for reference:\n");
  console.log(table(["station", "stored peak (PT)", "list", "Hs m", "DPD s", "MWD", "any event ±36 h", "nearest any event"], excluded));
  return summary;
}

function printMonthly(runs: StationRun[], seasons: Winter[]): boolean {
  let allWithin = true;
  console.log("\n## (c) Storm events per month (raw count / 36 h episodes; swell events and days with data for reference)\n");
  const months = seasons.flatMap(monthsOf);
  const rows: string[][] = months.map((month) => [month]);
  const summary: string[][] = [];
  for (const run of runs) {
    const episodes = stormEpisodes(run.events);
    const daysWithData = new Map<string, Set<string>>();
    for (const reading of run.readings) {
      const { date, month } = local(reading.timeUtcMs);
      daysWithData.set(month, (daysWithData.get(month) ?? new Set()).add(date));
    }
    let storms = 0;
    let episodeCount = 0;
    let monthsWithData = 0;
    months.forEach((month, index) => {
      const monthStorms = run.events.filter((event) => event.kind === "storm" && event.peakLocalDate.startsWith(month)).length;
      const monthEpisodes = episodes.filter((episode) => episode[0].peakLocalDate.startsWith(month)).length;
      const monthSwells = run.events.filter((event) => event.kind !== "storm" && event.peakLocalDate.startsWith(month)).length;
      const days = daysWithData.get(month)?.size ?? 0;
      if (days > 0) monthsWithData += 1;
      storms += monthStorms;
      episodeCount += monthEpisodes;
      rows[index].push(`${monthStorms} / ${monthEpisodes}`, String(monthSwells), String(days));
    });
    const average = monthsWithData > 0 ? storms / monthsWithData : 0;
    const averageEpisodes = monthsWithData > 0 ? episodeCount / monthsWithData : 0;
    if (average > MAX_STORM_EVENTS_PER_MONTH) allWithin = false;
    summary.push([run.id, String(storms), String(episodeCount), String(monthsWithData), fixed(average, 2), fixed(averageEpisodes, 2), average <= MAX_STORM_EVENTS_PER_MONTH ? "pass" : "FAIL"]);
  }
  console.log(table(["month", ...runs.flatMap((run) => [`${run.id} storm / episodes`, `${run.id} swell`, `${run.id} days w/ data`])], rows));
  console.log("");
  console.log(table(["station", "storm events", "storm episodes", "months with data", "storm events / month", "episodes / month", `<= ${MAX_STORM_EVENTS_PER_MONTH}`], summary));
  return allWithin;
}

/** `--face=4.5` etc. try a value for this run only; the shipped value lives in exposure.ts. */
function applyOverrides(): void {
  for (const [flag, key] of Object.entries(OVERRIDE_FLAGS)) {
    const raw = process.argv.find((arg) => arg.startsWith(`--${flag}=`))?.slice(flag.length + 3);
    if (raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`--${flag} needs a number, got "${raw}"`);
    (STORM_EVENT_THRESHOLDS as Record<string, number>)[key] = value;
  }
}

async function main(): Promise<void> {
  applyOverrides();
  const stored = (JSON.parse(await readFile(BIG_SWELLS, "utf8")) as { stations: StoredStation[] }).stations;
  const seasons = winters();
  console.log(`# Storm-class backtest (${new Date().toISOString().slice(0, 10)})\n`);
  console.log(`STORM_EVENT_THRESHOLDS = ${JSON.stringify(STORM_EVENT_THRESHOLDS)}`);
  console.log(`Swell pass: period >= ${SWELL_EVENT_THRESHOLDS.minPeriodS} s, face >= ${SWELL_EVENT_THRESHOLDS.minPeakFaceHeightFt} ft, rise >= ${SWELL_EVENT_THRESHOLDS.minFaceRiseFt} ft or ratio >= ${SWELL_EVENT_THRESHOLDS.minEnergyRatio}`);
  console.log(`Beach window ${BEACH.swell_window_center_deg}±${BEACH.swell_window_halfwidth_deg}°, timezone ${TIMEZONE}, winters: ${seasons.map((winter) => winter.label).join(", ")}`);

  const runs: StationRun[] = [];
  for (const id of STATIONS) {
    const sources: string[] = [];
    const readings = await loadReadings(id, sources);
    const events = seasons.flatMap((winter) => detectWinter(readings, winter));
    const name = stored.find((station) => station.id === id)?.name ?? id;
    runs.push({ id, name, sources, readings, events });
    console.log(`\n${id} (${name}): ${readings.length} complete readings from ${sources.join(", ")}`);
  }

  console.log("\n## (a) Events per station and winter");
  for (const run of runs) {
    for (const winter of seasons) printEvents(run, winter);
  }

  const matches = printMatches(runs, stored, seasons);
  const withinRate = printMonthly(runs, seasons);

  const storms = runs.flatMap((run) => run.events.filter((event) => event.kind === "storm"));
  const degenerate = storms.filter((event) => event.baselineFaceHeightFt === 0).length;
  console.log(`\nStorm events with a zero baseline (rise = face, ratio capped at 99): ${degenerate} of ${storms.length}`);
  const scored = matches.total - matches.gapMisses;
  console.log(`\nCriterion 1, every stored big event under ${SWELL_EVENT_THRESHOLDS.minPeriodS} s matched by a storm event, detector-gap misses excluded: ${matches.matched} of ${scored}, ${matches.matched === scored ? "PASS" : "FAIL"} (raw ${matches.matched} of ${matches.total})`);
  console.log(`Criterion 2, storm events average <= ${MAX_STORM_EVENTS_PER_MONTH} per winter month at each station: ${withinRate ? "PASS" : "FAIL"}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
