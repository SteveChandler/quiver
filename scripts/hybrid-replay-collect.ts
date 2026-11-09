/**
 * Read-only data collection for the hybrid-by-lead replay (Nov 2026).
 *
 * For every calibrated beach: logged model_swell forecasts from
 * ml_predictions_log at their real issue time (created_at) in three horizon
 * bands (13-24 h, 55-72 h, 151-168 h), the ECMWF WAM total Hs that was
 * available no later than that issue time (Open-Meteo previous-runs API,
 * previous_dayN with N = ceil(h / 24)), and CDIP truth from the 30-minute
 * realtime file (same 45 min match and cdip_sig bucket path as
 * scripts/replay-model-swell-calibration.ts). Writes one JSON line per
 * scored row to scripts/.hybrid-cache/recs.jsonl; scripts/hybrid-replay-analyze.py
 * scores it.
 *
 * The window is the same as scripts/replay-model-swell-calibration.ts: the
 * last DAYS days of predicted_at, up to 3 h ago. The cache is cleared at the
 * start of every run, so the truth always uses today's beaches rows
 * (shoaling_factors, swell window, access array).
 *
 * Run (needs network to CDIP THREDDS and previous-runs-api.open-meteo.com):
 *   node --import tsx scripts/hybrid-replay-collect.ts .env.local [days]
 * Normally run through scripts/refit-model-swell-tables.sh.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseOpendapAscii } from "../lib/services/cdip-mop/mop-client";
import {
  transformToFaceHeightDecomposed,
  transformToFaceHeightWithMetadata,
  type ShoalingFactors,
} from "../lib/utils/wave-height-transformer";
import { MODEL_SWELL_CALIBRATION_FACTORS } from "../lib/utils/model-swell-calibration-factors";

process.loadEnvFile(process.argv[2] ?? ".env.local");
const DAYS = Number(process.argv[3] ?? 30);
const CACHE = "scripts/.hybrid-cache";
// A cached truth file carries the beaches rows of the day it was fetched; a
// refit on old truth is how the Nov 9 stale-k defect happened. This also
// drops archive-recs.jsonl (same risk); rerun hybrid-replay-archive.ts for
// the 3-5 d bin.
rmSync(CACHE, { recursive: true, force: true });
mkdirSync(CACHE, { recursive: true });
const NOW = Date.now();
const SINCE = new Date(NOW - DAYS * 86_400_000).toISOString();
const UNTIL = new Date(NOW - 3 * 3_600_000).toISOString();
const M_TO_FT = 3.28084;
const MAX_BUOY_DISTANCE_KM = 100;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

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
interface Obs { t: number; hs: number; tp: number | null; dp: number | null }

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function cached<T>(name: string, load: () => Promise<T>): Promise<T> {
  const file = `${CACHE}/${name}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T;
  const value = await load();
  writeFileSync(file, JSON.stringify(value));
  return value;
}

async function fetchText(url: string, tries = 4, timeoutMs = 180_000): Promise<string> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Quiver (support@quiversurf.app)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
      return await res.text();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw last;
}

const CDIP = "https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/realtime";
async function cdipTruth(stn: string): Promise<{ obs: Obs[]; pos: { lat: number; lon: number } | null }> {
  return cached(`cdip-${stn}`, async () => {
    const base = `${CDIP}/${stn.padStart(3, "0")}p1_rt.nc.ascii`;
    const head = parseOpendapAscii(await fetchText(`${base}?waveTime,metaDeployLatitude,metaDeployLongitude`));
    const times = head.waveTime ?? [];
    const lat = head.metaDeployLatitude?.[0];
    const lon = head.metaDeployLongitude?.[0];
    const pos = Number.isFinite(lat) && Number.isFinite(lon) ? { lat: lat!, lon: lon! } : null;
    const first = times.findIndex((t) => t * 1000 >= Date.parse(SINCE));
    if (first < 0) return { obs: [], pos };
    const range = `[${first}:${times.length - 1}]`;
    const v = parseOpendapAscii(await fetchText(
      `${base}?${["waveTime", "waveHs", "waveTp", "waveDp", "waveFlagPrimary"].map((n) => n + range).join(",")}`,
    ));
    const obs: Obs[] = [];
    v.waveTime.forEach((t, i) => {
      if (![1, 2].includes(v.waveFlagPrimary[i])) return;
      const hs = v.waveHs[i];
      if (!(hs > 0 && hs < 30)) return;
      obs.push({ t: t * 1000, hs, tp: v.waveTp[i] > 0 ? v.waveTp[i] : null, dp: v.waveDp[i] >= 0 ? v.waveDp[i] : null });
    });
    return { obs, pos };
  });
}

const PREV_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];
const varName = (v: string, n: number) => (n === 0 ? v : `${v}_previous_day${n}`);
interface Ecmwf { lat: number; lon: number; hourly: Record<string, (number | null)[]> }
async function ecmwfPrevious(beach: Beach): Promise<Ecmwf> {
  return cached(`ecmwf-${beach.id}`, async () => {
    const vars = [
      ...PREV_DAYS.map((n) => varName("wave_height", n)),
      ...PREV_DAYS.map((n) => varName("wave_peak_period", n)),
    ].join(",");
    const url = `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}` +
      `&models=ecmwf_wam025&cell_selection=sea&hourly=${vars}&start_date=${SINCE.slice(0, 10)}&end_date=${UNTIL.slice(0, 10)}&timezone=UTC`;
    const doc = JSON.parse(await fetchText(url));
    if (!doc.hourly) throw new Error(`ECMWF ${beach.name}: ${doc.reason ?? "no hourly"}`);
    return { lat: doc.latitude, lon: doc.longitude, hourly: doc.hourly };
  });
}

interface LogRow {
  predicted_at: string;
  created_at: string;
  forecast_horizon_hours: number;
  raw_display_height_m: number;
  wave_height_om: number | null;
  wave_peak_period_om: number | null;
  wave_period_s: number | null;
  src: string | null;
  supported: boolean | null;
  raw_ft: number | null;
  period_s: number | null;
  dir: number | null;
  decay: number | null;
  components: Array<{ heightFt: number; periodS: number; directionDeg: number | null; partition?: "swell" | "wind_wave" } | null> | null;
}

async function logRows(beach: Beach): Promise<LogRow[]> {
  return cached(`log-${beach.id}`, async () => {
    const rows: LogRow[] = [];
    for (const [lo, hi] of [[13, 24], [55, 72], [151, 168]]) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("ml_predictions_log")
          .select(
            "predicted_at,created_at,forecast_horizon_hours,raw_display_height_m,wave_height_om,wave_peak_period_om,wave_period_s," +
              "src:display_replay_context->base->input->>source,supported:display_replay_context->base->supported," +
              "raw_ft:display_replay_context->base->input->rawHeightFt,period_s:display_replay_context->base->input->periodS," +
              "decay:display_replay_context->base->input->beach->deepwater_decay_factor,dir:display_replay_context->base->input->swellDirectionDeg,components:display_replay_context->base->input->components",
          )
          .eq("beach_id", beach.id)
          .eq("display_wave_source", "model_swell")
          .gte("created_at", SINCE)
          .gte("predicted_at", SINCE)
          .lte("predicted_at", UNTIL)
          .gte("forecast_horizon_hours", lo)
          .lte("forecast_horizon_hours", hi)
          .not("display_replay_context", "is", null)
          .order("id")
          .range(from, from + 999);
        if (error) throw new Error(`${beach.name} log: ${JSON.stringify(error)}`);
        rows.push(...((data ?? []) as unknown as LogRow[]));
        if (!data || data.length < 1000) break;
      }
    }
    return rows;
  });
}

function nearestObs(obs: Obs[], at: number): Obs | null {
  // obs sorted by t; binary search
  let lo = 0, hi = obs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (obs[mid].t < at) lo = mid + 1; else hi = mid;
  }
  let best: Obs | null = null;
  for (const i of [lo - 1, lo]) {
    const o = obs[i];
    if (!o) continue;
    if (Math.abs(o.t - at) <= 45 * 60_000 && (!best || Math.abs(o.t - at) < Math.abs(best.t - at))) best = o;
  }
  return best;
}

async function main(): Promise<void> {
  const { data: beaches, error } = await supabase
    .from("beaches")
    .select("id,name,lat,lon,cdip_station,shoaling_factors,swell_window_center_deg,swell_window_halfwidth_deg,swell_access_factors,terrain_enabled")
    .not("shoaling_factors", "is", null)
    .not("cdip_station", "is", null);
  if (error) throw error;
  const out: string[] = [];
  const meta: Record<string, unknown>[] = [];
  for (const beach of beaches as Beach[]) {
    if (!/^\d+$/.test(beach.cdip_station)) continue;
    let truthData: { obs: Obs[]; pos: { lat: number; lon: number } | null };
    try {
      truthData = await cdipTruth(beach.cdip_station);
    } catch (e) {
      meta.push({ id: beach.id, name: beach.name, stn: beach.cdip_station, skipped: `cdip: ${String(e).slice(0, 80)}` });
      continue;
    }
    const { obs, pos } = truthData;
    const buoyKm = pos ? distanceKm(beach.lat, beach.lon, pos.lat, pos.lon) : null;
    if (obs.length === 0 || (buoyKm != null && buoyKm > MAX_BUOY_DISTANCE_KM)) {
      meta.push({ id: beach.id, name: beach.name, stn: beach.cdip_station, skipped: obs.length === 0 ? "no-truth" : "far-buoy", buoyKm });
      continue;
    }
    obs.sort((a, b) => a.t - b.t);
    let ecmwf: Ecmwf;
    try {
      ecmwf = await ecmwfPrevious(beach);
    } catch (e) {
      meta.push({ id: beach.id, name: beach.name, stn: beach.cdip_station, skipped: `ecmwf: ${String(e)}` });
      continue;
    }
    const hourIndex = new Map<number, number>();
    (ecmwf.hourly.time as unknown as string[]).forEach((t, i) => hourIndex.set(Date.parse(`${t}:00Z`), i));
    const ecmwfAt = (v: string, n: number, at: number): number | null => {
      const i = hourIndex.get(Math.floor(at / 3_600_000) * 3_600_000);
      if (i == null || n < 0 || n > 7) return null;
      return ecmwf.hourly[varName(v, n)]?.[i] ?? null;
    };
    const rows = await logRows(beach);
    const cfg = {
      terrain_enabled: beach.terrain_enabled ?? undefined,
      swell_access_factors: beach.swell_access_factors,
      swell_window_center_deg: beach.swell_window_center_deg,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
      shoaling_factors: beach.shoaling_factors,
    };
    let n = 0;
    for (const row of rows) {
      if (row.src !== "model_swell" || row.supported !== true || row.raw_ft == null || !row.components) continue;
      const at = Date.parse(row.predicted_at);
      const issued = Date.parse(row.created_at);
      const o = nearestObs(obs, at);
      if (!o) continue;
      const truth = transformToFaceHeightWithMetadata({
        rawHeightFt: o.hs * M_TO_FT, periodS: o.tp, swellDirectionDeg: o.dp, beach, source: "cdip_sig",
      });
      if (!truth.isCalibrated || truth.faceHeightFt <= 0) continue;
      const input = (scale: number, withId: boolean) => ({
        // deepwater_decay_factor as the builder resolved it (decay-off flag applied), from the logged context
        beach: { ...cfg, deepwater_decay_factor: row.decay ?? null, ...(withId ? { id: beach.id } : {}) },
        source: "model_swell" as const,
        rawHeightFt: row.raw_ft! * scale,
        periodS: row.period_s,
        swellDirectionDeg: row.dir,
        components: row.components!.map((c) => (c ? { ...c, heightFt: c.heightFt * scale } : null)),
      });
      const prod = transformToFaceHeightDecomposed(input(1, true)).faceHeightFt;
      const uncal = transformToFaceHeightDecomposed(input(1, false)).faceHeightFt;
      if (!(uncal > 0)) continue;
      const leadH = (at - issued) / 3_600_000;
      // lead is 0-0.3 h past the horizon (issue time vs run hour); day 7 is the API limit
      const nCons = Math.min(7, Math.ceil(leadH / 24 - 0.02));
      const nOpt = Math.floor(leadH / 24);
      const mfHs = row.wave_height_om;
      const rssFt = Math.sqrt(row.components!.reduce((s, c) => s + (c ? c.heightFt ** 2 : 0), 0));
      const hyb = (ecmwfHs: number | null, basisFt: number | null) => {
        if (ecmwfHs == null || !(ecmwfHs > 0) || basisFt == null || !(basisFt > 0)) return { r: null, ft: uncal };
        const r = (ecmwfHs * M_TO_FT) / basisFt;
        return { r, ft: transformToFaceHeightDecomposed(input(r, false)).faceHeightFt, rCap: Math.min(2, Math.max(0.5, r)) };
      };
      const eCons = ecmwfAt("wave_height", nCons, at);
      const eOpt = ecmwfAt("wave_height", nOpt, at);
      const hCons = hyb(eCons, mfHs != null ? mfHs * M_TO_FT : null);
      const hConsCap = hCons.r != null ? transformToFaceHeightDecomposed(input(Math.min(2, Math.max(0.5, hCons.r)), false)).faceHeightFt : uncal;
      const hRss = hyb(eCons, rssFt);
      const hRssCap = hRss.r != null ? transformToFaceHeightDecomposed(input(Math.min(2, Math.max(0.5, hRss.r)), false)).faceHeightFt : uncal;
      const hOpt = hyb(eOpt, mfHs != null ? mfHs * M_TO_FT : null);
      out.push(JSON.stringify({
        b: beach.id, stn: beach.cdip_station, at: row.predicted_at, iss: row.created_at, h: row.forecast_horizon_hours,
        lead: Math.round(leadH * 10) / 10, truth: truth.faceHeightFt, logged: row.raw_display_height_m * M_TO_FT,
        prod, uncal, k: MODEL_SWELL_CALIBRATION_FACTORS[beach.id] ?? 1,
        hyb: hCons.ft, hybCap: hConsCap, hybRss: hRss.ft, hybRssCap: hRssCap, hybOpt: hOpt.ft,
        r: hCons.r, rRss: hRss.r, rOpt: hOpt.r, eHs: eCons, mfHs,
        tpTruth: o.tp, tpProd: row.period_s, tpMf: row.wave_peak_period_om, tpEc: ecmwfAt("wave_peak_period", nCons, at),
        truthHs: o.hs, dpTruth: o.dp,
      }));
      n++;
    }
    meta.push({
      id: beach.id, name: beach.name, stn: beach.cdip_station, lat: beach.lat, lon: beach.lon,
      cellLat: ecmwf.lat, cellLon: ecmwf.lon, cellKm: distanceKm(beach.lat, beach.lon, ecmwf.lat, ecmwf.lon),
      buoyKm, rows: rows.length, scored: n, shoaling_factors: beach.shoaling_factors,
    });
    console.log(`${beach.name}: rows ${rows.length} scored ${n} cell ${ecmwf.lat},${ecmwf.lon}`);
  }
  writeFileSync(`${CACHE}/recs.jsonl`, out.join("\n") + "\n");
  writeFileSync(`${CACHE}/beaches.json`, JSON.stringify(meta, null, 1));
  console.log(`DONE recs ${out.length} beaches ${meta.length}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
