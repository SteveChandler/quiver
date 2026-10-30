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
 * --seam-fixtures also refreshes scripts/__fixtures__/model-seam-fixtures.json:
 * the most recent real CDIP→model handoff pairs at each regression-fixture
 * beach plus Del Mar, which Gate G of scripts/shoaling-regression.ts replays.
 *
 * Run: node --import tsx scripts/replay-model-swell-calibration.ts <env file> [days] [--write] [--seam-fixtures]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
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
} from "../lib/utils/model-swell-calibration-factors";

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const WRITE = process.argv.includes("--write");
const SEAM_FIXTURES = process.argv.includes("--seam-fixtures");
config({ path: args[0] });
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

interface Beach {
  id: string;
  name: string;
  cdip_station: string;
  shoaling_factors: ShoalingFactors;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
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
function shippedFactor(ratios: number[]): number {
  if (ratios.length < MODEL_SWELL_FACTOR_MIN_ROWS) return 1;
  const k = Math.min(
    MODEL_SWELL_FACTOR_MAX,
    Math.max(MODEL_SWELL_FACTOR_MIN, median(ratios)),
  );
  return Math.abs(k - 1) >= MODEL_SWELL_FACTOR_MIN_EFFECT
    ? Math.round(k * 100) / 100
    : 1;
}

function withoutBeachId(input: ForecastReplayInput): ForecastReplayInput {
  const { id: _id, ...beach } = input.beach;
  return { ...input, beach };
}

async function main(): Promise<void> {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const until = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const { data: beaches, error } = await supabase
    .from("beaches")
    .select(
      "id,name,cdip_station,shoaling_factors,swell_window_center_deg,swell_window_halfwidth_deg",
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
  const obsByStation = new Map<string, Obs[]>();
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
      const { data, error: obsError } = await supabase
        .from("unified_wave_observations")
        .select("observed_at,wave_height_m,wave_period_s,wave_direction_deg")
        .eq("station_id", station)
        .gte("observed_at", since)
        .order("observed_at");
      if (obsError) throw obsError;
      obsByStation.set(station, (data ?? []) as Obs[]);
    }
    const obs = obsByStation.get(station)!;
    if (obs.length === 0) continue;

    const { data: rows, error: rowError } = await supabase
      .from("ml_predictions_log")
      .select("predicted_at,raw_display_height_m,display_replay_context")
      .eq("beach_id", beach.id)
      .eq("display_wave_source", "model_swell")
      .gte("predicted_at", since)
      .lte("predicted_at", until)
      .gte("forecast_horizon_hours", 12)
      .lte("forecast_horizon_hours", 48)
      .gt("raw_display_height_m", 0)
      .not("display_replay_context", "is", null);
    if (rowError) throw rowError;

    const recs: Rec[] = [];
    const pairs = new Map<string, SeamPair>();
    for (const row of (rows ?? []) as LogRow[]) {
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

    const allK = shippedFactor(recs.map((r) => r.truth / r.uncalibrated));
    if (allK !== 1)
      emitted.push({ id: beach.id, name: beach.name, k: allK, n: recs.length });
    if (recs.length < 40) continue;

    recs.sort((a, b) => a.at - b.at);
    const mid = recs[Math.floor(recs.length / 2)].at;
    const train = recs.filter((r) => r.at < mid);
    const test = recs.filter((r) => r.at >= mid);
    // Half the rows, so double them to keep the shipping row floor comparable.
    const trainRatios = train.map((r) => r.truth / r.uncalibrated);
    const trainK = shippedFactor([...trainRatios, ...trainRatios]);
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
  const source = readTemplate()
    .replace("__FIT_DATE__", today)
    .replaceAll("__DAYS__", String(DAYS))
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
 * season in the window (this one: fall south swell).
 *   node --import tsx scripts/replay-model-swell-calibration.ts .env.local __DAYS__ --write --seam-fixtures
 *
 * Fit __FIT_DATE__ over __DAYS__ days: ml_predictions_log model_swell rows, horizon
 * 12-48 h, buoy observation within 45 min. A beach gets an entry only with
 * at least MODEL_SWELL_FACTOR_MIN_ROWS rows and |k - 1| >= MODEL_SWELL_FACTOR_MIN_EFFECT.
 */
export const MODEL_SWELL_FACTOR_MIN = 0.8;
export const MODEL_SWELL_FACTOR_MAX = 1.6;
export const MODEL_SWELL_FACTOR_MIN_EFFECT = 0.08;
export const MODEL_SWELL_FACTOR_MIN_ROWS = 100;

export const MODEL_SWELL_CALIBRATION_FACTORS: Readonly<Record<string, number>> = {
__ENTRIES__
};
`;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
