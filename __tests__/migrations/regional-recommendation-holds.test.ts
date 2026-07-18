import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260717170000_create_regional_recommendation_holds.sql",
);
const sql = readFileSync(migrationPath, "utf8");
const fixturePath = join(
  process.cwd(),
  "scripts/db/regional-recommendation-holds-smoke.sql",
);
const fixtureSql = readFileSync(fixturePath, "utf8");

describe("regional recommendation hold migration", () => {
  it("creates versioned bounded policy state", () => {
    expect(sql).toContain("CREATE TABLE public.regional_recommendation_holds");
    expect(sql).toContain("UNIQUE (hold_id, version)");
    expect(sql).toContain("expires_at <= effective_at + interval '7 days'");
    expect(sql).toContain("payload_hash");
  });

  it("is append-only and transactional", () => {
    expect(sql).toContain("BEFORE UPDATE OR DELETE");
    expect(sql).toContain("append_regional_recommendation_hold_transition");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("hold idempotency collision");
    expect(sql).toContain("current_user = pg_get_userbyid");
    expect(sql.match(/pg_catalog\.sha256\(/g)).toHaveLength(2);
    expect(sql).not.toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(sql).toContain(
      "v_request_id IS DISTINCT FROM v_existing.request_id",
    );
    expect(sql).toContain("v_new := v_existing");
    expect(sql).toContain("v_new.request_id := v_request_id");
  });

  it("serializes retention with append and rechecks candidates under lock", () => {
    const purgeStart = sql.indexOf(
      "CREATE OR REPLACE FUNCTION public.purge_expired_regional_recommendation_holds_v1()",
    );
    const purgeEnd = sql.indexOf(
      "CREATE OR REPLACE FUNCTION public.erase_regional_recommendation_hold_operator_v1",
      purgeStart,
    );
    const purgeSql = sql.slice(purgeStart, purgeEnd);
    const lockAt = purgeSql.indexOf(
      "FOREACH v_candidate_hold_id IN ARRAY v_candidate_hold_ids",
    );
    const recheckAt = purgeSql.lastIndexOf("WITH latest AS (");
    const deleteAt = purgeSql.indexOf(
      "DELETE FROM public.regional_recommendation_holds",
    );

    expect(purgeStart).toBeGreaterThanOrEqual(0);
    expect(purgeEnd).toBeGreaterThan(purgeStart);
    expect(
      purgeSql.match(/array_agg\(latest\.hold_id ORDER BY latest\.hold_id\)/g),
    ).toHaveLength(2);
    expect(purgeSql.match(/WITH latest AS \(/g)).toHaveLength(2);
    expect(purgeSql).toContain("'regional-hold:' || v_candidate_hold_id::text");
    expect(purgeSql).toContain(
      "WHERE latest.hold_id = ANY(v_candidate_hold_ids)",
    );
    expect(recheckAt).toBeGreaterThan(lockAt);
    expect(deleteAt).toBeGreaterThan(recheckAt);
    expect(sql.match(/'regional-hold:'\s*\|\|/g)).toHaveLength(2);
  });

  it("resolves only the latest active overlapping version", () => {
    expect(sql).toContain("resolve_active_regional_recommendation_holds");
    expect(sql).toContain("WHERE effective_at <= p_as_of");
    expect(sql).toContain("DISTINCT ON (hold_id)");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("scope_beach_ids && p_beach_ids");
  });

  it("makes the append RPC the only service-role write path", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "REVOKE ALL ON public.regional_recommendation_holds FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON public.regional_recommendation_holds FROM service_role",
    );
    expect(sql).toContain(
      "GRANT SELECT ON public.regional_recommendation_holds TO service_role",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.append_regional_recommendation_hold_transition(jsonb) TO service_role",
    );
  });

  it("stores only bounded opaque metadata and supports erasure and retention", () => {
    const appendStart = sql.indexOf(
      "CREATE OR REPLACE FUNCTION public.append_regional_recommendation_hold_transition",
    );
    const appendEnd = sql.indexOf(
      "CREATE OR REPLACE FUNCTION public.resolve_active_regional_recommendation_holds",
      appendStart,
    );
    const appendSql = sql.slice(appendStart, appendEnd);
    const operatorLockAt = appendSql.indexOf("'regional-hold-operator:'");
    const deletionTombstoneAt = appendSql.indexOf(
      "FROM public.account_deletions",
    );
    const mappingInsertAt = appendSql.indexOf(
      "INSERT INTO public.regional_recommendation_hold_operator_refs",
    );

    expect(sql).toContain("regional_recommendation_hold_refs_are_safe");
    expect(sql).toContain("IF jsonb_typeof(p_refs) <> 'array' THEN");
    expect(sql).toContain("authorizing_operator_ref");
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).not.toMatch(/\breason\s+text\b/i);
    expect(sql).toContain("reason_code");
    expect(sql).toContain("purge_expired_regional_recommendation_holds_v1");
    expect(sql).toContain("erase_regional_recommendation_hold_operator_v1");
    expect(sql.toLowerCase()).toContain(
      "perform public.erase_regional_recommendation_hold_operator_v1(p_user_id)",
    );
    expect(sql).toContain("interval '13 months'");
    expect(
      sql.match(/hashtextextended\(\s*'regional-hold-operator:'/g),
    ).toHaveLength(2);
    expect(sql).toContain("FROM public.account_deletions");
    expect(sql).toContain("operator_profile.deleted_at IS NULL");
    expect(deletionTombstoneAt).toBeGreaterThan(operatorLockAt);
    expect(mappingInsertAt).toBeGreaterThan(deletionTombstoneAt);
    expect(sql).toContain("p_transition - 'operatorUserId'");
    expect(sql).toContain(
      "manual transition metadata cannot identify operator",
    );
  });

  it("makes the database verify every automatic-official activation", () => {
    expect(sql).toContain("official-rip-high.v1");
    expect(sql).toContain("official_high_rip_current");
    expect(sql).toContain("FROM public.rip_current_risks");
    expect(sql).toContain("v_risk_level IS DISTINCT FROM 'high'");
    expect(sql).toContain("v_risk_source IS DISTINCT FROM 'srf'");
    expect(sql).toContain("v_risk_source IS DISTINCT FROM 'alert'");
    expect(sql).toContain("v_risk_fetched_at IS NULL");
    expect(sql).toContain("v_risk_valid_date IS NULL");
    expect(sql).toContain("transaction_timestamp() - interval '12 hours'");
    expect(sql).toContain("transaction_timestamp() + interval '5 minutes'");
  });
});

describe("regional recommendation hold smoke fixture", () => {
  it("uses generated fixture identifiers", () => {
    expect(fixtureSql).toContain("CREATE TEMP TABLE fixture_ids");
    expect(fixtureSql).toContain("gen_random_uuid()");
    expect(fixtureSql).not.toMatch(/00000000-0000-0000-0000-[0-9a-f]{12}/i);
    expect(fixtureSql).toContain("'is_ephemeral_smoke_test', true");
    expect(fixtureSql).toContain(
      "fixture_hard_delete_policy_history_missing_or_linked",
    );
  });

  it("probes every denied service-role mutation", () => {
    expect(fixtureSql).toContain(
      "fixture_service_role_direct_insert_not_denied",
    );
    expect(fixtureSql).toContain(
      "fixture_service_role_direct_update_not_denied",
    );
    expect(fixtureSql).toContain(
      "fixture_service_role_direct_delete_not_denied",
    );
  });

  it("covers strict automatic retries and post-erasure append rejection", () => {
    expect(fixtureSql.match(/pg_catalog\.sha256\(/g)).toHaveLength(1);
    expect(fixtureSql).toContain(
      "automatic_retry_without_request_id_not_rejected",
    );
    expect(fixtureSql).toContain(
      "automatic_retry_added_request_id_not_rejected",
    );
    expect(fixtureSql).toContain("automatic_invalid_time_field");
    expect(fixtureSql).toContain("post_erasure_operator_append_not_rejected");
    expect(fixtureSql).toContain("fixture_automatic_accept_returned_no_row");
    expect(fixtureSql).toContain("fixture_automatic_alert_not_normalized");
    expect(fixtureSql).toContain("operator_uuid_reuse_not_rejected");
    expect(fixtureSql).toContain("non_array_reference_not_rejected");
    expect(fixtureSql).toContain("null_reference_not_rejected");
    expect(fixtureSql).toContain(
      "fixture_automatic_idempotent_retry_returned_no_row",
    );
    expect(fixtureSql).toContain(
      "fixture_automatic_without_request_id_returned_no_row",
    );
    expect(fixtureSql).toContain("fixture_retention_purge_returned_no_row");
    expect(fixtureSql).toContain("v_banned_until IS NULL");
  });
});
