import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

// Behaviour is exercised against a real Postgres by
// scripts/test-session-wave-size-vs-forecast-postgres.sh; these pin the shape.
describe("session wave size vs forecast migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20261021200000_session_wave_size_vs_forecast.sql"
    ),
    "utf8"
  );
  const executableSQL = migrationSQL.slice(0, migrationSQL.indexOf("-- Rollback (manual"));

  it("wraps the change in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("adds nullable answer columns validated without a table rewrite", () => {
    expect(executableSQL).toMatch(
      /ALTER TABLE public\.sessions ADD COLUMN IF NOT EXISTS wave_size_vs_forecast text;/
    );
    expect(executableSQL).toMatch(/ADD COLUMN IF NOT EXISTS reported_size_vs_forecast text,/);
    expect(executableSQL).toMatch(/ADD COLUMN IF NOT EXISTS shown_forecast_height_ft numeric;/);
    expect(executableSQL).not.toMatch(/(wave_size_vs_forecast|reported_size_vs_forecast) text\s+(NOT NULL|DEFAULT)/i);
    expect(
      executableSQL.match(/IN \('smaller', 'about_right', 'bigger'\)\) NOT VALID/g)
    ).toHaveLength(2);
    expect(executableSQL).toMatch(/VALIDATE CONSTRAINT sessions_wave_size_vs_forecast_check/);
    expect(executableSQL).toMatch(
      /VALIDATE CONSTRAINT session_wave_observation_candidates_size_vs_forecast_check/
    );
  });

  it("keeps the sync signature and its service_role-only grant", () => {
    expect(executableSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.sync_session_wave_observation_candidate\(\s*p_session_id uuid,\s*p_user_id uuid,\s*p_beach_id uuid,\s*p_arrival_time timestamptz,\s*p_status text,\s*p_wave_height_ft numeric,\s*p_source_created_by text DEFAULT 'trigger'\s*\)/
    );
    expect(executableSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.sync_session_wave_observation_candidate\(uuid, uuid, uuid, timestamptz, text, numeric, text\) FROM PUBLIC, anon, authenticated;/
    );
    expect(executableSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.sync_session_wave_observation_candidate\(uuid, uuid, uuid, timestamptz, text, numeric, text\) TO service_role;/
    );
    expect(executableSQL).not.toMatch(/TO authenticated/);
  });

  it("keeps a prefill only when the surfer confirmed it and copies the answer everywhere", () => {
    expect(executableSQL).toMatch(
      /session_height_source = 'forecast_prefill'\s+AND session_size_vs_forecast IS DISTINCT FROM 'about_right'\s+THEN[\s\S]*?rejection_reason_text := 'forecast_prefilled_wave_height'/
    );
    expect(executableSQL.match(/reported_size_vs_forecast = excluded\.reported_size_vs_forecast/g)).toHaveLength(2);
    expect(executableSQL.match(/shown_forecast_height_ft = excluded\.shown_forecast_height_ft/g)).toHaveLength(2);
  });

  it("re-syncs when the answer or the shown height is edited", () => {
    expect(executableSQL).toMatch(
      /CREATE TRIGGER trigger_create_session_forecast_snapshot\s+AFTER INSERT OR UPDATE OF [^;]*forecast_accuracy, tide_height_ft, tide_status, wave_size_vs_forecast, forecast_wave_height_ft\s+ON public\.sessions/
    );
  });

  it("reports the answers in the observation analytics", () => {
    expect(executableSQL).toMatch(/'size_vs_forecast', jsonb_build_object\(/);
    for (const key of [
      "answers",
      "answers_30d",
      "by_answer",
      "with_shown_height",
      "confirmed_prefills",
      "direction_only_prefills",
      "height_answer_conflicts",
    ]) {
      expect(executableSQL).toContain(`'${key}'`);
    }
    expect(executableSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_session_wave_observation_analytics\(\) TO service_role;/
    );
  });
});
