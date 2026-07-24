import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("user_devices Expo Updates identity migration", () => {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const migrationFiles = readdirSync(migrationsDir).filter((name) =>
    /^\d{14}_add_user_devices_expo_update_identity\.sql$/.test(name),
  );
  const migrationSQL = migrationFiles[0]
    ? readFileSync(join(migrationsDir, migrationFiles[0]), "utf8")
    : "";
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("ships one timestamped transactional migration", () => {
    expect(migrationFiles).toHaveLength(1);
    expect(migrationSQL.trim().startsWith("BEGIN;")).toBe(true);
    expect(migrationSQL.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("adds nullable 64-character Expo Updates text identity columns", () => {
    expect(normalizedSQL).toContain(
      "add column if not exists expo_update_id varchar(64)",
    );
    expect(normalizedSQL).toContain(
      "add column if not exists expo_channel varchar(64)",
    );
    expect(normalizedSQL).toContain(
      "add column if not exists expo_runtime_version varchar(64)",
    );
    expect(normalizedSQL).not.toMatch(
      /expo_(update_id|channel|runtime_version) varchar\(64\) not null/,
    );
  });

  it("adds nullable Expo Updates launch-state boolean columns", () => {
    expect(normalizedSQL).toContain(
      "add column if not exists expo_is_embedded_launch boolean",
    );
    expect(normalizedSQL).toContain(
      "add column if not exists expo_is_emergency_launch boolean",
    );
    expect(normalizedSQL).not.toMatch(
      /expo_is_(embedded|emergency)_launch boolean not null/,
    );
  });

  it("includes the Expo Updates fields in generated database types", () => {
    const generatedTypes = readFileSync(
      join(process.cwd(), "types", "database.generated.ts"),
      "utf8",
    );
    const userDevicesTypes = generatedTypes.match(
      /user_devices:\s*\{([\s\S]*?)\n\s*user_email_prefs:/,
    )?.[1] ?? "";

    expect(userDevicesTypes.match(/expo_update_id/g) ?? []).toHaveLength(3);
    expect(userDevicesTypes.match(/expo_channel/g) ?? []).toHaveLength(3);
    expect(userDevicesTypes.match(/expo_runtime_version/g) ?? []).toHaveLength(3);
    expect(userDevicesTypes.match(/expo_is_embedded_launch/g) ?? []).toHaveLength(3);
    expect(userDevicesTypes.match(/expo_is_emergency_launch/g) ?? []).toHaveLength(3);
    expect(userDevicesTypes).toContain("expo_update_id: string | null");
    expect(userDevicesTypes).toContain("expo_channel: string | null");
    expect(userDevicesTypes).toContain("expo_runtime_version: string | null");
    expect(userDevicesTypes).toContain(
      "expo_is_embedded_launch: boolean | null",
    );
    expect(userDevicesTypes).toContain(
      "expo_is_emergency_launch: boolean | null",
    );
  });
});
