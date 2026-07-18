import { readFileSync } from "node:fs";
import path from "node:path";
import { PROFILE_PUBLIC_FIELDS } from "@/lib/profile/constants";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260718142000_restrict_profile_analytics_consent.sql",
);

describe("profile analytics consent privacy", () => {
  it("keeps analytics consent out of reusable public profile projections", () => {
    expect(PROFILE_PUBLIC_FIELDS).not.toContain("allow_implicit_tracking");
  });

  it("removes public column access while preserving the public profile surface", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /REVOKE SELECT ON TABLE public\.profiles FROM anon, authenticated/i,
    );
    expect(sql).toMatch(
      /REVOKE SELECT ON TABLE public\.profiles FROM PUBLIC/i,
    );
    expect(sql).toMatch(/attname\s*<>\s*'allow_implicit_tracking'/i);
    expect(sql).toMatch(
      /GRANT SELECT \(%s\) ON TABLE public\.profiles TO anon, authenticated/i,
    );
    expect(sql).not.toMatch(
      /GRANT SELECT ON TABLE public\.profiles TO (?:anon|authenticated)/i,
    );
  });

  it("keeps direct user-event inserts owner scoped without reading the private column", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/DROP POLICY IF EXISTS "Users can insert their own events"/i);
    expect(sql).toMatch(
      /public\.get_my_analytics_tracking_allowed\(\(select auth\.uid\(\)\)\)/i,
    );
    expect(sql).not.toMatch(/allow_implicit_tracking\s*=\s*false/i);
  });
});
