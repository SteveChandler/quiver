import { readFileSync } from "fs";
import { join } from "path";

describe("session fit signal readiness SQL", () => {
  const sqlPath = join(
    process.cwd(),
    "docs/analytics/session-fit-signal-readiness.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");
  const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();
  const executableSql = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();

  it("stays read-only", () => {
    expect(sql).toContain("Read-only");
    expect(executableSql).toMatch(/\bselect\b/);
    expect(executableSql).not.toMatch(
      /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/,
    );
  });

  it("checks the v1 categorical session_decomposition fields needed for scoring", () => {
    expect(normalizedSql).toContain("public.sessions");
    expect(normalizedSql).toContain("session_decomposition");
    expect(normalizedSql).toContain("session_decomposition->>'version'");
    expect(normalizedSql).toContain("session_decomposition->>'skill_fit'");
    expect(normalizedSql).toContain("session_decomposition->>'board_fit'");
    expect(normalizedSql).toContain("under");
    expect(normalizedSql).toContain("dialed");
    expect(normalizedSql).toContain("over_my_head");
    expect(normalizedSql).toContain("too_small");
    expect(normalizedSql).toContain("right");
    expect(normalizedSql).toContain("too_much_board");
    expect(normalizedSql).toContain("wrong_type");
  });

  it("cross-checks telemetry without selecting raw identifiers", () => {
    expect(normalizedSql).toContain("public.user_events");
    expect(normalizedSql).toContain("session_decomposition_selected");
    expect(normalizedSql).toContain("session_board_fit_feedback_selected");
    expect(normalizedSql).toContain("count(distinct");
    expect(executableSql).not.toMatch(/\b(s\.id|s\.user_id|e\.user_id)\s+as\s+/);
    expect(executableSql).not.toMatch(/\bas\s+(session_id|user_id|raw_user_id)\b/);
  });
});
