import { readFileSync } from "fs";
import { join } from "path";

describe("toggle favorite beach guarded RPC migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260509120000_toggle_favorite_beach_guarded_rpc.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the RPC in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("creates a security-definer RPC for authenticated callers only", () => {
    expect(normalizedSQL).toContain(
      "create or replace function public.toggle_favorite_beach_guarded(p_beach_id uuid)",
    );
    expect(normalizedSQL).toContain("security definer");
    expect(normalizedSQL).toContain("set search_path = public, pg_catalog");
    expect(normalizedSQL).toContain(
      "revoke all on function public.toggle_favorite_beach_guarded(uuid) from public",
    );
    expect(normalizedSQL).toContain(
      "grant execute on function public.toggle_favorite_beach_guarded(uuid) to authenticated",
    );
  });

  it("serializes per-user toggles before counting favorites", () => {
    expect(normalizedSQL).toContain(
      "pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0))",
    );
    expect(normalizedSQL).toMatch(
      /select\s+count\(\*\)::integer,\s+coalesce\(max\(rank\),\s*0\)\s+\+\s+1/i,
    );
  });

  it("uses user_entitlements as the server-side Pro source of truth", () => {
    expect(normalizedSQL).toContain("from public.user_entitlements ue");
    expect(normalizedSQL).toContain(
      "(ue.is_pro = true or ue.is_trialing = true)",
    );
    expect(normalizedSQL).toContain("ue.expires_at >= now()");
    expect(normalizedSQL).not.toContain("p_is_pro");
  });

  it("raises a stable quota error for free users at three favorites", () => {
    expect(normalizedSQL).toContain("v_favorite_count >= 3");
    expect(normalizedSQL).toContain("favorite_quota_exceeded");
    expect(normalizedSQL).toContain("detail = 'free_favorites_limit'");
  });

  it("removes existing favorites and inserts new favorites with a deterministic rank", () => {
    expect(normalizedSQL).toContain("return 'removed'");
    expect(normalizedSQL).toContain(
      "insert into public.favorite_beaches (user_id, beach_id, rank)",
    );
    expect(normalizedSQL).toContain("on conflict (user_id, beach_id) do nothing");
    expect(normalizedSQL).toContain("return 'added'");
  });
});
