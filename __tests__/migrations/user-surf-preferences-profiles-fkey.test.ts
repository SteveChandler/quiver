import { readFileSync } from "fs";
import { join } from "path";

describe("user_surf_preferences profiles foreign key migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260504220000_add_user_surf_preferences_profiles_fkey.sql"
    ),
    "utf8"
  );

  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the schema change in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*begin;\s*$/im);
    expect(migrationSQL).toMatch(/^\s*commit;\s*$/im);
  });

  it("preserves the existing auth.users foreign key", () => {
    expect(migrationSQL).not.toMatch(
      /drop\s+constraint(?:\s+if\s+exists)?\s+user_surf_preferences_user_id_fkey/i
    );
  });

  it("adds and validates the profiles foreign key", () => {
    expect(migrationSQL).toMatch(
      /add\s+constraint\s+user_surf_preferences_user_id_profiles_fkey/i
    );
    expect(migrationSQL).toMatch(
      /validate\s+constraint\s+user_surf_preferences_user_id_profiles_fkey/i
    );
  });

  it("targets public.profiles(id) with cascade delete and NOT VALID creation", () => {
    expect(normalizedSQL).toContain(
      "foreign key (user_id) references public.profiles(id) on delete cascade not valid"
    );
  });

  it("reloads the PostgREST schema cache", () => {
    expect(normalizedSQL).toContain("notify pgrst, 'reload schema';");
  });

  it("only creates a supporting user_id index when no valid user_id-leading index exists", () => {
    expect(normalizedSQL).toMatch(
      /if not exists \([\s\S]*pg_index[\s\S]*indisvalid[\s\S]*attname = 'user_id'[\s\S]*create index/
    );
    expect(migrationSQL).not.toMatch(
      /create\s+index\s+if\s+not\s+exists\s+\w+\s+on\s+public\.user_surf_preferences\s*\(\s*user_id\s*\)/i
    );
  });
});
