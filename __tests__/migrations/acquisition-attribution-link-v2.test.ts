import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260725120000_add_acquisition_attribution_link_v2.sql",
  ),
  "utf8",
);

describe("acquisition attribution link v2 migration", () => {
  it("is transaction-wrapped and leaves the v1 function intact", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.link_anonymous_events_v2\(\s*p_session_id uuid,\s*p_user_id uuid,\s*p_signup_context jsonb DEFAULT NULL\s*\)\s*RETURNS jsonb/i,
    );
    expect(migrationSQL).not.toMatch(
      /DROP FUNCTION\s+(IF EXISTS\s+)?public\.link_anonymous_events\(/i,
    );
  });

  it("preserves the 30-day anonymous event-link window and returns safe outcomes", () => {
    expect(migrationSQL).toMatch(
      /UPDATE public\.user_events[\s\S]*session_id = p_session_id[\s\S]*user_id IS NULL[\s\S]*created_at > now\(\) - interval '30 days'/i,
    );
    expect(migrationSQL).toContain("'linked'");
    expect(migrationSQL).toContain("'attribution_outcome'");
    expect(migrationSQL).toContain("'signup_surface'");
    expect(migrationSQL).toContain("'evidence_source'");
  });

  it("only materializes attribution for profiles created in the prior 24 hours", () => {
    expect(migrationSQL).toMatch(
      /v_profile_created_at < now\(\) - interval '24 hours'[\s\S]*'not_recent'/i,
    );
    expect(migrationSQL).toMatch(/FOR UPDATE/i);
    expect(migrationSQL).not.toMatch(/\bUPDATE\s+auth\.users\b/i);
  });

  it("uses request, linked web, then linked native evidence precedence", () => {
    const requestEvidence = migrationSQL.indexOf("request_signup_context");
    const webEvidence = migrationSQL.indexOf("linked_web_signup_event");
    const nativeEvidence = migrationSQL.indexOf(
      "linked_native_first_open_event",
    );

    expect(requestEvidence).toBeGreaterThan(-1);
    expect(webEvidence).toBeGreaterThan(requestEvidence);
    expect(nativeEvidence).toBeGreaterThan(webEvidence);
    expect(migrationSQL).toContain("'signup_success'");
    expect(migrationSQL).toContain("'native_app_first_open'");
    expect(migrationSQL).toMatch(/metadata->>'platform'/i);
    expect(migrationSQL).toMatch(
      /event_type = 'signup_success'[\s\S]{0,700}COALESCE\(\s*ue\.metadata->>'platform',\s*ue\.metadata->>'_platform',\s*'web'\s*\) NOT IN/i,
    );
    const nativeSection = migrationSQL.slice(
      migrationSQL.indexOf("-- Evidence precedence 3"),
      migrationSQL.indexOf(
        "IF v_candidate_context IS NULL THEN\n    IF v_existing_context",
      ),
    );
    expect(nativeSection).toMatch(
      /event_type = 'native_app_first_open'[\s\S]*'source_capture_status', 'missing'/i,
    );
  });

  it("fills missing top-level and UTM keys while preserving established values", () => {
    expect(migrationSQL).toMatch(
      /v_candidate_context \|\| v_existing_context/i,
    );
    expect(migrationSQL).toMatch(
      /COALESCE\(v_candidate_context->'utm', '\{\}'::jsonb\)\s*\|\|\s*COALESCE\(v_existing_context->'utm'/i,
    );
    expect(migrationSQL).toMatch(
      /signup_context = v_merged_context/i,
    );
    expect(migrationSQL).toMatch(
      /v_existing_surface IS NOT NULL[\s\S]*attribution_outcome := 'preserved'/i,
    );
  });

  it("is service-role-only and does not contain a historical backfill", () => {
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.link_anonymous_events_v2\(uuid, uuid, jsonb\)\s+FROM PUBLIC/i,
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.link_anonymous_events_v2\(uuid, uuid, jsonb\)\s+FROM anon, authenticated/i,
    );
    expect(migrationSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.link_anonymous_events_v2\(uuid, uuid, jsonb\)\s+TO service_role/i,
    );
    expect(migrationSQL).not.toMatch(/\bDELETE\b/i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSQL).not.toMatch(/\bDROP TABLE\b/i);
  });
});
