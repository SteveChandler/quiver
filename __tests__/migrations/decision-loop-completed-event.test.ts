import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260831223000_add_decision_loop_completed_event.sql",
);

describe("decision loop completion event migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("extends the live event constraint without replacing its taxonomy", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
    expect(sql).toContain("pg_get_constraintdef");
    expect(sql).toContain("'decision_loop_completed'");
    expect(sql).toContain("CREATE UNIQUE INDEX user_events_decision_loop_completed_event_id_uidx");
    expect(sql).toContain("metadata ->> 'event_id'");
    expect(sql).not.toMatch(/\b(?:DELETE|TRUNCATE|DROP TABLE)\b/i);
  });
});
