import { readFileSync } from "node:fs";

const migration = "20261122122500_precheck_email_lifecycle";
const sql = readFileSync(`supabase/migrations/${migration}.sql`, "utf8");
const evaluator = readFileSync("supabase/migrations/20261117120000_lifecycle_trial_falls_through.sql", "utf8");

function compact(sqlText: string): string {
  return sqlText.replace(/\s+/g, "");
}

describe("email lifecycle precheck migration", () => {
  it("returns only source-less holds using the evaluator's early predicates in the same order", () => {
    const initialGuards = evaluator.slice(evaluator.indexOf("IF p.deleted_at"), evaluator.indexOf("IF reason IS NOT NULL"));
    const evaluatorGuards = Array.from(initialGuards.matchAll(/(?:IF|ELSIF) ([\s\S]*?) THEN reason := '([^']+)'/g),
      ([, predicate, reason]) => [
        compact(predicate)
          .replace("registered", "u.created_at")
          .replace("(SELECTcount(*)FROMpublic.profilesWHERElower(trim(email))=lower(trim(p.email)))", "coalesce(email_counts.matches,0)")
          .replaceAll("p_user_id", "cohort.user_id")
          .replace("history_reviewed_at>n", "history_reviewed_at>now()")
          .replace("entitlement_verified_until<=n", "entitlement_verified_until<=now()")
          .replace("entitlement_verified_until>n+", "entitlement_verified_until>now()+")
          .replace("approved_at>n", "approved_at>now()")
          .replace("expires_at<=n", "expires_at<=now()"),
        reason,
      ]);
    const precheckGuards = Array.from(sql.matchAll(/\bWHEN ([\s\S]*?)\s+THEN '([^']+)'/g),
      ([, predicate, reason]) => [compact(predicate), reason]);

    expect(evaluatorGuards.map(([, reason]) => reason)).toEqual([
      "ineligible_profile", "ambiguous_identity", "suppressed", "reply_paused",
      "consent_or_history_unknown", "entitlement_review_stale", "campaign_unapproved",
    ]);
    expect(precheckGuards).toEqual(evaluatorGuards);
    expect(compact(sql)).toContain(compact(`
      LEFT JOIN auth.users u ON u.id = cohort.user_id AND u.email_confirmed_at IS NOT NULL
        AND lower(trim(u.email)) = lower(trim(p.email))
    `));
    expect(compact(sql)).toContain(compact(`
      SELECT lower(trim(p.email)) AS email, count(*) AS matches
    `));
    expect(compact(sql)).toContain(compact(`
      'user_id', user_id, 'campaign_id', campaign_id, 'status', 'held', 'reason', reason
    `));
    expect(sql).toContain("FROM evaluated WHERE reason IS NOT NULL");
    expect(sql).toContain("cardinality(p_user_ids) <= 50");
  });

  it("adds a read-only service-role RPC and supplies its rollback", () => {
    const rollback = readFileSync(`supabase/rollbacks/${migration}_rollback.sql`, "utf8");

    expect(sql).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/);
    expect(sql).toContain("LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.precheck_email_lifecycle(uuid[]) FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.precheck_email_lifecycle(uuid[]) TO service_role;");
    expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE|TRUNCATE)\b/);
    expect(rollback).toMatch(/^BEGIN;\s+DROP FUNCTION IF EXISTS public\.precheck_email_lifecycle\(uuid\[\]\);\s+COMMIT;\s*$/);
  });
});
