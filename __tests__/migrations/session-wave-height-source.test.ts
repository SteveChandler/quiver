import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("session wave height source migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20261019100000_session_wave_height_source.sql"
    ),
    "utf8"
  );
  const executableSQL = migrationSQL.slice(0, migrationSQL.indexOf("-- Rollback (manual"));

  it("wraps the change in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("adds a nullable provenance column validated without a table rewrite", () => {
    expect(executableSQL).toMatch(
      /ALTER TABLE public\.sessions ADD COLUMN IF NOT EXISTS wave_height_source text;/
    );
    expect(executableSQL).not.toMatch(/wave_height_source text\s+(NOT NULL|DEFAULT)/i);
    expect(executableSQL).toMatch(
      /CHECK \(wave_height_source IN \('user', 'forecast_prefill'\)\) NOT VALID/
    );
    expect(executableSQL).toMatch(/VALIDATE CONSTRAINT sessions_wave_height_source_check/);
  });

  it("keeps the truth-sync signature the snapshot trigger calls and rejects prefills", () => {
    expect(executableSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.sync_session_wave_observation_candidate\(\s*p_session_id uuid,\s*p_user_id uuid,\s*p_beach_id uuid,\s*p_arrival_time timestamptz,\s*p_status text,\s*p_wave_height_ft numeric,\s*p_source_created_by text DEFAULT 'trigger'\s*\)/
    );
    expect(executableSQL).toMatch(
      /s\.wave_height_source = 'forecast_prefill'\s*\) THEN[\s\S]*?rejection_reason_text := 'forecast_prefilled_wave_height'/
    );
    expect(executableSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.sync_session_wave_observation_candidate\(uuid, uuid, uuid, timestamptz, text, numeric, text\) TO authenticated, service_role;/
    );
  });

  it("reads provenance from the submit event in both arrival orders", () => {
    expect(executableSQL).toMatch(
      /CREATE TRIGGER trigger_apply_session_wave_height_source\s+BEFORE INSERT OR UPDATE OF wave_height_ft ON public\.sessions/
    );
    expect(executableSQL).toMatch(
      /CREATE TRIGGER trigger_apply_submit_wave_height_source\s+AFTER INSERT ON public\.user_events\s+FOR EACH ROW\s+WHEN \(NEW\.event_type = 'session_log_submit'\)/
    );
    expect(executableSQL).toMatch(/':submit:v1'/);
    expect(executableSQL).toMatch(/':submit:web:v1'/);
  });

  it("never lets malformed analytics or a provenance failure block a write", () => {
    expect(executableSQL).not.toMatch(/forecast_prefilled'\)?::boolean/);
    expect(executableSQL).not.toMatch(/forecast_height_changed'\)?::boolean/);
    expect(executableSQL).toMatch(/'forecast_prefilled' = 'true'::jsonb/);
    expect(
      executableSQL.match(/EXCEPTION WHEN OTHERS THEN\s+--[^\n]*\n\s+RAISE WARNING/g)
    ).toHaveLength(2);
  });

  it("freezes the labels whose events expire before the migration may be applied", () => {
    const frozen = executableSQL.slice(
      executableSQL.indexOf("WITH frozen"),
      executableSQL.indexOf("from_events AS")
    );
    const ids = frozen.match(/'[0-9a-f-]{36}'/g) ?? [];
    expect(new Set(ids).size).toBe(95);
    expect(frozen).toMatch(/\]::uuid\[\]\), 'forecast_prefill'/);
    expect(frozen).toMatch(/\]::uuid\[\]\), 'user'/);
    expect(executableSQL).toMatch(/AND s\.wave_height_source IS NULL;/);
  });
});
