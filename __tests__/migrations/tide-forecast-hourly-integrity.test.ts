import { readFileSync } from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260723070000_add_tide_forecast_hourly_integrity.sql",
);
const rollbackPath = path.join(
  process.cwd(),
  "supabase/rollbacks/20260723070000_add_tide_forecast_hourly_integrity_rollback.sql",
);

describe("tide forecast hourly integrity migration", () => {
  it("adds station provenance and cleans each canonical UTC hour safely", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS station_id text/i,
    );
    expect(sql).toContain("date_bin(");
    expect(sql).toContain("TIMESTAMPTZ '1970-01-01 00:00:00+00'");
    expect(sql).toMatch(
      /PARTITION BY beach_id, canonical_hour, source/i,
    );
    expect(sql).toMatch(
      /ORDER BY created_at DESC, ts DESC, id DESC/i,
    );
    expect(sql).toContain("source = 'noaa_hilo_interpolated'");
    expect(sql).toContain("source = 'noaa'");
    expect(sql).toMatch(/UPDATE public\.tide_forecasts/i);
    expect(sql).toMatch(/SET ts = .*canonical_hour/i);
    expect(sql).toContain("tide_forecasts_unique");
    expect(sql).toMatch(/RAISE NOTICE[\s\S]*before=% after=%/i);
    expect(sql).toContain(
      "private.tide_forecasts_integrity_backup_20260723",
    );
  });

  it("ships an approval-gated rollback that restores archived rows", () => {
    const sql = readFileSync(rollbackPath, "utf8");

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain(
      "app.tide_forecast_integrity_rollback_approved",
    );
    expect(sql).toContain(
      "private.tide_forecasts_integrity_backup_20260723",
    );
    expect(sql).toMatch(/INSERT INTO public\.tide_forecasts/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS station_id/i);
  });
});
