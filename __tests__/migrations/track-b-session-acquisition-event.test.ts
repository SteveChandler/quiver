import { readFileSync } from "fs";
import { join } from "path";

describe("Migration: Track B session acquisition event allowlist", () => {
  const migrationPath = join(
    __dirname,
    "../../supabase/migrations/20260620132701_add_session_log_conditions_set_event.sql"
  );
  const approvalRequestPath = join(
    __dirname,
    "../../docs/research/2026-06-20-track-b-session-acquisition-event-approval-request.md"
  );
  const preflightPath = join(
    __dirname,
    "../../scripts/db/track-b-session-acquisition-event-preflight.sql"
  );
  const postflightPath = join(
    __dirname,
    "../../scripts/db/track-b-session-acquisition-event-postflight.sql"
  );

  let migrationSQL: string;
  let approvalRequestMarkdown: string;
  let preflightSQL: string;
  let postflightSQL: string;

  beforeAll(() => {
    migrationSQL = readFileSync(migrationPath, "utf8");
    approvalRequestMarkdown = readFileSync(approvalRequestPath, "utf8");
    preflightSQL = readFileSync(preflightPath, "utf8");
    postflightSQL = readFileSync(postflightPath, "utf8");
  });

  it("widens the event CHECK without replacing unrelated existing events", () => {
    expect(migrationSQL).toContain("user_events_event_type_check");
    expect(migrationSQL).toContain("pg_get_constraintdef");
    expect(migrationSQL).toContain("current_check");
    expect(migrationSQL).toContain("candidate_events text[]");
    expect(migrationSQL).toContain("session_log_conditions_set");
    expect(migrationSQL).toContain("missing_events");
    expect(migrationSQL).toContain("DROP CONSTRAINT user_events_event_type_check");
    expect(migrationSQL).toContain(
      "ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))"
    );
    expect(migrationSQL).toContain("NOTIFY pgrst, 'reload schema'");
    expect(migrationSQL).not.toMatch(/\bDELETE\b/i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSQL).not.toMatch(/\bDROP TABLE\b/i);
  });

  it("keeps the historical production approval packet tied to this event", () => {
    expect(approvalRequestMarkdown).toContain(
      "APPROVE: f20493762c71c54c71ba4eb6fe1bb396e706124c282f6775e11f9e1435540e8c"
    );
    expect(approvalRequestMarkdown).toContain(
      "2026-06-19-track-b-session-acquisition-event-approved"
    );
    expect(approvalRequestMarkdown).toContain("session_log_conditions_set");
    expect(approvalRequestMarkdown).toContain(
      "This approval phrase does not authorize Phase 0"
    );
  });

  it("has a read-only preflight that reports whether the migration is needed", () => {
    expect(preflightSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(preflightSQL).toMatch(/^ROLLBACK;/m);
    expect(preflightSQL).toContain("track_b_event_allowlist_preflight");
    expect(preflightSQL).toContain("to_regclass('public.user_events')");
    expect(preflightSQL).toContain("user_events_event_type_check");
    expect(preflightSQL).toContain("session_log_conditions_set");
    expect(preflightSQL).toContain("target_event_already_allowed");
    expect(preflightSQL).toContain("migration_needed");
    expect(preflightSQL).toContain(
      "can_request_track_b_event_migration_approval"
    );
    expect(preflightSQL).toContain("track_b_event_preflight_blockers");
    expect(preflightSQL).toContain("blocker_code");
    expect(preflightSQL).toContain("blocker_message");
    expect(preflightSQL).toContain("missing_user_events_table");
    expect(preflightSQL).toContain("missing_user_events_event_type_check");
    expect(preflightSQL).toContain("track_b_recent_session_funnel_events");
    expect(preflightSQL).toContain(
      "track_b_recent_session_funnel_events_skipped"
    );
    expect(preflightSQL).toContain("track_b_event_preflight_passed");
    expect(preflightSQL).toContain("RAISE EXCEPTION");
    expect(preflightSQL).toContain(
      "Track B session acquisition event preflight failed; see track_b_event_preflight_blockers above."
    );
    expect(preflightSQL).not.toMatch(/\bALTER TABLE\b/i);
    expect(preflightSQL).not.toMatch(/\bDROP CONSTRAINT\b/i);
    expect(preflightSQL).not.toMatch(/\bDELETE\b/i);
    expect(preflightSQL).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("has a read-only postflight that fails unless the new event is allowed", () => {
    expect(postflightSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(postflightSQL).toMatch(/^ROLLBACK;/m);
    expect(postflightSQL).toContain("track_b_event_allowlist_postflight");
    expect(postflightSQL).toContain("to_regclass('public.user_events')");
    expect(postflightSQL).toContain("user_events_event_type_check");
    expect(postflightSQL).toContain("session_log_conditions_set");
    expect(postflightSQL).toContain("target_event_allowed");
    expect(postflightSQL).toContain("track_b_event_allowlist_ready");
    expect(postflightSQL).toContain("track_b_event_postflight_blockers");
    expect(postflightSQL).toContain("blocker_code");
    expect(postflightSQL).toContain("blocker_message");
    expect(postflightSQL).toContain("missing_user_events_table");
    expect(postflightSQL).toContain("missing_user_events_event_type_check");
    expect(postflightSQL).toContain(
      "session_log_conditions_set_not_allowed"
    );
    expect(postflightSQL).toContain("track_b_conditions_set_event_rows");
    expect(postflightSQL).toContain(
      "track_b_conditions_set_event_rows_skipped"
    );
    expect(postflightSQL).toContain("track_b_event_postflight_passed");
    expect(postflightSQL).toContain("track_b_event_rows_query_safe");
    expect(postflightSQL).toContain("RAISE EXCEPTION");
    expect(postflightSQL).toContain(
      "Track B session acquisition event postflight failed; see track_b_event_postflight_blockers above."
    );
    expect(postflightSQL).not.toMatch(/\bALTER TABLE\b/i);
    expect(postflightSQL).not.toMatch(/\bDROP CONSTRAINT\b/i);
    expect(postflightSQL).not.toMatch(/\bDELETE\b/i);
    expect(postflightSQL).not.toMatch(/\bTRUNCATE\b/i);
  });
});
