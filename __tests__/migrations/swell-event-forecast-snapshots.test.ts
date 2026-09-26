import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260925150500_create_swell_event_forecast_snapshots.sql"),
  "utf8",
);

describe("swell event forecast snapshots migration", () => {
  it("runs in one transaction", () => {
    expect(sql.trim().split("\n").filter((line) => !line.startsWith("--"))[0]).toBe("BEGIN;");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("creates the snapshot table keyed per beach, event and run date", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.swell_event_forecast_snapshots/);
    expect(sql).toMatch(/beach_id uuid NOT NULL REFERENCES public\.beaches\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/run_date date NOT NULL/);
    expect(sql).toMatch(/fade_at timestamptz NULL/);
    expect(sql).toMatch(/UNIQUE \(beach_id, event_key, run_date\)/);
    expect(sql).toMatch(/\(beach_id, detected_at DESC\)/);
    for (const column of ["crossing_direction_deg", "crossing_period_s", "crossing_offshore_height_ft"]) {
      expect(sql).toMatch(new RegExp(`${column} numeric NULL`));
    }
  });

  it("is service role only", () => {
    expect(sql).toMatch(/ALTER TABLE public\.swell_event_forecast_snapshots ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.swell_event_crossing_history\(uuid\[\], timestamptz\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.swell_event_crossing_history\(uuid\[\], timestamptz\) TO service_role/);
    expect(sql).not.toMatch(/SECURITY DEFINER/);
  });

  it("counts crossings per event by its latest snapshot and beach-local peak date", () => {
    expect(sql).toMatch(/DISTINCT ON \(s\.beach_id, s\.event_key\)/);
    expect(sql).toMatch(/ORDER BY s\.beach_id, s\.event_key, s\.detected_at DESC/);
    expect(sql).toMatch(/AT TIME ZONE coalesce\(latest\.timezone, 'America\/Los_Angeles'\)\)::date/);
    expect(sql).toMatch(/latest\.crossing_direction_deg IS NOT NULL/);
    expect(sql).toMatch(/count\(DISTINCT run_date\)/);
  });

  it("never deletes data", () => {
    expect(sql).not.toMatch(/^\s*(DELETE|TRUNCATE|DROP)\b/m);
  });
});
