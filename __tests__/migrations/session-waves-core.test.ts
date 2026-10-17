import { readFileSync } from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20261018090000_session_waves_core.sql",
);

function normalizedSql(): string {
  return readFileSync(migrationPath, "utf8")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .toLowerCase();
}

describe("session waves core migration", () => {
  it("creates owner-protected import, track, wave, and correction tables", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const table of [
      "session_imports",
      "session_tracks",
      "session_waves",
      "session_wave_corrections",
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, "i"),
      );
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"),
      );
    }
  });

  it("adds source and event values, private storage, and transaction boundaries", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    for (const value of [
      "file_import",
      "hindcast_open_meteo",
      "session_import_failed",
      "session_waves_viewed",
      "session_wave_excluded",
      "session_wave_count_reported",
      "session-tracks",
    ]) {
      expect(sql).toContain(`'${value}'`);
    }
  });

  it("removes direct client import inserts, including existing column grants", () => {
    const sql = normalizedSql();
    expect(sql).toContain("drop policy if exists session_imports_insert_own on public.session_imports;");
    expect(sql).not.toMatch(/create policy session_imports_insert_own\b/);
    expect(sql).toContain("revoke insert (user_id, storage_path, original_filename) on public.session_imports from public, anon, authenticated;");
  });

  it("removes direct storage uploads while preserving owner reads", () => {
    const sql = normalizedSql();
    expect(sql).toContain('drop policy if exists "users can upload their own session tracks" on storage.objects;');
    expect(sql).not.toContain('create policy "users can upload their own session tracks"');
    expect(sql).toContain('create policy "users can read their own session tracks"');
  });

  it("requires the correction owner to own its session for insert and delete", () => {
    const sql = normalizedSql();

    for (const [policy, clause] of [
      ["session_wave_corrections_insert_own", "with check"],
      ["session_wave_corrections_delete_own", "using"],
    ]) {
      const definition = sql.match(new RegExp(`create policy ${policy}\\b[^;]+;`))?.[0];
      expect(definition).toContain(
        `${clause} (user_id = (select auth.uid()) and exists (select 1 from public.sessions s where s.id = session_wave_corrections.session_id and s.user_id = (select auth.uid())))`,
      );
    }
  });

  it("revokes default client access and grants only the required operations", () => {
    const sql = normalizedSql();
    const clientGrants: Record<string, string[]> = {
      session_imports: ["select"],
      session_tracks: ["select"],
      session_waves: ["select"],
      session_wave_corrections: ["select", "insert, delete"],
    };

    for (const [table, grants] of Object.entries(clientGrants)) {
      expect(sql).toContain(`revoke all on public.${table} from public, anon, authenticated;`);
      expect(sql).toContain(`grant all on public.${table} to service_role;`);
      const actual = [...sql.matchAll(/\bgrant ([^;]+?) on public\.(\w+) to authenticated;/g)]
        .filter((match) => match[2] === table)
        .map((match) => match[1]);
      expect(actual).toEqual(grants);
    }
  });

  it("indexes correction sessions, import sessions, track imports, and track owners", () => {
    const sql = normalizedSql();

    for (const [table, column] of [
      ["session_wave_corrections", "session_id"],
      ["session_imports", "session_id"],
      ["session_tracks", "import_id"],
      ["session_tracks", "user_id"],
    ]) {
      expect(sql).toMatch(
        new RegExp(`create index if not exists \\w+ on public\\.${table} \\(${column}\\)`),
      );
    }
  });

  it("can recreate policies, indexes, the provenance column, and the updated-at trigger", () => {
    const sql = normalizedSql();

    const policies = [...sql.matchAll(/create policy ("[^"]+"|\w+) on ([\w.]+)/g)];
    expect(policies).toHaveLength(7);
    for (const match of policies) {
      expect(sql).toContain(`drop policy if exists ${match[1]} on ${match[2]};`);
    }
    expect(sql).toContain("create index if not exists session_waves_current_session_idx");
    expect(sql).toContain("add column if not exists water_temp_source");
    expect(sql).toContain("drop trigger if exists set_session_imports_updated_at on public.session_imports;");
    expect(sql).toContain(
      "create trigger set_session_imports_updated_at before update on public.session_imports for each row execute function public.set_updated_at();",
    );

    const storagePolicies = [...sql.matchAll(/create policy "users can (?:upload|read) their own session tracks"[^;]+;/g)];
    expect(storagePolicies).toHaveLength(1);
    for (const match of storagePolicies) {
      expect(match[0]).toContain("(storage.foldername(name))[2] = (select auth.uid())::text");
    }
  });
});
