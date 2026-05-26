/**
 * Approval-gated v5 shadow backfill for ml_predictions_log.
 *
 * This script only updates v5 shadow fields. It never mutates wind fields,
 * display heights, observed values, error columns, or forecast-source fields.
 * Any value recovered from enhanced_forecasts is tagged as backfill_hindcast
 * because it is not guaranteed to be the original issue-time input.
 *
 * Dry run:
 *   corepack yarn tsx scripts/backfill-stale-v5-shadow.ts \
 *     --target om-present-null-v5 \
 *     --since 2026-05-10 \
 *     --until 2026-05-22 \
 *     --calibration-version v5_c.20260525_0630 \
 *     --dry-run
 *
 * Write mode requires:
 *   --write --confirm=BACKFILL_V5_HINDCAST
 */
import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { createServiceRoleClient } from "../lib/supabase";
import {
  computeV5Shadow,
  getActiveCalibration,
  type CalibrationVersion,
} from "../lib/services/forecast/calibration-v5";

export const BACKFILL_CONFIRMATION = "BACKFILL_V5_HINDCAST";

type TargetMode = "may2-bootstrap" | "om-present-null-v5";

export type CliOptions = {
  target: TargetMode;
  since: string;
  until: string;
  calibrationVersion: string | null;
  dryRun: boolean;
  write: boolean;
  confirm: string | null;
};

export type BackfillSourceRow = {
  id: string;
  beach_id: string;
  predicted_at: string;
  wave_height_om: number | null;
  wave_direction_deg: number | null;
};

type EnhancedRow = {
  beach_id: string;
  forecast_at: string;
  wave_height_om: number | null;
  wave_direction_om: number | null;
};

export type V5Patch = {
  v5_shadow_height_m: number;
  v5_model_version: string;
  direction_bucket: string;
  om_bucket: string;
};

export type BackfillPatch = {
  id: string;
  patch: V5Patch;
};

const BATCH_SIZE = 100;

function loadEnvFiles(cwd: string = process.cwd()): void {
  for (const name of [".env.production.local", ".env.local", ".env"]) {
    const envPath = path.join(cwd, name);
    if (fs.existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false });
    }
  }
}

function readOption(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function parseTarget(value: string | null): TargetMode {
  if (value == null) return "may2-bootstrap";
  if (value === "may2-bootstrap" || value === "om-present-null-v5") {
    return value;
  }
  throw new Error(`Unsupported --target ${value}`);
}

export function parseCliArgs(argv: string[]): CliOptions {
  const target = parseTarget(readOption(argv, "--target"));
  const write = hasFlag(argv, "--write");
  const explicitDryRun = hasFlag(argv, "--dry-run");
  if (write && explicitDryRun) {
    throw new Error("--write and --dry-run are mutually exclusive");
  }

  const confirm = readOption(argv, "--confirm");
  if (write && confirm !== BACKFILL_CONFIRMATION) {
    throw new Error(`--write requires --confirm=${BACKFILL_CONFIRMATION}`);
  }

  const since =
    readOption(argv, "--since") ??
    (target === "may2-bootstrap" ? "2026-05-02" : null);
  const until =
    readOption(argv, "--until") ??
    (target === "may2-bootstrap" ? "2026-05-03" : null);

  if (!since || !until) {
    throw new Error("--since and --until are required for this target");
  }

  return {
    target,
    since,
    until,
    calibrationVersion: readOption(argv, "--calibration-version"),
    dryRun: !write,
    write,
    confirm,
  };
}

export function buildV5Patch(
  row: BackfillSourceRow,
  calibration: CalibrationVersion
): BackfillPatch | null {
  if (row.wave_height_om == null) return null;

  const v5 = computeV5Shadow({
    wave_height_om_m: row.wave_height_om,
    primary_swell_direction_deg: row.wave_direction_deg,
    calibration,
  });
  if (!v5) return null;

  return {
    id: row.id,
    patch: {
      v5_shadow_height_m: v5.v5_shadow_height_m,
      v5_model_version: `${v5.v5_model_version}.backfill_hindcast`,
      direction_bucket: v5.direction_bucket,
      om_bucket: v5.om_bucket,
    },
  };
}

async function loadCalibration(
  supabase: ReturnType<typeof createServiceRoleClient>,
  version: string | null
): Promise<CalibrationVersion | null> {
  if (!version) {
    return getActiveCalibration();
  }

  const { data, error } = await supabase
    .from("ml_calibration_versions" as never)
    .select("version, knots, g_dir, guardrails")
    .eq("version", version)
    .maybeSingle();

  if (error) {
    throw new Error(`calibration select failed: ${error.message}`);
  }
  return data as unknown as CalibrationVersion | null;
}

async function fetchMlRows(
  supabase: ReturnType<typeof createServiceRoleClient>,
  options: CliOptions
): Promise<BackfillSourceRow[]> {
  const rows: BackfillSourceRow[] = [];
  let offset = 0;
  while (true) {
    let query = supabase
      .from("ml_predictions_log")
      .select(
        "id, beach_id, predicted_at, wave_height_om, wave_direction_deg"
      )
      .gte("created_at", options.since)
      .lt("created_at", options.until)
      .is("v5_shadow_height_m", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);

    if (options.target === "om-present-null-v5") {
      query = query.not("wave_height_om", "is", null);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`ml_predictions_log select failed: ${error.message}`);
    }
    const page = (data as BackfillSourceRow[]) ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function loadEnhancedRows(
  supabase: ReturnType<typeof createServiceRoleClient>,
  stale: BackfillSourceRow[]
): Promise<Map<string, EnhancedRow>> {
  const efMap = new Map<string, EnhancedRow>();
  if (stale.length === 0) return efMap;

  const beachIds = Array.from(new Set(stale.map((row) => row.beach_id)));
  const allTs = stale.map((row) => row.predicted_at).sort();
  const minTs = allTs[0];
  const maxTs = allTs[allTs.length - 1];

  for (let i = 0; i < beachIds.length; i += 50) {
    const slice = beachIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("beach_id, forecast_at, wave_height_om, wave_direction_om")
      .in("beach_id", slice)
      .gte("forecast_at", minTs)
      .lte("forecast_at", maxTs);

    if (error) {
      throw new Error(`enhanced_forecasts select failed: ${error.message}`);
    }

    for (const row of ((data as EnhancedRow[]) ?? [])) {
      const key = `${row.beach_id}|${row.forecast_at}`;
      const existing = efMap.get(key);
      if (
        !existing ||
        (existing.wave_height_om == null && row.wave_height_om != null)
      ) {
        efMap.set(key, row);
      }
    }
  }

  return efMap;
}

async function loadSourceRows(
  supabase: ReturnType<typeof createServiceRoleClient>,
  options: CliOptions
): Promise<BackfillSourceRow[]> {
  const rows = await fetchMlRows(supabase, options);
  if (options.target === "om-present-null-v5") {
    return rows;
  }

  const efMap = await loadEnhancedRows(supabase, rows);
  return rows.map((row) => {
    if (row.wave_height_om != null) return row;
    const ef = efMap.get(`${row.beach_id}|${row.predicted_at}`);
    return {
      ...row,
      wave_height_om: ef?.wave_height_om ?? null,
      wave_direction_deg: ef?.wave_direction_om ?? row.wave_direction_deg,
    };
  });
}

async function writePatches(
  supabase: ReturnType<typeof createServiceRoleClient>,
  patches: BackfillPatch[]
): Promise<{ written: number; failed: number }> {
  let written = 0;
  let failed = 0;

  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const batch = patches.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((item) =>
        supabase
          .from("ml_predictions_log")
          .update(item.patch as never)
          .eq("id", item.id)
      )
    );

    for (const result of results) {
      if (result.error) failed += 1;
      else written += 1;
    }
    console.log(
      `[backfill] progress: ${written}/${patches.length} written, ${failed} failed`
    );
  }

  return { written, failed };
}

async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  loadEnvFiles();
  const supabase = createServiceRoleClient();

  console.log(`[backfill] mode: ${options.dryRun ? "DRY-RUN" : "WRITE"}`);
  console.log(`[backfill] target: ${options.target}`);
  console.log(`[backfill] created_at window: ${options.since} -> ${options.until}`);

  const calibration = await loadCalibration(supabase, options.calibrationVersion);
  if (!calibration) {
    throw new Error("[backfill] no calibration loaded");
  }
  console.log(`[backfill] calibration: ${calibration.version}`);

  const rows = await loadSourceRows(supabase, options);
  const patches = rows
    .map((row) => buildV5Patch(row, calibration))
    .filter((patch): patch is BackfillPatch => patch != null);

  console.log(`[backfill] candidate rows: ${rows.length}`);
  console.log(`[backfill] update patches: ${patches.length}`);
  console.log(
    `[backfill] skipped missing inputs: ${rows.length - patches.length}`
  );

  if (options.dryRun) {
    console.log("[backfill] DRY-RUN sample patches:");
    for (const patch of patches.slice(0, 3)) {
      console.log("  ", patch);
    }
    console.log("[backfill] DRY-RUN complete - no writes performed");
    return;
  }

  const { written, failed } = await writePatches(supabase, patches);
  console.log(`[backfill] DONE: ${written} written, ${failed} failed`);
  if (failed > 0) {
    throw new Error(`[backfill] ${failed} row updates failed`);
  }
}

const invokedPath = process.argv[1] ?? "";
if (
  invokedPath.endsWith("backfill-stale-v5-shadow.ts") ||
  invokedPath.endsWith("backfill-stale-v5-shadow.js")
) {
  main().catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  });
}
