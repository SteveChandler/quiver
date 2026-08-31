import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260725200000_create_install_attribution_tokens.sql",
  ),
  "utf8",
).toLowerCase();

describe("install attribution schema", () => {
  it("stores only hashes and makes first consume recoverable by the same retry key", () => {
    expect(sql).toContain("token_hash text");
    expect(sql).toContain("redemption_key_hash text");
    expect(sql).not.toContain("raw_token");
    expect(sql).toContain("redeem_install_attribution_token");
    expect(sql).toContain("redemption_key_hash = p_redemption_key_hash");
    expect(sql).toContain("consumed_at is null");
    expect(sql).toContain("expires_at > now()");
    expect(sql).toMatch(
      /consumed_at is not null[\s\S]*redemption_key_hash = p_redemption_key_hash[\s\S]*expires_at > now\(\)/,
    );
    expect(sql).toContain("set search_path = ''");
  });

  it("keeps attribution tables private and audit rows free of request identity", () => {
    expect(sql).toContain(
      "alter table public.install_attribution_tokens enable row level security",
    );
    expect(sql).toContain(
      "alter table public.install_attribution_audit enable row level security",
    );
    expect(sql).toContain(
      "revoke all on table public.install_attribution_tokens",
    );
    expect(sql).toContain(
      "revoke all on table public.install_attribution_audit",
    );
    expect(sql).not.toMatch(
      /^\s*(?:ip_address|user_agent|user_id|email)\s+(?:text|uuid)\b/m,
    );
  });
});

describe("exact handoff install attribution schema", () => {
  const exactSql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260825120000_add_exact_handoff_install_attribution.sql",
    ),
    "utf8",
  ).toLowerCase();

  it("adds paired bounded context to the audited token and redemption RPC", () => {
    expect(exactSql).toContain("add column if not exists handoff_id uuid");
    expect(exactSql).toContain("add column if not exists handoff_context jsonb");
    expect(exactSql).toContain("install_attribution_tokens_handoff_pair_check");
    expect(exactSql).toContain("pg_column_size(handoff_context) <= 4096");
    expect(exactSql).toContain("redeem_install_attribution_token");
    expect(exactSql).toContain("handoff_id uuid");
    expect(exactSql).toContain("handoff_context jsonb");
  });
});
