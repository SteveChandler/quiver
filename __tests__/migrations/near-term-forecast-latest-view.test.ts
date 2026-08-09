import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260809050000_fix_near_term_forecast_latest_view.sql",
  ),
  "utf8",
);

describe("near-term enhanced forecast latest view migration", () => {
  it("uses the answer horizon and requires complete forecast rows", () => {
    expect(migration).toContain("ef.forecast_at >= now() - interval '24 hours'");
    expect(migration).toContain("ef.forecast_at < now() + interval '72 hours'");
    expect(migration).toContain("nullif(btrim(ef.wave_height), '') is not null");
    expect(migration).toContain("nullif(btrim(ef.data_source), '') is not null");
  });

  it("prioritizes local today before tomorrow and creates the supporting index", () => {
    expect(migration).toContain("coalesce(nullif(b.timezone, ''), 'America/Los_Angeles')");
    expect(migration).toContain("then 0");
    expect(migration).toContain("then 1");
    expect(migration).toContain(
      "idx_enhanced_forecasts_beach_forecast_at_updated_at",
    );
  });

  it("has a follow-up migration that skips expired today slots", () => {
    const followUpMigration = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260809130000_skip_expired_today_forecast_latest.sql",
      ),
      "utf8",
    );

    expect(followUpMigration).toContain("ef.forecast_at >= now()");
    expect(followUpMigration).toContain("ef.forecast_at < now() + interval '72 hours'");
    expect(followUpMigration).not.toContain(
      "ef.forecast_at >= now() - interval '24 hours'",
    );
  });
});
