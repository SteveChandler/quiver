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

  it("revokes devices and removes link codes during account deletion", () => {
    expect(sql).toContain(
      "UPDATE public.watch_devices SET revoked_at = now(), token_hash = NULL WHERE user_id = p_user_id AND revoked_at IS NULL;"
    );
    expect(sql).toContain("DELETE FROM public.watch_link_codes WHERE user_id = p_user_id;");
  });
});
