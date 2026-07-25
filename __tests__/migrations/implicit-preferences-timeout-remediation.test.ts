import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("implicit preferences timeout remediation migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260723120000_optimize_implicit_preferences_batch.sql"
    ),
    "utf8"
  );

  it("is transaction-wrapped", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("adds a batch-oriented user_events index", () => {
    expect(migrationSQL).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_user_events_implicit_batch\s+ON public\.user_events \(created_at, user_id\)/i
    );
  });

  it("uses grouped beach metrics instead of per-user JSONB unnesting", () => {
    const functionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.compute_implicit_preferences"
    );
    expect(functionStart).toBeGreaterThan(-1);

    const functionSQL = migrationSQL.slice(functionStart);
    expect(functionSQL).toMatch(/positive_beach_metrics\s+AS/i);
    expect(functionSQL).toMatch(/GROUP BY\s+we\.user_id,\s*we\.beach_id/i);
    expect(functionSQL).not.toMatch(/array_agg\(\s*jsonb_build_object/i);
  });

  it("avoids forecast lookups for non-positive or metadata-complete events", () => {
    expect(migrationSQL).toMatch(
      /WHERE\s+we\.metadata_wave_ft\s+IS\s+NULL\s+AND\s+we\.beach_id\s+IS\s+NOT\s+NULL/i
    );
    expect(migrationSQL).toMatch(/WHERE\s+(?:we\.)?weight\s*>\s*0/i);
  });

  it("preserves the metadata-first wave inference contract", () => {
    expect(migrationSQL).toMatch(
      /COALESCE\(we\.metadata_wave_ft,\s*forecast_wave\.wave_height_ft\)/i
    );
    expect(migrationSQL).toMatch(
      /ef\.forecast_at\s+BETWEEN\s+we\.created_at\s+-\s+interval\s+'6 hours'/i
    );
  });
});
