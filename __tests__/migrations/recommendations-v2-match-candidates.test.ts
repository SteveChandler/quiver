import fs from "fs";
import path from "path";

describe("recommendations v2 match candidates migration", () => {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const migrationPath = fs
    .readdirSync(migrationsDir)
    .find((name) => name.endsWith("_recommendations_v2_match_candidates.sql"));

  function readMigration(): string {
    expect(migrationPath).toEqual(expect.any(String));
    return fs.readFileSync(path.join(migrationsDir, migrationPath!), "utf8");
  }

  it("keeps get_user_match_candidates compatible while rejecting farthest cached forecasts", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_user_match_candidates");
    expect(sql).toContain("RETURNS TABLE(beach jsonb, score numeric, label text)");
    expect(sql).toContain("s.result->>'state' IN ('ready', 'learned')");
    expect(sql).toContain("ef.forecast_at <= now() + interval '72 hours'");
    expect(sql).toContain("CASE WHEN ef.forecast_at::date = now()::date THEN 0 ELSE 1 END");
    expect(sql).toContain("ABS(EXTRACT(EPOCH FROM (ef.forecast_at - now())))");
    expect(sql).not.toContain("ORDER BY ef.beach_id, ef.forecast_at DESC NULLS LAST");
  });

  it("preserves caller, entitlement, and grant boundaries", () => {
    const sql = readMigration();

    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("auth.role()");
    expect(sql).toContain("p_user_id <> v_caller");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_user_match_candidates");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_user_match_candidates");
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("TO service_role");
  });
});
