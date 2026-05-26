import fs from "fs";
import path from "path";

describe("phase1 personalization match states migration", () => {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const migrationPath = fs
    .readdirSync(migrationsDir)
    .find((name) => name.endsWith("_phase1_personalization_match_states.sql"));
  const readMigration = (): string => {
    expect(migrationPath).toEqual(expect.any(String));
    return fs.readFileSync(path.join(migrationsDir, migrationPath!), "utf8");
  };

  it("updates compute_user_match_score state semantics", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.compute_user_match_score");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.compute_user_match_score_core");
    expect(sql).toContain("'state', 'starter'");
    expect(sql).toContain("'state', 'learned'");
    expect(sql).toContain("'state', 'avoidance_learned'");
    expect(sql).toContain("'quality_band'");
    expect(sql).not.toMatch(/confidence low/i);
  });

  it("guards direct public RPC calls by caller identity and entitlement", () => {
    const sql = readMigration();

    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("auth.role()");
    expect(sql).toContain("p_user_id <> v_caller");
    expect(sql).toContain("lock_reason', 'billing_issue'");
    expect(sql).toContain("lock_reason', 'free'");
    expect(sql).toContain("IF NOT COALESCE(v_is_paid, false)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.compute_user_match_score_core");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.compute_user_match_score_core");
    expect(sql).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) TO authenticated",
    );
    expect(sql).not.toMatch(/PERSONALIZATION_BETA_USER_IDS|testflight_bypass/i);
  });

  it("keeps match candidate RPC compatible with learned state", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_user_match_candidates");
    expect(sql).toContain("s.result->>'state' IN ('ready', 'learned')");
    expect(sql).toContain("jsonb_typeof(s.result->'score') = 'number'");
    expect(sql).toContain("p_user_id <> v_caller");
  });
});
