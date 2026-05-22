import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260522150000_create_email_click_events.sql"
  ),
  "utf8"
);

describe("email click events migration", () => {
  it("creates a first-party email click event table linked to email_send_log", () => {
    expect(migrationSQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.email_click_events/i);
    expect(migrationSQL).toMatch(/email_send_log_id bigint NULL REFERENCES public\.email_send_log\(id\) ON DELETE CASCADE/i);
    expect(migrationSQL).toMatch(/resend_message_id text NOT NULL/i);
    expect(migrationSQL).toMatch(/clicked_at timestamptz NOT NULL/i);
    expect(migrationSQL).toMatch(/link text NOT NULL/i);
    expect(migrationSQL).toMatch(/user_agent text NULL/i);
  });

  it("keeps webhook replays idempotent without storing raw IP addresses", () => {
    expect(migrationSQL).toMatch(/webhook_message_id text NULL/i);
    expect(migrationSQL).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_email_click_events_webhook_message_id/i);
    expect(migrationSQL).not.toMatch(/\bip_address\b/i);
    expect(migrationSQL).not.toMatch(/\bipAddress\b/);
    expect(migrationSQL).toMatch(/raw IP addresses are intentionally omitted/i);
  });

  it("restricts access to service role only", () => {
    expect(migrationSQL).toMatch(/ALTER TABLE public\.email_click_events ENABLE ROW LEVEL SECURITY/i);
    expect(migrationSQL).toMatch(/REVOKE ALL ON TABLE public\.email_click_events FROM anon/i);
    expect(migrationSQL).toMatch(/REVOKE ALL ON TABLE public\.email_click_events FROM authenticated/i);
    expect(migrationSQL).toMatch(/GRANT ALL ON TABLE public\.email_click_events TO service_role/i);
    expect(migrationSQL).toMatch(
      /GRANT USAGE, SELECT ON SEQUENCE public\.email_click_events_id_seq TO service_role/i
    );
  });
});
