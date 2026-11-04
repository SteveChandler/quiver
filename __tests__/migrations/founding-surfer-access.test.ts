import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION = "20261104160000_founding_surfer_access.sql";

function functionBody(sql: string, name: string, terminator: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const end = sql.indexOf(terminator, start);
  if (end < 0) throw new Error(`Missing terminator for ${name}`);
  return sql.slice(start, end + terminator.length);
}

describe("founding surfer access migration", () => {
  const sql = readFileSync(
    join(__dirname, "../../supabase/migrations", MIGRATION),
    "utf-8",
  );

  it("is wrapped in BEGIN/COMMIT", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it("creates the runtime flag table with RLS and no client grants", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.app_runtime_flags \(\s+key text PRIMARY KEY,\s+enabled boolean NOT NULL DEFAULT false,\s+note text,\s+updated_at timestamptz NOT NULL DEFAULT now\(\)\s+\);/);
    expect(sql).toContain("ALTER TABLE public.app_runtime_flags ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("REVOKE ALL ON TABLE public.app_runtime_flags FROM PUBLIC, anon, authenticated;");
    expect(sql).not.toMatch(/GRANT[^;]*ON TABLE public\.app_runtime_flags TO [^;]*(anon|authenticated)/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it("seeds the switch off without overwriting a flipped row", () => {
    expect(sql).toMatch(/INSERT INTO public\.app_runtime_flags \(key, enabled, note\)\s+VALUES \(\s+'founding_access',\s+false,/);
    expect(sql).toContain("ON CONFLICT (key) DO NOTHING;");
  });

  it("defines founding_access_enabled() per the spec and grants it to authenticated + service_role only", () => {
    const fn = functionBody(sql, "founding_access_enabled", "$$;");
    expect(fn).toMatch(/RETURNS boolean/);
    expect(fn).toMatch(/\bSTABLE\b/);
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path = public\n/);
    expect(fn).toMatch(/coalesce\(\s+\(SELECT enabled FROM public\.app_runtime_flags WHERE key = 'founding_access'\),\s+false\s+\)/);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.founding_access_enabled() FROM PUBLIC, anon;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.founding_access_enabled() TO authenticated, service_role;");
  });

  it("lifts the curated favorites cap only while the switch is on", () => {
    const fn = functionBody(sql, "toggle_favorite_spot_guarded", "\nEND;\n$$;");
    expect(fn).toMatch(/SECURITY INVOKER\nSET search_path = public\n/);
    expect(fn).toMatch(/IF NOT has_unlimited_favorites\s+AND favorite_count >= 3\s+AND NOT public\.founding_access_enabled\(\) THEN\s+RAISE EXCEPTION 'favorite_quota_exceeded'\s+USING DETAIL = 'free_favorites_limit';/);
    // Guests are rejected before the cap check ever reads the switch.
    expect(fn.indexOf("RAISE EXCEPTION 'not_authenticated'")).toBeLessThan(fn.indexOf("founding_access_enabled"));
    // Real Pro check unchanged.
    expect(fn).toMatch(/AND \(ue\.is_pro = true OR ue\.is_trialing = true\)/);
  });

  it("unlocks personal match for reason 'free' only, keeping forbidden and billing_issue locks", () => {
    const fn = functionBody(sql, "user_match_access_result", "\nEND;\n$access$;");
    expect(fn).toMatch(/STABLE SECURITY DEFINER SET search_path = public, pg_temp/);
    expect(fn).toContain("'lock_reason', 'forbidden'");
    expect(fn).toMatch(/IF v_billing_issue THEN\s+RETURN jsonb_build_object\([\s\S]*?'lock_reason', 'billing_issue'/);
    expect(fn).toMatch(/IF \(NOT COALESCE\(v_is_paid, false\) OR \(v_expires_at IS NOT NULL AND v_expires_at < now\(\)\)\)\s+AND NOT public\.founding_access_enabled\(\) THEN\s+RETURN jsonb_build_object\([\s\S]*?'lock_reason', 'free'/);
  });

  it("returns match candidates for founding users but still nothing on billing issues", () => {
    const fn = functionBody(sql, "get_user_match_candidates", "\nEND;\n$function$;");
    expect(fn).toMatch(/SECURITY DEFINER\nSET search_path TO 'public', 'extensions', 'pg_temp'/);
    expect(fn).toMatch(/IF v_billing_issue THEN\s+RETURN;\s+END IF;/);
    expect(fn).toMatch(/IF \(NOT COALESCE\(v_is_paid, false\)\s+OR \(v_expires_at IS NOT NULL AND v_expires_at < now\(\)\)\)\s+AND NOT public\.founding_access_enabled\(\) THEN\s+RETURN;/);
  });

  it("scores Week Scout / discovery match evidence for founding users", () => {
    const fn = functionBody(sql, "get_week_scout_personalization", "\nEND;\n$function$;");
    expect(fn).toMatch(/SECURITY INVOKER\nSET search_path = public, pg_temp/);
    expect(fn).toMatch(/clock_timestamp\(\)\)\s+\) OR public\.founding_access_enabled\(\)\) THEN/);
    expect(fn).toContain("public.compute_user_match_scores(p_user_id, p_beach_ids,");
  });

  it("does not change any function grant", () => {
    const grantLines = sql.split("\n").filter((line) => /^\s*(GRANT|REVOKE)\b.*FUNCTION/.test(line));
    expect(grantLines).toEqual([
      "REVOKE ALL ON FUNCTION public.founding_access_enabled() FROM PUBLIC, anon;",
      "GRANT EXECUTE ON FUNCTION public.founding_access_enabled() TO authenticated, service_role;",
    ]);
  });
});
