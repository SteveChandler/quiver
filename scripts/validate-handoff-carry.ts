/**
 * Ad-hoc validation for #1236: replay the latest live enhanced_forecasts rows
 * through the NEW handoff code and print them next to what prod stored (the
 * OLD 48 h taper). Rows come from a JSON export of enhanced_forecasts with
 * columns beach, forecast_at, data_source, wave_height, src
 * (wave_height_provenance.source) and orig (handoff_blend.original_face_ft).
 *
 * Run: node --import tsx scripts/validate-handoff-carry.ts <rows.json>
 */
import { readFileSync } from "node:fs";
import {
  createForecastHandoffBlendState,
  processForecastHandoffBlendSlot,
} from "../lib/utils/forecast-handoff-blend";
import type { WaveHeightSourceTag } from "../lib/utils/wave-height-source";

interface Row {
  beach: string;
  forecast_at: string;
  data_source: string | null;
  wave_height: string | null;
  src: WaveHeightSourceTag | null;
  orig: number | null;
}

function ft(value: string | null): number | null {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

const rows: Row[] = JSON.parse(readFileSync(process.argv[2], "utf8"));
let oldInversions = 0;
let newInversions = 0;
let oldMorningInversions = 0;
let newMorningInversions = 0;

for (const beach of [...new Set(rows.map((row) => row.beach))]) {
  const slots = rows
    .filter((row) => row.beach === beach)
    .sort((a, b) => Date.parse(a.forecast_at) - Date.parse(b.forecast_at));
  const state = createForecastHandoffBlendState();
  let seamLine = "no seam";
  const out = slots.map((row) => {
    // Prod rows inside the old taper store the pre-blend height in orig.
    const model = row.orig ?? ft(row.wave_height);
    const step = processForecastHandoffBlendSlot({
      state,
      slot: {
        forecastAt: row.forecast_at,
        waveHeight: model == null ? row.wave_height : `${model} ft`,
        dataSource: row.data_source,
        waveHeightSource: row.src,
      },
    });
    if (step.metric) {
      seamLine = `seam ${step.metric.modelForecastAt.slice(0, 13)}Z: CDIP ${step.metric.cdipFaceFt} ft → model ${step.metric.modelFaceFt} ft`;
    }
    // NEW: the handoff step returns only a metric, so the row keeps its model height.
    return { at: row.forecast_at, model, oldFt: ft(row.wave_height), newFt: model };
  });

  const countFalls = (series: typeof out, key: "oldFt" | "newFt"): number => {
    let falls = 0;
    for (let i = 1; i < series.length; i += 1) {
      const [a, b] = [series[i - 1], series[i]];
      if (a.model == null || b.model == null || b.model < a.model) continue;
      if (a[key] != null && b[key] != null && b[key]! < a[key]!) falls += 1;
    }
    return falls;
  };

  // 08:00 PT = 15:00Z through Nov 1 (PDT), 16:00Z after.
  const mornings = out.filter((row) =>
    /T15:00:00/.test(row.at) ? row.at < "2026-11-02" : /T16:00:00/.test(row.at) && row.at >= "2026-11-02",
  );
  oldInversions += countFalls(out, "oldFt");
  newInversions += countFalls(out, "newFt");
  oldMorningInversions += countFalls(mornings, "oldFt");
  newMorningInversions += countFalls(mornings, "newFt");

  console.log(`\n=== ${beach} — ${seamLine} ===`);
  console.log("08:00 PT    model  OLD(prod)  NEW");
  for (const row of mornings.slice(0, 5)) {
    console.log(
      `${row.at.slice(0, 10)}  ${String(row.model ?? "—").padStart(5)}  ${String(row.oldFt ?? "—").padStart(9)}  ${String(row.newFt ?? "—").padStart(4)}`,
    );
  }
}

console.log("\n=== Verdict: shown height fell while the model held or grew ===");
console.log(`3-hourly slots: OLD ${oldInversions}, NEW ${newInversions}`);
console.log(`Day over day at 08:00 PT: OLD ${oldMorningInversions}, NEW ${newMorningInversions}`);
