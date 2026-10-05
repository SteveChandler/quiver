import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261004220000_claim_swell_outlook_first_sighting.sql"), "utf8");

describe("first-sighting atomic claim migration", () => {
  it("serializes each user's event claims and checks spacing inside that lock", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(sql.indexOf("interval '72 hours'"));
    expect(sql).toContain("created_at > claim_now - interval '72 hours'");
    expect(sql).toContain("event_key = ANY(p_event_keys)");
    expect(sql).toContain("ON CONFLICT (user_id, event_key) DO NOTHING");
  });

  it("is transactional, service-role only, and does not mutate engagement", () => {
    expect(sql).toMatch(/BEGIN;/);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).not.toMatch(/UPDATE|DELETE|TRUNCATE|swell_outlook_user_state/);
  });
});

it("returns explicit claim-denial reasons and uses the database clock", () => {
  expect(sql).toContain("RETURNS jsonb");
  expect(sql).toContain("claim_now := now()");
  expect(sql).toContain("'reason', 'event_exists'");
  expect(sql).toContain("'reason', 'first_sighting_spacing'");
  expect(sql).not.toContain("p_payload, p_now");
  expect(sql).toContain("p_payload, claim_now");
});

it("runs both local outlook harnesses in the existing swell integration workflow", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/swell-watch-normalization.yml"), "utf8");
  expect(workflow).toContain("bash scripts/test-swell-watch-study-postgres.sh");
  expect(workflow).toContain("bash scripts/test-swell-watch-feed-isolation-postgres.sh");
  expect(workflow).toContain("bash scripts/test-swell-snapshot-outcomes-postgres.sh");
  expect(workflow).toContain("bash scripts/test-swell-outlook-first-sighting-postgres.sh");
  expect(workflow).toContain("SCOUT_PG_BIN=/usr/lib/postgresql/15/bin");
  expect(workflow).toContain("postgres:15");
});
