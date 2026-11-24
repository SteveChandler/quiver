/**
 * Reproduction check for hybrid-replay-collect.ts: for a sample of logged rows,
 * compare the collector's "prod" input (current beach row + logged components +
 * logged decay) against replayForecastDisplayHeightM on the full logged context
 * (the canonical replay, which keeps the logged beach config). Read-only.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseForecastDisplayReplayContext } from "../lib/utils/forecast-display-replay";
import { transformToFaceHeightDecomposed } from "../lib/utils/wave-height-transformer";

process.loadEnvFile(process.argv[2] ?? ".env.local");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const recs = readFileSync("scripts/.hybrid-cache/recs.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const byKey = new Map<string, number>();
for (const r of recs) byKey.set(`${r.b}|${r.at}|${r.iss}`, r.prod);

async function main(): Promise<void> {
  const beaches = [...new Set(recs.map((r) => r.b as string))];
  let n = 0, within = 0, maxDiff = 0;
  for (const b of beaches) {
    const { data, error } = await supabase
      .from("ml_predictions_log")
      .select("predicted_at,created_at,display_replay_context")
      .eq("beach_id", b).eq("display_wave_source", "model_swell").eq("forecast_horizon_hours", 21)
      .gte("created_at", "2026-10-20").lte("created_at", "2026-10-27").limit(20);
    if (error) throw error;
    for (const row of data ?? []) {
      const ctx = parseForecastDisplayReplayContext(row.display_replay_context);
      if (!ctx || !ctx.base.supported) continue;
      const key = `${b}|${new Date(row.predicted_at).toISOString().replace(".000Z", "+00:00").replace("T", " ")}|${row.created_at}`;
      const mine = recs.find((r) => r.b === b && Date.parse(r.at) === Date.parse(row.predicted_at) && Date.parse(r.iss) === Date.parse(row.created_at));
      if (!mine) continue;
      const canonical = transformToFaceHeightDecomposed({ ...ctx.base.input, beach: { ...ctx.base.input.beach, id: b } }).faceHeightFt;
      const d = Math.abs(canonical - mine.prod);
      n++; if (d <= 0.05) within++; maxDiff = Math.max(maxDiff, d);
      void key;
    }
  }
  console.log(`rows ${n}: collector prod within 0.05 ft of canonical context replay ${within} (${((within / n) * 100).toFixed(1)}%), max diff ${maxDiff.toFixed(2)} ft`);
}
main().catch((e) => { console.error(e); process.exit(1); });
