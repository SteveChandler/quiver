#!/usr/bin/env tsx
/**
 * Read-only live validation for the OB Pier long-period south-swell fix.
 *
 * This intentionally validates CDIP 220 as offshore upstream swell arrival,
 * not displayed face-height truth. It does not write enhanced_forecasts; a
 * production forecast regeneration is still required before stored rows change.
 *
 * Run:
 *   yarn tsx scripts/validate-ob-pier-south-swell.ts
 */

import {
  alignmentFactor,
  calculatePeriodFactor,
  componentAccessFactor,
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
} from "../lib/utils/wave-height-transformer";
import { TERRAIN_BINS } from "../types/terrain";

const CDIP_220_URL =
  "http://erddap.cdip.ucsd.edu/erddap/tabledap/wave_agg.json" +
  "?station_id,time,waveHs,waveTp,waveDp" +
  "&waveFlagPrimary=1" +
  '&time>max(time)-1days' +
  '&station_id="220"';

const M_TO_FT = 3.28084;
const OB_PIER_TARGET_DIRECTION_DEG = 192;
const OB_PIER_TARGET_BIN = Math.round(OB_PIER_TARGET_DIRECTION_DEG / 5) % TERRAIN_BINS;

interface CdipTable {
  table?: {
    columnNames?: string[];
    rows?: Array<Array<string | number | null>>;
  };
}

interface CdipObservation {
  time: string;
  heightM: number;
  periodS: number;
  directionDeg: number;
}

function numberAt(
  row: Array<string | number | null>,
  columnNames: string[],
  columnName: string,
): number | null {
  const index = columnNames.indexOf(columnName);
  if (index < 0) return null;
  const value = row[index];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringAt(
  row: Array<string | number | null>,
  columnNames: string[],
  columnName: string,
): string | null {
  const index = columnNames.indexOf(columnName);
  if (index < 0) return null;
  const value = row[index];
  return typeof value === "string" ? value : null;
}

async function fetchCdip220(): Promise<CdipObservation[]> {
  const response = await fetch(CDIP_220_URL, {
    headers: { "User-Agent": "quiver-validation-script/1.0" },
  });
  if (!response.ok) {
    throw new Error(`CDIP 220 fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as CdipTable;
  const columnNames = data.table?.columnNames ?? [];
  const rows = data.table?.rows ?? [];

  return rows.flatMap((row): CdipObservation[] => {
    const time = stringAt(row, columnNames, "time");
    const heightM = numberAt(row, columnNames, "waveHs");
    const periodS = numberAt(row, columnNames, "waveTp");
    const directionDeg = numberAt(row, columnNames, "waveDp");
    if (
      !time ||
      heightM == null ||
      periodS == null ||
      directionDeg == null ||
      heightM <= 0 ||
      periodS <= 0
    ) {
      return [];
    }

    return [{ time, heightM, periodS, directionDeg }];
  });
}

function createObPierBeach(): BeachTerrainConfig {
  const access = Array(TERRAIN_BINS).fill(0);
  access[OB_PIER_TARGET_BIN] = 0.022199;

  return {
    terrain_enabled: true,
    swell_access_factors: access,
    shoaling_factors: null,
    swell_window_center_deg: 293,
    swell_window_halfwidth_deg: 73,
    deepwater_decay_factor: 1,
  };
}

function pickValidationObservation(observations: CdipObservation[]): CdipObservation {
  const targetBinSouthSwell = observations
    .filter((obs) =>
      obs.periodS >= 15 &&
      Math.round(obs.directionDeg / 5) % TERRAIN_BINS === OB_PIER_TARGET_BIN
    )
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

  if (targetBinSouthSwell[0]) return targetBinSouthSwell[0];

  const longPeriod = observations
    .filter((obs) => obs.periodS >= 15)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

  if (longPeriod[0]) return longPeriod[0];

  const latest = [...observations].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
  if (!latest) {
    throw new Error("CDIP 220 returned no usable observations");
  }

  return latest;
}

async function main(): Promise<void> {
  const observations = await fetchCdip220();
  const observation = pickValidationObservation(observations);
  const beach = createObPierBeach();
  const heightFt = observation.heightM * M_TO_FT;

  const strictAlignment = alignmentFactor(
    observation.directionDeg,
    observation.periodS,
    beach.swell_window_center_deg,
    beach.swell_window_halfwidth_deg,
  );
  const modelAccess = componentAccessFactor(
    observation.directionDeg,
    observation.periodS,
    beach,
    "model_swell",
  );
  const cdipDirectAccess = componentAccessFactor(
    observation.directionDeg,
    observation.periodS,
    beach,
    "cdip_swell",
  );
  const periodFactor = calculatePeriodFactor(observation.periodS);
  const oldStrictContributionFt = heightFt * periodFactor * strictAlignment;
  const newCdipDirect = transformToFaceHeightDecomposed({
    components: [
      {
        heightFt,
        periodS: observation.periodS,
        directionDeg: observation.directionDeg,
      },
      null,
      null,
    ],
    beach,
    source: "cdip_swell",
    rawHeightFt: heightFt,
    periodS: observation.periodS,
    swellDirectionDeg: observation.directionDeg,
  });
  const newModel = transformToFaceHeightDecomposed({
    components: [
      {
        heightFt,
        periodS: observation.periodS,
        directionDeg: observation.directionDeg,
      },
      null,
      null,
    ],
    beach,
    source: "model_swell",
    rawHeightFt: heightFt,
    periodS: observation.periodS,
    swellDirectionDeg: observation.directionDeg,
  });

  console.log("=== OB Pier south-swell validation ===");
  console.log({
    station: "CDIP 220 Mission Bay West",
    observation_time: observation.time,
    cdip_hs_m: Number(observation.heightM.toFixed(3)),
    cdip_hs_ft: Number(heightFt.toFixed(2)),
    period_s: Number(observation.periodS.toFixed(1)),
    direction_deg: Math.round(observation.directionDeg),
    caveat: "CDIP 220 is offshore Hs; this validates upstream swell arrival before beach face-height transform.",
  });

  console.log("\n=== Fixed OB Pier transform comparison ===");
  console.log({
    swell_window_center_deg: beach.swell_window_center_deg,
    swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
    strict_alignment: Number(strictAlignment.toFixed(6)),
    model_access_factor: Number(modelAccess.toFixed(6)),
    cdip_direct_access_factor: Number(cdipDirectAccess.toFixed(6)),
    period_factor: Number(periodFactor.toFixed(3)),
    old_strict_component_contribution_ft: Number(oldStrictContributionFt.toFixed(2)),
    new_cdip_direct_face_ft: newCdipDirect.faceHeightFt,
    new_cdip_direct_path: newCdipDirect.path,
    new_model_face_ft: newModel.faceHeightFt,
    new_model_path: newModel.path,
  });

  console.log("\n=== Verdict ===");
  console.log(
    cdipDirectAccess > 0 &&
      cdipDirectAccess < modelAccess &&
      newCdipDirect.path === "decomposed"
      ? "PASS: CDIP/direct long-period south swell now gets a scaled nonzero terrain floor without the model-source baseline."
      : "FAIL: CDIP/direct path is still zeroed or falling back.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
