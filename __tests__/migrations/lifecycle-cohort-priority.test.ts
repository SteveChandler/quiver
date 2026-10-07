import { readFileSync } from "fs";
import { join } from "path";

describe("overdue lifecycle cohort priority", () => {
  const sql = readFileSync(
    join(__dirname, "../../supabase/migrations/20261007020000_fix_lifecycle_cohort_starvation.sql"),
    "utf-8"
  ).replace(/\s+/g, " ").trim();

  it("prioritizes overdue unsent recipients even after a recent evaluation", () => {
    expect(sql).toContain("ORDER BY coalesce(r.status='due' AND r.first_due_at<now()-interval '30 minutes' AND NOT EXISTS(");
    expect(sql).not.toMatch(/r\.evaluated_at\s*</);
    expect(sql).toContain("WHERE a.user_id=r.user_id AND a.lifecycle_job=r.job AND a.episode=r.episode AND a.state NOT IN ('cancelled','failed')");
    expect(sql).toContain("), false) DESC, r.evaluated_at NULLS FIRST, s.user_id LIMIT 50");
  });
});
