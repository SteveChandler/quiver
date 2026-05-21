import { readFileSync } from "fs";
import { join } from "path";

describe("Migration: Supabase advisor cleanup", () => {
  const migrationPath = join(
    __dirname,
    "../../supabase/migrations/20260521120000_supabase_advisor_cleanup.sql",
  );
  const scriptPath = join(
    __dirname,
    "../../scripts/db/rollback-validate-advisor-cleanup.mjs",
  );
  const extensionInventoryPath = join(
    __dirname,
    "../../scripts/db/extension-relocation-inventory.sql",
  );
  const extensionApplyPath = join(
    __dirname,
    "../../scripts/db/extension-relocation-apply.sql",
  );
  const extensionRollbackPath = join(
    __dirname,
    "../../scripts/db/extension-relocation-rollback.sql",
  );

  let migrationSQL: string;
  let rollbackScript: string;
  let extensionInventorySQL: string;
  let extensionApplySQL: string;
  let extensionRollbackSQL: string;

  beforeAll(() => {
    migrationSQL = readFileSync(migrationPath, "utf8");
    rollbackScript = readFileSync(scriptPath, "utf8");
    extensionInventorySQL = readFileSync(extensionInventoryPath, "utf8");
    extensionApplySQL = readFileSync(extensionApplyPath, "utf8");
    extensionRollbackSQL = readFileSync(extensionRollbackPath, "utf8");
  });

  it("is transaction-safe and documents dashboard-only/platform advisor items", () => {
    expect(migrationSQL.trim().startsWith("BEGIN;")).toBe(true);
    expect(migrationSQL.trim().endsWith("COMMIT;")).toBe(true);
    expect(migrationSQL).toContain("Auth leaked password protection");
    expect(migrationSQL).toContain("Postgres version warnings");
    expect(migrationSQL).toContain("Extension relocation is split");
    expect(migrationSQL).not.toContain("ALTER EXTENSION %I SET SCHEMA extensions");
    expect(migrationSQL).not.toContain("CREATE INDEX CONCURRENTLY");
    expect(migrationSQL).not.toContain("REFRESH MATERIALIZED VIEW CONCURRENTLY");
  });

  it("fixes the reported external-facing security errors", () => {
    expect(migrationSQL).toContain("CREATE OR REPLACE VIEW public.profiles_with_home_beach");
    expect(migrationSQL).toContain("WITH (security_invoker = true)");
    expect(migrationSQL).toContain("ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY");
    expect(migrationSQL).toContain("ALTER TABLE public.beach_dioramas ENABLE ROW LEVEL SECURITY");
    expect(migrationSQL).toContain("ALTER TABLE public.dev_session_mutation_audit ENABLE ROW LEVEL SECURITY");
    expect(migrationSQL).toContain("REVOKE ALL ON public.dev_session_mutation_audit FROM PUBLIC, anon, authenticated");
  });

  it("removes broad storage listing policies while preserving owner write policies", () => {
    [
      "Avatar images are publicly readable",
      "Beach photos are publicly readable",
      "Public read access for diorama videos",
      "Intel photos are publicly readable",
      "Public can read ML artifacts",
      "Session media are publicly readable",
    ].forEach((policyName) => {
      expect(migrationSQL).toContain(`DROP POLICY IF EXISTS "${policyName}" ON storage.objects`);
    });

    expect(migrationSQL).not.toContain("DROP POLICY IF EXISTS \"Users can upload their own avatar\"");
    expect(migrationSQL).not.toContain("DROP POLICY IF EXISTS \"Users can upload their own session media\"");
  });

  it("hides materialized views from API roles", () => {
    expect(migrationSQL).toContain("'observable_beaches'");
    expect(migrationSQL).toContain("'beach_ml_performance_baseline'");
    expect(migrationSQL).toContain("'mv_beach_amenities'");
    expect(migrationSQL).toContain("REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, authenticator");
    expect(migrationSQL).toContain("GRANT SELECT ON TABLE public.%I TO service_role");
  });

  it("locks down SECURITY DEFINER functions and restores intentional grants", () => {
    expect(migrationSQL).toContain("ALTER FUNCTION %I.%I(%s) SECURITY INVOKER");
    expect(migrationSQL).toContain("WHERE n.nspname = 'public'");
    expect(migrationSQL).toContain("AND p.prosecdef");
    expect(migrationSQL).toContain("REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated");
    expect(migrationSQL).toContain("GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role");
    expect(migrationSQL).toContain("('compute_user_match_score')");
    expect(migrationSQL).toContain("('get_nearby_beaches')");
  });

  it("sets a fixed search_path on all public functions", () => {
    expect(migrationSQL).toContain("ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions, pg_temp");
    expect(migrationSQL).toContain("CREATE OR REPLACE FUNCTION public.is_admin_user()");
    expect(migrationSQL).toContain("SECURITY INVOKER");
  });

  it("consolidates the noisy permissive policy groups from the advisor output", () => {
    expect(migrationSQL).toContain("sessions_select_owner_public_or_admin");
    expect(migrationSQL).toContain("session_media_select_public_owner_or_admin");
    expect(migrationSQL).toContain("DROP POLICY IF EXISTS \"Service role has full access to events\"");
    expect(migrationSQL).toContain("DROP POLICY IF EXISTS \"Service role has full access to email prefs\"");
    expect(migrationSQL).toContain("DROP POLICY IF EXISTS \"Service role has full access to preferences\"");
    expect(migrationSQL).toContain("DROP POLICY IF EXISTS \"Service role can manage all preferences\"");
  });

  it("ships a rollback rehearsal script that strips the migration wrapper and asserts rollback", () => {
    expect(rollbackScript).toContain("stripMigrationTransaction");
    expect(rollbackScript).toContain("BEGIN;");
    expect(rollbackScript).toContain("ROLLBACK;");
    expect(rollbackScript).toContain("advisor_cleanup_baseline");
    expect(rollbackScript).toContain("advisor_cleanup_after_rollback");
    expect(rollbackScript).toContain("rollback validation passed");
  });

  it("ships extension relocation preflight and paired rollback scripts", () => {
    expect(extensionInventorySQL).toContain("extrelocatable");
    expect(extensionInventorySQL).toContain("support_or_drop_recreate_required");
    expect(extensionInventorySQL).toContain("matched_extension_symbol");
    expect(extensionApplySQL).toContain("ARRAY['pg_trgm', 'unaccent']");
    expect(extensionApplySQL).toContain("ALTER EXTENSION %I SET SCHEMA extensions");
    expect(extensionApplySQL).toContain("PostGIS is intentionally excluded");
    expect(extensionRollbackSQL).toContain("ALTER EXTENSION %I SET SCHEMA public");
  });
});
