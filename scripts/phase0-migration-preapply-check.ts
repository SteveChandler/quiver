#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";

import { validatePhase0GateEvidenceFile } from "./phase0-app-deploy-gate";

export const PHASE0_MIGRATION_APPROVAL_PLAN_TEXT = [
  "PHASE0_FORECAST_ACCURACY_MIGRATION_PLAN_V1",
  "migration: supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql",
  "rollback: supabase/rollbacks/20260618160000_phase0_forecast_accuracy_metrics_rollback.sql",
  "target: production Supabase quiverDB via POSTGRES_URL_NON_POOLING owner connection",
  "backup_artifact: /tmp/quiver-prod-phase0-forecast-accuracy-preapply-20260620.dump, fresh pg_dump within 24 hours required before apply",
  "preconditions:",
  "- Phase 0 application code has deployed before the migration.",
  "- Fresh post-deploy read-only Phase 0 app-deploy gate passes and its saved evidence validates with --require-deploy-start-utc.",
  "- Fresh local pg_dump backup artifact exists at backup_artifact and is less than 24 hours old.",
  "- Phase 0 migration pre-apply check passes against post-deploy evidence, backup artifact, and maintainer approval phrase.",
  "- Maintainer explicitly replies with the approval phrase for this plan hash.",
  "pre_apply_command:",
  'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/phase0-migration-preapply-check.ts --post-deploy-evidence-json /tmp/quiver-phase0-app-deploy-gate-post-deploy.json --backup-path /tmp/quiver-prod-phase0-forecast-accuracy-preapply-20260620.dump --approval-phrase "<maintainer approval phrase>"',
  "command:",
  'psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.phase0_forecast_accuracy_migration_approved = \'2026-06-19-phase0-forecast-accuracy-metrics-approved\';" -f supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql',
  "objects_affected:",
  "- public.ml_predictions_log columns forecast_horizon_bucket, display_wave_source, display_raw_input_height_m",
  "- public.ml_predictions_log CHECK constraints for horizon bucket, display wave source, and nonnegative raw input",
  "- indexes idx_ml_predictions_display_horizon_source_unique, idx_ml_predictions_horizon_bucket_observed, and legacy idx_ml_predictions_beach_predicted_at_unique removal",
  "- functions public.get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz), public.get_ml_weekly_metrics(), public.get_ml_health_metrics(), public.sync_session_wave_observation_candidate(...)",
  "post_apply:",
  '- psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-postflight.sql',
  "- wait for fresh 0-24h and 25-72h rows plus observation backfill",
  '- psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql',
  "- rerun Phase 0 harness and all scoped Phase 1/2/3 approval harnesses before any coverage write",
  "not_authorized_by_this_plan:",
  "- Phase 1 shoaling factor production write",
  "- Phase 2 terrain production write",
  "- Phase 3 analog or bathymetry production write",
  "- Track B event allowlist migration",
].join("\n");

export const PHASE0_MIGRATION_APPROVAL_PLAN_SHA256 = createHash("sha256")
  .update(PHASE0_MIGRATION_APPROVAL_PLAN_TEXT)
  .digest("hex");

export const PHASE0_MIGRATION_APPROVAL_PHRASE =
  `APPROVE: ${PHASE0_MIGRATION_APPROVAL_PLAN_SHA256}`;

const DEFAULT_MAX_EVIDENCE_AGE_HOURS = 24;
const DEFAULT_MAX_BACKUP_AGE_HOURS = 24;
const DEFAULT_MIN_BACKUP_BYTES = 1024;
const MAX_BACKUP_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface Phase0MigrationPreapplyCliOptions {
  evidenceJsonPath: string;
  backupPath: string;
  approvalPhrase: string;
  maxEvidenceAgeHours: number;
  maxBackupAgeHours: number;
  minBackupBytes: number;
}

export interface Phase0MigrationPreapplyValidationOptions {
  evidenceJsonPath: string;
  backupPath: string;
  approvalPhrase: string;
  maxEvidenceAgeHours?: number;
  maxBackupAgeHours?: number;
  minBackupBytes?: number;
  now?: Date;
}

export interface Phase0MigrationPreapplyValidationResult {
  ok: boolean;
  blockers: string[];
  evidence: {
    ok: boolean;
    blockers: string[];
  };
  backup: {
    path: string;
    exists: boolean;
    is_file: boolean;
    size_bytes: number | null;
    modified_at: string | null;
    age_hours: number | null;
  };
  approval_phrase_accepted: boolean;
}

export function parsePhase0MigrationPreapplyCliArgs(
  argv: string[]
): Phase0MigrationPreapplyCliOptions {
  let evidenceJsonPath: string | null = null;
  let backupPath: string | null = null;
  let approvalPhrase: string | null = null;
  let maxEvidenceAgeHours = DEFAULT_MAX_EVIDENCE_AGE_HOURS;
  let maxBackupAgeHours = DEFAULT_MAX_BACKUP_AGE_HOURS;
  let minBackupBytes = DEFAULT_MIN_BACKUP_BYTES;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--post-deploy-evidence-json") {
      evidenceJsonPath = readFlagValue(next, "--post-deploy-evidence-json");
      index += 1;
      continue;
    }
    if (arg.startsWith("--post-deploy-evidence-json=")) {
      evidenceJsonPath = readFlagValue(
        readInlineFlagValue(arg),
        "--post-deploy-evidence-json"
      );
      continue;
    }
    if (arg === "--backup-path") {
      backupPath = readFlagValue(next, "--backup-path");
      index += 1;
      continue;
    }
    if (arg.startsWith("--backup-path=")) {
      backupPath = readFlagValue(readInlineFlagValue(arg), "--backup-path");
      continue;
    }
    if (arg === "--approval-phrase") {
      approvalPhrase = readFlagValue(next, "--approval-phrase");
      index += 1;
      continue;
    }
    if (arg.startsWith("--approval-phrase=")) {
      approvalPhrase = readFlagValue(
        readInlineFlagValue(arg),
        "--approval-phrase"
      );
      continue;
    }
    if (arg === "--max-evidence-age-hours") {
      maxEvidenceAgeHours = parsePositiveInteger(
        readFlagValue(next, "--max-evidence-age-hours"),
        "--max-evidence-age-hours"
      );
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-evidence-age-hours=")) {
      maxEvidenceAgeHours = parsePositiveInteger(
        readFlagValue(readInlineFlagValue(arg), "--max-evidence-age-hours"),
        "--max-evidence-age-hours"
      );
      continue;
    }
    if (arg === "--max-backup-age-hours") {
      maxBackupAgeHours = parsePositiveInteger(
        readFlagValue(next, "--max-backup-age-hours"),
        "--max-backup-age-hours"
      );
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-backup-age-hours=")) {
      maxBackupAgeHours = parsePositiveInteger(
        readFlagValue(readInlineFlagValue(arg), "--max-backup-age-hours"),
        "--max-backup-age-hours"
      );
      continue;
    }
    if (arg === "--min-backup-bytes") {
      minBackupBytes = parsePositiveInteger(
        readFlagValue(next, "--min-backup-bytes"),
        "--min-backup-bytes"
      );
      index += 1;
      continue;
    }
    if (arg.startsWith("--min-backup-bytes=")) {
      minBackupBytes = parsePositiveInteger(
        readFlagValue(readInlineFlagValue(arg), "--min-backup-bytes"),
        "--min-backup-bytes"
      );
      continue;
    }

    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (!evidenceJsonPath) {
    throw new Error("--post-deploy-evidence-json is required.");
  }
  if (!backupPath) {
    throw new Error("--backup-path is required.");
  }
  if (!approvalPhrase) {
    throw new Error("--approval-phrase is required.");
  }

  return {
    evidenceJsonPath,
    backupPath,
    approvalPhrase,
    maxEvidenceAgeHours,
    maxBackupAgeHours,
    minBackupBytes,
  };
}

export async function validatePhase0MigrationPreapplyPacket(
  options: Phase0MigrationPreapplyValidationOptions
): Promise<Phase0MigrationPreapplyValidationResult> {
  const now = options.now ?? new Date();
  const maxEvidenceAgeHours =
    options.maxEvidenceAgeHours ?? DEFAULT_MAX_EVIDENCE_AGE_HOURS;
  const maxBackupAgeHours =
    options.maxBackupAgeHours ?? DEFAULT_MAX_BACKUP_AGE_HOURS;
  const minBackupBytes = options.minBackupBytes ?? DEFAULT_MIN_BACKUP_BYTES;
  const blockers: string[] = [];
  const evidence = await validatePhase0GateEvidenceFile(
    options.evidenceJsonPath,
    {
      maxEvidenceAgeHours,
      requireDeployStartUtc: true,
      now,
    }
  );

  if (!evidence.ok) {
    blockers.push(
      ...evidence.blockers.map((blocker) => `evidence_${blocker}`)
    );
  }

  const backup = await validateBackupArtifact({
    backupPath: options.backupPath,
    maxBackupAgeHours,
    minBackupBytes,
    now,
    blockers,
  });

  const normalizedApprovalPhrase = options.approvalPhrase.trim();
  const approvalPhraseAccepted =
    normalizedApprovalPhrase === PHASE0_MIGRATION_APPROVAL_PHRASE;
  if (normalizedApprovalPhrase.length === 0) {
    blockers.push("approval_phrase_missing");
  } else if (!approvalPhraseAccepted) {
    blockers.push("approval_phrase_mismatch");
  }

  return {
    ok: blockers.length === 0,
    blockers,
    evidence: {
      ok: evidence.ok,
      blockers: evidence.blockers,
    },
    backup,
    approval_phrase_accepted: approvalPhraseAccepted,
  };
}

async function validateBackupArtifact(options: {
  backupPath: string;
  maxBackupAgeHours: number;
  minBackupBytes: number;
  now: Date;
  blockers: string[];
}): Promise<Phase0MigrationPreapplyValidationResult["backup"]> {
  try {
    const backupStat = await stat(options.backupPath);
    const ageMs = options.now.getTime() - backupStat.mtime.getTime();
    const ageHours = roundHours(ageMs / (60 * 60 * 1000));

    if (!backupStat.isFile()) {
      options.blockers.push("backup_not_file");
    }
    if (backupStat.size < options.minBackupBytes) {
      options.blockers.push("backup_too_small");
    }
    if (ageMs < -MAX_BACKUP_FUTURE_SKEW_MS) {
      options.blockers.push("backup_mtime_in_future");
    }
    if (ageMs > options.maxBackupAgeHours * 60 * 60 * 1000) {
      options.blockers.push("backup_too_old");
    }

    return {
      path: options.backupPath,
      exists: true,
      is_file: backupStat.isFile(),
      size_bytes: backupStat.size,
      modified_at: backupStat.mtime.toISOString(),
      age_hours: ageHours,
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      options.blockers.push("backup_missing");
    } else {
      options.blockers.push("backup_stat_failed");
    }
    return {
      path: options.backupPath,
      exists: false,
      is_file: false,
      size_bytes: null,
      modified_at: null,
      age_hours: null,
    };
  }
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function readInlineFlagValue(arg: string): string {
  return arg.slice(arg.indexOf("=") + 1);
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return parsed;
}

function roundHours(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
  );
}

async function main(): Promise<void> {
  try {
    const options = parsePhase0MigrationPreapplyCliArgs(process.argv.slice(2));
    const result = await validatePhase0MigrationPreapplyPacket(options);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      console.error(
        `Phase 0 migration pre-apply check failed:\n- ${result.blockers.join(
          "\n- "
        )}`
      );
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

if (require.main === module) {
  void main();
}
