import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261103180000_session_watch_claims.sql"),
  "utf8"
);

describe("session watch claims migration", () => {
  it("runs in one transaction", () => {
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("adds timing_user_set like tide_status_user_set, with explicit column grants", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS timing_user_set boolean NOT NULL DEFAULT false");
    expect(sql).toContain("GRANT SELECT (timing_user_set), INSERT (timing_user_set), UPDATE (timing_user_set) ON public.sessions TO authenticated");
  });

  it("keys one claim per session and bounds its window", () => {
    expect(sql).toContain("session_id uuid PRIMARY KEY REFERENCES public.sessions ON DELETE CASCADE");
    expect(sql).toContain("window_end > window_start AND window_end - window_start <= interval '24 hours'");
    expect(sql).toContain("ON public.session_watch_claims (user_id, window_end)");
  });

  it("lets owners claim only their own live session and device, and never write the importer's fields", () => {
    expect(sql).toContain("ALTER TABLE public.session_watch_claims ENABLE ROW LEVEL SECURITY");
    const insertPolicy = sql.slice(sql.indexOf("CREATE POLICY session_watch_claims_insert_own"),
      sql.indexOf("DROP POLICY IF EXISTS session_watch_claims_delete_own"));
    expect(insertPolicy).toContain("user_id = (select auth.uid())");
    expect(insertPolicy).toContain("s.id = session_id AND s.user_id = (select auth.uid()) AND s.deleted_at IS NULL");
    expect(insertPolicy).toContain("d.id = device_id AND d.user_id = (select auth.uid())");
    expect(sql).toContain("REVOKE ALL ON public.session_watch_claims FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT SELECT, DELETE ON public.session_watch_claims TO authenticated");
    expect(sql).toContain("GRANT INSERT (session_id, user_id, device_id, window_start, window_end) ON public.session_watch_claims TO authenticated");
    expect(sql).not.toMatch(/GRANT[^;]*UPDATE[^;]*session_watch_claims TO authenticated/);
    expect(sql).not.toMatch(/FOR UPDATE TO authenticated/);
  });
});
