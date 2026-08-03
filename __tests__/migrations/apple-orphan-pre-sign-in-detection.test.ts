import fs from "node:fs";
import path from "node:path";
import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260803120000_detect_apple_orphan_before_sign_in.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("pre-sign-in Apple orphan detector migration", () => {
  it("distinguishes claimed Apple subjects before candidate matching", () => {
    expect(sql).toContain("detect_apple_orphan_before_sign_in");
    expect(sql).toContain("identity_row.provider = 'apple'");
    expect(sql).toContain("identity_row.provider_id = p_apple_sub");
    expect(sql).toContain("'status', 'apple_sub_claimed'");
  });

  it("requires exactly one older same-install exact-name candidate", () => {
    expect(sql).toContain("metadata->>'native_install_id'");
    expect(sql).toContain("candidate_user.created_at < p_token_issued_at");
    expect(sql).toContain("= v_normalized_name");
    expect(sql).toContain("v_candidate_count <> 1");
    expect(sql).toContain("'status', 'unclaimed_no_match'");
  });

  it("reuses the recovery dependency registry and records only hashed Apple identity audit data", () => {
    expect(sql).toContain("apple_recovery_dependency_registry");
    expect(sql).toContain("schema_coverage_incomplete");
    expect(sql).toContain("extensions.digest(p_apple_sub, 'sha256')");
    expect(sql).toContain("pre_sign_in_orphan_prevented");
    expect(sql).not.toContain("probable_canonical_user_id");
  });

  it("documents install-ID churn and never mutates Auth-owned tables", () => {
    expect(sql).toContain("may reset on uninstall/reinstall");
    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+auth\./i);
    expect(sql).not.toMatch(/ALTER TABLE\s+auth\./i);
  });
});
