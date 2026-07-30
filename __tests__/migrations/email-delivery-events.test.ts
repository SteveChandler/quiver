import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730120000_create_email_delivery_events.sql"
  ),
  "utf8"
);

describe("email delivery events migration", () => {
  it("is transactional and creates the table additively", () => {
    expect(migrationSQL.trim()).toMatch(/^BEGIN;/i);
    expect(migrationSQL.trim()).toMatch(/COMMIT;$/i);
    expect(migrationSQL).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.email_delivery_events/i
    );
  });

  it("creates the durable event schema, nullable send-log link, and replay key", () => {
    expect(migrationSQL).toMatch(/id bigserial PRIMARY KEY/i);
    expect(migrationSQL).toMatch(
      /email_send_log_id bigint NULL REFERENCES public\.email_send_log\(id\) ON DELETE CASCADE/i
    );
    expect(migrationSQL).toMatch(/resend_message_id text NOT NULL/i);
    expect(migrationSQL).toMatch(/webhook_message_id text NOT NULL/i);
    expect(migrationSQL).toMatch(/event_at timestamptz NOT NULL/i);
    expect(migrationSQL).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_email_delivery_events_webhook_message_id[\s\S]*ON public\.email_delivery_events\(webhook_message_id\)/i
    );
  });

  it("constrains events to the supported Resend delivery lifecycle", () => {
    expect(migrationSQL).toMatch(
      /CONSTRAINT email_delivery_events_event_type_check CHECK/i
    );
    for (const eventType of [
      "email.delivered",
      "email.opened",
      "email.clicked",
      "email.bounced",
    ]) {
      expect(migrationSQL).toContain(`'${eventType}'`);
    }
  });

  it("indexes provider, linkage, and event-time queries", () => {
    expect(migrationSQL).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_email_delivery_events_resend_message_id[\s\S]*ON public\.email_delivery_events\(resend_message_id\)/i
    );
    expect(migrationSQL).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_email_delivery_events_email_send_log_id[\s\S]*ON public\.email_delivery_events\(email_send_log_id\)/i
    );
    expect(migrationSQL).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_email_delivery_events_event_type_event_at[\s\S]*ON public\.email_delivery_events\(event_type, event_at DESC\)/i
    );
  });

  it("enables RLS and grants table and sequence access only to service_role", () => {
    expect(migrationSQL).toMatch(
      /ALTER TABLE public\.email_delivery_events ENABLE ROW LEVEL SECURITY/i
    );
    expect(migrationSQL).not.toMatch(/CREATE POLICY/i);
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON TABLE public\.email_delivery_events FROM anon/i
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON TABLE public\.email_delivery_events FROM authenticated/i
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON SEQUENCE public\.email_delivery_events_id_seq FROM anon/i
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON SEQUENCE public\.email_delivery_events_id_seq FROM authenticated/i
    );
    expect(migrationSQL).toMatch(
      /GRANT ALL ON TABLE public\.email_delivery_events TO service_role/i
    );
    expect(migrationSQL).toMatch(
      /GRANT USAGE, SELECT ON SEQUENCE public\.email_delivery_events_id_seq TO service_role/i
    );
    expect(migrationSQL).not.toMatch(
      /GRANT\s+\w+[\s\S]*ON (?:TABLE|SEQUENCE) public\.email_delivery_events(?:_id_seq)? TO (?:anon|authenticated)/i
    );
  });

  it("contains no destructive data statements or privacy-detail columns", () => {
    expect(migrationSQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSQL).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migrationSQL).not.toMatch(/\b(?:ip|ip_address)\s+(?:inet|text)\b/i);
    expect(migrationSQL).not.toMatch(/\bipAddress\b/);
    expect(migrationSQL).not.toMatch(/\blink\s+text\b/i);
    expect(migrationSQL).not.toMatch(/\buser_agent\s+text\b/i);
    expect(migrationSQL).not.toMatch(/\bmetadata\s+jsonb\b/i);
  });

  it("documents the privacy and race contract and reloads PostgREST", () => {
    expect(migrationSQL).toMatch(/raw-IP[\s\S]*intentionally omitted/i);
    expect(migrationSQL).toMatch(/webhook can arrive before its email_send_log row/i);
    expect(migrationSQL).toMatch(/NOTIFY pgrst, 'reload schema'/i);
  });
});
