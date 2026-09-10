#!/usr/bin/env bash
# Disposable PostgreSQL 15 only; no environment files or production connections.
set -euo pipefail
study_root="$(cd "$(dirname "$0")/.." && pwd)"
study_container="swell-watch-study-test-$$"
cleanup() { docker rm -f "$study_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$study_container" -e POSTGRES_PASSWORD=disposable postgres:15 >/dev/null
deadline=$((SECONDS + 30))
until docker exec "$study_container" sh -c 'test "$(head -n 1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)" = 1 && pg_isready -U postgres -d postgres' >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Disposable PostgreSQL startup failed' >&2; exit 1; fi
  sleep 0.1
done
study_database=postgres
run_file() { docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - < "$1"; }
query() { docker exec "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -Atqc "$1"; }
run_file "$study_root/__tests__/fixtures/swell-watch-study-base.sql" >/dev/null
for migration in \
  20260824120000_create_swell_watch_event_pipeline \
  20260824130000_create_swell_watch_production_approval_authority \
  20260904120001_add_swell_watch_v2_enqueue_dedupe \
  20260904140000_create_swell_watch_provider_run_receipts \
  20260905010000_add_swell_watch_owner_attestation \
  20260905020000_resolve_swell_watch_event_identity \
  20260905030000_retain_swell_watch_unavailable_components \
  20260905040000_require_current_swell_watch_run_evidence \
  20260905050000_read_attested_swell_watch_run \
  20260905060000_ingest_swell_watch_run_atomically \
  20260905070000_read_swell_watch_delivery_health \
  20260905080000_read_swell_watch_run_scope \
  20260905090000_ingest_swell_watch_cohort \
  20260906140000_add_swell_watch_collection_lease \
  20260906150000_separate_swell_watch_evaluation_policy \
  20260906160000_record_swell_watch_shadow_demand \
  20260910180000_automate_swell_watch_study; do
  run_file "$study_root/supabase/migrations/$migration.sql" >/dev/null
done
query 'CREATE DATABASE study_activation TEMPLATE postgres'
study_database=study_activation
run_file "$study_root/__tests__/fixtures/swell-watch-study-activation.sql" >/dev/null
run_file "$study_root/docs/operations/swell-watch-study-activate.sql" >/dev/null
activation_before=$(query "SELECT row_to_json(a)::text FROM public.swell_watch_study_authorities a")
run_file "$study_root/docs/operations/swell-watch-study-activate.sql" >/dev/null
activation_after=$(query "SELECT row_to_json(a)::text FROM public.swell_watch_study_authorities a")
if [ "$activation_before" != "$activation_after" ]; then echo 'Activation retry changed authority' >&2; exit 1; fi
if [ "$(query "SELECT public.read_swell_watch_study_health()->>'status'")" != active ]; then
  echo 'Exact activation did not produce active study' >&2; exit 1
fi
# Each clone differs only in one revoked validity field, keeping the reviewed config hash.
for validity_field in not_before expires_at; do
  query "CREATE DATABASE study_revoke_$validity_field TEMPLATE study_activation"
  study_database="study_revoke_$validity_field"
  query "INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at) SELECT 2,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before+CASE WHEN '$validity_field'='not_before' THEN interval '1 second' ELSE interval '0 seconds' END,expires_at+CASE WHEN '$validity_field'='expires_at' THEN interval '1 second' ELSE interval '0 seconds' END FROM public.swell_watch_study_authorities WHERE epoch=1;"
  if [ "$(query "SELECT original.config_hash=revoked.config_hash AND original.$validity_field<>revoked.$validity_field FROM public.swell_watch_study_authorities original JOIN public.swell_watch_study_authorities revoked ON revoked.epoch=2 WHERE original.epoch=1")" != t ]; then
    echo "Invalid temporal-revocation fixture: $validity_field" >&2; exit 1
  fi
  temporal_before=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a')
  if revoke_error=$(run_file "$study_root/docs/operations/swell-watch-study-revoke.sql" 2>&1); then
    echo "Revocation accepted altered $validity_field on matching-config epoch 2" >&2; exit 1
  elif [[ "$revoke_error" != *'unexpected revoked study authority'* ]]; then
    echo "$revoke_error" >&2; exit 1
  fi
  temporal_after=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a')
  if [ "$temporal_before" != "$temporal_after" ]; then
    echo "Rejected temporal revocation changed authority: $validity_field" >&2; exit 1
  fi
  study_database=study_activation
done
run_file "$study_root/docs/operations/swell-watch-study-revoke.sql" >/dev/null
run_file "$study_root/docs/operations/swell-watch-study-revoke.sql" >/dev/null
if [ "$(query "SELECT count(*) FROM public.swell_watch_study_authorities")" != 2 ] || \
  [ "$(query "SELECT public.read_swell_watch_study_health()->>'status'")" != blocked ]; then
  echo 'Exact revocation was not idempotent and blocked' >&2; exit 1
fi
if activation_error=$(run_file "$study_root/docs/operations/swell-watch-study-activate.sql" 2>&1); then
  echo 'Activation unexpectedly replaced revoked authority' >&2; exit 1
elif [[ "$activation_error" != *'unexpected study authority; exact retry only'* ]]; then
  echo "$activation_error" >&2; exit 1
fi
query "INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at) SELECT 3,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at FROM public.swell_watch_study_authorities WHERE epoch=2;"
if revoke_error=$(run_file "$study_root/docs/operations/swell-watch-study-revoke.sql" 2>&1); then
  echo 'Revocation accepted unexpected revoked authority' >&2; exit 1
elif [[ "$revoke_error" != *'unexpected study authority; review before revoking'* ]]; then
  echo "$revoke_error" >&2; exit 1
fi
if [ "$(query 'SELECT count(*) FROM public.swell_watch_study_authorities')" != 3 ]; then
  echo 'Rejected revocation changed authority' >&2; exit 1
fi
study_database=postgres
run_file "$study_root/__tests__/fixtures/swell-watch-study-receipts.sql" >/dev/null
run_file "$study_root/__tests__/fixtures/swell-watch-study-probe.sql"
query 'SET ROLE service_role; SELECT public.study_complete_retry()' &
first_pid=$!
query 'SET ROLE service_role; SELECT public.study_complete_retry()' &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
query "SELECT public.study_assert((SELECT count(*) FROM public.swell_watch_study_acceptances WHERE revision_set_id=(SELECT revision_set_id FROM public.study_pending))=1,'concurrent acceptance once'); SELECT public.study_assert((SELECT count(*) FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id=(SELECT revision_set_id FROM public.study_pending))=1,'concurrent completion once');"
# Synchronize on the held control lock, not elapsed time, before testing revocation.
query 'SELECT public.study_probe_legacy_ingestion(false)'
query "BEGIN; SELECT public.study_install(5,'revoked'); SELECT pg_sleep(2); COMMIT;" &
revoke_pid=$!
deadline=$((SECONDS + 10))
until [ "$(query "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted AND objid=(hashtextextended('swell-watch-control',0) & 4294967295)::oid")" -gt 0 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Revocation lock not acquired' >&2; exit 1; fi
  sleep 0.05
done
query "SET ROLE service_role; SELECT public.study_error('SELECT public.complete_swell_watch_study_run((SELECT revision_set_id FROM public.study_pending),repeat(''a'',64),public.study_cohort(),public.study_inputs())','current study config required');"
wait "$revoke_pid"
query 'SELECT public.study_probe_legacy_ingestion(true)'
query "SELECT public.study_assert(public.swell_watch_provider_evidence_is_current((SELECT provider_batch_id FROM public.study_manual_batch)),'study revocation leaves manual evidence current');"
query "SELECT public.study_assert(NOT public.swell_watch_provider_evidence_is_current((SELECT b.id FROM public.swell_watch_provider_run_completed_batches b JOIN public.study_pending p ON p.revision_set_id=b.revision_set_id)),'concurrent revocation invalidates completed evidence');"
echo 'Swell Watch study PostgreSQL checks passed'
