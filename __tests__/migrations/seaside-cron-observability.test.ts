import fs from "fs";
import path from "path";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

function migration(name: string): string {
  return fs.readFileSync(path.join(migrationsDir, name), "utf8");
}

describe("Seaside cron operations migrations", () => {
  const observabilitySql = migration(
    "20260827170000_add_seaside_cron_observability.sql",
  );
  const refreshSql = migration(
    "20260827171000_schedule_observable_refresh.sql",
  );

  it("creates a private durable run ledger with timing, row, and memory fields", () => {
    expect(observabilitySql).toContain(
      "CREATE TABLE IF NOT EXISTS public.seaside_cron_runs",
    );
    expect(observabilitySql).toContain("duration_ms bigint");
    expect(observabilitySql).toContain("row_count bigint");
    expect(observabilitySql).toContain("peak_memory_mb numeric");
    expect(observabilitySql).toContain(
      "ALTER TABLE public.seaside_cron_runs ENABLE ROW LEVEL SECURITY",
    );
    expect(observabilitySql).toContain(
      "REVOKE ALL ON TABLE public.seaside_cron_runs FROM PUBLIC, anon, authenticated",
    );
    expect(observabilitySql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seaside_cron_runs TO service_role",
    );
  });

  it("leaves failure and staleness alerting to Sentry Cron", () => {
    expect(observabilitySql).not.toContain("seaside_cron_alerts");
    expect(observabilitySql).not.toContain("monitor-seaside-crons");
    expect(observabilitySql).not.toContain("check_seaside_cron_staleness");
    expect(observabilitySql).not.toContain("result jsonb");
    expect(observabilitySql).not.toContain("schedule_minutes");
    expect(observabilitySql).not.toContain("updated_at");
    expect(observabilitySql).not.toContain("seaside_cron_jobs");
  });

  it("schedules the observable refresh directly in Supabase", () => {
    expect(refreshSql).toContain("'refresh-observable-beaches-hourly'");
    expect(refreshSql).toContain("'25 * * * *'");
    expect(refreshSql).toContain(
      "$cron$SELECT public.refresh_observable_beaches();$cron$",
    );
  });
});
