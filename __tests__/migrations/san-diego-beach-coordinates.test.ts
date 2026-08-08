import { readFileSync } from "fs";
import { join } from "path";

describe("San Diego beach coordinate correction migration", () => {
  const migrationPath = join(
    __dirname,
    "../../supabase/migrations/20260808052000_correct_san_diego_beach_coordinates.sql",
  );
  const migrationSQL = readFileSync(migrationPath, "utf8");
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it.each([
    ["La Jolla Shores", "32.856700", "-117.257500"],
    ["Tourmaline Beach", "32.805149", "-117.262364"],
    ["Birdrock", "32.815031", "-117.273505"],
  ])("corrects %s to its audited break coordinates", (name, lat, lon) => {
    expect(migrationSQL).toContain(`'${name}'`);
    expect(migrationSQL).toContain(lat);
    expect(migrationSQL).toContain(lon);
  });

  it("guards every update by stable id and expected name", () => {
    expect(normalizedSQL).toContain("where beach.id = correction.id");
    expect(normalizedSQL).toContain("and beach.name = correction.expected_name");
  });

  it("wraps the guarded coordinate update in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;$/m);
    expect(migrationSQL.trim()).toMatch(/COMMIT;$/);
  });

  it("aborts instead of partially updating the catalog", () => {
    expect(normalizedSQL).toContain("if updated_count <> 3 then");
    expect(normalizedSQL).toContain("raise exception");
  });
});
