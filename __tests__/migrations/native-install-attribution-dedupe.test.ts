import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260802150000_dedupe_native_install_attribution_joins.sql",
  ),
  "utf8",
);

describe("native install attribution join dedupe migration", () => {
  it("repairs legacy duplicates before enforcing owner-scoped event IDs", () => {
    expect(migrationSQL).toMatch(/^BEGIN;$/m);
    expect(migrationSQL).toMatch(/^COMMIT;$/m);
    expect(migrationSQL).toContain(
      "LOCK TABLE public.user_events IN SHARE ROW EXCLUSIVE MODE",
    );
    expect(migrationSQL).toContain("PARTITION BY user_id, metadata ->> 'event_id'");
    expect(migrationSQL).toContain("ranked_duplicates.duplicate_rank > 1");
    expect(migrationSQL).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS user_events_native_install_attribution_event_id_uidx/,
    );
    expect(migrationSQL).toContain(
      "WHERE event_type = 'native_install_attribution_joined'",
    );
  });
});
