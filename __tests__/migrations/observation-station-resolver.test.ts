import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261020120000_observation_station_resolver_base_tables.sql"),
  "utf8"
);
const body = sql.replace(/--.*$/gm, "");

describe("get_beach_observation_station base-table migration", () => {
  it("is transactional and replaces the function in place", () => {
    expect(sql.trim()).toMatch(/^BEGIN;/i);
    expect(sql.trim()).toMatch(/COMMIT;$/i);
    expect(body).toMatch(/CREATE OR REPLACE FUNCTION public\.get_beach_observation_station\(p_beach_id uuid\)/i);
  });

  it("never reads the UNION view, which cannot push station_id down", () => {
    expect(body).not.toMatch(/unified_wave_observations/i);
    expect(body).toMatch(/public\.ioos_observations/);
    expect(body).toMatch(/public\.ndbc_direct_observations/);
  });

  it("keeps all five tiers and the 7-day recency rule", () => {
    for (const tier of [0, 1, 2, 3, 4]) expect(sql).toContain(`Tier ${tier}:`);
    expect(body.match(/interval '7 days'/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
