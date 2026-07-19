import { readFileSync } from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260718141000_get_my_analytics_tracking_allowed.sql",
);

describe("owner-scoped analytics consent RPC", () => {
  it("returns only the authenticated user's tracking preference", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("get_my_analytics_tracking_allowed");
    expect(sql).toContain("p_expected_user_id uuid");
    expect(sql).toMatch(/p\.id\s*=\s*\(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/p\.id\s*=\s*p_expected_user_id/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/auth\.uid\(\)\)\s*<>\s*p_expected_user_id/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/i);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO anon/i);
  });
});
