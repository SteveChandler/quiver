import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const appliedMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260718120000_dedupe_forecast_feedback_requests.sql",
);
const ingestPathMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260724031000_scope_forecast_feedback_idempotency_to_ingest_path.sql",
);
const appliedMigrationSQL = readFileSync(appliedMigrationPath, "utf8");

function readIngestPathMigration(): string {
  expect(existsSync(ingestPathMigrationPath)).toBe(true);
  return readFileSync(ingestPathMigrationPath, "utf8");
}

describe("forecast feedback request dedupe migration", () => {
  it("keeps the already-applied migration immutable", () => {
    expect(
      createHash("sha256").update(appliedMigrationSQL).digest("hex"),
    ).toBe("09c40c9ce9b019b4cae5544bdc11ef346b26d292aa598739d41fb7a7e2cd09df");
  });

  it("audits historical duplicate keys without rewriting feedback", () => {
    const ingestPathMigrationSQL = readIngestPathMigration();
    const lockPosition = ingestPathMigrationSQL.indexOf(
      "LOCK TABLE public.forecast_feedback_contexts IN SHARE ROW EXCLUSIVE MODE",
    );
    const auditPosition = ingestPathMigrationSQL.indexOf(
      "GROUP BY user_id, request_id, ingest_path",
    );
    const dropPosition = ingestPathMigrationSQL.indexOf(
      "DROP INDEX IF EXISTS public.uq_forecast_feedback_contexts_user_request",
    );
    const indexPosition = ingestPathMigrationSQL.indexOf("CREATE UNIQUE INDEX");

    expect(lockPosition).toBeGreaterThanOrEqual(0);
    expect(auditPosition).toBeGreaterThan(lockPosition);
    expect(dropPosition).toBeGreaterThan(auditPosition);
    expect(indexPosition).toBeGreaterThan(dropPosition);
    expect(ingestPathMigrationSQL).toContain("HAVING count(*) > 1");
    expect(ingestPathMigrationSQL).toContain("approved remediation plan");
    expect(ingestPathMigrationSQL).not.toMatch(
      /\bUPDATE\s+public\.forecast_feedback_contexts\b/,
    );
    expect(ingestPathMigrationSQL).not.toMatch(
      /\bDELETE\s+FROM\s+public\.forecast_feedback_contexts\b/,
    );
  });

  it("enforces one authenticated delivery per request and ingest path", () => {
    const ingestPathMigrationSQL = readIngestPathMigration();
    expect(ingestPathMigrationSQL).toMatch(
      /ON public\.forecast_feedback_contexts \(user_id, request_id, ingest_path\)/,
    );
    expect(ingestPathMigrationSQL).toContain(
      "WHERE user_id IS NOT NULL AND request_id IS NOT NULL",
    );
  });
});
