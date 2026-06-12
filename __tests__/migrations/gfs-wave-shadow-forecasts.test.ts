import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("GFS-Wave shadow forecasts migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(pattern: RegExp): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      pattern.test(filename),
    );

    expect(matches).toHaveLength(1);
    return readFileSync(join(migrationsDir, matches[0]), "utf8");
  }

  let migrationSQL: string;
  let normalizedSQL: string;

  beforeAll(() => {
    migrationSQL = readMigrationSQL(
      /^\d{14}_create_gfs_wave_shadow_forecasts\.sql$/,
    );
    normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();
  });

  it("creates the shadow table in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
    expect(normalizedSQL).toContain("create table if not exists public.gfs_wave_shadow_forecasts");
  });

  it("keys rows by beach, predicted_at, and source_model for first-write-wins capture", () => {
    expect(normalizedSQL).toContain("unique (beach_id, predicted_at, source_model)");
    expect(normalizedSQL).toContain("forecast_horizon_hours integer not null");
    expect(normalizedSQL).toContain("capture_status text not null");
    expect(normalizedSQL).toContain("all_zero_wave_height");
  });

  it("keeps the experiment service-role only and separate from ml_predictions_log", () => {
    expect(normalizedSQL).toContain("alter table public.gfs_wave_shadow_forecasts enable row level security");
    expect(normalizedSQL).toContain("create policy gfs_wave_shadow_forecasts_service_role");
    expect(normalizedSQL).not.toMatch(/alter table public\.ml_predictions_log/i);
    expect(normalizedSQL).not.toMatch(/alter table public\.enhanced_forecasts/i);
  });

  it("uses an initplan for the service-role policy auth helper", () => {
    const policySQL = readMigrationSQL(
      /^\d{14}_optimize_gfs_wave_shadow_rls_policy\.sql$/,
    );
    const normalizedPolicySQL = policySQL.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedPolicySQL).toContain(
      "drop policy if exists gfs_wave_shadow_forecasts_service_role",
    );
    expect(normalizedPolicySQL).toContain(
      "create policy gfs_wave_shadow_forecasts_service_role",
    );
    expect(normalizedPolicySQL).toContain(
      "using ((select auth.jwt()) ->> 'role' = 'service_role')",
    );
    expect(normalizedPolicySQL).toContain(
      "with check ((select auth.jwt()) ->> 'role' = 'service_role')",
    );
    expect(normalizedPolicySQL).not.toMatch(/\busing \(auth\.jwt\(\)/);
  });
});
