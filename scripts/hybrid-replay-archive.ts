/**
 * Secondary hybrid-by-lead replay from the daily swell archive
 * (workspace-notes/Reports/swell-archive/<day>/, scripts/swell-forecast-archive.py).
 * The archive holds real issue-time Open-Meteo best_match (MFWAM) partitions and
 * ecmwf_wam025 total Hs for 8 days at 4 calibrated California beaches, so it is the
 * only source for the 3-5 d bin. Issue time = the day's latest manifest run_at;
 * only valid hours after it are scored. Components mimic forecast-builder.ts:
 * swell_1, swell_2, wind_wave, directions on 16 compass points.
 * Needs the CDIP caches that hybrid-replay-collect.ts writes.
 * Writes scripts/.hybrid-cache/archive-recs.jsonl in the recs.jsonl format.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  transformToFaceHeightDecomposed,
  transformToFaceHeightWithMetadata,
} from "../lib/utils/wave-height-transformer";
import { MODEL_SWELL_CALIBRATION_FACTORS } from "../lib/utils/model-swell-calibration-factors";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(process.argv[2] ?? ".env.local");
const ROOT = "/Users/stevenchandler/Desktop/dev/workspace-notes/Reports/swell-archive";
const CACHE = "scripts/.hybrid-cache";
const M_TO_FT = 3.28084;
const SITES: Record<string, string> = {
  Blacks_Beach: "01330afc-00d3-461b-88f3-b173774766f4",
  Scripps: "4b0cf129-c706-4e24-8210-2219defc5ea7",
  HB_Pier: "071db1df-b5ee-4af6-a022-ea8a09667cbe",
  Ocean_Beach_SF: "d9524c9d-8315-4686-9d35-24ceb6db2a82",
};
const compass = (d: number | null) => (d == null ? null : (Math.round(d / 22.5) % 16) * 22.5);

async function main(): Promise<void> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: beaches, error } = await supabase
    .from("beaches")
    .select("id,name,cdip_station,deepwater_decay_factor,shoaling_factors,swell_window_center_deg,swell_window_halfwidth_deg,swell_access_factors,terrain_enabled")
    .in("id", Object.values(SITES));
  if (error) throw error;
  const out: string[] = [];
  for (const [site, id] of Object.entries(SITES)) {
    const beach = beaches!.find((b) => b.id === id)!;
    const cdipFile = `${CACHE}/cdip-${beach.cdip_station}.json`;
    if (!existsSync(cdipFile)) { console.log(`${site}: no CDIP cache`); continue; }
    const obs = (JSON.parse(readFileSync(cdipFile, "utf8")).obs as { t: number; hs: number; tp: number | null; dp: number | null }[])
      .sort((a, b) => a.t - b.t);
    const near = (at: number) => {
      let best = null as (typeof obs)[number] | null;
      for (const o of obs) {
        if (o.t < at - 45 * 60_000) continue;
        if (o.t > at + 45 * 60_000) break;
        if (!best || Math.abs(o.t - at) < Math.abs(best.t - at)) best = o;
      }
      return best;
    };
    const cfg = {
      terrain_enabled: beach.terrain_enabled ?? undefined,
      swell_access_factors: beach.swell_access_factors,
      swell_window_center_deg: beach.swell_window_center_deg,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
      shoaling_factors: beach.shoaling_factors,
      // equals the logged context value at these 4 beaches (checked Nov 6)
      deepwater_decay_factor: beach.deepwater_decay_factor ?? null,
    };
    let n = 0;
    for (const day of readdirSync(ROOT).sort()) {
      const mfFile = `${ROOT}/${day}/openmeteo-best_match-${site}.json`;
      const ecFile = `${ROOT}/${day}/openmeteo-ecmwf_wam025-${site}.json`;
      const manFile = `${ROOT}/${day}/manifest.json`;
      if (!existsSync(mfFile) || !existsSync(ecFile)) continue;
      // Without a manifest (early days) the file mtime is the latest possible fetch time.
      const runs = existsSync(manFile) ? JSON.parse(readFileSync(manFile, "utf8")).runs : [];
      const issued = runs.length
        ? Math.max(...runs.map((r: { run_at: string }) => Date.parse(r.run_at)))
        : (await import("node:fs")).statSync(mfFile).mtimeMs;
      const mf = JSON.parse(readFileSync(mfFile, "utf8")).hourly;
      const ec = JSON.parse(readFileSync(ecFile, "utf8")).hourly;
      const ecIdx = new Map<string, number>((ec.time as string[]).map((t, i) => [t, i]));
      (mf.time as string[]).forEach((t, i) => {
        const at = Date.parse(`${t}:00Z`);
        if (at % (3 * 3_600_000) !== 0) return; // 3-hourly like the log
        const lead = (at - issued) / 3_600_000;
        if (lead <= 0 || at > Date.now() - 3 * 3_600_000) return;
        const o = near(at);
        if (!o) return;
        const truth = transformToFaceHeightWithMetadata({ rawHeightFt: o.hs * M_TO_FT, periodS: o.tp, swellDirectionDeg: o.dp, beach, source: "cdip_sig" });
        if (!truth.isCalibrated || truth.faceHeightFt <= 0) return;
        const part = (h: string, p: string, d: string, ww = false) => {
          const hv = mf[h]?.[i], pv = mf[p]?.[i];
          return hv > 0 && pv > 0 ? { heightFt: hv * M_TO_FT, periodS: pv, directionDeg: compass(mf[d]?.[i] ?? null), ...(ww ? { partition: "wind_wave" as const } : {}) } : null;
        };
        const comps = [
          part("swell_wave_height", "swell_wave_period", "swell_wave_direction"),
          part("secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction"),
          // the archive saved no wind_wave_direction; the swell_1 direction stands in
          part("wind_wave_height", "wind_wave_period", "swell_wave_direction", true),
        ];
        if (!comps[0]) return;
        const input = (scale: number, withId: boolean) => ({
          beach: withId ? { ...cfg, id } : cfg,
          source: "model_swell" as const,
          rawHeightFt: comps[0]!.heightFt * scale,
          periodS: comps[0]!.periodS,
          swellDirectionDeg: comps[0]!.directionDeg,
          components: comps.map((c) => (c ? { ...c, heightFt: c.heightFt * scale } : null)),
        });
        const uncal = transformToFaceHeightDecomposed(input(1, false)).faceHeightFt;
        if (!(uncal > 0)) return;
        const prod = transformToFaceHeightDecomposed(input(1, true)).faceHeightFt;
        const j = ecIdx.get(t);
        const eHs = j == null ? null : ec.wave_height[j];
        const mfHs = mf.wave_height?.[i];
        const r = eHs > 0 && mfHs > 0 ? eHs / mfHs : null;
        const hyb = r == null ? uncal : transformToFaceHeightDecomposed(input(r, false)).faceHeightFt;
        const hybCap = r == null ? uncal : transformToFaceHeightDecomposed(input(Math.min(2, Math.max(0.5, r)), false)).faceHeightFt;
        const rssFt = Math.sqrt(comps.reduce((sum, c) => sum + (c ? c.heightFt ** 2 : 0), 0));
        const rRss = eHs > 0 && rssFt > 0 ? (eHs * M_TO_FT) / rssFt : null;
        const hybRss = rRss == null ? uncal : transformToFaceHeightDecomposed(input(rRss, false)).faceHeightFt;
        const hybRssCap = rRss == null ? uncal : transformToFaceHeightDecomposed(input(Math.min(2, Math.max(0.5, rRss)), false)).faceHeightFt;
        out.push(JSON.stringify({
          b: id, stn: beach.cdip_station, at: new Date(at).toISOString(), iss: new Date(issued).toISOString(), h: Math.round(lead),
          lead: Math.round(lead * 10) / 10, truth: truth.faceHeightFt, logged: prod, prod, uncal,
          k: MODEL_SWELL_CALIBRATION_FACTORS[id] ?? 1, hyb, hybCap, hybRss, hybRssCap, hybOpt: hyb, r, rRss, rOpt: r, eHs, mfHs,
          tpTruth: o.tp, tpProd: comps[0]!.periodS, tpMf: mf.wave_peak_period?.[i] ?? null, tpEc: j == null ? null : ec.wave_peak_period?.[j] ?? null,
          truthHs: o.hs,
        }));
        n++;
      });
    }
    console.log(`${site}: ${n} rows`);
  }
  writeFileSync(`${CACHE}/archive-recs.jsonl`, out.join("\n") + "\n");
  console.log(`DONE archive rows ${out.length}`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
