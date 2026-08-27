import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260826190000_add_rtma_wind_source.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("RTMA wind observation migration", () => {
  it("stores hourly wind independently from three-hour forecast rows", () => {
    expect(sql).toContain("CREATE TABLE public.beach_wind_observations");
    expect(sql).toContain("PRIMARY KEY (beach_id, observed_at, source)");
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.bulk_upsert_rtma_wind_observations",
    );
    expect(sql).not.toContain("UPDATE public.enhanced_forecasts");
  });

  it("exposes only a non-stale latest-wind read contract", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_current_beach_wind",
    );
    expect(sql).toContain(
      "observation.observed_at >= now() - interval '2 hours'",
    );
    expect(sql).toContain(
      "observation.observed_at <= now() + interval '15 minutes'",
    );
    expect(sql).toContain("ORDER BY observation.observed_at DESC");
    expect(sql).toContain("LIMIT 1");
  });

  it("keeps writes service-role only", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.bulk_upsert_rtma_wind_observations(jsonb) FROM PUBLIC",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.bulk_upsert_rtma_wind_observations(jsonb) TO service_role",
    );
  });
});
