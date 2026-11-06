/**
 * Scores logged model-hour forecasts at calibrated beaches against the
 * CDIP-path face height (buoy Hs × beach bucket) at the same hour, and fits
 * the per-beach model_swell factor shipped in
 * lib/utils/model-swell-calibration-factors.ts.
 *
 * Read-only against prod. Rows: ml_predictions_log, model_swell display,
 * horizon 12-48 h, last DAYS days. Each row's `display_replay_context` holds
 * the exact transform input the forecast builder used; the fit replays it
 * with the beach id removed, so it measures the uncalibrated model ruler
 * whether or not the logged height already carried a factor. "logged" scores
 * the height users saw then (before Oct 29 2026 that included the 48 h seam
 * taper #1238 removed); "current" scores today's uncalibrated code. Out-of-sample scores fit on the first half of
 * each beach's rows and score the second half; the emitted map is fit on all
 * rows.
 *
 * Truth comes from CDIP's 30-minute realtime file on THREDDS. Our stored
 * observations keep about 12 readings a day, which left half the forecast
 * hours without a buoy reading inside the 45 min match window; the stored
 * rows are only the fallback when THREDDS is unreachable. Factors above
 * MODEL_SWELL_FACTOR_REVIEW are printed for a settings review: a beach that
 * needs that much correction usually has a wrong swell window or access
 * array, not a model bias.
 *
 * --seam-fixtures also refreshes scripts/__fixtures__/model-seam-fixtures.json:
 * the most recent real CDIP→model handoff pairs at each regression-fixture
 * beach plus Del Mar, which Gate G of scripts/shoaling-regression.ts replays.
 *
 * Run: node --import tsx scripts/replay-model-swell-calibration.ts <env file> [days] [--write] [--seam-fixtures]
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseOpendapAscii } from "../lib/services/cdip-mop/mop-client";
import {
  transformToFaceHeightDecomposed,
  transformToFaceHeightWithMetadata,
  type ShoalingFactors,
} from "../lib/utils/wave-height-transformer";
import {
  parseForecastDisplayReplayContext,
  type ForecastReplayInput,
} from "../lib/utils/forecast-display-replay";
import {
  MODEL_SWELL_FACTOR_MAX,
  MODEL_SWELL_FACTOR_MIN,
  MODEL_SWELL_FACTOR_MIN_EFFECT,
  MODEL_SWELL_FACTOR_MIN_ROWS,
  MODEL_SWELL_FACTOR_REVIEW,
  MODEL_SWELL_STATION_FACTOR_HOLDS,
} from "../lib/utils/model-swell-calibration-factors";

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const WRITE = process.argv.includes("--write");
const SEAM_FIXTURES = process.argv.includes("--seam-fixtures");
try {
  process.loadEnvFile(args[0]);
} catch (error) {
  // dotenv's config() tolerated a missing file; keep that.
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const DAYS = Number(args[1] ?? 30);
const M_TO_FT = 3.28084;
const SEAM_PAIRS_PER_BEACH = 5;
const OUT_PATH = "lib/utils/model-swell-calibration-factors.ts";
const FIXTURE_PATH = "scripts/__fixtures__/shoaling-regression-fixtures.json";
const SEAM_PATH = "scripts/__fixtures__/model-seam-fixtures.json";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// The truth path must see the beach row production's buoy path sees: beaches
// whose shoaling_factors set direction_shadow still get calibratedShadowFactor
// on the bucket path, which needs the window and access fields.
interface Beach {
  id: string;
  name: string;
  lat: number;
  lon: number;
  cdip_station: string;
  shoaling_factors: ShoalingFactors;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  swell_access_factors: number[] | null;
  terrain_enabled: boolean | null;
}

/**
 * A buoy farther than this from the beach is a wrong assignment, not a
 * reference (Nov 2026: "179" is Astoria Canyon OR for Ventura beaches,
 * "217" is Onslow Bay NC for County Line, "71" is Harvest for Ocean Beach SF).
 */
const MAX_BUOY_DISTANCE_KM = 100;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

interface LogRow {
  predicted_at: string;
  raw_display_height_m: number;
  display_replay_context: unknown;
}

interface Obs {
  observed_at: string;
  wave_height_m: number;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
}

interface Rec {
  at: number;
  truth: number;
  /** Logged prod height, from whatever code ran at the time. */
  logged: number;
  /** Replayed builder input without the per-beach factor; the fit basis. */
  uncalibrated: number;
}

/** A real CDIP→model handoff: the last buoy slot and the first model slot. */
export interface SeamPair {
  modelForecastAt: string;
  cdip: ForecastReplayInput;
  model: ForecastReplayInput;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** The shipping rule: enough rows, a material effect, clamped. 1 means "no entry". */
function shippedFactor(
  ratios: number[],
  minRows: number = MODEL_SWELL_FACTOR_MIN_ROWS,
  max: number = MODEL_SWELL_FACTOR_MAX,
): number {
  if (ratios.length < minRows) return 1;
  const k = Math.min(max, Math.max(MODEL_SWELL_FACTOR_MIN, median(ratios)));
  return Math.abs(k - 1) >= MODEL_SWELL_FACTOR_MIN_EFFECT
    ? Math.round(k * 100) / 100
    : 1;
}

// Also drops the ECMWF hybrid scale: this table is fit on the MFWAM-only basis.
function withoutBeachId(input: ForecastReplayInput): ForecastReplayInput {
  const { id: _id, ...beach } = input.beach;
  const { ecmwfHybrid: _hybrid, ...rest } = input;
  return { ...rest, beach };
}

const PAGE_SIZE = 1000;

/** PostgREST caps a response at 1000 rows; a longer window used to be silently cut. */
async function fetchAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

const CDIP_REALTIME_URL =
  "https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/realtime";
/** waveFlagPrimary: 1 good, 2 not evaluated; 3 questionable, 4 bad, 9 missing are dropped. */
const CDIP_USABLE_FLAGS = new Set([1, 2]);

interface StationTruth {
  obs: Obs[];
  /** Deployed position from the station's own metadata; null for stored fallback rows. */
  position: { lat: number; lon: number } | null;
}

async function fetchCdipRealtime(
  stationNumber: string,
  sinceMs: number,
): Promise<StationTruth> {
  const base = `${CDIP_REALTIME_URL}/${stationNumber.padStart(3, "0")}p1_rt.nc.ascii`;
  const get = async (query: string): Promise<Record<string, number[]>> => {
    const res = await fetch(`${base}?${query}`, {
      headers: { "User-Agent": "Quiver (support@quiversurf.app)" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`CDIP ${stationNumber}: HTTP ${res.status}`);
    return parseOpendapAscii(await res.text());
  };
  const head = await get("waveTime,metaDeployLatitude,metaDeployLongitude");
  const times = head.waveTime ?? [];
  const lat = head.metaDeployLatitude?.[0];
  const lon = head.metaDeployLongitude?.[0];
  const position =
    typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon }
      : null;
  const first = times.findIndex((t) => t * 1000 >= sinceMs);
  if (first < 0) return { obs: [], position };
  const last = times.length - 1;
  const range = `[${first}:${last}]`;
  const v = await get(
    ["waveTime", "waveHs", "waveTp", "waveDp", "waveFlagPrimary"]
      .map((name) => `${name}${range}`)
      .join(","),
  );
  const obs: Obs[] = [];
  v.waveTime.forEach((t, i) => {
    if (!CDIP_USABLE_FLAGS.has(v.waveFlagPrimary[i])) return;
    const hs = v.waveHs[i];
    if (!(hs > 0 && hs < 30)) return;
    obs.push({
      observed_at: new Date(t * 1000).toISOString(),
      wave_height_m: hs,
      wave_period_s: v.waveTp[i] > 0 ? v.waveTp[i] : null,
      wave_direction_deg: v.waveDp[i] >= 0 ? v.waveDp[i] : null,
    });
  });
  return { obs, position };
}

async function fetchStoredObservations(station: string, since: string): Promise<Obs[]> {
  return fetchAllRows<Obs>((from, to) =>
    supabase
      .from("unified_wave_observations")
      .select("observed_at,wave_height_m,wave_period_s,wave_direction_deg")
      .eq("station_id", station)
      .gte("observed_at", since)
      .order("observed_at")
      .range(from, to),
  );
}

function fitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const until = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const { data: beaches, error } = await supabase
    .from("beaches")
    .select(
      "id,name,lat,lon,cdip_station,shoaling_factors,swell_window_center_deg,swell_window_halfwidth_deg,swell_access_factors,terrain_enabled",
    )
    .not("shoaling_factors", "is", null)
    .not("cdip_station", "is", null);
  if (error) throw error;

  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const seamIds = new Set<string>(
    Object.values(fixture.beaches as Record<string, { id: string }>).map(
      (b) => b.id,
    ),
  );
  const seam: Record<string, { name: string; pairs: SeamPair[] }> = {};
  const obsByStation = new Map<string, StationTruth>();
  const truthSource = new Map<string, "cdip-realtime" | "stored">();
  const noTruth: string[] = [];
  const farBuoy: string[] = [];
  const held: string[] = [];
  const totals = {
    logged: [] as number[],
    current: [] as number[],
    shipped: [] as number[],
  };
  const emitted: Array<{ id: string; name: string; k: number; n: number }> = [];
  const lines: string[] = [];
  let reproduced = 0;
  let replayed = 0;

  for (const beach of beaches as Beach[]) {
    const station = `edu_ucsd_cdip_${beach.cdip_station.padStart(3, "0")}`;
    if (!obsByStation.has(station)) {
      let truth: StationTruth;
      try {
        truth = await fetchCdipRealtime(beach.cdip_station, Date.parse(since));
        truthSource.set(station, "cdip-realtime");
      } catch (cdipError) {
        console.warn(`${station}: ${String(cdipError)}; using stored observations`);
        truth = { obs: await fetchStoredObservations(station, since), position: null };
        truthSource.set(station, "stored");
      }
      obsByStation.set(station, truth);
    }
    const { obs, position } = obsByStation.get(station)!;
    if (obs.length === 0) {
      noTruth.push(`${beach.name} (CDIP ${beach.cdip_station})`);
      continue;
    }
    if (position) {
      const km = distanceKm(beach.lat, beach.lon, position.lat, position.lon);
      if (km > MAX_BUOY_DISTANCE_KM) {
        farBuoy.push(`${beach.name} (CDIP ${beach.cdip_station}, ${Math.round(km)} km)`);
        continue;
      }
    }

    const rows = await fetchAllRows<LogRow>((from, to) =>
      supabase
        .from("ml_predictions_log")
        .select("predicted_at,raw_display_height_m,display_replay_context")
        .eq("beach_id", beach.id)
        .eq("display_wave_source", "model_swell")
        .gte("predicted_at", since)
        .lte("predicted_at", until)
        .gte("forecast_horizon_hours", 12)
        .lte("forecast_horizon_hours", 48)
        .gt("raw_display_height_m", 0)
        .not("display_replay_context", "is", null)
        .order("predicted_at")
        .order("id")
        .range(from, to),
    );

    const recs: Rec[] = [];
    const pairs = new Map<string, SeamPair>();
    for (const row of rows) {
      const ctx = parseForecastDisplayReplayContext(row.display_replay_context);
      if (!ctx || ctx.base.input.source !== "model_swell") continue;
      if (ctx.handoff && !pairs.has(ctx.handoff.model.forecastAt)) {
        pairs.set(ctx.handoff.model.forecastAt, {
          modelForecastAt: ctx.handoff.model.forecastAt,
          cdip: withoutBeachId(ctx.handoff.cdip.input),
          model: withoutBeachId(ctx.handoff.model.input),
        });
      }

      const at = Date.parse(row.predicted_at);
      let nearest: Obs | null = null;
      for (const o of obs) {
        const gap = Math.abs(Date.parse(o.observed_at) - at);
        if (
          gap <= 45 * 60_000 &&
          (!nearest || gap < Math.abs(Date.parse(nearest.observed_at) - at))
        )
          nearest = o;
      }
      if (!nearest || !(nearest.wave_height_m > 0)) continue;

      const truth = transformToFaceHeightWithMetadata({
        rawHeightFt: nearest.wave_height_m * M_TO_FT,
        periodS: nearest.wave_period_s,
        swellDirectionDeg: nearest.wave_direction_deg,
        beach,
        source: "cdip_sig",
      });
      if (!truth.isCalibrated || truth.faceHeightFt <= 0) continue;

      // Unsupported rows had a later step (the south OC guardrail) rewrite
      // the height, so the replay cannot reproduce them.
      if (!ctx.base.supported) continue;
      const uncalibrated = transformToFaceHeightDecomposed(
        withoutBeachId(ctx.base.input),
      ).faceHeightFt;
      const logged = row.raw_display_height_m * M_TO_FT;
      if (uncalibrated <= 0 || logged <= 0) continue;
      replayed += 1;
      if (Math.abs(uncalibrated - logged) <= 0.15) reproduced += 1;
      recs.push({ at, truth: truth.faceHeightFt, logged, uncalibrated });
    }

    if (seamIds.has(beach.id) || beach.name === "Del Mar") {
      const recent = [...pairs.values()]
        .sort((a, b) => b.modelForecastAt.localeCompare(a.modelForecastAt))
        .slice(0, SEAM_PAIRS_PER_BEACH);
      if (recent.length > 0)
        seam[beach.id] = { name: beach.name, pairs: recent };
    }

    const cap = MODEL_SWELL_STATION_FACTOR_HOLDS[beach.cdip_station] ?? MODEL_SWELL_FACTOR_MAX;
    const ratios = recs.map((r) => r.truth / r.uncalibrated);
    const allK = shippedFactor(ratios, MODEL_SWELL_FACTOR_MIN_ROWS, cap);
    const unheldK = shippedFactor(ratios);
    if (unheldK > allK)
      held.push(`${beach.name} (CDIP ${beach.cdip_station}): fit ${unheldK.toFixed(2)}, ships ${allK.toFixed(2)}`);
    if (allK !== 1)
      emitted.push({ id: beach.id, name: beach.name, k: allK, n: recs.length });
    if (recs.length < 40) continue;

    recs.sort((a, b) => a.at - b.at);
    const mid = recs[Math.floor(recs.length / 2)].at;
    const train = recs.filter((r) => r.at < mid);
    const test = recs.filter((r) => r.at >= mid);
    // Half the rows, so half the shipping row floor.
    const trainK = shippedFactor(
      train.map((r) => r.truth / r.uncalibrated),
      MODEL_SWELL_FACTOR_MIN_ROWS / 2,
      cap,
    );
    const mae = (pick: (r: Rec) => number): number =>
      mean(test.map((r) => Math.abs(r.truth - pick(r))));
    const row = {
      logged: mae((r) => r.logged),
      current: mae((r) => r.uncalibrated),
      shipped: mae((r) => r.uncalibrated * trainK),
    };
    for (const key of Object.keys(row) as Array<keyof typeof row>) {
      totals[key].push(...test.map(() => row[key]));
    }
    lines.push(
      [
        beach.name.padEnd(34),
        beach.cdip_station.padStart(4),
        String(recs.length).padStart(5),
        trainK.toFixed(2).padStart(6),
        allK.toFixed(2).padStart(6),
        row.logged.toFixed(2).padStart(7),
        row.current.toFixed(2).padStart(7),
        row.shipped.toFixed(2).padStart(7),
      ].join(" "),
    );
  }

  console.log(
    "MAE ft vs CDIP-path face, scored on the second half of each beach's rows.",
  );
  console.log(
    "beach                              stn     n  k-1st  k-all  logged current shipped",
  );
  for (const line of lines.sort()) console.log(line);
  console.log(
    `\nALL test n=${totals.current.length}: logged ${mean(totals.logged).toFixed(3)}  current ${mean(totals.current).toFixed(3)}  shipped-rule ${mean(totals.shipped).toFixed(3)}`,
  );
  console.log(
    `replay reproduced the logged height within 0.15 ft: ${reproduced}/${replayed}`,
  );
  console.log(`emitted ${emitted.length} beach factors`);
  const sources = [...truthSource.values()];
  console.log(
    `buoy truth: ${sources.filter((s) => s === "cdip-realtime").length} stations from CDIP realtime, ${sources.filter((s) => s === "stored").length} from stored observations`,
  );
  if (noTruth.length > 0) {
    console.log(
      `\nno buoy readings in the window, so no factor (reassign cdip_station if the buoy is gone): ${noTruth.length} beaches`,
    );
    for (const name of noTruth.sort()) console.log(`  ${name}`);
  }
  if (farBuoy.length > 0) {
    console.log(
      `\nbuoy more than ${MAX_BUOY_DISTANCE_KM} km from the beach, so no factor (wrong cdip_station): ${farBuoy.length} beaches`,
    );
    for (const name of farBuoy.sort()) console.log(`  ${name}`);
  }
  if (held.length > 0) {
    console.log(
      `\nheld below the fit by MODEL_SWELL_STATION_FACTOR_HOLDS: ${held.length} beaches`,
    );
    for (const line of held.sort()) console.log(`  ${line}`);
  }
  const review = emitted.filter(
    (e) => e.k > MODEL_SWELL_FACTOR_REVIEW || e.k <= MODEL_SWELL_FACTOR_MIN,
  );
  if (review.length > 0) {
    console.log(
      `\nreview beach settings (factor > ${MODEL_SWELL_FACTOR_REVIEW} or pinned at the ${MODEL_SWELL_FACTOR_MIN} floor; usually a swell window or access array that blocks or over-admits real swell):`,
    );
    for (const e of [...review].sort((a, b) => b.k - a.k))
      console.log(`  ${e.k.toFixed(2)}  ${e.name}  ${e.id}`);
  }

  if (SEAM_FIXTURES) {
    // One pair per line keeps the fixture reviewable despite 72-bin access arrays.
    const body = Object.entries(seam)
      .map(
        ([id, entry]) =>
          `  ${JSON.stringify(id)}: {\n    "name": ${JSON.stringify(entry.name)},\n    "pairs": [\n${entry.pairs
            .map((pair) => `      ${JSON.stringify(pair)}`)
            .join(",\n")}\n    ]\n  }`,
      )
      .join(",\n");
    writeFileSync(SEAM_PATH, `{\n${body}\n}\n`);
    console.log(
      `wrote ${Object.keys(seam).length} seam beaches to ${SEAM_PATH}`,
    );
  }

  if (!WRITE) return;
  emitted.sort((a, b) => a.name.localeCompare(b.name));
  const today = new Date().toISOString().slice(0, 10);
  const entries = emitted
    .map((e) => `  "${e.id}": ${e.k.toFixed(2)}, // ${e.name} (n=${e.n})`)
    .join("\n");
  // Holds carry over from the current table, so editing that file is the way to change one.
  const holds = Object.entries(MODEL_SWELL_STATION_FACTOR_HOLDS)
    .map(([station, cap]) => `  ${JSON.stringify(station)}: ${cap},`)
    .join("\n");
  const source = readTemplate()
    .replace("__FIT_DATE__", today)
    .replace("__COMMIT__", fitCommit())
    .replaceAll("__DAYS__", String(DAYS))
    .replace("__HOLDS__", holds)
    .replace("__ENTRIES__", entries);
  writeFileSync(OUT_PATH, source);
  console.log(`wrote ${OUT_PATH}`);
}

function readTemplate(): string {
  return `/**
 * Per-beach multiplier on model_swell face heights at CDIP-calibrated beaches.
 *
 * Model hours and buoy hours use different rulers: buoy hours go through the
 * beach's measured shoaling buckets, model hours through the generic
 * period/terrain factor. In Orange County the model ruler reads about half
 * the buoy ruler, so the forecast dropped at the CDIP→model handoff. #1238
 * removed the seam taper that had been hiding this. Each factor here is the
 * median of (CDIP-path face / uncalibrated model face) over matched hours, so
 * a beach's model hours land on its buoy ruler.
 *
 * Generated — do not hand-edit entries. Refit monthly; the fit only covers the
 * season in the window.
 *   node --import tsx scripts/replay-model-swell-calibration.ts .env.local __DAYS__ --write --seam-fixtures
 *
 * Fit __FIT_DATE__ at commit __COMMIT__ over __DAYS__ days: ml_predictions_log
 * model_swell rows, horizon 12-48 h, CDIP 30-minute realtime buoy reading
 * within 45 min. A beach gets an entry only with at least
 * MODEL_SWELL_FACTOR_MIN_ROWS rows and |k - 1| >= MODEL_SWELL_FACTOR_MIN_EFFECT.
 * The fit is only valid for the transform at that commit; refit after any
 * change to wave-height-transformer.ts.
 *
 * The cap was 1.6 until Nov 2026, when it bound at 30 of 91 beaches; a
 * held-out half scored 0.69 ft MAE at 2.5 against 0.85 at 1.6. Factors above
 * MODEL_SWELL_FACTOR_REVIEW still ship but are listed for a settings review.
 */
export const MODEL_SWELL_FACTOR_MIN = 0.8;
export const MODEL_SWELL_FACTOR_MAX = 2.5;
export const MODEL_SWELL_FACTOR_REVIEW = 1.6;
export const MODEL_SWELL_FACTOR_MIN_EFFECT = 0.08;
export const MODEL_SWELL_FACTOR_MIN_ROWS = 100;

/**
 * Lower cap by cdip_station, hand-set. Edit it in this file: a refit reads it
 * and writes it back unchanged.
 *
 * "215" (Long Beach Channel; Huntington and Newport): the Nov 2026 fit gave
 * 1.8-2.3, but the window was 82-98% south swell and in model-west hours the
 * buoy/model ratio was about 1.0, so a single k over-calls west swell here
 * (Nov 13 replay: HB Pier Northside 9.7-10.4 ft against a plausible 5.5-7).
 * The buckets these beaches are fit to also disagree with CDIP MOP. Held at
 * the old 1.6 cap until a buoy-confirmed 11 s+ west swell validates the fit;
 * delete the entry and refit then.
 */
export const MODEL_SWELL_STATION_FACTOR_HOLDS: Readonly<Record<string, number>> = {
__HOLDS__
};

export const MODEL_SWELL_CALIBRATION_FACTORS: Readonly<Record<string, number>> = {
__ENTRIES__
};
`;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
