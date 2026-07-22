import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260722193000_repair_get_coach_picks_daily_intel.sql",
  ),
  "utf8",
);
const fixtureSql = readFileSync(
  join(process.cwd(), "scripts/db/coach-picks-daily-intel-smoke.sql"),
  "utf8",
);

describe("Coach Picks daily-intel repair migration", () => {
  it("preserves the RPC contract without depending on retired score views", () => {
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_coach_picks",
    );
    expect(migrationSql).toContain("RETURNS TABLE (");
    expect(migrationSql).toContain("pick_rank int");
    expect(migrationSql).toContain("distance_km numeric");
    expect(migrationSql).toContain("score int");
    expect(migrationSql).not.toContain("v_beach_hourly_scores");
    expect(migrationSql).not.toContain("mv_beach_hourly_scores");
  });

  it("uses the latest daily score and enforces public strict-radius candidates", () => {
    expect(migrationSql).toContain("FROM public.beach_daily_intel intel");
    expect(migrationSql).toContain(
      "ORDER BY intel.forecast_date DESC, intel.generated_at DESC",
    );
    expect(migrationSql).toContain(
      "WHERE candidate.distance_km <= _radius_km",
    );
    expect(migrationSql.match(/b\.deleted_at IS NULL/g)).toHaveLength(2);
    expect(migrationSql.match(/NOT b\.is_private/g)).toHaveLength(2);
    expect(migrationSql).not.toContain("region_id");
  });

  it("is transactional and preserves least-privilege execution", () => {
    expect(migrationSql).toMatch(/^--[\s\S]*\nBEGIN;/);
    expect(migrationSql.trimEnd()).toMatch(/COMMIT;$/);
    expect(migrationSql).toContain(
      "SET search_path = public, pg_catalog",
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.get_coach_picks(uuid, numeric) FROM PUBLIC",
    );
    expect(migrationSql).toContain("TO anon, authenticated, service_role");
  });

  it("ships a rollback-only smoke fixture covering ranking and exclusions", () => {
    expect(fixtureSql).toContain("\\set ON_ERROR_STOP on");
    expect(fixtureSql).toContain("CREATE TEMP TABLE coach_picks_fixture_ids");
    expect(fixtureSql).toContain("gen_random_uuid()");
    expect(fixtureSql).toContain("SET LOCAL ROLE anon");
    expect(fixtureSql).toContain("coach_picks_fixture_anon_contract_failed");
    expect(fixtureSql).toContain("coach_picks_fixture_latest_score_not_used");
    expect(fixtureSql).toContain("coach_picks_fixture_radius_not_strict");
    expect(fixtureSql.trimEnd()).toMatch(/ROLLBACK;$/);
  });
});
