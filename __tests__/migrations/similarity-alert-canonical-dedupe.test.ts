import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260724005515_similarity_alert_canonical_dedupe.sql",
  ),
  "utf8",
);
const rollbackSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/rollbacks/20260724005515_similarity_alert_canonical_dedupe_rollback.sql",
  ),
  "utf8",
);
const normalizedMigration = migrationSQL.replace(/\s+/g, " ").toLowerCase();
const normalizedRollback = rollbackSQL.replace(/\s+/g, " ").toLowerCase();

describe("similarity alert canonical dedupe migration", () => {
  it("is transactional and preserves queued user data", () => {
    expect(normalizedMigration).toContain("begin;");
    expect(normalizedMigration.trim().endsWith("commit;")).toBe(true);
    expect(normalizedMigration).not.toMatch(/\b(delete|truncate)\b/);
  });

  it("deduplicates by user, beach, window, and canonical verdict", () => {
    expect(normalizedMigration).toContain(
      "create unique index alert_queue_similarity_canonical_decision_dedupe",
    );
    expect(normalizedMigration).toContain(
      "user_id, beach_id, window_start, ((conditions_snapshot -> 'session_decision' ->> 'verdict'))",
    );
    expect(normalizedMigration).toContain(
      "where (conditions_snapshot ->> 'alert_type') = 'similarity_match'",
    );
    expect(normalizedMigration).toContain(
      "drop index if exists public.alert_queue_one_similarity_per_user_day",
    );
  });

  it("makes the insert RPC require and infer the canonical verdict contract", () => {
    expect(normalizedMigration).toContain(
      "v_verdict not in ('go', 'maybe', 'no')",
    );
    expect(normalizedMigration).toContain(
      "on conflict ( user_id, beach_id, window_start, ((conditions_snapshot -> 'session_decision' ->> 'verdict')) )",
    );
    expect(normalizedMigration).toContain("to service_role");
    expect(normalizedMigration).toContain("notify pgrst, 'reload schema'");
  });

  it("ships a fail-closed rollback for the replaced user/day contract", () => {
    const guardPosition = normalizedRollback.indexOf("having count(*) > 1");
    const indexPosition = normalizedRollback.indexOf(
      "create unique index alert_queue_one_similarity_per_user_day",
    );

    expect(normalizedRollback).toContain("begin;");
    expect(normalizedRollback.trim().endsWith("commit;")).toBe(true);
    expect(normalizedRollback).not.toMatch(/\b(delete|truncate)\b/);
    expect(guardPosition).toBeGreaterThanOrEqual(0);
    expect(indexPosition).toBeGreaterThan(guardPosition);
    expect(normalizedRollback).toContain(
      "drop index if exists public.alert_queue_similarity_canonical_decision_dedupe",
    );
  });
});
