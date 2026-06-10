import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("session truth and CDIP station preference migration", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((file: string) =>
      file.includes("session_truth_cdip_station_preference")
    );

    if (!migrationFile) {
      throw new Error("session truth/CDIP station preference migration file not found");
    }

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf8");
  });

  it("wraps function replacements in a transaction without creating new exposed tables", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
    expect(migrationSQL).not.toMatch(/CREATE\s+TABLE/i);
  });

  it("default-denies session truth pools to analytics_is_real_user = true", () => {
    const analyticsStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_session_wave_observation_analytics()"
    );
    const analyticsSQL = migrationSQL.slice(analyticsStart);

    expect(analyticsStart).toBeGreaterThan(-1);
    expect(analyticsSQL).toMatch(/real_completed_sessions[\s\S]*p\.analytics_is_real_user\s*=\s*true/i);
    expect(analyticsSQL).toMatch(/candidates[\s\S]*p\.analytics_is_real_user\s*=\s*true/i);
    expect(analyticsSQL).not.toMatch(/coalesce\s*\(\s*p\.analytics_is_real_user/i);
    expect(analyticsSQL).not.toMatch(/p\.analytics_is_real_user\s+IS\s+DISTINCT\s+FROM\s+false/i);
  });

  it("exposes raw versus strict-real session diagnostics without user identifiers", () => {
    expect(migrationSQL).toMatch(/'session_truth'/i);
    expect(migrationSQL).toMatch(/'wave_height_sessions_90d_raw'/i);
    expect(migrationSQL).toMatch(/'wave_height_sessions_90d_non_deleted'/i);
    expect(migrationSQL).toMatch(/'wave_height_sessions_90d_strict_real'/i);
    expect(migrationSQL).toMatch(/'wave_height_sessions_90d_excluded_by_analytics_flag'/i);
    expect(migrationSQL).toMatch(/'wave_height_sessions_90d_mock_or_test_diagnostic'/i);
    expect(migrationSQL).toMatch(/'wave_height_sessions_90d_bot_flagged'/i);
    expect(migrationSQL).toMatch(/'wave_height_sessions_90d_snapshot_linked'/i);
    expect(migrationSQL).not.toMatch(/p\.email\s+AS/i);
    expect(migrationSQL).not.toMatch(/user_id\s+AS/i);
  });

  it("prefers explicit CDIP stations only when recent observations exist", () => {
    const stationStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_beach_observation_station"
    );
    const stationSQL = migrationSQL.slice(stationStart);

    expect(stationStart).toBeGreaterThan(-1);
    expect(stationSQL).toMatch(/preferred_cdip_station/i);
    expect(stationSQL).toMatch(/b\.cdip_station/i);
    expect(stationSQL).toMatch(/edu_ucsd_cdip_/i);
    expect(stationSQL).toMatch(/public\.unified_wave_observations/i);
    expect(stationSQL).toMatch(/observed_at\s*>=\s*now\(\)\s*-\s*interval\s+'7 days'/i);
    expect(stationSQL).toMatch(/wave_height_m\s+IS\s+NOT\s+NULL/i);
  });

  it("preserves existing IOOS and NDBC fallback tiers after CDIP preference", () => {
    const stationStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_beach_observation_station"
    );
    const stationSQL = migrationSQL.slice(stationStart);

    expect(stationSQL).toMatch(/FROM public\.ioos_stations s/i);
    expect(stationSQL).toMatch(/FROM public\.ndbc_direct_stations s/i);
    expect(stationSQL).toMatch(/swell_windows_overlap/i);
    expect(stationSQL).toMatch(/ST_DWithin/i);
  });

  it("marks the resolver-change epoch and does not re-backfill historical truth", () => {
    expect(migrationSQL).toMatch(/station resolver epoch/i);
    expect(migrationSQL).toMatch(/historical observed_m re-backfill is intentionally out of scope/i);
    expect(migrationSQL).not.toMatch(/UPDATE\s+public\.ml_predictions_log[\s\S]*observed_m\s*=/i);
  });
});

describe("CDIP station impact report", () => {
  const reportPath = join(
    __dirname,
    "../../scripts/cdip-station-impact-report.sql"
  );

  it("is read-only and compares current station selection to explicit CDIP preference", () => {
    expect(existsSync(reportPath)).toBe(true);
    const reportSQL = readFileSync(reportPath, "utf8");

    expect(reportSQL).toMatch(/current_station_id/i);
    expect(reportSQL).toMatch(/proposed_cdip_station_id/i);
    expect(reportSQL).toMatch(/recent_cdip_observation_count/i);
    expect(reportSQL).toMatch(/affected_ml_predictions/i);
    expect(reportSQL).not.toMatch(/\bINSERT\b/i);
    expect(reportSQL).not.toMatch(/\bUPDATE\b/i);
    expect(reportSQL).not.toMatch(/\bDELETE\b/i);
    expect(reportSQL).not.toMatch(/\bREFRESH\b/i);
  });
});
