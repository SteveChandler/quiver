import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("native Sentry RLS fixes migration", () => {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const migrationFile = readdirSync(migrationsDir).find((name) =>
    name.endsWith("_native_sentry_rls_fixes.sql")
  );
  const migrationSQL = migrationFile
    ? readFileSync(join(migrationsDir, migrationFile), "utf8")
    : "";
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("ships the expected pending migration file", () => {
    expect(migrationFile).toEqual(expect.stringMatching(/_native_sentry_rls_fixes\.sql$/));
    expect(migrationSQL.trim().startsWith("BEGIN;")).toBe(true);
    expect(migrationSQL.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("restores owner SELECT on session-media storage objects for shipped native upserts", () => {
    expect(normalizedSQL).toContain("users can read their own session media objects");
    expect(normalizedSQL).toContain("on storage.objects");
    expect(normalizedSQL).toContain("for select");
    expect(normalizedSQL).toContain("to authenticated");
    expect(normalizedSQL).toContain("bucket_id = 'session-media'");
    expect(normalizedSQL).toContain("(storage.foldername(name))[2]");
    expect(normalizedSQL).toContain("auth.uid()");
  });

  it("keeps native analytics default-allow unless tracking is explicitly disabled", () => {
    expect(normalizedSQL).toContain("drop policy if exists \"users can insert their own events\"");
    expect(normalizedSQL).toContain("on public.user_events");
    expect(normalizedSQL).toContain("for insert");
    expect(normalizedSQL).toContain("to authenticated");
    expect(normalizedSQL).toContain("not exists");
    expect(normalizedSQL).toContain("allow_implicit_tracking = false");
    expect(normalizedSQL).not.toContain("allow_implicit_tracking = true");
  });
});
