import { readFileSync } from "node:fs";
import { join } from "node:path";

const indexes = [
  {
    name: "idx_marine_forecasts_beach_ts_utc",
    migration: "20261129000000_drop_marine_forecasts_beach_ts_utc_index",
    original: "20250820132000_add_generated_hourly_columns",
  },
  {
    name: "idx_marine_forecasts_nws_wind_mv_lookup",
    migration: "20261129000001_drop_marine_forecasts_nws_wind_mv_lookup_index",
    original: "20260120140000_optimize_mv_beach_hourly_scores_indexes",
  },
  {
    name: "idx_mpl_v5_shadow_comparator",
    migration: "20261129000002_drop_mpl_v5_shadow_comparator_index",
    original: "20260502235421_add_v5_shadow_logging",
  },
];

function readSql(directory: "migrations" | "rollbacks", name: string): string {
  return readFileSync(join(__dirname, "../../supabase", directory, `${name}.sql`), "utf8");
}

describe.each(indexes)("$name", ({ name, migration, original }) => {
  it("drops one index concurrently after the Run 2 release hold", () => {
    const sql = readSql("migrations", migration);
    expect(sql).toMatch(/^-- pg-delta: transaction=false\n-- Apply after the Nov 28 hybrid-gate Run 2 scores\./);
    expect(sql.replace(/^--[^\n]*\n/gm, "").trim()).toBe(
      `DROP INDEX CONCURRENTLY IF EXISTS public.${name};`
    );
  });

  it("restores the exact original index definition", () => {
    const originalCreate = readSql("migrations", original).match(
      new RegExp(`CREATE INDEX IF NOT EXISTS ${name}\\s[^;]+;`)
    )?.[0];

    expect(readSql("rollbacks", `${migration}_rollback`).replace(/^--[^\n]*\n/gm, "").trim())
      .toBe(originalCreate);
  });
});
