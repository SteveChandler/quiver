/**
 * Copernicus Marine In Situ near-real-time moorings (European wave buoys and
 * platforms). Licence, variables and provider choices are in ./parsers.ts.
 *
 * Storage: public S3-compatible bucket, one NetCDF file per platform per UTC
 * day under latest/YYYYMMDD/, rewritten through the day.
 * - Registry (daily): list the last 7 days of latest/ (about 4 listing pages
 *   a day) and read the global attributes of each platform's newest file
 *   (~800 files, ~67 MB). Any file that still fails after retries fails the
 *   whole source, so a partial list never deactivates stations.
 * - Latest (hourly, via the station history queue): one listing of today's
 *   prefix (and yesterday's before 06:00 UTC) per run; a station's file is
 *   downloaded only when its LastModified is newer than the one stored in
 *   txt_last_modified.
 */

import type {
  SourceObservation,
  SourceStation,
  StationHistoryResult,
  WaveStationSourceAdapter,
} from "../types";
import { readNetcdf, type NcFile } from "./netcdf";
import {
  CMEMS_VARIABLES,
  newestFilePerPlatform,
  parseCmemsObservations,
  parseCmemsStation,
  parseListingPage,
  parseMooringKey,
  utcDay,
  type MooringFile,
  type StationSkipReason,
} from "./parsers";

const BUCKET_URL = "https://s3.waw3-1.cloudferro.com/mdl-native-01";
export const DATASET_PREFIX =
  "native/INSITU_GLO_PHYBGCWAV_DISCRETE_MYNRT_013_030/cmems_obs-ins_glo_phybgcwav_mynrt_na_irr_202311/";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_LISTING_PAGES_PER_DAY = 20;
const REGISTRY_DAYS = 7;
const REGISTRY_CONCURRENCY = 6;
const REGISTRY_BUDGET_MS = 150_000;
const FILE_RETRIES = 2;
/**
 * Before this UTC hour the latest phase also reads yesterday's file: readings
 * land 2.4 h (median) to 3.5 h (95th percentile) after they are taken, up to
 * 6 h for the slowest provider, so 23:xx readings arrive in the early hours.
 */
const YESTERDAY_UNTIL_UTC_HOUR = 6;
/** Rows up to this much older than the newest stored are resent (see historyOverlapMinutes). */
const HISTORY_OVERLAP_MINUTES = 180;
/** A cached listing serves one cron run; a warm instance lists again next run. */
const LISTING_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= FILE_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      // 404 is an answer, not a transient failure.
      if (res.ok || res.status === 404) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Copernicus ${url.slice(BUCKET_URL.length)} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export function listingUrl(day: string, continuationToken: string | null): string {
  const params = new URLSearchParams({ "list-type": "2", prefix: `${DATASET_PREFIX}latest/${day}/`, "max-keys": "1000" });
  if (continuationToken) params.set("continuation-token", continuationToken);
  return `${BUCKET_URL}?${params.toString()}`;
}

/** Every mooring file of one UTC day (empty when the day has no folder yet). */
async function listDay(day: string): Promise<MooringFile[]> {
  const files: MooringFile[] = [];
  let token: string | null = null;
  for (let page = 0; page < MAX_LISTING_PAGES_PER_DAY; page++) {
    const res = await fetchWithRetry(listingUrl(day, token));
    if (!res.ok) throw new Error(`Copernicus listing ${day} failed: HTTP ${res.status}`);
    const parsed = parseListingPage(await res.text());
    for (const entry of parsed.entries) {
      const file = parseMooringKey(entry, DATASET_PREFIX);
      if (file) files.push(file);
    }
    token = parsed.nextToken;
    if (!token) return files;
  }
  throw new Error(`Copernicus listing ${day}: more than ${MAX_LISTING_PAGES_PER_DAY} pages`);
}

async function listDays(days: string[]): Promise<MooringFile[]> {
  const perDay = await Promise.all(days.map((day) => listDay(day)));
  return perDay.flat();
}

let latestListing: { key: string; expiresAt: number; promise: Promise<Map<string, MooringFile[]>> } | null = null;

/** Days the latest phase reads at `nowMs`: today, plus yesterday before 06:00 UTC. */
export function latestDays(nowMs: number): string[] {
  const today = utcDay(nowMs);
  return new Date(nowMs).getUTCHours() < YESTERDAY_UNTIL_UTC_HOUR ? [today, utcDay(nowMs - DAY_MS)] : [today];
}

/** Files per platform for the latest phase, listed once per run (the promise is shared by every station). */
function latestFilesByPlatform(nowMs: number): Promise<Map<string, MooringFile[]>> {
  const days = latestDays(nowMs);
  const key = days.join(",");
  if (latestListing && latestListing.key === key && latestListing.expiresAt > Date.now()) return latestListing.promise;
  const promise = listDays(days).then((files) => {
    const byPlatform = new Map<string, MooringFile[]>();
    for (const file of files) byPlatform.set(file.platformCode, [...(byPlatform.get(file.platformCode) ?? []), file]);
    return byPlatform;
  });
  latestListing = { key, expiresAt: Date.now() + LISTING_TTL_MS, promise };
  promise.catch(() => {
    if (latestListing?.promise === promise) latestListing = null;
  });
  return promise;
}

async function downloadFile(file: MooringFile): Promise<Uint8Array> {
  const res = await fetchWithRetry(`${BUCKET_URL}/${DATASET_PREFIX}${file.path}`);
  if (!res.ok) throw new Error(`Copernicus ${file.path} failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function readFile(file: MooringFile): Promise<NcFile> {
  return readNetcdf(await downloadFile(file), CMEMS_VARIABLES);
}

interface RegistryScan {
  stations: SourceStation[];
  platformsListed: number;
  bytesFetched: number;
  skipped: Record<StationSkipReason, number>;
  /** Wave-carrying platforms left out because their provider is not listed, by institution. */
  skippedProviders: Record<string, number>;
  /** Files that downloaded but could not be read. */
  unreadable: string[];
}

/** The registry pass, with the counts the dry run reports. */
export async function scanRegistry(nowMs: number): Promise<RegistryScan> {
  const startedMs = Date.now();
  const days = Array.from({ length: REGISTRY_DAYS }, (_, i) => utcDay(nowMs - i * DAY_MS));
  const newest = [...newestFilePerPlatform(await listDays(days)).values()];
  const scan: RegistryScan = {
    stations: [],
    platformsListed: newest.length,
    bytesFetched: 0,
    skipped: { "no-wave-variable": 0, "provider-not-listed": 0, "not-fixed-platform": 0, "bad-position": 0 },
    skippedProviders: {},
    unreadable: [],
  };

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < newest.length) {
      if (Date.now() - startedMs > REGISTRY_BUDGET_MS) {
        throw new Error(`Copernicus registry: over the ${REGISTRY_BUDGET_MS / 1000} s budget at ${next}/${newest.length} files`);
      }
      const file = newest[next++];
      // A download that keeps failing fails the source (no partial list); a
      // file that downloads but cannot be read is skipped and counted, so one
      // damaged file cannot stop the registry every day.
      const bytes = await downloadFile(file);
      scan.bytesFetched += bytes.length;
      let nc: NcFile;
      try {
        nc = await readNetcdf(bytes, CMEMS_VARIABLES);
      } catch (error) {
        scan.unreadable.push(`${file.path}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      const result = parseCmemsStation(nc, file.platformCode);
      if (result.ok) {
        scan.stations.push(result.station);
        continue;
      }
      scan.skipped[result.reason]++;
      if (result.reason === "provider-not-listed") {
        const key = result.institution ?? "unknown";
        scan.skippedProviders[key] = (scan.skippedProviders[key] ?? 0) + 1;
      }
    }
  };
  await Promise.all(Array.from({ length: REGISTRY_CONCURRENCY }, worker));
  scan.stations.sort((a, b) => a.sourceStationId.localeCompare(b.sourceStationId));
  return scan;
}

async function fetchStations(): Promise<SourceStation[]> {
  const scan = await scanRegistry(Date.now());
  console.info(
    `[WaveStations] copernicus registry: ${scan.stations.length} stations from ${scan.platformsListed} platforms; ` +
      `skipped ${JSON.stringify(scan.skipped)}; unreadable ${scan.unreadable.length}`,
  );
  if (scan.unreadable.length > 0) console.warn(`[WaveStations] copernicus unreadable files: ${scan.unreadable.slice(0, 5).join("; ")}`);
  return scan.stations;
}

/**
 * Today's file (and yesterday's before 06:00 UTC) for one station. Files not
 * newer than `ifModifiedSince` (the newest LastModified stored last time) are
 * not downloaded; with none newer the answer is not_modified.
 */
export async function fetchCopernicusStationFiles(
  sourceStationId: string,
  options: { ifModifiedSince: string | null; nowMs?: number },
): Promise<StationHistoryResult> {
  const nowMs = options.nowMs ?? Date.now();
  const files = (await latestFilesByPlatform(nowMs)).get(sourceStationId) ?? [];
  if (files.length === 0) return { status: "not_found" };
  const sinceMs = options.ifModifiedSince ? Date.parse(options.ifModifiedSince) : NaN;
  const changed = files.filter((file) => !Number.isFinite(sinceMs) || Date.parse(file.lastModified) > sinceMs);
  if (changed.length === 0) return { status: "not_modified" };

  const observations: SourceObservation[] = [];
  for (const file of changed) observations.push(...parseCmemsObservations(await readFile(file), sourceStationId));
  const lastModifiedMs = Math.max(...files.map((file) => Date.parse(file.lastModified)));
  return { status: "ok", lastModified: new Date(lastModifiedMs).toISOString(), observations };
}

export const copernicusAdapter: WaveStationSourceAdapter = {
  source: "copernicus",
  latestEveryMinutes: 60,
  latestVia: "history",
  historyOverlapMinutes: HISTORY_OVERLAP_MINUTES,
  fetchStations,
  fetchStationHistory: (sourceStationId, options) =>
    fetchCopernicusStationFiles(sourceStationId, { ifModifiedSince: options.ifModifiedSince }),
};
