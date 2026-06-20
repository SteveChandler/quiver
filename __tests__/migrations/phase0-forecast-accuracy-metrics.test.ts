import { readFileSync } from "fs";
import { join } from "path";
import {
  expectSqlAllowedWaveSourceCtes,
  expectSqlDisplayWaveSourceAllowlists,
} from "../helpers/sql-wave-source-tags";

describe("Migration: Phase 0 forecast accuracy metrics", () => {
  const migrationPath = join(
    __dirname,
    "../../supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql"
  );
  const rollbackPath = join(
    __dirname,
    "../../supabase/rollbacks/20260618160000_phase0_forecast_accuracy_metrics_rollback.sql"
  );
  const preflightPath = join(
    __dirname,
    "../../scripts/db/phase0-forecast-accuracy-preflight.sql"
  );
  const postflightPath = join(
    __dirname,
    "../../scripts/db/phase0-forecast-accuracy-postflight.sql"
  );
  const dataReadinessPath = join(
    __dirname,
    "../../scripts/db/phase0-forecast-accuracy-data-readiness.sql"
  );
  const snapshotLoggingHealthPath = join(
    __dirname,
    "../../scripts/db/phase0-snapshot-logging-health.sql"
  );
  let migrationSQL: string;
  let rollbackSQL: string;
  let preflightSQL: string;
  let postflightSQL: string;
  let dataReadinessSQL: string;
  let snapshotLoggingHealthSQL: string;

  beforeAll(() => {
    migrationSQL = readFileSync(migrationPath, "utf8");
    rollbackSQL = readFileSync(rollbackPath, "utf8");
    preflightSQL = readFileSync(preflightPath, "utf8");
    postflightSQL = readFileSync(postflightPath, "utf8");
    dataReadinessSQL = readFileSync(dataReadinessPath, "utf8");
    snapshotLoggingHealthSQL = readFileSync(snapshotLoggingHealthPath, "utf8");
  });

  it("is wrapped in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  it("requires an explicit approval token before mutating schema", () => {
    expect(migrationSQL).toContain(
      "current_setting('app.phase0_forecast_accuracy_migration_approved', true)"
    );
    expect(migrationSQL).toContain(
      "2026-06-19-phase0-forecast-accuracy-metrics-approved"
    );
    expect(migrationSQL).toContain(
      "Phase 0 forecast accuracy migration requires explicit human approval"
    );
    expect(migrationSQL.indexOf("current_setting")).toBeLessThan(
      migrationSQL.indexOf("ALTER TABLE public.ml_predictions_log")
    );
  });

  it("creates the canonical horizon/baseline accuracy RPC", () => {
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_forecast_accuracy_horizon_metrics/i
    );
    expect(migrationSQL).toContain("0-24h");
    expect(migrationSQL).toContain("25-72h");
    expect(migrationSQL).toContain("73h+");
    expect(migrationSQL).toContain("current_display");
    expect(migrationSQL).toContain("raw_display");
    expect(migrationSQL).toContain("raw_om");
    expect(migrationSQL).toContain("v5_shadow");
  });

  it("adds and backfills the canonical horizon bucket column", () => {
    expect(migrationSQL).toMatch(
      /ALTER TABLE public\.ml_predictions_log\s+ADD COLUMN IF NOT EXISTS forecast_horizon_bucket text/i
    );
    expect(migrationSQL).toMatch(
      /ml_predictions_log_forecast_horizon_bucket_check/i
    );
    expect(migrationSQL).toMatch(
      /UPDATE public\.ml_predictions_log\s+SET forecast_horizon_bucket = CASE/i
    );
    expect(migrationSQL).toContain("WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'");
    expect(migrationSQL).toContain("WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'");
    expect(migrationSQL).toContain("WHEN forecast_horizon_hours >= 73 THEN '73h+'");
  });

  it("adds source provenance needed for proposed display replay", () => {
    expect(migrationSQL).toMatch(
      /ALTER TABLE public\.ml_predictions_log\s+ADD COLUMN IF NOT EXISTS display_wave_source text/i
    );
    expect(migrationSQL).toMatch(
      /ALTER TABLE public\.ml_predictions_log\s+ADD COLUMN IF NOT EXISTS display_raw_input_height_m numeric\(5,3\)/i
    );
    expect(migrationSQL).toContain("ml_predictions_log_display_wave_source_check");
    expect(migrationSQL).toContain(
      "ml_predictions_log_display_raw_input_height_nonnegative_check"
    );
    expect(migrationSQL).toContain("OR display_raw_input_height_m >= 0");
    expectSqlDisplayWaveSourceAllowlists(migrationSQL);
    expect(migrationSQL).toContain(
      "Required for replaying proposed shoaling factors"
    );
  });

  it("replaces one-row-per-slot uniqueness with per-horizon snapshot uniqueness", () => {
    expect(migrationSQL).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_predictions_display_horizon_source_unique\s+ON public\.ml_predictions_log \(beach_id, predicted_at, forecast_horizon_bucket, display_source\)/i
    );
    expect(migrationSQL).toMatch(/NULLS NOT DISTINCT/i);
    expect(migrationSQL).toMatch(
      /DROP INDEX IF EXISTS public\.idx_ml_predictions_beach_predicted_at_unique/i
    );
  });

  it("has a guarded rollback for restoring the legacy conflict target", () => {
    expect(rollbackSQL).toMatch(/^BEGIN;/m);
    expect(rollbackSQL).toMatch(/^COMMIT;/m);
    expect(rollbackSQL).toContain(
      "current_setting('app.phase0_forecast_accuracy_rollback_approved', true)"
    );
    expect(rollbackSQL).toContain(
      "2026-06-19-phase0-forecast-accuracy-rollback-approved"
    );
    expect(rollbackSQL).toContain(
      "Phase 0 forecast accuracy rollback requires explicit human approval"
    );
    expect(rollbackSQL.indexOf("current_setting")).toBeLessThan(
      rollbackSQL.indexOf(
        "DROP INDEX IF EXISTS public.idx_ml_predictions_display_horizon_source_unique"
      )
    );
    expect(rollbackSQL).toContain(
      "Cannot restore idx_ml_predictions_beach_predicted_at_unique"
    );
    expect(rollbackSQL).toMatch(
      /GROUP BY beach_id, predicted_at[\s\S]*HAVING COUNT\(\*\) > 1/i
    );
    expect(rollbackSQL).toMatch(
      /DROP INDEX IF EXISTS public\.idx_ml_predictions_display_horizon_source_unique/i
    );
    expect(rollbackSQL).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_predictions_beach_predicted_at_unique\s+ON public\.ml_predictions_log \(beach_id, predicted_at\)/i
    );
  });

  it("has a read-only production preflight for the unique-index swap", () => {
    expect(preflightSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(preflightSQL).toMatch(/^ROLLBACK;/m);
    expect(preflightSQL).toContain("phase0_required_columns");
    expect(preflightSQL).toContain("('created_at')");
    expect(preflightSQL).toContain("('model_version')");
    expect(preflightSQL).toContain("phase0_required_columns_assertion");
    expect(preflightSQL).toContain(
      "phase0_required_columns_assertion_passed"
    );
    expect(preflightSQL).toContain(
      "phase0_new_unique_index_duplicate_risk"
    );
    expect(preflightSQL).toContain(
      "phase0_new_unique_index_duplicate_risk_assertion"
    );
    expect(preflightSQL).toMatch(
      /GROUP BY beach_id, predicted_at, forecast_horizon_bucket, display_source/i
    );
    expect(preflightSQL).toContain(
      "WHEN duplicate_groups = 0 AND duplicate_rows = 0 THEN 1"
    );
    expect(preflightSQL).toContain(
      "phase0_new_unique_index_duplicate_risk_assertion_passed"
    );
    expect(preflightSQL).toContain(
      "phase0_face_hs_display_source_contract_30d"
    );
    expect(preflightSQL).toContain(
      "phase0_face_hs_display_source_contract_assertion"
    );
    expect(preflightSQL).toContain(
      "phase0_face_hs_display_source_contract_assertion_passed"
    );
    expect(preflightSQL).toContain(
      "model_version_face_hs_without_display_source_rows"
    );
    expect(preflightSQL).toContain(
      "model_version = 'face-Hs-transformer-v1'"
    );
    expect(preflightSQL).toContain(
      "display_source = 'face-Hs-transformer-v1'"
    );
    expect(preflightSQL).toContain(
      "idx_ml_predictions_display_horizon_source_unique"
    );
    expect(preflightSQL).toContain("phase0_current_horizon_coverage_30d");
    expect(preflightSQL).toContain(
      "phase0_current_short_horizon_freshness_24h"
    );
    expect(preflightSQL).toContain(
      "phase0_legacy_current_0_72h_slot_horizon_shape"
    );
    expect(preflightSQL).toContain("phase0_preflight_readiness_summary");
    expect(preflightSQL).toContain("required_columns_present");
    expect(preflightSQL).toContain(
      "new_unique_index_duplicate_risk_clear"
    );
    expect(preflightSQL).toContain(
      "face_hs_display_source_contract_clear"
    );
    expect(preflightSQL).toContain(
      "legacy_short_horizon_starvation_detected"
    );
    expect(preflightSQL).toContain("pre_migration_schema_shape_clear");
    expect(preflightSQL).toContain("forecast_horizon_bucket_column_present");
    expect(preflightSQL).toContain("display_wave_source_column_present");
    expect(preflightSQL).toContain(
      "display_raw_input_height_column_present"
    );
    expect(preflightSQL).toContain("canonical_accuracy_rpc_present");
    expect(preflightSQL).toContain(
      "can_request_phase0_migration_approval"
    );
    expect(preflightSQL).toContain("phase0_preflight_blockers");
    expect(preflightSQL).toContain("blocker_code");
    expect(preflightSQL).toContain("blocker_message");
    expect(preflightSQL).toContain("required_columns_missing");
    expect(preflightSQL).toContain("new_unique_index_duplicate_risk");
    expect(preflightSQL).toContain(
      "face_hs_display_source_contract_failed"
    );
    expect(preflightSQL).toContain("legacy_unique_index_missing");
    expect(preflightSQL).toContain(
      "horizon_source_unique_index_already_present"
    );
    expect(preflightSQL).toContain(
      "forecast_horizon_bucket_column_already_present"
    );
    expect(preflightSQL).toContain(
      "display_wave_source_column_already_present"
    );
    expect(preflightSQL).toContain(
      "display_raw_input_height_column_already_present"
    );
    expect(preflightSQL).toContain("canonical_accuracy_rpc_already_present");
    expect(preflightSQL).toContain("phase0_preflight_assertions_passed");
    expect(preflightSQL).toContain("\\gset");
    expect(preflightSQL).toContain("RAISE EXCEPTION");
    expect(preflightSQL).toContain(
      "Phase 0 forecast accuracy preflight failed; see phase0_preflight_blockers and phase0_preflight_readiness_summary above."
    );
    expect(preflightSQL).toMatch(
      /AND pre_migration_schema_shape_clear[\s\S]*AS can_request_phase0_migration_approval/i
    );
    expect(preflightSQL).toContain(
      "created_at >= now() - interval '24 hours'"
    );
    expect(preflightSQL).toContain(
      "predicted_at < now() + interval '72 hours'"
    );
    expect(preflightSQL).toContain("logged_horizon_bucket");
    expect(preflightSQL).toContain("created_last_24h");
    expect(preflightSQL).not.toContain("1 / CASE");
    expect(preflightSQL).not.toContain("1 / 0");
  });

  it("has a read-only postflight that proves the migrated metric path is live", () => {
    expect(postflightSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(postflightSQL).toMatch(/^ROLLBACK;/m);
    expect(postflightSQL).toContain("phase0_expected_objects");
    expect(postflightSQL).toContain("phase0_schema_assertions_passed");
    expect(postflightSQL).toContain(
      "idx_ml_predictions_display_horizon_source_unique"
    );
    expect(postflightSQL).toContain(
      "idx_ml_predictions_beach_predicted_at_unique"
    );
    expect(postflightSQL).toContain(
      "ml_predictions_log_display_wave_source_check"
    );
    expect(postflightSQL).toContain(
      "ml_predictions_log_display_raw_input_height_nonnegative_check"
    );
    expect(postflightSQL).toContain(
      "public.get_forecast_accuracy_horizon_metrics"
    );
    expect(postflightSQL).toContain("get_ml_weekly_metrics");
    expect(postflightSQL).toContain("get_ml_health_metrics");
    expect(postflightSQL).toContain(
      "get_forecast_accuracy_horizon_metrics live baseline columns"
    );
    expect(postflightSQL).toContain(
      "get_ml_weekly_metrics live display columns"
    );
    expect(postflightSQL).toContain(
      "get_ml_health_metrics live display columns"
    );
    expect(postflightSQL).toContain("p.raw_display_height_m");
    expect(postflightSQL).toContain("p.offset_corrected_display_height_m");
    expect(postflightSQL).toContain("p.wave_height_om");
    expect(postflightSQL).toContain("p.v5_shadow_height_m");
    expect(postflightSQL).toContain("POSITION('p.raw_error_m'");
    expect(postflightSQL).toContain("POSITION('p.corrected_error_m'");
    expect(postflightSQL).toContain("POSITION('p.corrected_forecast_m'");
    expect(postflightSQL).toContain(
      "sync_session_wave_observation_candidate"
    );
    expect(postflightSQL).toContain(
      "p.display_source = ''face-Hs-transformer-v1''"
    );
    expect(postflightSQL).toContain("phase0_postflight_blockers");
    expect(postflightSQL).toContain("blocker_code");
    expect(postflightSQL).toContain("missing_");
    expect(postflightSQL).toContain("unexpected_");
    expect(postflightSQL).toContain(
      "REGEXP_REPLACE(LOWER(object_name), '[^a-z0-9]+', '_', 'g')"
    );
    expect(postflightSQL).toContain(
      "WHERE exists_now IS DISTINCT FROM expected_exists"
    );
    expect(postflightSQL).toContain("\\gset");
    expect(postflightSQL).toContain("RAISE EXCEPTION");
    expect(postflightSQL).toContain(
      "Phase 0 forecast accuracy postflight failed; see phase0_postflight_blockers and phase0_expected_objects above."
    );
    expect(postflightSQL).toContain("phase0_metric_rpc_sample_7d");
    expect(postflightSQL).toContain("phase0_horizon_coverage_24h");
    expect(postflightSQL).not.toContain("1 / CASE");
    expect(postflightSQL).not.toContain("1 / 0");
  });

  it("has a read-only data-readiness gate for fresh short-horizon proof", () => {
    expect(dataReadinessSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(dataReadinessSQL).toMatch(/^ROLLBACK;/m);
    expect(dataReadinessSQL).toContain("phase0_data_readiness_24h");
    expect(dataReadinessSQL).toContain("phase0_data_readiness_30d");
    expect(dataReadinessSQL).toContain("phase0_data_readiness_schema_state");
    expect(dataReadinessSQL).toContain(
      "phase0_data_readiness_has_phase0_schema"
    );
    expect(dataReadinessSQL).toContain(
      "phase0_data_readiness_schema_assertion"
    );
    expect(dataReadinessSQL).toContain("phase0_data_readiness_assertions");
    expect(dataReadinessSQL).toContain("phase0_data_readiness_blockers");
    expect(dataReadinessSQL).toContain("blocker_code");
    expect(dataReadinessSQL).toContain("blocker_message");
    expect(dataReadinessSQL).toContain("phase0_metric_rpc_readiness_30d");
    expect(dataReadinessSQL).toContain(
      "fresh_0_24h_snapshot_rows_present"
    );
    expect(dataReadinessSQL).toContain(
      "fresh_25_72h_snapshot_rows_present"
    );
    expect(dataReadinessSQL).toContain(
      "fresh_short_horizon_source_provenance_complete"
    );
    expect(dataReadinessSQL).toContain(
      "fresh_short_horizon_bucket_provenance_complete"
    );
    expect(dataReadinessSQL).toContain("observed_0_72h_rows_at_least_75");
    expect(dataReadinessSQL).toContain(
      "observed_0_72h_horizon_bucket_provenance_at_least_75"
    );
    expect(dataReadinessSQL).toContain(
      "observed_0_72h_source_provenance_at_least_75"
    );
    expect(dataReadinessSQL).toContain(
      "observed_0_72h_approval_provenance_at_least_75"
    );
    expect(dataReadinessSQL).toContain(
      "canonical_metric_0_72h_required_baselines_present"
    );
    expect(dataReadinessSQL).toContain(
      "schema_forecast_horizon_bucket_missing"
    );
    expect(dataReadinessSQL).toContain("schema_display_wave_source_missing");
    expect(dataReadinessSQL).toContain(
      "schema_display_raw_input_height_missing"
    );
    expect(dataReadinessSQL).toContain(
      "schema_canonical_accuracy_rpc_missing"
    );
    expect(dataReadinessSQL).toContain("stored_horizon_bucket");
    expect(dataReadinessSQL).toContain("effective_horizon_bucket");
    expect(dataReadinessSQL).toContain(
      "rows_with_horizon_bucket_provenance"
    );
    expect(dataReadinessSQL).toContain(
      "rows_missing_horizon_bucket_provenance"
    );
    expect(dataReadinessSQL).toContain(
      "observed_rows_with_horizon_bucket_provenance"
    );
    expect(dataReadinessSQL).toContain(
      "observed_rows_with_approval_provenance"
    );
    expect(dataReadinessSQL).toContain(
      "created_at >= now() - interval '24 hours'"
    );
    expect(dataReadinessSQL).toContain(
      "predicted_at >= now() - interval '30 days'"
    );
    expect(dataReadinessSQL).toContain(
      "stored_horizon_bucket IN ('0-24h', '25-72h')"
    );
    expect(dataReadinessSQL).toContain(
      "forecast_horizon_hours BETWEEN 0 AND 24"
    );
    expect(dataReadinessSQL).toContain(
      "forecast_horizon_hours BETWEEN 25 AND 72"
    );
    expect(dataReadinessSQL).toContain(
      "display_source = 'face-Hs-transformer-v1'"
    );
    expect(dataReadinessSQL).toContain("display_wave_source");
    expect(dataReadinessSQL).toContain(
      "allowed_wave_sources(source_tag) AS"
    );
    expect(dataReadinessSQL).toContain(
      "FROM allowed_wave_sources"
    );
    expect(dataReadinessSQL).toContain(
      "WHERE source_tag = display_wave_source"
    );
    expect(dataReadinessSQL).not.toContain("display_wave_source IN (");
    expect(dataReadinessSQL).not.toContain("display_wave_source NOT IN (");
    expectSqlAllowedWaveSourceCtes(dataReadinessSQL);
    expect(dataReadinessSQL).toContain("display_raw_input_height_m");
    expect(dataReadinessSQL).toContain("display_raw_input_height_m >= 0");
    expect(dataReadinessSQL).toContain("display_raw_input_height_m < 0");
    expect(dataReadinessSQL).toContain(
      "public.get_forecast_accuracy_horizon_metrics"
    );
    expect(dataReadinessSQL).toContain("'current_display'::text");
    expect(dataReadinessSQL).toContain("'raw_display'::text");
    expect(dataReadinessSQL).toContain("'raw_om'::text");
    expect(dataReadinessSQL).toContain("'v5_shadow'::text");
    expect(dataReadinessSQL).toContain("metrics.mae_m");
    expect(dataReadinessSQL).toContain("metrics.bias_m");
    expect(dataReadinessSQL).toContain("metrics.mae_m >= 0");
    expect(dataReadinessSQL).toContain(
      "metrics.mae_m::text NOT IN ('NaN', 'Infinity', '-Infinity')"
    );
    expect(dataReadinessSQL).toContain(
      "metrics.bias_m::text NOT IN ('NaN', 'Infinity', '-Infinity')"
    );
    expect(dataReadinessSQL).toMatch(/bool_and\(passed\)/);
    expect(dataReadinessSQL).toContain("\\gset");
    expect(dataReadinessSQL).toContain("RAISE EXCEPTION");
    expect(dataReadinessSQL).toContain(
      "Phase 0 forecast accuracy data readiness failed"
    );
    expect(dataReadinessSQL).toContain(
      "phase0_data_readiness_blockers, phase0_data_readiness_assertions"
    );
    expect(dataReadinessSQL).not.toContain("1 / CASE");
    expect(dataReadinessSQL).not.toContain("1 / 0");
  });

  it("has a read-only deployed snapshot logging health gate", () => {
    expect(snapshotLoggingHealthSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(snapshotLoggingHealthSQL).toMatch(/^ROLLBACK;/m);
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_min_created_at"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "\\if :{?phase0_snapshot_min_created_at}"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_parameters"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_schema_state"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_health_has_phase0_schema"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_health_has_partial_phase0_schema"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "bool_or(exists_now) AND NOT bool_and(exists_now)"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "\\if :phase0_snapshot_health_has_partial_phase0_schema"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_partial_schema_assertion"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_partial_schema_assertion_passed"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "\\elif :phase0_snapshot_health_has_phase0_schema"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_phase0_window"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_legacy_window"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_assertions"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_assertions_passed"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_snapshot_logging_health_blockers"
    );
    expect(snapshotLoggingHealthSQL).toContain("blocker_code");
    expect(snapshotLoggingHealthSQL).toContain("blocker_message");
    expect(snapshotLoggingHealthSQL).toContain("partial_phase0_schema");
    expect(snapshotLoggingHealthSQL).toContain(
      "recent_face_hs_rows_present"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "legacy_recent_face_hs_rows_present"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "legacy_model_version_contract_complete"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "legacy_horizon_hours_valid"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "legacy_display_heights_complete"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_horizon_bucket_provenance_complete"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_fresh_0_24h_rows_present"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_fresh_25_72h_rows_present"
    );
    expect(snapshotLoggingHealthSQL).toContain("fresh_0_24h_rows > 0");
    expect(snapshotLoggingHealthSQL).toContain("fresh_25_72h_rows > 0");
    expect(snapshotLoggingHealthSQL).toContain(
      "phase0_replay_provenance_complete"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "display_heights_complete"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "display_source = 'face-Hs-transformer-v1'"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "model_version = 'face-Hs-transformer-v1'"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "forecast_horizon_hours BETWEEN 0 AND 168"
    );
    expect(snapshotLoggingHealthSQL).toContain("forecast_horizon_bucket");
    expect(snapshotLoggingHealthSQL).toContain("display_wave_source");
    expect(snapshotLoggingHealthSQL).toContain(
      "allowed_wave_sources(source_tag) AS"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "FROM allowed_wave_sources"
    );
    expect(snapshotLoggingHealthSQL).toContain(
      "WHERE source_tag = display_wave_source"
    );
    expect(snapshotLoggingHealthSQL).not.toContain("display_wave_source IN (");
    expect(snapshotLoggingHealthSQL).not.toContain(
      "display_wave_source NOT IN ("
    );
    expectSqlAllowedWaveSourceCtes(snapshotLoggingHealthSQL);
    expect(snapshotLoggingHealthSQL).toContain("display_raw_input_height_m");
    expect(snapshotLoggingHealthSQL).toContain("display_raw_input_height_m >= 0");
    expect(snapshotLoggingHealthSQL).toContain("display_raw_input_height_m < 0");
    expect(snapshotLoggingHealthSQL).toContain("\\gset");
    expect(snapshotLoggingHealthSQL).toContain("RAISE EXCEPTION");
    expect(snapshotLoggingHealthSQL).toContain(
      "Phase 0 snapshot logging health failed; see phase0_snapshot_logging_health_blockers and phase0_snapshot_logging_health_assertions above."
    );
    expect(snapshotLoggingHealthSQL).not.toContain("1 / CASE");
    expect(snapshotLoggingHealthSQL).not.toContain("1 / 0");
  });

  it("computes MAE against observed_m from live display and comparator columns", () => {
    const canonicalStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_forecast_accuracy_horizon_metrics"
    );
    const canonicalEnd = migrationSQL.indexOf(
      "COMMENT ON FUNCTION public.get_forecast_accuracy_horizon_metrics",
      canonicalStart
    );
    const canonicalSQL = migrationSQL.slice(canonicalStart, canonicalEnd);

    expect(canonicalSQL).toContain("p.observed_m > 0");
    expect(canonicalSQL).toContain("e.offset_corrected_display_height_m");
    expect(canonicalSQL).toContain("e.raw_display_height_m");
    expect(canonicalSQL).toContain("e.wave_height_om");
    expect(canonicalSQL).toContain("e.v5_shadow_height_m");
    expect(canonicalSQL).toContain(
      "p.display_source = 'face-Hs-transformer-v1'"
    );
    expect(canonicalSQL).toMatch(/AVG\(ABS\(expanded\.signed_error\)\)/);
    expect(canonicalSQL).not.toContain("raw_error_m");
    expect(canonicalSQL).not.toContain("corrected_error_m");
    expect(canonicalSQL).not.toContain("corrected_forecast_m");
  });

  it("tie-breaks session feedback toward the shortest horizon snapshot", () => {
    const matcherStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.sync_session_wave_observation_candidate"
    );
    const matcherSQL = migrationSQL.slice(matcherStart);

    expect(matcherSQL).toContain("CASE p.forecast_horizon_bucket");
    expect(matcherSQL).toContain(
      "p.display_source = 'face-Hs-transformer-v1'"
    );
    expect(matcherSQL).toContain("WHEN '0-24h' THEN 1");
    expect(matcherSQL).toContain("WHEN '25-72h' THEN 2");
    expect(matcherSQL).toContain("WHEN '73h+' THEN 3");
    expect(matcherSQL).toMatch(/p\.forecast_horizon_hours ASC NULLS LAST/i);
    expect(matcherSQL).not.toMatch(/UPDATE public\.ml_predictions_log[\s\S]*observed_m\s+=/i);
  });

  it("repoints existing dashboard RPCs away from retired error columns", () => {
    const healthStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_ml_health_metrics"
    );
    const healthSQL = migrationSQL.slice(healthStart);
    const weeklyStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_ml_weekly_metrics"
    );
    const weeklyEnd = migrationSQL.indexOf(
      "COMMENT ON FUNCTION public.get_ml_weekly_metrics",
      weeklyStart
    );
    const weeklySQL = migrationSQL.slice(weeklyStart, weeklyEnd);

    expect(healthSQL).toContain("p.raw_display_height_m");
    expect(healthSQL).toContain("p.offset_corrected_display_height_m");
    expect(weeklySQL).toContain("p.raw_display_height_m");
    expect(weeklySQL).toContain("p.offset_corrected_display_height_m");
    expect(healthSQL).toContain("p.display_source = 'face-Hs-transformer-v1'");
    expect(weeklySQL).toContain("p.display_source = 'face-Hs-transformer-v1'");
    expect(healthSQL).not.toContain("p.raw_error_m");
    expect(healthSQL).not.toContain("p.corrected_error_m");
    expect(weeklySQL).not.toContain("p.raw_error_m");
    expect(weeklySQL).not.toContain("p.corrected_error_m");
  });
});
