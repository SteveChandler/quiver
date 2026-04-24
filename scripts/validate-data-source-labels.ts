/**
 * Ad-hoc validation: run the NEW per-slot data_source attribution against
 * live NOAA NWS + Open-Meteo APIs for Ocean Beach Pier and print the
 * distribution. Compare to OLD behavior (every row labeled NOAA_NWS via
 * hardcoded wrapper).
 *
 * Run from quiver/: yarn tsx scripts/validate-data-source-labels.ts
 */
import { NOAAWaveWatchService } from "../lib/services/noaa-wavewatch/noaa-wavewatch-service";

const LAT = 32.7486; // Ocean Beach Pier, San Diego
const LON = -117.2543;
const DAYS = 12;

async function main() {
  const service = new NOAAWaveWatchService();
  const result = await service.fetchWaveWatchForecast(LAT, LON, DAYS);

  if (!result || !result.forecast.length) {
    console.error("No forecast returned — both NWS and OM failed.");
    process.exit(1);
  }

  console.log(`=== Live fetch for OB Pier (${LAT}, ${LON}) ===`);
  console.log(`Total slots returned: ${result.forecast.length}`);
  console.log(`Wrapper has data_source field?`, "data_source" in result);

  // Per-slot distribution
  const counts = new Map<string, number>();
  for (const slot of result.forecast) {
    const src = slot.data_source ?? "<undefined>";
    counts.set(src, (counts.get(src) ?? 0) + 1);
  }

  console.log(`\n=== NEW code: per-slot data_source distribution ===`);
  for (const [src, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src.padEnd(15)} ${n} slots`);
  }

  // Sample first/middle/last to verify labels match horizon expectations
  const now = Date.now();
  const sampleIdxs = [0, Math.floor(result.forecast.length / 2), result.forecast.length - 1];
  console.log(`\n=== Sample slots (NEW code) ===`);
  for (const i of sampleIdxs) {
    const slot = result.forecast[i];
    const ts = new Date(slot.timestamp).getTime();
    const hoursAhead = ((ts - now) / 3600000).toFixed(1);
    console.log(
      `  idx ${String(i).padStart(3)}  +${hoursAhead}h  ${slot.timestamp}  data_source=${slot.data_source}  Hs=${slot.significant_wave_height?.toFixed(2)}m  T=${slot.peak_wave_period?.toFixed(1)}s`
    );
  }

  // Find first NOAA_NWS → OPEN_METEO transition (should be at ~72h horizon)
  let transitionIdx = -1;
  for (let i = 1; i < result.forecast.length; i++) {
    if (
      result.forecast[i - 1].data_source === "NOAA_NWS" &&
      result.forecast[i].data_source === "OPEN_METEO"
    ) {
      transitionIdx = i;
      break;
    }
  }

  console.log(`\n=== Transition NWS → OM ===`);
  if (transitionIdx >= 0) {
    const beforeSlot = result.forecast[transitionIdx - 1];
    const afterSlot = result.forecast[transitionIdx];
    const beforeH = (
      (new Date(beforeSlot.timestamp).getTime() - now) /
      3600000
    ).toFixed(1);
    const afterH = (
      (new Date(afterSlot.timestamp).getTime() - now) /
      3600000
    ).toFixed(1);
    console.log(
      `  last NOAA_NWS slot at +${beforeH}h (idx ${transitionIdx - 1})`
    );
    console.log(
      `  first OPEN_METEO slot at +${afterH}h (idx ${transitionIdx})`
    );
  } else {
    console.log(
      `  NONE found. Either NWS or OM unavailable, OR labels are uniform.`
    );
  }

  // OLD behavior simulation
  console.log(`\n=== OLD code: hardcoded wrapper would have labeled ===`);
  console.log(`  ALL ${result.forecast.length} slots stored as: NOAA_NWS`);
  console.log(
    `  (because forecast-builder.ts:161 fell back to waveData.data_source = "NOAA_NWS")`
  );

  // Verdict
  console.log(`\n=== Verdict ===`);
  const hasOM = (counts.get("OPEN_METEO") ?? 0) > 0;
  const hasNWS = (counts.get("NOAA_NWS") ?? 0) > 0;
  const hasFallback = (counts.get("FALLBACK") ?? 0) > 0;
  const wrapperGone = !("data_source" in result);

  console.log(`  [${wrapperGone ? "✓" : "✗"}] Wrapper data_source field absent`);
  console.log(
    `  [${hasNWS ? "✓" : "✗"}] At least one NOAA_NWS-labeled slot (days 1-3)`
  );
  console.log(
    `  [${hasOM ? "✓" : "✗"}] At least one OPEN_METEO-labeled slot (days 4-12)`
  );
  console.log(
    `  [${transitionIdx > 0 ? "✓" : "?"}] Found NWS→OM transition (expected near +72h)`
  );
  if (hasFallback) {
    console.log(
      `  [!] FALLBACK slots present — investigate if NWS/OM gaps were unexpected`
    );
  }

  if (wrapperGone && hasNWS && hasOM) {
    console.log(`\n  PASS — labels are honest. Old code would have lied with all-NWS.`);
  } else {
    console.log(`\n  FAIL or partial — see flags above.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Validation script error:", err);
  process.exit(1);
});
