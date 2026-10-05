import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql"),
  "utf8",
);

describe("swell snapshot lead and outcome migration", () => {
  it("runs in one transaction", () => {
    expect(sql.trim().split("\n").filter((line) => !line.startsWith("--"))[0]).toBe("BEGIN;");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("adds nullable columns only, with a closed outcome vocabulary", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS lead_days numeric NULL/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS outcome text NULL/);
    expect(sql).toMatch(/CHECK \(outcome IN \('held', 'vanished'\)\)/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS outcome_resolved_at timestamptz NULL/);
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM|TRUNCATE/);
  });

  it("keeps the resolver service role only", () => {
    expect(sql).toMatch(/SECURITY INVOKER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).not.toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.resolve_swell_event_outcomes\(timestamptz\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.resolve_swell_event_outcomes\(timestamptz\) TO service_role/);
  });
});
