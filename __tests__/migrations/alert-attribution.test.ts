import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260828140000_add_alert_attribution.sql",
);

describe("alert attribution migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("adds nullable UUID message identity without rewriting legacy rows", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
    expect(sql).toMatch(
      /ALTER TABLE public\.email_send_log\s+ADD COLUMN message_instance_id uuid;/,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.alert_delivery_attempts\s+ADD COLUMN message_instance_id uuid;/,
    );
    expect(sql).not.toMatch(/message_instance_id uuid\s+(?:NOT NULL|DEFAULT)/i);
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bDROP TABLE\b/i);
  });

  it("indexes message ownership lookups and uniquely identifies sent emails", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX email_send_log_message_instance_id_idx[\s\S]*?ON public\.email_send_log \(message_instance_id\)[\s\S]*?WHERE message_instance_id IS NOT NULL;/,
    );
    expect(sql).toMatch(
      /CREATE INDEX alert_delivery_attempts_message_instance_id_idx[\s\S]*?ON public\.alert_delivery_attempts \(message_instance_id\)[\s\S]*?WHERE message_instance_id IS NOT NULL;/,
    );
  });

  it("deduplicates attribution events per message, stage, action, and user", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX user_events_alert_attribution_idempotency_idx[\s\S]*?ON public\.user_events \([\s\S]*?user_id,[\s\S]*?event_type,[\s\S]*?metadata ->> 'message_instance_id'[\s\S]*?COALESCE\(metadata ->> 'action', ''\)[\s\S]*?WHERE event_type IN/,
    );
  });

  it.each([
    "alert_message_activated",
    "alert_app_returned",
    "alert_return_to_decision",
    "alert_decision_action",
  ])("adds the %s event without replacing the current taxonomy", (eventType) => {
    expect(sql).toContain("pg_get_constraintdef");
    expect(sql).toContain(`'${eventType}'`);
  });
});
