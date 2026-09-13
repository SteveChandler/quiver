#!/usr/bin/env bash
set -euo pipefail

container="phase26-provider-receipts-$$"
root="$(cd "$(dirname "$0")/.." && pwd)"
scratch_dir="$(mktemp -d)"

cleanup() { rm -rf "$scratch_dir"; docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

run_file() { docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$1"; }

docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=postgres postgres:15 >/dev/null
deadline=$((SECONDS + 30))
# The image's temporary initialization server can pass pg_isready before restarting.
until docker exec "$container" sh -c 'test "$(head -n 1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)" = 1 && pg_isready -U postgres -d postgres' >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo "disposable postgres did not become ready" >&2; exit 1; fi
  sleep 1
done

run_file "$root/__tests__/fixtures/swell-watch-event-pipeline-postgres.sql" >/dev/null
run_file "$root/supabase/migrations/20260824120000_create_swell_watch_event_pipeline.sql" >/dev/null
run_file "$root/supabase/migrations/20260824130000_create_swell_watch_production_approval_authority.sql" >/dev/null
run_file "$root/supabase/migrations/20260904120001_add_swell_watch_v2_enqueue_dedupe.sql" >/dev/null
run_file "$root/supabase/migrations/20260904140000_create_swell_watch_provider_run_receipts.sql" >/dev/null
run_file "$root/supabase/migrations/20260905010000_add_swell_watch_owner_attestation.sql" >/dev/null
run_file "$root/supabase/migrations/20260905030000_retain_swell_watch_unavailable_components.sql" >/dev/null
run_file "$root/supabase/migrations/20260905040000_require_current_swell_watch_run_evidence.sql" >/dev/null

for role in anon authenticated; do
  if docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE $role; SELECT public.ingest_swell_watch_evaluation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'synthetic_fixture:forbidden','11111111-1111-4111-8111-111111111111','region','physical','noaa',now(),'s1',1,12,170,2,'policy',repeat('a',64),repeat('b',64),'synthetic_fixture',now()+interval '3 days',now()+interval '4 days')" >/dev/null 2>&1; then
    echo "$role unexpectedly executed fixture ingestion" >&2
    exit 1
  fi
done

if docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_swell_watch_evaluation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'genuine_completed:forbidden','11111111-1111-4111-8111-111111111111','region','physical','open_meteo',now(),'s1',1,12,170,2,'policy',repeat('a',64),repeat('b',64),'genuine_completed',now()+interval '3 days',now()+interval '4 days')" >/dev/null 2>&1; then
  echo "service role unexpectedly forged genuine provider evidence" >&2
  exit 1
fi

docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_swell_watch_evaluation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03','synthetic_fixture:compatibility','11111111-1111-4111-8111-111111111111','fixture-region','fixture-physical','noaa',now(),'s1',1,12,170,2,'policy',repeat('a',64),repeat('b',64),'synthetic_fixture',now()+interval '3 days',now()+interval '4 days')" >/dev/null

run_file "$root/__tests__/fixtures/swell-watch-provider-run-receipts-probe.sql" >/dev/null

concurrent_sql="SET ROLE service_role; SELECT * FROM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes('2026-09-03T18:00Z',1.4,1));"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$concurrent_sql" >/dev/null &
first_pid=$!
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$concurrent_sql" >/dev/null &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

concurrent_counts=$(docker exec "$container" psql -U postgres -d postgres -Atq -c "SELECT count(*) || ':' || count(DISTINCT batch.id) || ':' || count(DISTINCT revision_set.id) FROM public.swell_watch_provider_run_issuances issuance JOIN public.swell_watch_provider_run_batches batch ON batch.issuance_id=issuance.id JOIN public.swell_watch_provider_run_revision_sets revision_set ON revision_set.batch_id=batch.id WHERE issuance.run_utc='2026-09-03T18:00Z'")
if [ "$concurrent_counts" != "1:1:1" ]; then
  echo "concurrent retry created duplicate durable identities: $concurrent_counts" >&2
  exit 1
fi

docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref) SELECT 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',revision_set.id,'accepted','fixture-reviewer',repeat('a',64),'fixture-contract' FROM public.swell_watch_provider_run_revision_sets revision_set JOIN public.swell_watch_provider_run_batches batch ON batch.id=revision_set.batch_id JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id WHERE issuance.run_utc='2026-09-03T18:00Z'" >/dev/null
race_ids=$(docker exec "$container" psql -U postgres -d postgres -Atq -c "SELECT revision_set.id || ':' || batch.id FROM public.swell_watch_provider_run_revision_sets revision_set JOIN public.swell_watch_provider_run_batches batch ON batch.id=revision_set.batch_id JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id WHERE issuance.run_utc='2026-09-03T18:00Z'")
race_revision_set_id=${race_ids%%:*}
race_run_batch_id=${race_ids##*:}
race_completed_id=$(docker exec "$container" psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT provider_batch_id FROM public.complete_swell_watch_provider_run_receipt('$race_revision_set_id')")
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_verified_swell_watch_evaluation('$race_completed_id','cccccccc-cccc-4ccc-8ccc-cccccccccc01','cccccccc-cccc-4ccc-8ccc-cccccccccc02','cccccccc-cccc-4ccc-8ccc-cccccccccc03','11111111-1111-4111-8111-111111111111','race-region','race-physical','2026-09-03T18:00Z','s1',1.4,12,170,2,'policy',repeat('a',64),repeat('b',64),'2026-09-06T12:00Z','2026-09-06T18:00Z'); SELECT public.append_swell_watch_state_transition('cccccccc-cccc-4ccc-8ccc-cccccccccc04','cccccccc-cccc-4ccc-8ccc-cccccccccc03',0,'candidate','genuine_completed:$race_run_batch_id')" >/dev/null
support_completed_id=$(docker exec "$container" psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c "SELECT completed.id FROM public.swell_watch_provider_run_completed_batches completed JOIN public.swell_watch_provider_run_revision_sets revision_set ON revision_set.id=completed.revision_set_id JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id WHERE issuance.run_utc='2026-09-03T12:00Z' ORDER BY revision_set.revision_number DESC LIMIT 1")
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_verified_swell_watch_evaluation('$support_completed_id','cccccccc-cccc-4ccc-8ccc-cccccccccc21','cccccccc-cccc-4ccc-8ccc-cccccccccc22','cccccccc-cccc-4ccc-8ccc-cccccccccc03','11111111-1111-4111-8111-111111111111','race-region','race-physical','2026-09-03T18:00Z','s1',1.5,12,170,2,'policy',repeat('a',64),repeat('b',64),'2026-09-06T12:00Z','2026-09-06T18:00Z')" >/dev/null
pre_race_result=$(docker exec "$container" psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT reason_code FROM public.swell_watch_validate_notification_release('cccccccc-cccc-4ccc-8ccc-cccccccccc03','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'cccccccc-cccc-4ccc-8ccc-cccccccccc05')")
if [ -z "$pre_race_result" ] || [ "$pre_race_result" = "provider_evidence_unavailable" ]; then
  echo "fresh race fixture was not current before revocation: $pre_race_result" >&2
  exit 1
fi

revoke_sql="BEGIN; SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref,revokes_attestation_id) SELECT 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',accepted.revision_set_id,'revoked','fixture-reviewer',repeat('b',64),'fixture-contract',accepted.id FROM public.swell_watch_provider_run_attestations accepted WHERE accepted.id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'; SELECT pg_sleep(1); COMMIT;"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$revoke_sql" >/dev/null &
revoke_pid=$!
deadline=$((SECONDS + 5))
until [ "$(docker exec "$container" psql -U postgres -d postgres -Atq -c "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted")" -gt 0 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo "revocation race did not acquire its provider lock" >&2; exit 1; fi
  sleep 0.05
done
docker exec "$container" psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c "/* provider-release-race */ SET ROLE service_role; SELECT reason_code FROM public.swell_watch_validate_notification_release('cccccccc-cccc-4ccc-8ccc-cccccccccc03','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'cccccccc-cccc-4ccc-8ccc-cccccccccc05')" > "$scratch_dir/release-result" &
release_pid=$!
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "/* provider-ingest-race */ SET ROLE service_role; SELECT public.ingest_verified_swell_watch_evaluation('$race_completed_id','cccccccc-cccc-4ccc-8ccc-cccccccccc11','cccccccc-cccc-4ccc-8ccc-cccccccccc12','cccccccc-cccc-4ccc-8ccc-cccccccccc13','11111111-1111-4111-8111-111111111111','race-region','race-physical-two','2026-09-03T19:00Z','s1',1.4,12,170,2,'policy',repeat('a',64),repeat('b',64),'2026-09-06T12:00Z','2026-09-06T18:00Z')" > "$scratch_dir/ingest-result" 2>&1 &
ingest_pid=$!
deadline=$((SECONDS + 5))
until [ "$(docker exec "$container" psql -U postgres -d postgres -Atq -c "SELECT count(*) FROM pg_stat_activity WHERE (query LIKE '%provider-release-race%' OR query LIKE '%provider-ingest-race%') AND wait_event='advisory'")" -eq 2 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo "release and ingest did not wait on the provider evidence lock" >&2; exit 1; fi
  sleep 0.05
done
wait "$revoke_pid"
wait "$release_pid"
if wait "$ingest_pid"; then
  echo "concurrent ingest unexpectedly survived attestation revocation" >&2
  exit 1
fi
race_result=$(tr -d '[:space:]' < "$scratch_dir/release-result")
if [ "$race_result" != "provider_evidence_unavailable" ]; then
  echo "release/revocation race did not fail closed: $race_result" >&2
  exit 1
fi

initial_completion_race=$(docker exec "$container" psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT revision_set_id FROM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes('2026-09-04T00:00Z',1.5,1))")
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref) VALUES ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','$initial_completion_race','accepted','fixture-reviewer',repeat('c',64),'fixture-contract')" >/dev/null
correction_sql="BEGIN; SET ROLE service_role; SELECT * FROM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes('2026-09-04T00:00Z',1.6,2)); SELECT pg_sleep(1); COMMIT;"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$correction_sql" >/dev/null &
correction_pid=$!
deadline=$((SECONDS + 5))
until [ "$(docker exec "$container" psql -U postgres -d postgres -Atq -c "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted")" -gt 0 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo "correction race did not acquire its provider lock" >&2; exit 1; fi
  sleep 0.05
done
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "/* provider-completion-race */ SET ROLE service_role; SELECT * FROM public.complete_swell_watch_provider_run_receipt('$initial_completion_race')" > "$scratch_dir/completion-result" 2>&1 &
completion_pid=$!
deadline=$((SECONDS + 5))
until [ "$(docker exec "$container" psql -U postgres -d postgres -Atq -c "SELECT count(*) FROM pg_stat_activity WHERE query LIKE '%provider-completion-race%' AND wait_event='advisory'")" -gt 0 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo "completion did not wait on the provider correction lock" >&2; exit 1; fi
  sleep 0.05
done
wait "$correction_pid"
if wait "$completion_pid"; then
  echo "stale revision completed during a correction race" >&2
  exit 1
fi

run_file "$root/__tests__/fixtures/swell-watch-owner-attestation-probe.sql" >/dev/null
echo "swell watch provider receipt PostgreSQL checks passed"
