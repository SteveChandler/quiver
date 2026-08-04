import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260802161000_add_apple_orphan_recovery_flagged_event.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("Apple orphan recovery analytics event migration", () => {
  it("preserves the current CHECK expression and adds only the new event", () => {
    expect(sql).toContain("pg_get_constraintdef");
    expect(sql).toContain("current_check");
    expect(sql).toContain(
      "candidate_events text[] := ARRAY['apple_orphan_recovery_flagged']",
    );
    expect(sql).toContain(
      "DROP CONSTRAINT user_events_event_type_check",
    );
    expect(sql).toContain(
      "ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))",
    );
  });

  it("is transactional and performs no data deletion", () => {
    expect(sql.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
  });
});
