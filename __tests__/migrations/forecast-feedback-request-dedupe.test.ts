import { createHash } from "node:crypto";
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
  it("matches the immutable shared-schema contract mirror", () => {
    expect(createHash("sha256").update(migrationSQL).digest("hex")).toBe(
      "09c40c9ce9b019b4cae5544bdc11ef346b26d292aa598739d41fb7a7e2cd09df",
    );
  });

  it("repairs historical duplicate keys before enforcing uniqueness", () => {
    const lockPosition = migrationSQL.indexOf(
      "LOCK TABLE public.forecast_feedback_contexts IN SHARE ROW EXCLUSIVE MODE",
    );
    const repairPosition = migrationSQL.indexOf(
      "UPDATE public.forecast_feedback_contexts",
    );
    const indexPosition = migrationSQL.indexOf("CREATE UNIQUE INDEX");

    expect(lockPosition).toBeGreaterThanOrEqual(0);
    expect(repairPosition).toBeGreaterThan(lockPosition);
    expect(indexPosition).toBeGreaterThan(repairPosition);
    expect(migrationSQL).toContain("PARTITION BY user_id, request_id");
    expect(migrationSQL).toContain("delivery_rank > 1");
    expect(migrationSQL).toContain(":legacy-duplicate:");
  });

  it("enforces one authenticated delivery per stable request ID", () => {
    expect(migrationSQL).toMatch(
      /ON public\.forecast_feedback_contexts \(user_id, request_id\)/,
    );
    expect(migrationSQL).toContain(
      "WHERE user_id IS NOT NULL AND request_id IS NOT NULL",
    );
  });
});
