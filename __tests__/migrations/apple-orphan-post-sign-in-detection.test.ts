import fs from "node:fs";
import path from "node:path";
import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260802162000_detect_apple_orphan_after_sign_in.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("post-sign-in Apple orphan detector migration", () => {
  it("requires one older exact-name account on the same native install", () => {
    expect(sql).toContain("detect_apple_orphan_after_sign_in");
    expect(sql).toContain("metadata->>'native_install_id'");
    expect(sql).toContain("v_candidate_count <> 1");
    expect(sql).toContain("candidate_user.created_at < v_current_created_at");
    expect(sql).toContain("= v_current_name");
  });

  it("verifies the Apple identity, fails closed on schema growth, and flags both audit chains", () => {
    expect(sql).toContain("identity_row.provider = 'apple'");
    expect(sql).toContain("schema_coverage_incomplete");
    expect(sql).toContain("post_sign_in_orphan_flagged");
    expect(sql).toContain("apple_orphan_recovery_flagged");
  });

  it("is transactional and never mutates auth-owned tables", () => {
    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+auth\./i);
    expect(sql).not.toMatch(/ALTER TABLE\s+auth\./i);
  });
});
