import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Surfers Beach (El Granada) migration", () => {
  const sql = readFileSync(
    join(__dirname, "../../supabase/migrations/20261106180000_add_surfers_beach_el_granada.sql"),
    "utf8"
  );
  const id = "73cfa55c-0708-533b-b8c8-9af6db7bc7b2";
  const name = "Surfers Beach / Princeton Jetty (El Granada)";
  const slug = "surfers-beach-el-granada-ca";

  it("adds one source-backed searchable row without promoting it", () => {
    expect(sql).toContain(`('${id}', '${name}', '${slug}'`);
    expect(sql).toContain("'El Granada', 'CA', 'San Francisco', 'America/Los_Angeles', 37.4994, -122.4715");
    expect(sql.match(/"retrievedAt":"2026-11-06","fields":\[/g)).toHaveLength(5);
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

  it("names the row so native name-only search finds every term the user typed", () => {
    const lower = name.toLowerCase();
    for (const term of ["princeton jetty", "surfers beach", "el granada"]) {
      expect(lower).toContain(term);
    }
  });
});
