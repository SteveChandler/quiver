import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261018090100_session_waves_triggers.sql"),
  "utf8",
);

describe("session waves trigger migration", () => {
  it("defines the historical file import cutoff", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.is_historical_file_import\(p_source text, p_arrival timestamptz, p_duration_minutes int\)/i);
    expect(migration).toMatch(/p_source = 'file_import'\s+AND p_arrival \+ make_interval\(mins => coalesce\(p_duration_minutes,\s*0\)\) < now\(\) - interval '48 hours'/i);
  });

  it("excludes historical inserts from the offer and email completion triggers", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.earn_pro_offer_on_session\(\)/i);
    expect(migration).toMatch(/AND NOT public\.is_historical_file_import\(NEW\.source, NEW\.arrival_time, NEW\.duration_minutes\)/);
    expect(migration).toMatch(/PERFORM public\.earn_five_session_offer\(NEW\.user_id\)/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.stamp_email_session_completion\(\)/i);
    expect(migration).toMatch(/TG_OP = 'INSERT'[\s\S]*NEW\.status = 'completed' AND NOT public\.is_historical_file_import\(NEW\.source, NEW\.arrival_time, NEW\.duration_minutes\)/);
  });

  it("requests track and import purges during account deletion", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.delete_user_account\(p_user_id uuid\)/i);
    expect(migration).toMatch(/UPDATE public\.session_tracks SET purge_requested_at = now\(\) WHERE user_id = p_user_id;/);
    expect(migration).toMatch(/UPDATE public\.session_imports SET purge_requested_at = now\(\) WHERE user_id = p_user_id;/);
    expect(migration).toMatch(/DELETE FROM public\.session_wave_corrections WHERE user_id = p_user_id;/);
    expect(migration).toMatch(/PERFORM public\.erase_regional_recommendation_hold_operator_v1\(p_user_id\)/);
  });
});
