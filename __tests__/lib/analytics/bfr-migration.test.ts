import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260824150000_add_bfr_analytics_events.sql"
  ),
  "utf8"
);

const BFR_DB_EVENTS = [
  "beach_follow_started",
  "beach_follow_saved_local",
  "beach_follow_sync_started",
  "beach_follow_sync_completed",
  "follow_topic_changed",
  "visitor_intent_selected",
  "surf_intent_qualified",
  "my_coast_viewed",
  "my_coast_beach_opened",
  "watched_call_exposed",
  "watched_call_created",
  "watched_call_already_exists",
  "watched_call_update_eligible",
  "watched_call_update_suppressed",
  "watched_call_update_delivered",
  "watched_call_update_opened",
  "watched_call_manual_reopened",
  "watched_call_context_resolved",
  "home_mode_restored",
  "home_mode_expired",
  "home_recommendation_changed",
] as const;

describe("BFR analytics migration", () => {
  it("additively extends the existing check without applying destructive data changes", () => {
    expect(migrationSql).toMatch(/^BEGIN;/m);
    expect(migrationSql).toMatch(/^COMMIT;/m);
    expect(migrationSql).toContain("pg_get_constraintdef");
    expect(migrationSql).toContain("current_check");
    for (const eventType of BFR_DB_EVENTS) {
      expect(migrationSql).toContain(`'${eventType}'`);
    }
    expect(migrationSql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bDROP TABLE\b/i);
  });

  it("reuses existing exact handoff events instead of creating duplicates", () => {
    expect(migrationSql).not.toContain("exact_call_handoff_started");
    expect(migrationSql).not.toContain("exact_call_handoff_resolved");
  });
});
