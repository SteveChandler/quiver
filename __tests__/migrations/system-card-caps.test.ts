import { readFileSync } from "node:fs";

describe("system feed cap migration", () => {
  it("locks and counts every system-authored feed producer before inserting", () => {
    const sql = readFileSync(
      "supabase/migrations/20260813160000_atomic_system_feed_caps.sql",
      "utf8",
    );

    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("JOIN public.profiles p ON p.id = ip.user_id");
    expect(sql).toContain("p.is_system_account IS TRUE");
    expect(sql).toContain("daily_count");
    expect(sql).toContain("beach_daily_count");
    expect(sql).toContain("beach_weekly_count");
    expect(sql.indexOf("INSERT INTO public.intel_posts")).toBeGreaterThan(
      sql.indexOf("beach_weekly_count"),
    );
  });
});
