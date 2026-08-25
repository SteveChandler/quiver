import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260824150000_add_bfr_analytics_events.sql"
  ),
  "utf8"
);
const beachFollowsMigrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260824120000_create_beach_follows.sql"
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

describe("BFR migrations", () => {
  it("persists an exact per-topic addition-time map on beach follows", () => {
    expect(beachFollowsMigrationSql).toContain(
      "topic_added_at jsonb NOT NULL"
    );
    expect(beachFollowsMigrationSql).toContain(
      "CONSTRAINT beach_follows_topic_added_at_matches_topics CHECK"
    );
    expect(beachFollowsMigrationSql).toContain(
      "jsonb_object_length(topic_added_at) = cardinality(topics)"
    );
    expect(beachFollowsMigrationSql).toContain("topic_added_at ?& topics");
    expect(beachFollowsMigrationSql).toContain(
      "@.type() != \"string\""
    );
    expect(beachFollowsMigrationSql).toContain(
      "CREATE FUNCTION public.beach_follow_topic_added_at_is_valid(value jsonb)"
    );
    expect(beachFollowsMigrationSql).toContain("IMMUTABLE");
    expect(beachFollowsMigrationSql).toContain("length(candidate) > 35");
    expect(beachFollowsMigrationSql).toContain(
      "candidate !~ '^[0-9]{4}-(0[1-9]|1[0-2])"
    );
    expect(beachFollowsMigrationSql).toContain(
      "(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$'"
    );
    expect(beachFollowsMigrationSql).toContain(
      "candidate::pg_catalog.timestamptz"
    );
    expect(beachFollowsMigrationSql).toContain(
      "public.beach_follow_topic_added_at_is_valid(topic_added_at)"
    );
    expect(beachFollowsMigrationSql).toContain(
      "invalid_datetime_format OR datetime_field_overflow"
    );
  });

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
