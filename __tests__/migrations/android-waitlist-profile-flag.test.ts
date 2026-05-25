import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Android waitlist profile flag migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");
  const migrationFile = readdirSync(migrationsDir).find((name) =>
    /_add_android_waitlist_profile_flag\.sql$/.test(name),
  );
  const migrationSQL = migrationFile
    ? readFileSync(join(migrationsDir, migrationFile), "utf8")
    : "";
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("ships the expected migration file", () => {
    expect(migrationFile).toEqual(
      expect.stringMatching(/_add_android_waitlist_profile_flag\.sql$/),
    );
  });

  it("adds the durable Android waitlist profile fields", () => {
    expect(normalizedSQL).toContain(
      "alter table public.profiles add column if not exists wants_android_access boolean not null default false",
    );
    expect(normalizedSQL).toContain(
      "add column if not exists android_waitlist_joined_at timestamptz",
    );
    expect(normalizedSQL).toContain(
      "add column if not exists android_waitlist_source text",
    );
    expect(normalizedSQL).toContain(
      "add column if not exists android_waitlist_surface text",
    );
    expect(normalizedSQL).toContain(
      "add column if not exists android_waitlist_placement text",
    );
  });

  it("documents the profile flag and reloads PostgREST schema", () => {
    expect(normalizedSQL).toContain(
      "comment on column public.profiles.wants_android_access",
    );
    expect(normalizedSQL).toContain("notify pgrst, 'reload schema'");
  });
});
