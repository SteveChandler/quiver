/**
 * Builds lib/data/big-swells.json: the biggest and most recent big swells measured at each
 * NDBC buoy that is the nearest wave buoy (within 100 km) to a Quiver beach.
 *
 *   yarn tsx scripts/big-swells/build-big-swells.ts [--station=44065]
 *
 * Sources: NDBC historical stdmet archives (one file per year), this year's monthly files, and
 * the 45-day realtime2 file. Downloads are cached in .cache/big-swells/ (realtime ones are
 * refetched). No database access, no credentials. Rerun to pick up new big swells.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { gunzipSync } from "node:zlib";

import { parseNdbcStdmet, type NdbcRecord } from "@/lib/climatology/parse-ndbc";
import { pickBigSwells, type BigSwellBuoy } from "@/lib/big-swells";

const CACHE_DIR = ".cache/big-swells";
const OUTPUT = "lib/data/big-swells.json";
const NDBC = "https://www.ndbc.noaa.gov";
const USER_AGENT = "QuiverSurf/1.0 (https://www.quiversurf.app; big-swells)";
const YEAR_MS = 365.25 * 24 * 3_600_000;
const MIN_HISTORY_MS = 5 * YEAR_MS;
const MAX_SILENCE_MS = 1.5 * YEAR_MS;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Nearest active NDBC wave buoy within 100 km of each public beach (prod, 2026-10-23):
// select distinct nearest station_id from ndbc_direct_stations where has_wave_data and active
// and station_type = 'buoy', per beach, keeping distance <= 100 km. 491 of 572 beaches.
const STATION_IDS = [
  "41025", "41029", "41038", "41053", "41056", "41067", "41068", "41070", "41076", "41110",
  "41112", "41113", "41114", "41115", "41117", "41120", "41122", "41159", "42012", "42013",
  "42028", "42035", "42043", "42044", "42092", "42098", "44007", "44013", "44030", "44056",
  "44065", "44069", "44074", "44084", "44085", "44086", "44087", "44090", "44091", "44095",
  "44097", "44099", "46013", "46014", "46015", "46025", "46027", "46041", "46042", "46053",
  "46087", "46088", "46092", "46097", "46099", "46119", "46128", "46206", "46211", "46215",
  "46218", "46221", "46222", "46224", "46229", "46235", "46236", "46237", "46239", "46240",
  "46243", "46244", "46253", "46254", "46256", "46266", "46268", "46274", "46277", "46278",
  "46280", "46285", "46286", "51045", "51201", "51202", "51205", "51208", "51210", "51211",
  "51212", "ssbn7",
];

async function fetchBody(url: string, cacheName: string | null): Promise<Buffer | null> {
  const path = cacheName ? join(CACHE_DIR, cacheName) : null;
  if (path && existsSync(path)) return readFile(path);

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  await delay(300);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (path) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path, body);
  }
  return body;
}

async function listFiles(dir: string, pattern: RegExp): Promise<string[]> {
  const body = await fetchBody(`${NDBC}/${dir}/`, null);
  return [...new Set(body?.toString("utf8").match(pattern) ?? [])];
}

async function loadStation(id: string, files: { yearly: string[]; monthly: string[][] }): Promise<NdbcRecord[]> {
  const records: NdbcRecord[] = [];
  const add = (body: Buffer | null, gz: boolean): void => {
    if (body) records.push(...parseNdbcStdmet((gz ? gunzipSync(body) : body).toString("utf8")));
  };

  // Realtime first: on a shared timestamp the archived (quality-controlled) reading wins below.
  add(await fetchBody(`${NDBC}/data/realtime2/${id.toUpperCase()}.txt`, null), false);
  for (const file of files.yearly.filter((name) => name.startsWith(`${id}h`))) {
    add(await fetchBody(`${NDBC}/data/historical/stdmet/${file}`, file), true);
  }
  // This year's closed months are <id><month code>YYYY.txt.gz; the latest month is a plain <id>.txt.
  for (const [index, month] of MONTHS.entries()) {
    const own = new RegExp(`^${id}(?:[1-9abc]\\d{4}\\.txt\\.gz|\\.txt)$`);
    for (const file of files.monthly[index].filter((name) => own.test(name))) {
      add(await fetchBody(`${NDBC}/data/stdmet/${month}/${file}`, file.endsWith(".gz") ? file : null), file.endsWith(".gz"));
    }
  }

  // Monthly and realtime files overlap; keep one reading per timestamp.
  const byTime = new Map(records.map((record) => [record.timeUtcMs, record]));
  return [...byTime.values()];
}

/**
 * Median buoy/model Hs over the last 45 days (the realtime2 window). Sheltered buoys read well
 * below the 0.25-degree wave model, so the route skips the forecast comparison when this is off.
 */
async function modelRatio(id: string, lat: number, lon: number, records: NdbcRecord[]): Promise<number | null> {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "wave_height",
    models: "ecmwf_wam025",
    past_days: "45",
    forecast_days: "1",
    timezone: "UTC",
  }).toString();
  const hourly = JSON.parse((await fetchBody(url.toString(), null))?.toString("utf8") ?? "{}")?.hourly;
  const model = new Map<number, number>();
  for (const [index, time] of (hourly?.time ?? []).entries()) {
    const hs = hourly.wave_height?.[index];
    if (typeof hs === "number" && hs >= 0.3) model.set(Date.parse(`${time}Z`) / 3_600_000, hs);
  }
  const ratios = records
    .map((record) => {
      const hs = model.get(Math.round(record.timeUtcMs / 3_600_000));
      return hs && record.waveHeightM !== null ? record.waveHeightM / hs : null;
    })
    .filter((ratio): ratio is number => ratio !== null)
    .sort((a, b) => a - b);
  if (ratios.length < 100) {
    console.warn(`${id}: ${ratios.length} model pairs, no ratio`);
    return null;
  }
  return Math.round(ratios[Math.floor(ratios.length / 2)] * 100) / 100;
}

async function main(): Promise<void> {
  const only = process.argv.find((arg) => arg.startsWith("--station="))?.slice("--station=".length);
  const ids = only ? [only] : STATION_IDS;

  const meta = (await fetchBody(`${NDBC}/activestations.xml`, null))?.toString("utf8") ?? "";
  const yearly = await listFiles("data/historical/stdmet", /[0-9a-z]+h\d{4}\.txt\.gz/g);
  const monthly = await Promise.all(
    MONTHS.map((month) => listFiles(`data/stdmet/${month}`, /[0-9a-z]+(?:[1-9abc]\d{4}\.txt\.gz|\.txt)/g)),
  );

  const stations: BigSwellBuoy[] = [];
  for (const id of ids) {
    const tag = new RegExp(`<station id="${id}" lat="([-\\d.]+)" lon="([-\\d.]+)"[^>]* name="([^"]*)"`, "i").exec(meta);
    if (!tag) {
      console.warn(`${id}: not in activestations.xml, skipped`);
      continue;
    }
    const records = await loadStation(id, { yearly, monthly });
    const { bigHsM, biggest, recent } = pickBigSwells(records);
    if (biggest.length === 0) {
      console.warn(`${id}: no wave heights, skipped`);
      continue;
    }
    const times = records.filter((record) => record.waveHeightM !== null).map((record) => record.timeUtcMs);
    const first = times.reduce((a, b) => Math.min(a, b));
    const last = times.reduce((a, b) => Math.max(a, b));
    const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
    // "Biggest since <year>" needs years behind it, and a buoy that went quiet can't stand in for today's sea.
    if (last - first < MIN_HISTORY_MS || Date.now() - last > MAX_SILENCE_MS) {
      console.warn(`${id}: history ${day(first)} to ${day(last)} too short or stale, skipped`);
      continue;
    }
    stations.push({
      id,
      name: tag[3].trim(),
      lat: Number(tag[1]),
      lon: Number(tag[2]),
      since: day(first),
      through: day(last),
      bigHsM,
      modelRatio: await modelRatio(id, Number(tag[1]), Number(tag[2]), records),
      biggest,
      recent,
    });
    const added = stations[stations.length - 1];
    console.log(`${id}: ${times.length} readings since ${day(first)}, big >= ${bigHsM} m, model ratio ${added.modelRatio}, top ${biggest[0].hsM} m ${biggest[0].at.slice(0, 10)}`);
  }

  if (only) {
    console.log(JSON.stringify(stations[0], null, 2));
    return;
  }
  await writeFile(OUTPUT, `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), stations }, null, 1)}\n`);
  console.log(`wrote ${stations.length} stations to ${OUTPUT}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
