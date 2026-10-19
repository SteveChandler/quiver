import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261019090000_garmin_watch.sql"),
  "utf8"
);

describe("Garmin watch migration", () => {
  it("guards the session waves dependency before changing schema", () => {
    expect(sql.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(sql.indexOf("to_regclass('public.session_tracks')")).toBeLessThan(
      sql.indexOf("CREATE TABLE IF NOT EXISTS public.watch_devices")
    );
    expect(sql).toContain("to_regclass('public.session_imports')");
    expect(sql).toContain("apply 20261018090000_session_waves_core.sql first");
    expect(sql).toContain("to_regproc('public.is_historical_file_import') IS NULL");
    expect(sql).toContain("apply 20261018090100_session_waves_triggers.sql first");
    expect(sql.indexOf("to_regproc('public.is_historical_file_import')")).toBeLessThan(sql.indexOf("ALTER TABLE"));
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("adds watch source, track format, and import origin", () => {
    expect(sql).toContain("string_to_array('garmin_watch', ',')");
    expect(sql).toContain("format IN ('fit', 'gpx', 'quiver_watch')");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'file'");
    expect(sql).toContain("origin IN ('file', 'garmin_watch')");
  });

  it.each(["watch_devices", "watch_link_codes", "watch_uploads"])(
    "protects %s with RLS and explicit grants",
    table => {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated`);
      expect(sql).toContain(`GRANT ALL ON public.${table} TO service_role`);
    }
  );

  it.each([
    ["watch_uploads", "device_id"],
    ["watch_uploads", "user_id"],
    ["watch_uploads", "import_id"],
    ["watch_link_codes", "user_id"],
    ["watch_link_codes", "device_id"],
    ["session_imports", "device_id"],
  ])("indexes the %s.%s foreign key idempotently", (table, column) => {
    expect(sql).toMatch(
      new RegExp(`CREATE INDEX IF NOT EXISTS \\w+\\s+ON public\\.${table} \\(${column}\\);`)
    );
  });

  it("grants device reads without exposing token hashes, including on reapplication", () => {
    expect(sql).toContain(
      "REVOKE SELECT (token_hash) ON public.watch_devices FROM PUBLIC, anon, authenticated;"
    );
    const columnGrants = [...sql.matchAll(
      /GRANT SELECT\s*\(([^)]+)\)\s+ON public\.watch_devices TO authenticated;/g
    )];
    expect(columnGrants).toHaveLength(1);
    expect(columnGrants[0]?.[1].split(",").map(column => column.trim())).toEqual([
      "id", "user_id", "platform", "device_uid", "device_part_number",
      "device_name", "app_version", "created_at", "last_seen_at", "revoked_at",
    ]);
    expect(sql).not.toMatch(/GRANT (?:SELECT|ALL) ON public\.watch_devices TO authenticated/);
  });

  it("atomically merges chunk acknowledgements with owner and completion guards", () => {
    const fn = sql.match(/CREATE OR REPLACE FUNCTION public.watch_upload_mark_chunks[\s\S]*?\$\$;/)?.[0];
    expect(fn).toEqual(expect.any(String));
    expect(fn).toMatch(/RETURNS int\[\]/);
    expect(fn).toMatch(/SECURITY INVOKER[\s\S]*SET search_path = public/);
    expect(fn).toMatch(/UPDATE public.watch_uploads[\s\S]*SET received_chunks = ARRAY/);
    expect(fn).toMatch(/SELECT DISTINCT chunk[\s\S]*unnest\(received_chunks \|\| p_add\)/);
    expect(fn).toMatch(/NOT \(chunk = ANY \(p_remove\)\)[\s\S]*ORDER BY chunk/);
    expect(fn).toMatch(/WHERE id = p_id AND user_id = p_user_id AND import_id IS NULL[\s\S]*RETURNING received_chunks/);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.watch_upload_mark_chunks(uuid, uuid, int[], int[]) FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.watch_upload_mark_chunks(uuid, uuid, int[], int[]) TO service_role;");
  });

  it("marks staged watch uploads for account-deletion purge", () => {
    expect(sql).toContain("ALTER TABLE public.watch_uploads ADD COLUMN IF NOT EXISTS purge_requested_at timestamptz;");
    expect(sql).toContain("UPDATE public.watch_uploads SET purge_requested_at = now() WHERE user_id = p_user_id AND purge_requested_at IS NULL;");
  });

  it("adds the events check without an immediate validation scan", () => {
    expect(sql).toMatch(/ADD CONSTRAINT user_events_event_type_check CHECK .* NOT VALID'/);
    expect(sql).toContain("ALTER TABLE public.user_events VALIDATE CONSTRAINT user_events_event_type_check;");
  });

  it("represents the acknowledgement RPC and purge marker in generated types", () => {
    const generated = readFileSync(join(process.cwd(), "types/database.generated.ts"), "utf8");
    const upload = generated.match(/      watch_uploads: \{([\s\S]*?)        Relationships:/)?.[1];
    expect(upload).toContain("purge_requested_at: string | null");
    expect(upload?.match(/purge_requested_at\?: string \| null/g)).toHaveLength(2);
    const fn = generated.match(/      watch_upload_mark_chunks: \{([\s\S]*?)\n      \}/)?.[1];
    expect(fn).toContain("p_id: string");
    expect(fn).toContain("p_user_id: string");
    expect(fn).toContain("p_add: number[]");
    expect(fn).toContain("p_remove: number[]");
    expect(fn).toContain("Returns: number[] | null");
  });

  it("revokes devices and removes link codes during account deletion", () => {
    expect(sql).toContain(
      "UPDATE public.watch_devices SET revoked_at = now(), token_hash = NULL WHERE user_id = p_user_id AND revoked_at IS NULL;"
    );
    expect(sql).toContain("DELETE FROM public.watch_link_codes WHERE user_id = p_user_id;");
  });
});
