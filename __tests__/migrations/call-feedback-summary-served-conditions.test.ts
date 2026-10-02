import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260928233000_call_feedback_summary_served_conditions.sql",
);

describe("call feedback summary served conditions migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("runs in one transaction and only touches the view", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
    expect(sql).not.toMatch(/\b(?:DELETE|TRUNCATE|DROP TABLE)\b/i);
  });

  it("appends served_conditions from the exposure event metadata", () => {
    expect(sql).toContain("ue.metadata->'served_conditions' AS served_conditions");
    expect(sql).toContain("shown_calls.served_conditions");
    expect(sql).toContain("event_type = 'board_pick_exposed'");
  });

  it("keeps the view invoker-secured and service-role only", () => {
    expect(sql).toContain("WITH (security_invoker = true)");
    expect(sql).toContain("option_name = 'security_invoker'");
    expect(sql).toMatch(
      /REVOKE ALL ON public\.call_feedback_summary FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /GRANT SELECT ON public\.call_feedback_summary TO service_role;/,
    );
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
