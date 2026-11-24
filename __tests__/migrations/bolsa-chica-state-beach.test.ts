import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Bolsa Chica State Beach migration", () => {
  const sql = readFileSync(
    join(__dirname, "../../supabase/migrations/20261031210000_add_bolsa_chica_state_beach.sql"),
    "utf8"
  );
  const name = "Bolsa Chica State Beach";

  it("adds one source-backed searchable row without promoting it", () => {
    expect(sql).toContain(
      `('dd21a212-1f15-5b34-8749-8d54c44f3b25', '${name}', 'bolsa-chica-state-beach-huntington-beach-ca'`
    );
    expect(sql).toContain(
      "'Huntington Beach', 'CA', 'Orange County', 'America/Los_Angeles', 33.6970, -118.0521, 'beach'"
    );
    expect(sql.match(/"retrievedAt":"2026-10-31","fields":\[/g)).toHaveLength(9);
    expect(sql).toContain("https://www.parks.ca.gov/?page_id=642");
    expect(sql).toContain("https://www.openstreetmap.org/node/11836050631");
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("UUID identity or coordinate conflict");
    expect(sql).toContain("existing beach within 300 m");
    expect(sql).toContain("false,false,false,false");
    expect(sql).toContain("forecast_source_id = 'open_meteo'");
    expect(sql).toContain("n <> 1 OR source_n <> 1 OR promoted_n <> 0");
    expect(sql).not.toMatch(/terrain_enabled\s*=\s*true/);
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).toMatch(/^COMMIT;$/m);
  });

  it("names the row so native name-only search finds the user's queries", () => {
    const inserted = sql.match(/\('dd21a212-1f15-5b34-8749-8d54c44f3b25', '([^']+)'/)?.[1] ?? "";
    for (const query of ["bolsa chica", "bolsa chica state beach"]) {
      expect(inserted.toLowerCase()).toContain(query);
    }
  });

  it("keeps user-facing copy free of competitor names", () => {
    const copy = sql.slice(sql.indexOf("'Bolsa Chica State Beach is"), sql.indexOf("ARRAY["));
    expect(copy.length).toBeGreaterThan(200);
    expect(copy).not.toMatch(/surfline|surf-forecast|wannasurf|mondo|magicseaweed/i);
  });
});
