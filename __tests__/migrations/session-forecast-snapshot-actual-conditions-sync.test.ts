import { readFileSync } from "fs";
import { join } from "path";

describe("session forecast snapshot actual_conditions sync migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260502130000_sync_session_snapshot_actual_conditions.sql"
    ),
    "utf8"
  );

  it("wraps trigger and backfill changes in a transaction", () => {
    expect(migrationSQL).toMatch(/^begin;/m);
    expect(migrationSQL).toMatch(/^commit;/m);
  });

  it("fires the snapshot trigger when post-completion condition fields change", () => {
    const triggerStart = migrationSQL.indexOf(
      "create trigger trigger_create_session_forecast_snapshot"
    );
    const triggerSQL = migrationSQL.slice(triggerStart);

    [
      "status",
      "wave_quality",
      "water_temp",
      "crowd_level",
      "parking_ease",
      "rating",
      "notes",
      "duration_minutes",
      "arrival_time",
      "wave_height_ft",
      "wind_speed_mph",
      "wind_direction",
      "forecast_accuracy",
      "tide_height_ft",
      "tide_status",
    ].forEach((column) => {
      expect(triggerSQL).toContain(column);
    });
  });

  it("updates existing snapshots instead of returning early for completed sessions", () => {
    expect(migrationSQL).not.toMatch(
      /tg_op\s*=\s*'UPDATE'\s+and\s+old\.status\s*=\s*'completed'[\s\S]{0,120}return\s+new;/i
    );
    expect(migrationSQL).toMatch(/update\s+public\.session_forecast_snapshots/i);
    expect(migrationSQL).toMatch(/actual_conditions\s*=\s*coalesce\(actual_conditions/i);
  });

  it("backfills stale snapshot actual_conditions from sessions", () => {
    expect(migrationSQL).toMatch(/with\s+current_conditions\s+as/i);
    expect(migrationSQL).toMatch(/join\s+public\.sessions\s+s\s+on\s+s\.id\s*=\s*sfs\.session_id/i);
    expect(migrationSQL).toMatch(/'rating',\s+s\.rating/i);
    expect(migrationSQL).toMatch(/returning\s+1/i);
  });
});
