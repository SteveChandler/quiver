import fs from "node:fs";
import path from "node:path";
import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260802160000_register_post_foundation_apple_recovery_dependencies.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");
const diagnosticSql = fs.readFileSync(
  path.join(
    process.cwd(),
    ".planning/apple-orphan-population-20260802.sql",
  ),
  "utf8",
);

describe("Apple recovery schema coverage registration", () => {
  it("registers every reviewed post-foundation auth FK", () => {
    expect(sql).toContain("v_expected_count constant integer := 21");
    expect(sql).toContain("android_tester_roster_entries_user_id_fkey");
    expect(sql).toContain("community_spot_photos_uploader_id_fkey");
    expect(sql).toContain("android_waitlist_entries_user_id_fkey");
    expect(sql).toContain("apple_recovery_dependency_registry");
    expect(sql).toContain("'auth.users'::regclass");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("pg_temp.apple_recovery_expected_dependencies");
    expect(sql).toContain("Current Auth/Profile dependency coverage remains incomplete");
  });

  it("is transactional and never mutates auth-owned tables", () => {
    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+auth\./i);
    expect(sql).not.toMatch(/ALTER TABLE\s+auth\./i);
  });

  it("keeps the operator diagnostic on current device tables and aliases", () => {
    expect(diagnosticSql).toContain("BEGIN TRANSACTION READ ONLY");
    expect(diagnosticSql).toContain("public.user_devices");
    expect(diagnosticSql).toContain("shared_native_install");
    expect(diagnosticSql).not.toContain("push_devices");
    expect(diagnosticSql).not.toContain("shared_push_device");
  });
});
