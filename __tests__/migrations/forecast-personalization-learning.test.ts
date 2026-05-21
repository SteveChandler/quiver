import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("forecast personalization learning migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260520120000_forecast_personalization_learning.sql"
    ),
    "utf8"
  );

  it("wraps function and trigger updates in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("matches session snapshots by nearest forecast_at instead of legacy date/time columns", () => {
    const snapshotFunctionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_session_forecast_snapshot()"
    );
    const snapshotFunctionSQL = migrationSQL.slice(snapshotFunctionStart);

    expect(snapshotFunctionSQL).toMatch(/ef\.forecast_at\s+IS\s+NOT\s+NULL/i);
    expect(snapshotFunctionSQL).toMatch(
      /ef\.forecast_at\s+BETWEEN\s+new\.arrival_time\s+-\s+interval\s+'6 hours'/i
    );
    expect(snapshotFunctionSQL).toMatch(
      /ORDER BY\s+abs\(EXTRACT\(EPOCH FROM \(ef\.forecast_at\s+-\s+new\.arrival_time\)\)\)\s+ASC/i
    );
    expect(snapshotFunctionSQL).not.toMatch(/ef\.forecast_date\s*=\s*new\.arrival_time::date/i);
    expect(snapshotFunctionSQL).not.toMatch(/ef\.forecast_time::time/i);
  });

  it("rematches existing completed-session snapshots when beach or arrival time changes", () => {
    const snapshotFunctionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_session_forecast_snapshot()"
    );
    const snapshotFunctionSQL = migrationSQL.slice(snapshotFunctionStart);

    expect(snapshotFunctionSQL).toMatch(/should_rematch_forecast\s+boolean\s+:=\s+false/i);
    expect(snapshotFunctionSQL).toMatch(/old\.arrival_time\s+IS\s+DISTINCT\s+FROM\s+new\.arrival_time/i);
    expect(snapshotFunctionSQL).toMatch(/old\.beach_id\s+IS\s+DISTINCT\s+FROM\s+new\.beach_id/i);
    expect(snapshotFunctionSQL).toMatch(/IF snapshot_exists AND NOT should_rematch_forecast THEN/i);
    expect(snapshotFunctionSQL).toMatch(/UPDATE public\.session_forecast_snapshots[\s\S]*forecast_snapshot\s+=\s+forecast_data/i);
    expect(snapshotFunctionSQL).toMatch(/DELETE FROM public\.session_forecast_snapshots[\s\S]*WHERE session_id = new\.id/i);
    expect(snapshotFunctionSQL).toMatch(/AFTER INSERT OR UPDATE OF[\s\S]*status,\s+beach_id,/i);
  });

  it("stores logged session wave height as weak observation candidates without mutating ML truth", () => {
    const observationFunctionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.sync_session_wave_observation_candidate("
    );
    const observationFunctionSQL = migrationSQL.slice(observationFunctionStart);
    const snapshotFunctionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_session_forecast_snapshot()"
    );
    const snapshotFunctionSQL = migrationSQL.slice(snapshotFunctionStart);

    expect(observationFunctionStart).toBeGreaterThan(-1);
    expect(migrationSQL).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.session_wave_observation_candidates/i
    );
    expect(migrationSQL).toMatch(/CONSTRAINT session_wave_observation_candidates_session_unique UNIQUE \(session_id\)/i);
    expect(migrationSQL).toMatch(/ALTER TABLE public\.session_wave_observation_candidates ENABLE ROW LEVEL SECURITY/i);
    expect(migrationSQL).toMatch(/TO service_role[\s\S]*USING \(true\)[\s\S]*WITH CHECK \(true\)/i);
    expect(observationFunctionSQL).toMatch(/SECURITY DEFINER/i);
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.sync_session_wave_observation_candidate\(uuid, uuid, uuid, timestamptz, text, numeric, text\) FROM PUBLIC, anon, authenticated/i
    );
    expect(snapshotFunctionSQL).toMatch(/SECURITY DEFINER/i);
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.create_session_forecast_snapshot\(\) FROM PUBLIC, anon, authenticated/i
    );
    expect(observationFunctionSQL).toMatch(/p_wave_height_ft\s+\*\s+0\.3048/i);
    expect(observationFunctionSQL).toMatch(
      /p\.predicted_at\s+BETWEEN\s+p_arrival_time\s+-\s+interval\s+'6 hours'/i
    );
    expect(observationFunctionSQL).toMatch(/quality_state,\s+rejection_reason,\s+observation_weight/i);
    expect(observationFunctionSQL).toMatch(/snapshot_display_height_m/i);
    expect(observationFunctionSQL).toMatch(/snapshot_raw_om_height_m/i);
    expect(observationFunctionSQL).toMatch(/snapshot_v5_shadow_height_m/i);
    expect(observationFunctionSQL).toMatch(/snapshot_buoy_observed_m/i);
    expect(observationFunctionSQL).not.toMatch(/UPDATE public\.ml_predictions_log[\s\S]*observed_m\s+=/i);
    expect(migrationSQL).not.toMatch(/CREATE OR REPLACE FUNCTION public\.apply_session_observation_to_ml_predictions/i);
    expect(snapshotFunctionSQL).toMatch(
      /PERFORM public\.sync_session_wave_observation_candidate\([\s\S]*new\.wave_height_ft,[\s\S]*'trigger'/i
    );
    expect(snapshotFunctionSQL).not.toMatch(/WHEN \(new\.status = 'completed'\)/i);
  });

  it("marks invalid or no-longer-completed session observations as rejected and backfills idempotently", () => {
    expect(migrationSQL).toMatch(/rejection_reason_text := 'session_not_completed'/i);
    expect(migrationSQL).toMatch(/rejection_reason_text := 'missing_wave_height_ft'/i);
    expect(migrationSQL).toMatch(/rejection_reason_text := 'invalid_wave_height_ft'/i);
    expect(migrationSQL).toMatch(/quality_state = 'rejected'/i);
    expect(migrationSQL).toMatch(/observation_weight = 0/i);
    expect(migrationSQL).toMatch(
      /SELECT public\.sync_session_wave_observation_candidate\([\s\S]*'backfill'[\s\S]*FROM public\.sessions s[\s\S]*WHERE s\.status = 'completed'/i
    );
    expect(migrationSQL).toMatch(/ON CONFLICT \(session_id\) DO UPDATE SET/i);
  });

  it("adds private weak-observation analytics without exposing user identifiers", () => {
    const analyticsFunctionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_session_wave_observation_analytics()"
    );
    const analyticsFunctionSQL = migrationSQL.slice(analyticsFunctionStart);

    expect(analyticsFunctionStart).toBeGreaterThan(-1);
    expect(analyticsFunctionSQL).toMatch(/RETURNS jsonb/i);
    expect(analyticsFunctionSQL).toMatch(/REVOKE ALL ON FUNCTION public\.get_session_wave_observation_analytics\(\) FROM PUBLIC, anon, authenticated/i);
    expect(analyticsFunctionSQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_session_wave_observation_analytics\(\) TO service_role/i);
    expect(analyticsFunctionSQL).toMatch(/real_completed_sessions/i);
    expect(analyticsFunctionSQL).toMatch(/valid_height_candidates/i);
    expect(analyticsFunctionSQL).toMatch(/matched_to_ml_within_6h/i);
    expect(analyticsFunctionSQL).toMatch(/matched_with_buoy_truth/i);
    expect(analyticsFunctionSQL).toMatch(/user_vs_buoy_abs_error_avg_m/i);
    expect(analyticsFunctionSQL).toMatch(/user_beats_display_count/i);
    expect(analyticsFunctionSQL).toMatch(/anonymous_user_rank/i);
    expect(analyticsFunctionSQL).toMatch(/effective_weak_label_mass[\s\S]*ml_prediction_id IS NOT NULL/i);
    expect(analyticsFunctionSQL).not.toMatch(/p\.email\s+AS/i);
    expect(analyticsFunctionSQL).not.toMatch(/user_id\s+AS/i);
  });

  it("infers implicit wave ranges from positive events with metadata-first forecast fallback", () => {
    expect(migrationSQL).toMatch(/event_wave_samples\s+AS/i);
    expect(migrationSQL).toMatch(/e\.metadata->>'wave_height_ft'/i);
    expect(migrationSQL).toMatch(/e\.metadata->>'forecast_wave_height_ft'/i);
    expect(migrationSQL).toMatch(/COALESCE\(we\.metadata_wave_ft,\s*forecast_wave\.wave_height_ft\)/i);
    expect(migrationSQL).toMatch(/ef\.forecast_at\s+BETWEEN\s+we\.created_at\s+-\s+interval\s+'6 hours'/i);
    expect(migrationSQL).toMatch(/WHERE\s+we\.weight\s+>\s+0/i);
  });

  it("requires at least three usable wave samples and writes 10th/90th percentiles", () => {
    expect(migrationSQL).toMatch(/WHEN count\(\*\)\s+>=\s+3 THEN round\(\(percentile_cont\(0\.1\)/i);
    expect(migrationSQL).toMatch(/WHEN count\(\*\)\s+>=\s+3 THEN round\(\(percentile_cont\(0\.9\)/i);
    expect(migrationSQL).toMatch(/inferred_wave_min_ft\s+=\s+excluded\.inferred_wave_min_ft/i);
    expect(migrationSQL).toMatch(/inferred_wave_max_ft\s+=\s+excluded\.inferred_wave_max_ft/i);
  });
});
