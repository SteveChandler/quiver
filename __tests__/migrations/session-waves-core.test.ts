import { readFileSync } from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20261018090000_session_waves_core.sql",
);

describe("session waves core migration", () => {
  it("creates owner-protected import, track, wave, and correction tables", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const table of [
      "session_imports",
      "session_tracks",
      "session_waves",
      "session_wave_corrections",
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE public\\.${table}\\b`, "i"));
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"),
      );
    }
  });

  it("adds source and event values, private storage, and transaction boundaries", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    for (const value of [
      "file_import",
      "hindcast_open_meteo",
      "session_import_failed",
      "session_waves_viewed",
      "session_wave_excluded",
      "session_wave_count_reported",
      "session-tracks",
    ]) {
      expect(sql).toContain(`'${value}'`);
    }
  });
});
