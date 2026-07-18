import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260718130000_allow_session_log_form_view_event.sql",
);

describe("session_log_form_view user_events migration", () => {
  it("preserves the live CHECK expression and appends the durable funnel stage", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("pg_get_constraintdef");
    expect(sql).toContain("user_events_event_type_check");
    expect(sql).toContain("'session_log_form_view'");
    expect(sql).toContain("current_check");
    expect(sql).toContain("missing_events");
    expect(sql).not.toMatch(/DELETE\s+FROM|TRUNCATE\s+|DROP\s+TABLE/i);
  });
});
