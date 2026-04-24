#!/usr/bin/env tsx
/**
 * Read-only diagnostic: trace OB Pier wave_height overshoot.
 *
 * Hand-walking the transformer with the same component inputs gives ~2.0 ft,
 * but enhanced_forecasts.wave_height stores ~4.1 ft. This script pins down
 * which of three failure modes is in play:
 *
 *   1. transformer-output ≈ stored → our hand-walk was wrong; inspect the
 *      per-component prints to find which factor we miscomputed.
 *   2. transformer-output << stored → ALARM: another writer is amplifying.
 *      Suspects: selectWaveHeightSource (CDIP scalar?), update-enhanced merge,
 *      OM-primary bulk migration 20260423204959, admin/backfill scripts.
 *   3. NOAA partition order swapped (swell_2 period > swell_1 period) → FLAG.
 *
 * Run from quiver/: yarn tsx scripts/validate-ob-pier-overshoot.ts
 *
 * Plan reference: ~/.claude/plans/audit-the-blast-radius-ethereal-acorn.md
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { selectWaveHeightSource } from "../lib/utils/wave-formatters";
import {
  alignmentFactor,
  BASE_SHOALING,
  calculatePeriodFactor,
  lookupShoalingBucket,
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
  type SwellComponentInput,
  type ShoalingFactors,
} from "../lib/utils/wave-height-transformer";

config({ path: ".env.local" });

const BEACH_ID = "65d177de-e75a-4ad8-aa0d-48a67c0851b0";
const LAT = 32.7486;
const LON = -117.2543;
const NWS_USER_AGENT = "quiver-validation-script/1.0 (steven@quiver.surf)";
const M_TO_FT = 3.28084;

interface NwsValueEntry {
  validTime: string; // ISO8601 + duration, e.g. "2026-04-24T12:00:00+00:00/PT1H"
  value: number | null;
}

interface NwsValuesField {
  uom?: string;
  values: NwsValueEntry[];
}

interface NwsGridpointResponse {
  properties: Record<string, NwsValuesField | unknown>;
}

interface NwsPointsResponse {
  properties: { forecastGridData: string };
}

/**
 * Parse the ISO8601 interval string used by NWS gridpoints values
 * (e.g. "2026-04-24T12:00:00+00:00/PT3H") into [startMs, endMs].
 */
function parseValidTime(validTime: string): [number, number] {
  const [iso, duration] = validTime.split("/");
  const startMs = new Date(iso).getTime();
  // Duration is like "PT1H", "PT3H", "PT12H". Pull the H number.
  const hMatch = duration?.match(/PT(\d+)H/);
  const hours = hMatch ? Number(hMatch[1]) : 1;
  const endMs = startMs + hours * 3600 * 1000;
  return [startMs, endMs];
}

/**
 * Pick the value entry whose interval covers `targetMs`.
 * Returns null if none match (NWS sometimes leaves gaps in long-horizon fields).
 */
function pickValueAt(field: NwsValuesField | undefined, targetMs: number): number | null {
  if (!field || !Array.isArray(field.values)) return null;
  for (const entry of field.values) {
    const [start, end] = parseValidTime(entry.validTime);
    if (targetMs >= start && targetMs < end) {
      return entry.value;
    }
  }
  return null;
}

function asValuesField(props: Record<string, unknown>, key: string): NwsValuesField | undefined {
  const raw = props[key];
  if (raw && typeof raw === "object" && "values" in raw && Array.isArray((raw as { values: unknown }).values)) {
    return raw as NwsValuesField;
  }
  return undefined;
}

async function fetchNwsGridpoints(): Promise<{ gridUrl: string; data: NwsGridpointResponse }> {
  const pointsUrl = `https://api.weather.gov/points/${LAT},${LON}`;
  const pointsResp = await fetch(pointsUrl, { headers: { "User-Agent": NWS_USER_AGENT } });
  if (!pointsResp.ok) {
    throw new Error(`NWS points fetch failed: ${pointsResp.status} ${pointsResp.statusText}`);
  }
  const points = (await pointsResp.json()) as NwsPointsResponse;
  const gridUrl = points.properties.forecastGridData;
  const gridResp = await fetch(gridUrl, { headers: { "User-Agent": NWS_USER_AGENT } });
  if (!gridResp.ok) {
    throw new Error(`NWS gridpoints fetch failed: ${gridResp.status} ${gridResp.statusText}`);
  }
  const data = (await gridResp.json()) as NwsGridpointResponse;
  return { gridUrl, data };
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "null";
  return n.toFixed(digits);
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // --- 1. Beach config from prod -----------------------------------------
  const { data: beachRow, error: beachErr } = await supabase
    .from("beaches")
    .select(
      "id, name, persona, deepwater_decay_factor, shoaling_factors, swell_window_center_deg, swell_window_halfwidth_deg, cdip_station, terrain_enabled, swell_access_factors",
    )
    .eq("id", BEACH_ID)
    .single();
  if (beachErr || !beachRow) {
    throw new Error(`Beach lookup failed: ${beachErr?.message ?? "no row"}`);
  }

  console.log("=== Beach config ===");
  console.log({
    id: beachRow.id,
    name: beachRow.name,
    persona: beachRow.persona,
    deepwater_decay_factor: beachRow.deepwater_decay_factor,
    swell_window_center_deg: beachRow.swell_window_center_deg,
    swell_window_halfwidth_deg: beachRow.swell_window_halfwidth_deg,
    cdip_station: beachRow.cdip_station,
    terrain_enabled: beachRow.terrain_enabled,
    has_shoaling_factors: beachRow.shoaling_factors != null,
    swell_access_factors_len: Array.isArray(beachRow.swell_access_factors)
      ? beachRow.swell_access_factors.length
      : null,
  });

  // --- Pull the stored row early so we can fall back to it if NOAA NWS
  //     doesn't publish components at our target hour (common at edge gridpoints).
  const targetMs = Date.now() + 3 * 3600 * 1000; // now + 3h
  const targetHourFloor = new Date(Math.floor(targetMs / 3600000) * 3600000);
  const targetHourCeil = new Date(targetHourFloor.getTime() + 3600000);
  const { data: efRows, error: efErr } = await supabase
    .from("enhanced_forecasts")
    .select(
      "forecast_at, data_source, wave_height, wave_height_om, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_wave_height, wind_wave_period, wind_wave_direction",
    )
    .eq("beach_id", BEACH_ID)
    .gte("forecast_at", targetHourFloor.toISOString())
    .lt("forecast_at", targetHourCeil.toISOString())
    .order("forecast_at", { ascending: true })
    .limit(1);
  if (efErr) {
    throw new Error(`enhanced_forecasts lookup failed: ${efErr.message}`);
  }
  const stored = efRows?.[0];

  // --- 2. NOAA NWS gridpoints --------------------------------------------
  console.log("\n=== Fetching NOAA NWS gridpoints ===");
  const { gridUrl, data: grid } = await fetchNwsGridpoints();
  console.log(`Grid URL: ${gridUrl}`);

  const targetIso = new Date(targetMs).toISOString();
  console.log(`Target hour (now+3h): ${targetIso}`);

  const props = grid.properties as Record<string, unknown>;
  const fields = {
    waveHeight: asValuesField(props, "waveHeight"),
    primarySwellHeight: asValuesField(props, "primarySwellHeight"),
    primarySwellDirection: asValuesField(props, "primarySwellDirection"),
    swellPeriod: asValuesField(props, "swellPeriod"),
    secondarySwellHeight: asValuesField(props, "secondarySwellHeight"),
    secondarySwellDirection: asValuesField(props, "secondarySwellDirection"),
    secondarySwellPeriod: asValuesField(props, "secondarySwellPeriod"),
    windWaveHeight: asValuesField(props, "windWaveHeight"),
    windWavePeriod: asValuesField(props, "windWavePeriod"),
    windWaveDirection: asValuesField(props, "windWaveDirection"),
  };

  // NWS gives wave heights in meters and directions in degrees. Convert to ft.
  const waveHeightM = pickValueAt(fields.waveHeight, targetMs);
  const swell1HeightM = pickValueAt(fields.primarySwellHeight, targetMs);
  const swell1Dir = pickValueAt(fields.primarySwellDirection, targetMs);
  const swell1Period = pickValueAt(fields.swellPeriod, targetMs);
  const swell2HeightM = pickValueAt(fields.secondarySwellHeight, targetMs);
  const swell2Dir = pickValueAt(fields.secondarySwellDirection, targetMs);
  const swell2Period = pickValueAt(fields.secondarySwellPeriod, targetMs);
  const windWaveHeightM = pickValueAt(fields.windWaveHeight, targetMs);
  const windWavePeriod = pickValueAt(fields.windWavePeriod, targetMs);
  const windWaveDir = pickValueAt(fields.windWaveDirection, targetMs);

  const swell1HeightFt = swell1HeightM != null ? swell1HeightM * M_TO_FT : null;
  const swell2HeightFt = swell2HeightM != null ? swell2HeightM * M_TO_FT : null;
  const windWaveHeightFt = windWaveHeightM != null ? windWaveHeightM * M_TO_FT : null;
  const waveHeightFt = waveHeightM != null ? waveHeightM * M_TO_FT : null;

  console.log("\n=== NOAA values at target hour (converted ft) ===");
  console.log({
    waveHeightFt: fmt(waveHeightFt),
    swell_1: { heightFt: fmt(swell1HeightFt), periodS: fmt(swell1Period, 1), directionDeg: fmt(swell1Dir, 0) },
    swell_2: { heightFt: fmt(swell2HeightFt), periodS: fmt(swell2Period, 1), directionDeg: fmt(swell2Dir, 0) },
    wind_wave: { heightFt: fmt(windWaveHeightFt), periodS: fmt(windWavePeriod, 1), directionDeg: fmt(windWaveDir, 0) },
  });

  // --- 3. Build components for transformer ------------------------------
  const components: Array<SwellComponentInput | null> = [];
  if (swell1HeightFt != null && swell1Period != null && Number.isFinite(swell1Period)) {
    components.push({ heightFt: swell1HeightFt, periodS: swell1Period, directionDeg: swell1Dir });
  }
  if (swell2HeightFt != null && swell2Period != null && Number.isFinite(swell2Period)) {
    components.push({ heightFt: swell2HeightFt, periodS: swell2Period, directionDeg: swell2Dir });
  }
  if (windWaveHeightFt != null && windWavePeriod != null && Number.isFinite(windWavePeriod)) {
    components.push({ heightFt: windWaveHeightFt, periodS: windWavePeriod, directionDeg: windWaveDir });
  }

  let inputSource: "noaa_live" | "stored_components" = "noaa_live";
  if (components.length === 0) {
    console.warn(
      "\n[NOTE] NOAA NWS gridpoint did not publish heights/periods at this hour. " +
        "Falling back to stored enhanced_forecasts components as transformer inputs.",
    );
    inputSource = "stored_components";
    if (!stored) {
      console.error("No stored enhanced_forecasts row to fall back to either — bailing.");
      process.exit(1);
    }
    // enhanced_forecasts stores values as strings with unit suffixes: "2.1 ft", "9s", "W".
    // Parse each form by stripping the suffix or mapping the compass.
    const parseNumWithUnit = (v: unknown): number | null => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v !== "string") return null;
      const m = v.match(/-?\d+(?:\.\d+)?/);
      return m ? Number(m[0]) : null;
    };
    const COMPASS: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    };
    const parseDir = (v: unknown): number | null => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v !== "string") return null;
      const upper = v.trim().toUpperCase();
      if (upper in COMPASS) return COMPASS[upper];
      return parseNumWithUnit(v);
    };
    const stSwell1H = parseNumWithUnit(stored.swell_1_height);
    const stSwell1P = parseNumWithUnit(stored.swell_1_period);
    const stSwell1D = parseDir(stored.swell_1_direction);
    const stSwell2H = parseNumWithUnit(stored.swell_2_height);
    const stSwell2P = parseNumWithUnit(stored.swell_2_period);
    const stSwell2D = parseDir(stored.swell_2_direction);
    const stWindH = parseNumWithUnit(stored.wind_wave_height);
    const stWindP = parseNumWithUnit(stored.wind_wave_period);
    const stWindD = parseDir(stored.wind_wave_direction);
    if (stSwell1H != null && stSwell1P != null) {
      components.push({ heightFt: stSwell1H, periodS: stSwell1P, directionDeg: stSwell1D });
    }
    if (stSwell2H != null && stSwell2P != null) {
      components.push({ heightFt: stSwell2H, periodS: stSwell2P, directionDeg: stSwell2D });
    }
    if (stWindH != null && stWindP != null) {
      components.push({ heightFt: stWindH, periodS: stWindP, directionDeg: stWindD });
    }
    if (components.length === 0) {
      console.error("Stored row also has no usable components — bailing.");
      process.exit(1);
    }
    console.log("\n=== Stored components (used as transformer inputs) ===");
    console.log(components);
  }

  // --- 4. BeachTerrainConfig --------------------------------------------
  const beach: BeachTerrainConfig = {
    swell_access_factors: Array.isArray(beachRow.swell_access_factors)
      ? (beachRow.swell_access_factors as number[])
      : null,
    terrain_enabled: beachRow.terrain_enabled ?? false,
    shoaling_factors: (beachRow.shoaling_factors as ShoalingFactors | null) ?? null,
    swell_window_center_deg: beachRow.swell_window_center_deg,
    swell_window_halfwidth_deg: beachRow.swell_window_halfwidth_deg,
    deepwater_decay_factor: beachRow.deepwater_decay_factor,
  };

  // --- 5. selectWaveHeightSource ----------------------------------------
  // modelSwellM is METERS — selectWaveHeightSource converts internally.
  // Use whichever swell_1 height we ended up with (NOAA live or stored).
  const primary = components[0];
  if (!primary) {
    console.error("No primary component — bailing.");
    process.exit(1);
  }
  const primarySwellM = primary.heightFt / M_TO_FT;
  const sourceResult = selectWaveHeightSource({
    cdipSigFt: undefined,
    modelSwellM: primarySwellM,
  });
  console.log(`\n=== selectWaveHeightSource (input source: ${inputSource}) ===`);
  console.log(sourceResult);

  if (!sourceResult) {
    console.error("selectWaveHeightSource returned null — cannot proceed.");
    process.exit(1);
  }

  // --- 6. transformToFaceHeightDecomposed -------------------------------
  const transformResult = transformToFaceHeightDecomposed({
    components,
    beach,
    source: sourceResult.source,
    rawHeightFt: sourceResult.heightFt,
    periodS: primary.periodS,
    swellDirectionDeg: primary.directionDeg,
  });
  console.log("\n=== transformToFaceHeightDecomposed ===");
  console.log(transformResult);

  // --- 7. Per-component derived values (manual unroll) -------------------
  console.log("\n=== Per-component breakdown ===");
  console.log(`BASE_SHOALING (exported constant): ${BASE_SHOALING}`);
  const decay =
    sourceResult.source !== "cdip_sig" && beach.deepwater_decay_factor != null
      ? beach.deepwater_decay_factor
      : 1.0;
  console.log(`decay (source=${sourceResult.source}, deepwater_decay_factor=${beach.deepwater_decay_factor}): ${decay}`);

  let manualSumOfSquares = 0;
  for (const [idx, c] of components.entries()) {
    if (!c) continue;
    const align = alignmentFactor(
      c.directionDeg,
      c.periodS,
      beach.swell_window_center_deg ?? null,
      beach.swell_window_halfwidth_deg ?? null,
    );
    const periodFactor = calculatePeriodFactor(c.periodS);
    const bucketFactor =
      sourceResult.source === "cdip_sig"
        ? lookupShoalingBucket(c.periodS, beach.shoaling_factors)
        : null;
    const perComponentFactor = bucketFactor ?? BASE_SHOALING * periodFactor;
    const faceI = c.heightFt * decay * perComponentFactor * align;
    manualSumOfSquares += faceI * faceI;
    const tag = idx === 0 ? "swell_1" : idx === 1 ? "swell_2" : "wind_wave";
    console.log(`  [${tag}]`, {
      heightFt: fmt(c.heightFt),
      periodS: fmt(c.periodS, 1),
      directionDeg: fmt(c.directionDeg, 0),
      alignment: fmt(align, 4),
      periodFactor: fmt(periodFactor, 3),
      bucketFactor: bucketFactor == null ? "null" : fmt(bucketFactor, 3),
      perComponentFactor: fmt(perComponentFactor, 3),
      faceContribFt: fmt(faceI, 3),
    });
  }
  console.log(`Manual RMS sum: ${fmt(Math.sqrt(manualSumOfSquares), 3)} ft`);

  // --- 8. Stored enhanced_forecasts row (already pulled above) -----------
  console.log("\n=== Stored enhanced_forecasts row ===");
  if (!stored) {
    console.log(`(no row at ${targetHourFloor.toISOString()})`);
  } else {
    console.log(stored);
  }

  // --- 9. Verdict --------------------------------------------------------
  console.log("\n=== VERDICT ===");
  const transformerFt = transformResult.faceHeightFt;
  // enhanced_forecasts.wave_height is stored as a unit-suffixed string ("4.1 ft").
  const storedFt = (() => {
    if (!stored || stored.wave_height == null) return null;
    if (typeof stored.wave_height === "number") {
      return Number.isFinite(stored.wave_height) ? stored.wave_height : null;
    }
    if (typeof stored.wave_height !== "string") return null;
    const m = stored.wave_height.match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  })();

  console.log(
    `Transformer output: ${fmt(transformerFt)} ft  (path=${transformResult.path}, calibrated=${transformResult.isCalibrated})`,
  );
  console.log(`Stored wave_height: ${storedFt == null ? "null" : fmt(storedFt)} ft`);

  if (storedFt == null) {
    console.log("INDETERMINATE: no stored row at target hour — re-run after the next forecast cycle.");
  } else {
    const delta = storedFt - transformerFt;
    const ratio = transformerFt > 0 ? storedFt / transformerFt : NaN;
    console.log(`Delta: ${fmt(delta)} ft`);
    console.log(`Ratio (stored / transformer): ${Number.isFinite(ratio) ? fmt(ratio, 3) : "n/a"}`);

    if (Math.abs(delta) < 0.4) {
      console.log(
        "MATCH: hand-math was wrong — inspect per-component prints above for which factor we miscomputed",
      );
    } else if (delta > 0.4) {
      console.log(
        "ALARM: stored is higher than transformer can produce — another writer is in the loop. " +
          "Suspect: selectWaveHeightSource (CDIP scalar?), update-enhanced merge, " +
          "recent OM-primary bulk migration 20260423204959, or admin/backfill scripts",
      );
    } else {
      console.log(
        "INVERTED: stored is lower than transformer — likely a different (older) write that hasn't been refreshed",
      );
    }
  }

  // --- 9b. Pre-fix vs post-fix demonstration ------------------------------
  // Reconstructs the now-deleted selectWaveHeightFormatted logic inline using
  // the actual stored wave_height_om for this hour. Proves the fix flips the
  // broken case to honest face-Hs locally, without needing a fresh DB write.
  console.log("\n=== Pre-fix vs post-fix demonstration (this hour, OB Pier) ===");
  const omM = stored && typeof (stored as { wave_height_om?: number | null }).wave_height_om === "number"
    ? (stored as { wave_height_om?: number | null }).wave_height_om!
    : null;
  const SMALL_WAVE_GATE_M = 0.95;
  const postFixFt = transformResult.faceHeightFt;
  const postFixString = `${postFixFt.toFixed(1)} ft`;
  let preFixString: string;
  let preFixSource: string;
  if (omM != null && Number.isFinite(omM) && omM >= SMALL_WAVE_GATE_M) {
    const omFt = omM * M_TO_FT;
    preFixString = `${omFt.toFixed(1)} ft`;
    preFixSource = `OM-primary override (om_m=${omM.toFixed(2)} >= ${SMALL_WAVE_GATE_M})`;
  } else {
    preFixString = postFixString;
    preFixSource =
      omM == null
        ? "transformer (om_m null — gate would not have fired)"
        : `transformer (om_m=${omM.toFixed(2)} < ${SMALL_WAVE_GATE_M} — gate did not fire)`;
  }
  console.log(`  Pre-fix wave_height (simulated): ${preFixString}  via ${preFixSource}`);
  console.log(`  Post-fix wave_height (this PR):  ${postFixString}  via transformer face-Hs`);
  if (preFixString !== postFixString) {
    console.log(`  RESULT: fix flips this hour from ${preFixString} → ${postFixString} ✅`);
  } else {
    console.log(`  RESULT: this hour was NOT being amplified (gate didn't fire) — fix is a no-op here.`);
  }

  // --- 10. NOAA partition order check -----------------------------------
  console.log("\n=== NOAA partition order check ===");
  if (swell1Period != null && swell2Period != null) {
    const aFt = fmt(swell1Period, 1);
    const bFt = fmt(swell2Period, 1);
    if (swell1Period >= swell2Period) {
      console.log(`OK: swell_1 has higher (or equal) period (swell_1=${aFt}s vs swell_2=${bFt}s)`);
    } else {
      console.log(
        `FLAG: swell_2 outranks swell_1 by period (swell_1=${aFt}s vs swell_2=${bFt}s) — slot ordering may be wrong`,
      );
    }
  } else {
    console.log(
      `(only one populated swell partition: swell_1_period=${fmt(swell1Period, 1)}, swell_2_period=${fmt(swell2Period, 1)})`,
    );
  }
}

main().catch((err) => {
  console.error("validate-ob-pier-overshoot error:", err);
  process.exit(1);
});
