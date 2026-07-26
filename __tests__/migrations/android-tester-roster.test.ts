import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260725213000_create_android_tester_roster.sql",
  ),
  "utf8",
).toLowerCase();

describe("Android tester roster migration", () => {
  it("creates service-role-only RLS tables for roster, encrypted identity, stages, install evidence, sync runs, and audit", () => {
    for (const table of [
      "android_tester_roster_entries",
      "android_tester_roster_identities",
      "android_tester_roster_stages",
      "android_tester_roster_join_evidence",
      "android_tester_roster_install_evidence",
      "android_tester_roster_first_open_evidence",
      "android_tester_roster_sync_runs",
      "android_tester_roster_sync_claims",
      "android_tester_roster_audit",
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
      expect(sql).toMatch(
        new RegExp(
          `grant (?:all|select, insert) on table public\\.${table} to service_role`,
        ),
      );
    }
  });

  it("stores unjoined identity only as an AES-GCM envelope with no reversible identity hash", () => {
    const identityTable = sql.match(
      /create table if not exists public\.android_tester_roster_identities \(([\s\S]*?)\n\);/,
    )?.[1];

    expect(identityTable).toContain("key_version");
    expect(identityTable).toContain("iv");
    expect(identityTable).toContain("ciphertext");
    expect(identityTable).toContain("auth_tag");
    expect(identityTable).not.toMatch(/\bemail\b|\bmember_id\b|\bidentity_hash\b/);
    expect(sql).not.toMatch(
      /\b(email_hash|member_id_hash|external_member_id_hash)\b/,
    );
  });

  it("keeps eligibility, Play opt-in, install, first-open, and account join as independent timestamped evidence", () => {
    expect(sql).toContain("stage text not null");
    expect(sql).toContain("status text not null");
    expect(sql).toContain("source text not null");
    expect(sql).toContain("observed_at timestamptz not null");
    expect(sql).toContain("confidence text not null");
    expect(sql).toContain("evidence jsonb not null");
    expect(sql).toMatch(
      /stage in \(\s*'group_eligibility',\s*'play_opt_in',\s*'install',\s*'first_open',\s*'account_join'\s*\)/,
    );
    expect(sql).not.toMatch(/play_opt_in[\s\S]{0,100}(?:install|account_join)\s*=/);
  });

  it("only treats complete snapshots as authoritative for leave, schedules +30-day purge, and cancels purge on rejoin", () => {
    expect(sql).toContain("apply_android_tester_roster_snapshot");
    expect(sql).toContain("p_snapshot_complete");
    expect(sql).toMatch(
      /if not p_snapshot_complete then[\s\S]*return/,
    );
    expect(sql).toContain("p_observed_at + interval '30 days'");
    expect(sql).toContain("purge_after = null");
    expect(sql).toContain("purge_android_tester_roster_identities");
    expect(sql).toContain("purge_after <= p_now");
  });

  it("atomically links a user independently of install evidence, appends account-join stage, audits anonymously, and deletes raw identity", () => {
    const linkFunction = sql.match(
      /create or replace function public\.link_android_tester_roster_account\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(linkFunction).toContain("security definer");
    expect(linkFunction).toContain("for update");
    expect(linkFunction).toContain(
      "delete from public.android_tester_roster_identities",
    );
    expect(linkFunction).toContain(
      "insert into public.android_tester_roster_join_evidence",
    );
    expect(linkFunction).not.toContain(
      "insert into public.android_tester_roster_install_evidence",
    );
    expect(linkFunction).toContain(
      "insert into public.android_tester_roster_stages",
    );
    expect(linkFunction).toContain(
      "insert into public.android_tester_roster_audit",
    );
    expect(linkFunction).toContain("same_key_retry");
    expect(linkFunction).toContain("p_idempotency_key_hash");
    expect(linkFunction).toMatch(
      /insert into public\.android_tester_roster_audit[\s\S]*values \(\s*null,\s*p_entry_id,\s*'join'/,
    );
    expect(linkFunction).not.toContain(
      "jsonb_build_object('nativeinstallid'",
    );
    const idempotencyChecks = linkFunction?.match(
      /idempotency_key_hash = p_idempotency_key_hash/g,
    );
    expect(idempotencyChecks).toHaveLength(2);
    expect(linkFunction).toMatch(
      /for update;[\s\S]*idempotency_key_hash = p_idempotency_key_hash[\s\S]*same_key_retry/,
    );
    expect(sql).toContain("install_evidence_source_check");
    expect(sql).toContain("install_evidence_surface_check");
    expect(sql).toContain("install_evidence_placement_check");
    expect(sql).toContain("install_evidence_campaign_check");
    const joinContextFunction = sql.match(
      /create or replace function public\.get_android_tester_roster_join_context\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    expect(joinContextFunction).toContain("'same_key_retry'");
    expect(joinContextFunction).toContain(
      "insert into public.android_tester_roster_audit",
    );
  });

  it("records install and first-open as separate idempotent operational evidence", () => {
    const installFunction = sql.match(
      /create or replace function public\.record_android_tester_roster_install\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    const firstOpenFunction = sql.match(
      /create or replace function public\.record_android_tester_roster_first_open\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    const linkFunction = sql.match(
      /create or replace function public\.link_android_tester_roster_account\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(installFunction).toContain(
      "insert into public.android_tester_roster_install_evidence",
    );
    expect(installFunction).toContain("'install'");
    expect(firstOpenFunction).toContain(
      "insert into public.android_tester_roster_first_open_evidence",
    );
    expect(firstOpenFunction).toContain("'first_open'");
    expect(linkFunction).not.toContain("'first_open'");
    expect(linkFunction).not.toContain("'install'");
  });

  it("creates explicit unknown rows for every non-eligibility stage and reports latest per-stage aggregates", () => {
    const applyFunction = sql.match(
      /create or replace function public\.apply_android_tester_roster_snapshot\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    const summaryFunction = sql.match(
      /create or replace function public\.get_android_tester_roster_summary\(\)([\s\S]*?)\n\$\$;/,
    )?.[0];

    for (const stage of [
      "play_opt_in",
      "install",
      "first_open",
      "account_join",
    ]) {
      expect(applyFunction).toContain(`'${stage}'`);
    }
    expect(applyFunction).toMatch(
      /'play_opt_in',\s*'unknown'[\s\S]*'install',\s*'unknown'[\s\S]*'first_open',\s*'unknown'[\s\S]*'account_join',\s*'unknown'/,
    );
    expect(summaryFunction).toContain("'stagecounts'");
    expect(summaryFunction).toContain("'group_eligibility'");
    expect(summaryFunction).toContain("'play_opt_in'");
    expect(summaryFunction).toContain("'first_open'");
    expect(summaryFunction).toContain("distinct on (entry_id, stage)");
  });

  it("removes linked roster data on account deletion and exposes only aggregate/non-PII reporting RPCs", () => {
    expect(sql).toContain("delete_android_tester_roster_for_account");
    expect(sql).toContain("when (new.deleted_at is not null");
    expect(sql).toContain("delete from public.android_tester_roster_entries");
    expect(sql).toContain("get_android_tester_roster_summary");
    expect(sql).toContain("export_android_tester_roster_non_pii");
    expect(sql).not.toMatch(/returns table \([^)]*\bemail\b/i);
  });

  it("provides a mandatory non-PII audit RPC and makes all privileged RPCs service-role only", () => {
    expect(sql).toContain("record_android_tester_roster_audit");
    expect(sql).toContain("actor_user_id");
    expect(sql).toContain("action");
    expect(sql).toContain("outcome");
    const auditTable = sql.match(
      /create table if not exists public\.android_tester_roster_audit \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(auditTable).not.toMatch(
      /^\s*(?:email|member_id|ciphertext)\s+(?:text|bytea)\b/m,
    );
    expect(auditTable).toContain("evidence::text !~ '@'");
    expect(sql).toContain("p_evidence::text ~ '@'");

    for (const functionName of [
      "record_android_tester_roster_audit",
      "get_android_tester_roster_join_context",
      "link_android_tester_roster_account",
      "claim_android_tester_roster_sync",
      "release_android_tester_roster_sync_claim",
      "get_android_tester_roster_sync_identities",
      "apply_android_tester_roster_snapshot",
      "record_android_tester_roster_install",
      "record_android_tester_roster_first_open",
      "purge_android_tester_roster_identities",
      "get_android_tester_roster_summary",
      "export_android_tester_roster_non_pii",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}\\([\\s\\S]*?grant execute on function public\\.${functionName}\\([\\s\\S]*?to service_role`,
        ),
      );
    }
  });

  it("claims complete reconciliation from identity read through atomic apply", () => {
    const claimFunction = sql.match(
      /create or replace function public\.claim_android_tester_roster_sync\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    const applyFunction = sql.match(
      /create or replace function public\.apply_android_tester_roster_snapshot\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(claimFunction).toContain("on conflict (singleton)");
    expect(claimFunction).toContain("interval '15 minutes'");
    expect(applyFunction).toContain("p_claim_token uuid");
    expect(applyFunction).toMatch(
      /from public\.android_tester_roster_sync_claims[\s\S]*claim_token = p_claim_token[\s\S]*for update/,
    );
    expect(applyFunction).toContain(
      "delete from public.android_tester_roster_sync_claims",
    );
    expect(sql).toContain("release_android_tester_roster_sync_claim");
  });

  it("replaces obsolete encrypted identity envelopes on an explicit refresh", () => {
    const applyFunction = sql.match(
      /create or replace function public\.apply_android_tester_roster_snapshot\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(applyFunction).toContain(
      "observation->>'kind' = 'identity_refresh'",
    );
    expect(applyFunction).toMatch(
      /identity_refresh[\s\S]*on conflict \(entry_id\) do update set[\s\S]*ciphertext = excluded\.ciphertext/,
    );
    expect(applyFunction).toMatch(
      /identity_refresh[\s\S]*where exists \([\s\S]*entry\.user_id is null[\s\S]*on conflict \(entry_id\)/,
    );
    expect(sql).toContain("refreshed_count integer");
    expect(applyFunction).toContain(
      "v_refreshed := v_refreshed + v_changed",
    );
    expect(applyFunction).toContain("'refreshedcount', v_refreshed");
  });

  it("accepts only bounded opaque manual Play evidence", () => {
    const recordStageFunction = sql.match(
      /create or replace function public\.record_android_tester_roster_stage\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(recordStageFunction).toContain("play_console_membership_review");
    expect(recordStageFunction).toContain("referenceid");
    expect(recordStageFunction).toContain(
      "p_evidence - array['code', 'referenceid'] <> '{}'::jsonb",
    );
    expect(recordStageFunction).toContain(
      "raise exception 'invalid play evidence'",
    );
  });

  it("updates the exact sync run created by each snapshot transaction", () => {
    const applySnapshotFunction = sql.match(
      /create or replace function public\.apply_android_tester_roster_snapshot\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(applySnapshotFunction).toContain("v_sync_run_id uuid");
    expect(applySnapshotFunction).toContain(
      "returning id into v_sync_run_id",
    );
    expect(applySnapshotFunction).toContain("where id = v_sync_run_id");
    expect(applySnapshotFunction).not.toMatch(
      /order by run\.created_at desc[\s\S]*limit 1/,
    );
  });

  it("reconciles linked rows without restoring deleted identity envelopes", () => {
    const syncIdentityFunction = sql.match(
      /create or replace function public\.get_android_tester_roster_sync_identities\(\)([\s\S]*?)\n\$\$;/,
    )?.[0];
    const applySnapshotFunction = sql.match(
      /create or replace function public\.apply_android_tester_roster_snapshot\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(syncIdentityFunction).toContain("user_id uuid");
    expect(syncIdentityFunction).toContain(
      "left join public.android_tester_roster_identities",
    );
    expect(syncIdentityFunction).not.toContain("where entry.user_id is null");
    expect(applySnapshotFunction).toContain(
      "observation->>'kind' = 'left_linked'",
    );
    expect(applySnapshotFunction).toContain(
      "observation->>'kind' = 'rejoined_linked'",
    );
    expect(applySnapshotFunction).toMatch(
      /left_linked[\s\S]*user_id is not null/,
    );
  });

  it("serializes join against leave and skips zero-row stage/count changes", () => {
    const applyFunction = sql.match(
      /create or replace function public\.apply_android_tester_roster_snapshot\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(applyFunction).toMatch(
      /observation->>'kind' = 'left'[\s\S]*for update[\s\S]*user_id is null[\s\S]*get diagnostics v_changed = row_count/,
    );
    expect(applyFunction).toContain(
      "v_left := v_left + v_changed",
    );
    expect(applyFunction).toMatch(
      /if v_changed = 0 then[\s\S]*continue/,
    );
  });

  it("anonymizes account-linked audit residue before deleting the roster row", () => {
    const deletionFunction = sql.match(
      /create or replace function public\.delete_android_tester_roster_for_account\(\)([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(deletionFunction).toMatch(
      /update public\.android_tester_roster_audit[\s\S]*actor_user_id = null[\s\S]*evidence = '\{\}'::jsonb/,
    );
    expect(deletionFunction).toMatch(
      /update public\.android_tester_roster_audit[\s\S]*delete from public\.android_tester_roster_entries/,
    );
  });
});
