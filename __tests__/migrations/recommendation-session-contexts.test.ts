import fs from "fs";
import path from "path";

describe("recommendation session context migrations", () => {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

  function readMigration(suffix: string): string {
    const migrationPath = fs
      .readdirSync(migrationsDir)
      .find((name) => name.endsWith(suffix));
    expect(migrationPath).toEqual(expect.any(String));
    return fs.readFileSync(path.join(migrationsDir, migrationPath!), "utf8");
  }

  it("creates narrow RLS-backed recommendation attribution storage", () => {
    const sql = readMigration("_recommendation_session_contexts.sql");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.recommendation_session_contexts");
    expect(sql).toContain("UNIQUE (user_id, session_id, recommendation_id)");
    expect(sql).toContain("ALTER TABLE public.recommendation_session_contexts ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("WITH CHECK (auth.uid() = user_id)");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE ON public.recommendation_session_contexts TO authenticated");
  });

  it("keeps strict snapshot repair same-beach and preview-first", () => {
    const sql = readMigration("_strict_session_snapshot_repair.sql");

    expect(sql).toContain("ef.beach_id = s.beach_id");
    expect(sql).toContain("interval '90 minutes'");
    expect(sql).toContain("p_apply boolean DEFAULT false");
    expect(sql).toContain("IF NOT p_apply THEN");
    expect(sql).toContain("cs.nearest_beach_id = s.beach_id");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.repair_strict_session_snapshots(integer, boolean) TO service_role");
    expect(sql).not.toContain("GRANT EXECUTE ON FUNCTION public.repair_strict_session_snapshots(integer, boolean) TO authenticated");
  });
});
