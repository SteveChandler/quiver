import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Redondo Beach jetty breaks migration", () => {
  const sql = readFileSync(
    join(__dirname, "../../supabase/migrations/20260914160000_add_sapphire_street_redondo_beach.sql"),
    "utf8"
  );

  const rows = [
    ["c9ea72a3-d7bf-5f3d-b77e-1aa6cce81dee", "Sapphire Street (Redondo Beach)", "sapphire-street-redondo-beach-ca", 33.8325, -118.3918],
    ["50b0ec6c-9254-5450-9b23-90cb85997cb1", "Knob Hill (Redondo Beach)", "knob-hill-redondo-beach-ca", 33.829, -118.3922],
  ] as const;

  it("adds both source-backed searchable rows without promoting them", () => {
    for (const [id, name, slug, lat, lon] of rows) {
      expect(sql).toContain(`('${id}', '${name}', '${slug}'`);
      expect(sql).toContain(`'Redondo Beach', 'CA', 'Los Angeles', 'America/Los_Angeles', ${lat.toFixed(4)}, ${lon}`);
    }
    expect(sql.match(/"retrievedAt":"2026-09-14","fields":\[/g)).toHaveLength(12);
    expect(sql).toContain("https://www.openstreetmap.org/way/1452981257");
    expect(sql).toContain("https://beaches.lacounty.gov/redondo-beach/");
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("UUID identity or coordinate conflict");
    expect(sql).toContain("existing beach within 300 m");
    expect(sql).toContain("false,false,false,false");
    expect(sql).toContain("forecast_source_id = 'open_meteo'");
    expect(sql).toContain("n <> 2 OR source_n <> 2 OR promoted_n <> 0");
    expect(sql).not.toMatch(/terrain_enabled\s*=\s*true/);
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).toMatch(/^COMMIT;$/m);
  });

  it("names the rows so native name-only search finds the user's queries", () => {
    const names = rows.map(([, name]) => name.toLowerCase());
    expect(names.some((name) => name.includes("sapphir"))).toBe(true);
    expect(names.every((name) => name.includes("redondo beach"))).toBe(true);
  });

  it("keeps the two breaks far enough apart to be distinct spots", () => {
    const [[, , , latA, lonA], [, , , latB, lonB]] = rows;
    const metres = Math.hypot(
      (latA - latB) * 111320,
      (lonA - lonB) * 111320 * Math.cos((latA * Math.PI) / 180)
    );
    expect(metres).toBeGreaterThan(300);
  });
});
