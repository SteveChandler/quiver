import { readFileSync } from "node:fs";
import { join } from "node:path";

function migration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("session conditions expansion migrations", () => {
  it("adds wave characteristics to sessions only with the canonical 12-value check", () => {
    const sql = migration("20260611090000_add_wave_characteristics_to_sessions.sql");

    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("ALTER TABLE public.sessions");
    expect(sql).not.toContain("sessions_history");

    for (const value of [
      "clean",
      "glassy",
      "choppy",
      "blown_out",
      "fat",
      "mushy",
      "peaky",
      "powerful",
      "closeouts",
      "barreling",
      "reform",
      "walled",
    ]) {
      expect(sql).toContain(`'${value}'`);
    }
  });

  it("creates the tide snapshot RPC and trigger with authenticated execution and update recompute semantics", () => {
    const sql = migration("20260611091000_add_session_tide_snapshot_trigger.sql");

    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.compute_session_tide_snapshot");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.compute_session_tide_snapshot");
    expect(sql).toContain("TO authenticated, service_role");
    expect(sql).toContain("previous_source IN ('noaa', 'noaa_hilo_interpolated')");
    expect(sql).toContain("next_source IN ('noaa', 'noaa_hilo_interpolated')");
    expect(sql).toContain("central_span_hours");
    expect(sql).toContain("exact_on_previous");
    expect(sql).toContain("COALESCE(NEW.tide_data_source, '') <> 'user'");
    expect(sql).toContain("NEW.arrival_time IS DISTINCT FROM OLD.arrival_time");
    expect(sql).toContain("NEW.beach_id IS DISTINCT FROM OLD.beach_id");
  });

  it("adds observed rip current capture to sessions only", () => {
    const sql = migration("20260611092000_add_rip_current_observed_to_sessions.sql");

    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("ALTER TABLE public.sessions");
    expect(sql).not.toContain("sessions_history");
    expect(sql).toContain("rip_current_observed");
    expect(sql).toContain("'none'");
    expect(sql).toContain("'light'");
    expect(sql).toContain("'strong'");
  });

  it("creates rip risk storage and stamps sessions by beach-local date on insert/update", () => {
    const sql = migration("20260611093000_add_rip_current_risk_pipeline.sql");

    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("CREATE TABLE public.rip_current_risks");
    expect(sql).toContain("UNIQUE (beach_id, valid_date)");
    expect(sql).toContain("ALTER TABLE public.rip_current_risks ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FOR SELECT");
    expect(sql).toContain("FOR ALL");
    expect(sql).toContain("(NEW.arrival_time AT TIME ZONE b.timezone)::date");
    expect(sql).toContain("BEFORE INSERT OR UPDATE OF beach_id, arrival_time");
  });
});
