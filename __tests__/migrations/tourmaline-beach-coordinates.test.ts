import { readFileSync } from "fs";
import { join } from "path";

describe("Tourmaline beach coordinate correction migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260804230000_correct_tourmaline_beach_coordinates.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the correction in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("moves only the canonical Tourmaline row to the shoreline", () => {
    expect(normalizedSQL).toContain("lat = 32.805149");
    expect(normalizedSQL).toContain("lon = -117.262364");
    expect(normalizedSQL).toContain(
      "where id = '17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid",
    );
    expect(normalizedSQL).toContain("and slug = 'tourmaline'");
    expect(normalizedSQL).toContain("and deleted_at is null");
    expect(normalizedSQL).not.toContain("delete from");
  });
});
