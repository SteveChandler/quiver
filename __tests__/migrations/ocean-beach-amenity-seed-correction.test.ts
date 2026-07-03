import fs from "node:fs";
import path from "node:path";

function readMigration(): string {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const migration = fs
    .readdirSync(migrationsDir)
    .find((name) => /^\d{14}_correct_ocean_beach_amenity_seeds\.sql$/.test(name));

  if (!migration) {
    throw new Error("Ocean Beach amenity seed correction migration not found");
  }

  return fs.readFileSync(path.join(migrationsDir, migration), "utf8");
}

describe("Ocean Beach amenity seed correction migration", () => {
  let sql: string;

  beforeAll(() => {
    sql = readMigration();
  });

  it("is wrapped and idempotent", () => {
    expect(sql).toMatch(/^\s*BEGIN;/i);
    expect(sql).toMatch(/COMMIT;\s*$/i);
    expect(sql).toMatch(/WHERE NOT EXISTS/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });

  it("moves Ocean Beach placeholders onto land-side source points", () => {
    expect(sql).toContain("32.7492797, -117.2521646");
    expect(sql).toContain("32.7490172, -117.2523221");
    expect(sql).toContain("32.7491611, -117.2525285");
    expect(sql).not.toContain("32.75040, -117.25370");
    expect(sql).not.toContain("32.75045, -117.25375");
  });

  it("adds Ocean Beach lifeguard tower seed rows", () => {
    expect(sql.match(/'lifeguard'/g)).toHaveLength(8);
    expect(sql).toContain("seed:san-diego:ocean-beach:lifeguard-south");
    expect(sql).toContain("seed:san-diego:ocean-beach:lifeguard-central");
    expect(sql).toContain("seed:san-diego:ocean-beach:lifeguard-north");
    expect(sql).toContain("seed:san-diego:ocean-beach:lifeguard-far-north");
  });
});
