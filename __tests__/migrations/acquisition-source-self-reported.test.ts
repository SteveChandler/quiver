import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730121000_add_acquisition_source_self_reported_event.sql"
  ),
  "utf8"
);

const TARGET_EVENT = "acquisition_source_self_reported";

describe("acquisition source self-reported event migration", () => {
  it("preserves the current CHECK expression and widens only its constraint", () => {
    expect(migrationSQL).toContain("pg_get_constraintdef");
    expect(migrationSQL).toContain("current_check");
    expect(migrationSQL).toContain(
      "RAISE EXCEPTION 'user_events_event_type_check constraint not found'"
    );
    expect(migrationSQL).toContain(
      "DROP CONSTRAINT user_events_event_type_check"
    );
    expect(migrationSQL).toContain(
      "ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))"
    );
    expect(migrationSQL.match(/\bDROP CONSTRAINT\b/g)).toHaveLength(1);
    expect(migrationSQL).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("no-ops when the exact event is already present", () => {
    expect(migrationSQL).toContain(
      "'(^|[^[:alnum:]_])' || event_name || '([^[:alnum:]_]|$)'"
    );
    expect(migrationSQL).toMatch(
      /IF missing_events IS NULL OR array_length\(missing_events, 1\) IS NULL THEN[\s\S]*RAISE NOTICE[\s\S]*RETURN;[\s\S]*END IF;/
    );

    const returnPosition = migrationSQL.indexOf("RETURN;");
    const dropPosition = migrationSQL.indexOf("DROP CONSTRAINT");
    expect(returnPosition).toBeGreaterThanOrEqual(0);
    expect(dropPosition).toBeGreaterThan(returnPosition);
  });

  it("contains exactly the locked event spelling without a static allowlist", () => {
    const candidateEvents = migrationSQL.match(
      /candidate_events text\[\] := ARRAY\[(.*?)\];/
    );

    expect(candidateEvents?.[1]).toBe(`'${TARGET_EVENT}'`);
    expect(migrationSQL.match(new RegExp(TARGET_EVENT, "g"))).toHaveLength(1);
  });

  it("uses explicit transaction boundaries and performs no data deletion", () => {
    expect(migrationSQL.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
    expect(migrationSQL.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(migrationSQL.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(migrationSQL).not.toMatch(/\bDELETE\b/i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSQL).not.toMatch(/\bDROP TABLE\b/i);
  });
});
