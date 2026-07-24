import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260718120000_dedupe_forecast_feedback_requests.sql",
  ),
  "utf8",
);

describe("forecast feedback request dedupe migration", () => {
  it("audits historical duplicate keys without rewriting feedback", () => {
    const lockPosition = migrationSQL.indexOf(
      "LOCK TABLE public.forecast_feedback_contexts IN SHARE ROW EXCLUSIVE MODE",
    );
    const auditPosition = migrationSQL.indexOf(
      "GROUP BY user_id, request_id, ingest_path",
    );
    const indexPosition = migrationSQL.indexOf("CREATE UNIQUE INDEX");

    expect(lockPosition).toBeGreaterThanOrEqual(0);
    expect(auditPosition).toBeGreaterThan(lockPosition);
    expect(indexPosition).toBeGreaterThan(auditPosition);
    expect(migrationSQL).toContain("HAVING count(*) > 1");
    expect(migrationSQL).toContain("approved remediation plan");
    expect(migrationSQL).not.toMatch(/\bUPDATE\s+public\.forecast_feedback_contexts\b/);
    expect(migrationSQL).not.toMatch(/\bDELETE\s+FROM\s+public\.forecast_feedback_contexts\b/);
  });

  it("enforces one authenticated delivery per request and ingest path", () => {
    expect(migrationSQL).toMatch(
      /ON public\.forecast_feedback_contexts \(user_id, request_id, ingest_path\)/,
    );
    expect(migrationSQL).toContain(
      "WHERE user_id IS NOT NULL AND request_id IS NOT NULL",
    );
  });
});
