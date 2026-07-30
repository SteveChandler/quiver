import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("implicit preferences centroid rounding remediation migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260727230000_fix_implicit_preferences_centroid_rounding.sql"
    ),
    "utf8"
  );

  it("is transaction-wrapped", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("recreates the optimized function", () => {
    expect(migrationSQL).toContain(
      "CREATE OR REPLACE FUNCTION public.compute_implicit_preferences"
    );
    expect(migrationSQL).toMatch(/positive_beach_metrics\s+AS/i);
  });

  it("casts both double precision centroid ratios to numeric before scaled rounding", () => {
    expect(migrationSQL).toContain(
      `(
            sum(lat * weighted_engagement) FILTER (WHERE lat IS NOT NULL) /
              nullif(sum(weighted_engagement) FILTER (WHERE lat IS NOT NULL), 0)
          )::numeric,
          6
        ) AS location_centroid_lat`
    );
    expect(migrationSQL).toContain(
      `(
            sum(lon * weighted_engagement) FILTER (WHERE lon IS NOT NULL) /
              nullif(sum(weighted_engagement) FILTER (WHERE lon IS NOT NULL), 0)
          )::numeric,
          6
        ) AS location_centroid_lon`
    );
  });

  it("preserves the function security boundary", () => {
    expect(migrationSQL).toMatch(/SECURITY DEFINER/i);
    expect(migrationSQL).toMatch(/SET search_path = public, pg_temp/i);
  });
});
