import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261018090100_session_waves_triggers.sql"),
  "utf8",
);

describe("session waves trigger migration", () => {
  it("requires the core tables before replacing any functions", () => {
    const preamble = migration.slice(0, migration.indexOf("CREATE OR REPLACE FUNCTION"));
    expect(preamble).toContain("to_regclass('public.session_tracks') IS NULL");
    expect(preamble).toContain("to_regclass('public.session_imports') IS NULL");
    expect(preamble).toContain("RAISE EXCEPTION 'apply 20261018090000_session_waves_core.sql first'");
  });

  it("defines the historical file import cutoff", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.is_historical_file_import\(p_source text, p_arrival timestamptz, p_duration_minutes int, p_as_of timestamptz DEFAULT now\(\)\)/i);
    expect(migration).toMatch(/p_source = 'file_import'\s+AND p_arrival \+ make_interval\(mins => coalesce\(p_duration_minutes,\s*0\)\) < p_as_of - interval '48 hours'/i);
  });

  it("excludes historical inserts from the offer and email completion triggers", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.earn_pro_offer_on_session\(\)/i);
    expect(migration).toMatch(/AND NOT public\.is_historical_file_import\(NEW\.source, NEW\.arrival_time, NEW\.duration_minutes\)/);
    expect(migration).toMatch(/PERFORM public\.earn_five_session_offer\(NEW\.user_id\)/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.stamp_email_session_completion\(\)/i);
    expect(migration).toMatch(/TG_OP = 'INSERT'[\s\S]*NEW\.status = 'completed' AND NOT public\.is_historical_file_import\(NEW\.source, NEW\.arrival_time, NEW\.duration_minutes\)/);
  });

  it("uses creation-time eligibility for both earning and displayed offer progress", () => {
    const earnOffer = migration.match(/CREATE OR REPLACE FUNCTION public\.earn_five_session_offer\([\s\S]*?\$\$;/i)?.[0];
    const listOffers = migration.match(/CREATE OR REPLACE FUNCTION public\.list_owned_pro_offers\([\s\S]*?\$\$;/i)?.[0];
    const exclusion = "AND NOT public.is_historical_file_import(s.source, s.arrival_time, s.duration_minutes, s.created_at)";

    expect(earnOffer).toContain("FROM public.sessions s");
    expect(earnOffer).toContain(exclusion);
    expect(earnOffer).toContain("IF cardinality(ids)=5 THEN");
    expect(listOffers).toContain("'completed_sessions',(SELECT count(*) FROM public.sessions s");
    expect(listOffers).toContain(exclusion);
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.evaluate_email_lifecycle/i);
  });

  it("uses the same eligibility rule when previewing and claiming an offer", () => {
    const previewOffer = migration.match(/CREATE OR REPLACE FUNCTION public\.preview_pro_offer\([\s\S]*?\$\$;/i)?.[0];
    const reserveOffer = migration.match(/CREATE OR REPLACE FUNCTION public\.reserve_pro_offer\([\s\S]*?\$\$;/i)?.[0];
    const exclusion = "AND NOT public.is_historical_file_import(s.source, s.arrival_time, s.duration_minutes, s.created_at)";

    expect(previewOffer).toContain("'completed_sessions',(SELECT count(*) FROM public.sessions s");
    expect(previewOffer).toContain(exclusion);
    expect(reserveOffer).toContain("FROM public.sessions s");
    expect(reserveOffer).toContain(exclusion);
  });

  it("requests track and import purges during account deletion", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.delete_user_account\(p_user_id uuid\)/i);
    expect(migration).toMatch(/UPDATE public\.session_tracks SET purge_requested_at = now\(\) WHERE user_id = p_user_id AND purge_requested_at IS NULL;/);
    expect(migration).toMatch(/UPDATE public\.session_imports SET purge_requested_at = now\(\) WHERE user_id = p_user_id AND purge_requested_at IS NULL;/);
    expect(migration).toContain("DELETE FROM public.session_waves WHERE user_id = p_user_id;");
    expect(migration).toMatch(/DELETE FROM public\.session_wave_corrections WHERE user_id = p_user_id;/);
    expect(migration).toMatch(/PERFORM public\.erase_regional_recommendation_hold_operator_v1\(p_user_id\)/);
  });
});
