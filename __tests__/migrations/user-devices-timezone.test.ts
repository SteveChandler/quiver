import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("user_devices timezone migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");
  const migrationFile = readdirSync(migrationsDir).find((name) =>
    /_add_user_devices_timezone\.sql$/.test(name)
  );
  const migrationSQL = migrationFile
    ? readFileSync(join(migrationsDir, migrationFile), "utf8")
    : "";
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("ships the expected migration file", () => {
    expect(migrationFile).toEqual(
      expect.stringMatching(/_add_user_devices_timezone\.sql$/)
    );
  });

  it("adds a nullable timezone column to user_devices", () => {
    expect(normalizedSQL).toContain(
      "alter table public.user_devices add column if not exists timezone text"
    );
    expect(normalizedSQL).not.toContain("timezone text not null");
  });

  it("backfills missing profile timezones from home beach only", () => {
    expect(normalizedSQL).toContain("update public.profiles p");
    expect(normalizedSQL).toContain("from public.beaches b");
    expect(normalizedSQL).toContain("p.timezone is null");
    expect(normalizedSQL).toContain("p.home_beach_id = b.id");
    expect(normalizedSQL).toContain("b.timezone is not null");
  });

  it("does not overwrite existing profile timezones with a generic default", () => {
    expect(normalizedSQL).not.toContain("set timezone = 'utc'");
    expect(normalizedSQL).not.toContain("set timezone = 'america/los_angeles'");
  });
});
