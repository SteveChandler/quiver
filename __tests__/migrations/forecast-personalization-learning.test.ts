import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("forecast personalization learning migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260520120000_forecast_personalization_learning.sql"
    ),
    "utf8"
  );

  it("wraps function and trigger updates in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("matches session snapshots by nearest forecast_at instead of legacy date/time columns", () => {
    const snapshotFunctionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_session_forecast_snapshot()"
    );
    const snapshotFunctionSQL = migrationSQL.slice(snapshotFunctionStart);

    expect(snapshotFunctionSQL).toMatch(/ef\.forecast_at\s+IS\s+NOT\s+NULL/i);
    expect(snapshotFunctionSQL).toMatch(
      /ef\.forecast_at\s+BETWEEN\s+new\.arrival_time\s+-\s+interval\s+'6 hours'/i
    );
    expect(snapshotFunctionSQL).toMatch(
      /ORDER BY\s+abs\(EXTRACT\(EPOCH FROM \(ef\.forecast_at\s+-\s+new\.arrival_time\)\)\)\s+ASC/i
    );
    expect(snapshotFunctionSQL).not.toMatch(/ef\.forecast_date\s*=\s*new\.arrival_time::date/i);
    expect(snapshotFunctionSQL).not.toMatch(/ef\.forecast_time::time/i);
  });

  it("infers implicit wave ranges from positive events with metadata-first forecast fallback", () => {
    expect(migrationSQL).toMatch(/event_wave_samples\s+AS/i);
    expect(migrationSQL).toMatch(/e\.metadata->>'wave_height_ft'/i);
    expect(migrationSQL).toMatch(/e\.metadata->>'forecast_wave_height_ft'/i);
    expect(migrationSQL).toMatch(/COALESCE\(we\.metadata_wave_ft,\s*forecast_wave\.wave_height_ft\)/i);
    expect(migrationSQL).toMatch(/ef\.forecast_at\s+BETWEEN\s+we\.created_at\s+-\s+interval\s+'6 hours'/i);
    expect(migrationSQL).toMatch(/WHERE\s+we\.weight\s+>\s+0/i);
  });

  it("requires at least three usable wave samples and writes 10th/90th percentiles", () => {
    expect(migrationSQL).toMatch(/WHEN count\(\*\)\s+>=\s+3 THEN round\(\(percentile_cont\(0\.1\)/i);
    expect(migrationSQL).toMatch(/WHEN count\(\*\)\s+>=\s+3 THEN round\(\(percentile_cont\(0\.9\)/i);
    expect(migrationSQL).toMatch(/inferred_wave_min_ft\s+=\s+excluded\.inferred_wave_min_ft/i);
    expect(migrationSQL).toMatch(/inferred_wave_max_ft\s+=\s+excluded\.inferred_wave_max_ft/i);
  });
});
