import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260522132815_restrict_referral_rpc_execute_grants.sql"
  ),
  "utf8"
);

describe("referral RPC execute grant migration", () => {
  it("is wrapped in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  it("revokes default public execute grants before granting explicit callers", () => {
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.record_referral_attribution\(uuid, uuid, text, text\)\s+FROM PUBLIC, anon/i
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.accept_invite_for_user\(uuid, uuid\)\s+FROM PUBLIC, anon/i
    );
    expect(migrationSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_referral_attribution\(uuid, uuid, text, text\)\s+TO authenticated, service_role/i
    );
    expect(migrationSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.accept_invite_for_user\(uuid, uuid\)\s+TO authenticated, service_role/i
    );
  });
});
