import fs from "fs";
import path from "path";
import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260725190000_apple_identity_recovery_foundation.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");
const config = fs.readFileSync(
  path.join(process.cwd(), "supabase/config.toml"),
  "utf8",
);

describe("Apple identity recovery foundation migration", () => {
  it("is transactional and keeps recovery RPCs service-role only", () => {
    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.assess_apple_identity_recovery[\s\S]+FROM PUBLIC, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.assess_apple_identity_recovery[\s\S]+TO service_role/i,
    );
  });

  it("seeds FK coverage from pg_catalog and fails closed on schema growth", () => {
    expect(sql).toMatch(/INSERT INTO public\.apple_recovery_dependency_registry/i);
    expect(sql).toMatch(/pg_constraint/i);
    expect(sql).toMatch(/confrelid IN \('auth\.users'::regclass, 'public\.profiles'::regclass\)/i);
    expect(sql).toMatch(/schema_coverage_incomplete/i);
    expect(sql).toMatch(
      /NOT EXISTS[\s\S]+apple_recovery_dependency_registry/i,
    );
    expect(sql).toMatch(
      /first assessment[\s\S]+own new constraints as uncovered schema growth/i,
    );
  });

  it("uses stable Apple subject identity and never relay/email matching", () => {
    expect(sql).toMatch(/provider\s*=\s*'apple'/i);
    expect(sql).toMatch(/provider_id\s*=\s*p_apple_sub/i);
    expect(sql).not.toMatch(/privaterelay/i);
    expect(sql).not.toMatch(/lower\s*\(\s*email/i);
  });

  it("requires explicit confirmation and leaves auth identity transfer fail-closed", () => {
    expect(sql).toMatch(/confirmed_at\s*=\s*clock_timestamp\(\)/i);
    expect(sql).toMatch(/identity_transfer_not_supported/i);
    expect(sql).not.toMatch(/UPDATE\s+auth\.identities/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+auth\.(users|identities|sessions)/i);
  });

  it("creates replay, audit, expiry, notification, and rollback records", () => {
    expect(sql).toMatch(/apple_token_sha256[\s\S]+UNIQUE/i);
    expect(sql).toMatch(/apple_identity_recovery_audit/i);
    expect(sql).toMatch(/expires_at/i);
    expect(sql).toMatch(/notification_status/i);
    expect(sql).toMatch(/rollback_until/i);
  });

  it("enables manual linking in local Supabase configuration", () => {
    expect(config).toMatch(/enable_manual_linking\s*=\s*true/i);
  });
});
