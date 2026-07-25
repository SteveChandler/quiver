import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260725121000_add_app_handoff_native_open_event.sql",
  ),
  "utf8",
);

describe("app handoff native-open event migration", () => {
  it("adds the event without replacing unrelated allowlisted events", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
    expect(migrationSQL).toContain("app_handoff_native_open");
    expect(migrationSQL).toContain("pg_get_constraintdef");
    expect(migrationSQL).toContain("current_check");
    expect(migrationSQL).toContain("missing_events");
    expect(migrationSQL).toContain(
      "DROP CONSTRAINT user_events_event_type_check",
    );
    expect(migrationSQL).not.toMatch(/\bDELETE\b/i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSQL).not.toMatch(/\bDROP TABLE\b/i);
  });
});
