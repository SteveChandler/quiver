import { readFileSync } from "node:fs";

describe("system-card traffic-weight migration", () => {
  it("is explicitly unapplied and creates the materialized analytics table", () => {
    const sql = readFileSync(
      "supabase/migrations/20260813150000_create_beach_traffic_weights.sql",
      "utf8",
    );
    expect(sql).toContain("-- UNAPPLIED FORWARD MIGRATION (2026-08-13)");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.beach_traffic_weights");
    expect(sql).toContain("allocation_tier");
  });
});
