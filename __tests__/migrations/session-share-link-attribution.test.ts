import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260521130000_add_session_share_link_attribution.sql"
  ),
  "utf8"
);

describe("session share link attribution migration", () => {
  it("creates a separate attribution table without touching session_shares triggers", () => {
    expect(migrationSQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.session_share_links/i);
    expect(migrationSQL).toMatch(/share_id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
    expect(migrationSQL).toMatch(/REFERENCES public\.sessions\(id\) ON DELETE CASCADE/i);
    expect(migrationSQL).not.toMatch(/trigger_increment_share_count/i);
    expect(migrationSQL).not.toMatch(/ALTER TABLE public\.session_shares/i);
  });

  it("enables authenticated-only RLS for inserts and own-row reads", () => {
    expect(migrationSQL).toMatch(/ALTER TABLE public\.session_share_links ENABLE ROW LEVEL SECURITY/i);
    expect(migrationSQL).toMatch(/REVOKE ALL ON TABLE public\.session_share_links FROM anon/i);
    expect(migrationSQL).toMatch(/GRANT SELECT, INSERT ON TABLE public\.session_share_links TO authenticated/i);
    expect(migrationSQL).toMatch(/GRANT ALL ON TABLE public\.session_share_links TO service_role/i);
    expect(migrationSQL).toMatch(/FOR INSERT\s+TO authenticated/i);
    expect(migrationSQL).toMatch(/user_id = auth\.uid\(\)/i);
    expect(migrationSQL).toMatch(/sessions\.is_public = true/i);
    expect(migrationSQL).toMatch(/sessions\.user_id = auth\.uid\(\)/i);
    expect(migrationSQL).toMatch(/FOR SELECT\s+TO authenticated/i);
    expect(migrationSQL).not.toMatch(/TO anon/i);
  });

  it("adds share_link_opened to the user_events check constraint", () => {
    expect(migrationSQL).toMatch(/DROP CONSTRAINT IF EXISTS user_events_event_type_check/i);
    expect(migrationSQL).toMatch(/ADD CONSTRAINT user_events_event_type_check/i);
    expect(migrationSQL).toContain("'share_link_opened'::text");
  });
});
