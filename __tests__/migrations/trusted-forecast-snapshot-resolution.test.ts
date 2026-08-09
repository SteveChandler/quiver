import fs from "node:fs";
import path from "node:path";
import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260808220000_fix_trusted_forecast_snapshot_resolution.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("trusted forecast snapshot resolution forward migration", () => {
  it("is transactional and does not edit the applied migration", () => {
    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_application(\n  p_row jsonb\n)",
    );
    expect(sql).toContain("'forecastHorizonBucket'");
    expect(sql).toContain("'displaySource'");
  });

  it("validates and resolves applications on the complete prediction key", () => {
    expect(sql).toContain("'forecastHorizonBucket',");
    expect(sql).toContain("'displaySource',");
    expect(sql).toContain(
      "AND forecast_horizon_bucket = (v_element ->> 'forecastHorizonBucket')",
    );
    expect(sql).toContain(
      "AND display_source = (v_element ->> 'displaySource')",
    );
    expect(sql).toContain("'public.persist_trusted_forecast_build(jsonb)'::regprocedure");
    expect(sql).not.toContain("DROP FUNCTION public.persist_trusted_forecast_build");
  });
});
