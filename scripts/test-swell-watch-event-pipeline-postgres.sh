#!/usr/bin/env bash
set -euo pipefail

container="phase26-swell-watch-fixture-$$"
root="$(cd "$(dirname "$0")/.." && pwd)"
scratch_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$scratch_dir"
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql_db() { docker exec -i "$container" psql -U postgres -d postgres "$@"; }
run_file() { docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$1"; }
run_service_file() { docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE service_role;" -f - < "$1"; }
expect_sqlstate() {
  local label="$1" state="$2"
  shift 2
  local output status
  set +e
  output=$("$@" 2>&1)
  status=$?
  set -e
  if [ "$status" -eq 0 ] || [[ "$output" != *"$state"* ]]; then
    echo "$label did not return SQLSTATE $state: $output" >&2
    exit 1
  fi
}

docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=postgres postgres:15 >/dev/null
deadline=$((SECONDS + 30))
until docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "disposable postgres did not become ready within 30 seconds" >&2
    exit 1
  fi
  sleep 1
done

run_file "$root/__tests__/fixtures/swell-watch-event-pipeline-postgres.sql"
run_file "$root/supabase/migrations/20260824120000_create_swell_watch_event_pipeline.sql"
run_file "$root/supabase/migrations/20260824130000_create_swell_watch_production_approval_authority.sql"
run_file "$root/supabase/migrations/20260904120001_add_swell_watch_v2_enqueue_dedupe.sql"
run_file "$root/supabase/migrations/20260904140000_create_swell_watch_provider_run_receipts.sql"
sed -n '1,/^\$\$;/p' "$root/__tests__/fixtures/swell-watch-provider-run-receipts-probe.sql" | docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - >/dev/null

validator_results=$(psql_db -Atq -c "SELECT (public.swell_watch_production_policy_values_valid('{}'::jsonb) IS FALSE)::text || ':' || (public.swell_watch_production_policy_values_valid('{\"volume_caps\":{}}'::jsonb) IS FALSE)::text || ':' || (public.swell_watch_production_policy_values_valid('{\"volume_caps\":{\"maximum_candidates_per_region\":null}}'::jsonb) IS FALSE)::text || ':' || (public.swell_watch_production_policy_values_valid('{\"volume_caps\":{\"maximum_candidates_per_region\":\"50\"}}'::jsonb) IS FALSE)::text")
if [ "$validator_results" != "true:true:true:true" ]; then
  echo "policy value validator accepted a missing, null, or numeric-string field: $validator_results" >&2
  exit 1
fi
expect_invalid_authority_policy() {
  local label="$1" policy_values="$2"
  expect_sqlstate "$label invalid authority policy" 23514 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SELECT set_config('app.swell_watch_internal_write', 'on', false); INSERT INTO public.swell_watch_production_approval_authority (record_id, authority_id, authority_epoch, state, revokes_authority_id, policy_hash, policy_provenance, policy_values, approval_id, approval_evidence_hash, production_scope, reviewer, not_before, expires_at) VALUES ('abababab-abab-4bab-8bab-abababababaa', 'acacacac-acac-4cac-8cac-acacacacacaa', 99, 'active', NULL, repeat('a', 64), 'production_approved', $policy_values, 'fixture-invalid', repeat('c', 64), 'swell_watch_push', 'fixture-reviewer', now() - interval '1 hour', now() + interval '1 hour')"
}
expect_invalid_authority_policy "empty" "'{}'::jsonb"
expect_invalid_authority_policy "missing" "'{\"volume_caps\":{}}'::jsonb"
expect_invalid_authority_policy "null" "'{\"volume_caps\":{\"maximum_candidates_per_region\":null}}'::jsonb"
expect_invalid_authority_policy "numeric-string" "'{\"volume_caps\":{\"maximum_candidates_per_region\":\"50\"}}'::jsonb"

protected_count=$(psql_db -Atq -c "SELECT count(*) FROM (SELECT role_name, p.oid FROM (VALUES ('anon'::name), ('authenticated'::name)) roles(role_name) CROSS JOIN pg_proc p WHERE p.proname IN ('advance_swell_watch_event', 'claim_swell_watch_recipient_announcement', 'ingest_swell_watch_evaluation', 'append_swell_watch_state_transition', 'swell_watch_get_automation_control', 'swell_watch_get_production_authority', 'transition_swell_watch_automation_control', 'swell_watch_validate_notification_release', 'swell_watch_record_provider_delivery_outcome') AND NOT has_function_privilege(role_name, p.oid, 'EXECUTE')) denied")
if [ "$protected_count" != "18" ]; then
  echo "protected RPC privilege inventory failed: $protected_count" >&2
  exit 1
fi
for role in anon authenticated; do
  expect_sqlstate "$role protected RPC" 42501 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE $role; SELECT public.claim_swell_watch_recipient_announcement('12121212-1212-4121-8121-121212121212', '55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"
done
for role in anon authenticated; do
  expect_sqlstate "$role control RPC" 42501 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE $role; SELECT * FROM public.swell_watch_get_automation_control()"
  expect_sqlstate "$role release RPC" 42501 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE $role; SELECT * FROM public.swell_watch_validate_notification_release('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now(), '99999999-9999-4999-8999-999999999999')"
done
expect_sqlstate "missing control actor" 22023 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT * FROM public.transition_swell_watch_automation_control('hold', 0, 'operator_hold', 'swell-watch-control-missing-actor', NULL, NULL)"
expect_sqlstate "service direct write" 42501 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; INSERT INTO public.swell_watch_observations (id, evaluation_id, source_point_id, provider, forecast_at, source_slot, height_m, period_s, direction_deg, identity_kind) VALUES (gen_random_uuid(), 'synthetic_fixture:direct', '11111111-1111-4111-8111-111111111111', 'noaa', now(), 's1', 1, 10, 90, 'synthetic_fixture')"

first_control=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch || ':' || reason_code FROM public.transition_swell_watch_automation_control('hold', 0, 'operator_hold', 'swell-watch-control-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
replay_control=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch || ':' || reason_code FROM public.transition_swell_watch_automation_control('hold', 0, 'operator_hold', 'swell-watch-control-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
if [ "$first_control" != "held:1:operator_hold" ] || [ "$replay_control" != "$first_control" ]; then
  echo "control idempotency did not return its exact append-only transition" >&2
  exit 1
fi
expect_sqlstate "conflicting control replay" 23505 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT * FROM public.transition_swell_watch_automation_control('hold', 0, 'other_hold', 'swell-watch-control-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"
expect_sqlstate "stale control epoch" 40001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT * FROM public.transition_swell_watch_automation_control('hold', 0, 'operator_hold', 'swell-watch-control-2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"
reset_control=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch FROM public.transition_swell_watch_automation_control('reset_shadow', 1, 'operator_reset', 'swell-watch-control-3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
if [ "$reset_control" != "shadow:2" ]; then
  echo "held control did not require explicit reset to shadow" >&2
  exit 1
fi
expect_sqlstate "arm without authority" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT * FROM public.transition_swell_watch_automation_control('arm', 2, 'operator_arm', 'swell-watch-control-4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"
psql_db -v ON_ERROR_STOP=1 -c "SELECT set_config('app.swell_watch_internal_write', 'on', false); INSERT INTO public.swell_watch_production_approval_authority (record_id, authority_id, authority_epoch, state, revokes_authority_id, policy_hash, policy_provenance, policy_values, approval_id, approval_evidence_hash, production_scope, reviewer, not_before, expires_at) VALUES ('abababab-abab-4bab-8bab-abababababab', 'acacacac-acac-4cac-8cac-acacacacacac', 1, 'active', NULL, repeat('a', 64), 'production_approved', '{\"volume_caps\":{\"maximum_candidates_per_region\":50,\"maximum_recipients_per_event\":1000,\"maximum_projected_sends_per_window\":1000,\"projected_send_window_hours\":24},\"provider_failure_hold\":{\"window_minutes\":60,\"maximum_failure_rate\":0.05,\"minimum_samples\":20},\"staleness\":{\"maximum_forecast_age_hours\":1},\"partition_matching\":{\"maximum_direction_delta_deg\":30,\"maximum_period_delta_s\":3,\"maximum_arrival_delta_hours\":12},\"stability\":{\"minimum_genuine_evaluations\":2}}'::jsonb, 'fixture-approval', repeat('c', 64), 'swell_watch_push', 'fixture-reviewer', now() - interval '1 hour', now() + interval '1 hour'); INSERT INTO public.favorite_beaches (user_id, beach_id, custom_spot_id, alerts_enabled) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', NULL, true); INSERT INTO public.user_devices (user_id, retired_at) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NULL);" >/dev/null
armed_control=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch FROM public.transition_swell_watch_automation_control('arm', 2, 'operator_arm', 'swell-watch-control-5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
if [ "$armed_control" != "armed:3" ]; then echo "fixture authority did not permit arm" >&2; exit 1; fi
expect_sqlstate "owner control history update" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "UPDATE public.swell_watch_automation_control_transitions SET reason_code = 'tampered' WHERE epoch = 1"

release_second_run=$(psql_db -Atq -c "SELECT to_char(date_trunc('day', now() AT TIME ZONE 'UTC') + (floor(extract(hour FROM now() AT TIME ZONE 'UTC') / 6)::integer + 1) * interval '6 hours', 'YYYY-MM-DD\"T\"HH24:MI\"Z\"')")
release_first_run=$(psql_db -Atq -c "SELECT to_char('$release_second_run'::timestamptz - interval '6 hours', 'YYYY-MM-DD\"T\"HH24:MI\"Z\"')")
release_first_revision=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT revision_set_id FROM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes('$release_first_run',1,1))")
release_second_revision=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT revision_set_id FROM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes('$release_second_run',1.1,1))")
psql_db -v ON_ERROR_STOP=1 -c "SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_provider_run_attestations (revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref) VALUES ('$release_first_revision','accepted','local-fixture-attestation',repeat('d',64),'local-fixture-contract'),('$release_second_revision','accepted','local-fixture-attestation',repeat('e',64),'local-fixture-contract');" >/dev/null
release_first_batch=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT provider_batch_id FROM public.complete_swell_watch_provider_run_receipt('$release_first_revision')")
release_second_batch=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT provider_batch_id FROM public.complete_swell_watch_provider_run_receipt('$release_second_revision')")
psql_db -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_verified_swell_watch_evaluation('$release_first_batch', '40404040-4040-4040-8040-404040404040', '41414141-4141-4141-8141-414141414141', '42424242-4242-4242-8242-424242424242', '11111111-1111-4111-8111-111111111111', 'fixture-release-region', 'fixture-release-component', '$release_second_run', 's1', 1, 12, 170, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64), now() + interval '3 days', now() + interval '3 days 6 hours');"
psql_db -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_verified_swell_watch_evaluation('$release_second_batch', '43434343-4343-4343-8343-434343434343', '44444444-4444-4444-8444-444444444445', '42424242-4242-4242-8242-424242424242', '11111111-1111-4111-8111-111111111111', 'fixture-release-region', 'fixture-release-component', '$release_second_run', 's1', 1.1, 12, 170, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64), now() + interval '3 days', now() + interval '3 days 6 hours');"
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('45454545-4545-4545-8545-454545454545', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('type', 'swell_watch', 'schema_version', 'swell-watch-notification.v2', 'regional_event_id', '42424242-4242-4242-8242-424242424242', 'beach_id', '11111111-1111-4111-8111-111111111111', 'forecast_at', to_char('$release_second_run'::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')));" >/dev/null
psql_db -v ON_ERROR_STOP=1 -c "UPDATE public.notification_events SET payload = payload || jsonb_build_object('type', 'swell_watch', 'schema_version', 'swell-watch-notification.v2', 'beach_slug', 'fixture-beach', 'copy_context', jsonb_build_object('beach_timezone', 'UTC'), 'target_partition', jsonb_build_object('height_m', 1, 'period_s', 12, 'direction_deg', 150), 'arrival_at', to_char((now() + interval '3 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), 'peak_at', to_char((now() + interval '3 days 6 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), 'kind', 'v2', 'title', 'Swell incoming.', 'body', 'Productivity has been cancelled.') WHERE id = '45454545-4545-4545-8545-454545454545';" >/dev/null
expect_sqlstate "missing v2 regional identity" 23514 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('45454545-4545-4545-8545-454545454546', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('schema_version', 'swell-watch-notification.v2'));"
expect_sqlstate "null v2 regional identity" 23514 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('45454545-4545-4545-8545-454545454547', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('schema_version', 'swell-watch-notification.v2', 'regional_event_id', NULL));"
release_sql="SELECT allowed || ':' || reason_code FROM public.swell_watch_validate_notification_release('42424242-4242-4242-8242-424242424242', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (SELECT (payload ->> 'forecast_at')::timestamptz FROM public.notification_events WHERE id = '45454545-4545-4545-8545-454545454545'), '45454545-4545-4545-8545-454545454545')"
first_release=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $release_sql")
retry_release=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $release_sql")
if [ "$first_release" != "true:allowed" ] || [ "$retry_release" != "true:allowed" ]; then
  echo "same notification event did not retain a retry-safe release receipt: $first_release / $retry_release" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "UPDATE public.notification_events SET status = 'processed' WHERE id = '45454545-4545-4545-8545-454545454545';" >/dev/null
expect_sqlstate "terminal v2 re-enqueue" 23505 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) SELECT '46464646-4646-4646-8646-464646464646', recipient_user_id, type, payload FROM public.notification_events WHERE id = '45454545-4545-4545-8545-454545454545';"
if [ "$(psql_db -Atq -c "SELECT count(*) FROM public.notification_events WHERE recipient_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND type = 'swell_watch' AND payload ->> 'schema_version' = 'swell-watch-notification.v2' AND (payload ->> 'regional_event_id')::uuid = '42424242-4242-4242-8242-424242424242'::uuid")" != "1" ]; then
  echo "terminal v2 re-enqueue created a second event" >&2
  exit 1
fi
enqueue_concurrent_v2() {
  local event_id="$1" error_file="$2"
  psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('$event_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('schema_version', 'swell-watch-notification.v2', 'regional_event_id', '52525252-5252-4252-8252-525252525252'));" >/dev/null 2>"$error_file"
}
enqueue_one_error="$scratch_dir/concurrent-one.err"
enqueue_two_error="$scratch_dir/concurrent-two.err"
enqueue_concurrent_v2 '56565656-5656-4656-8656-565656565656' "$enqueue_one_error" &
enqueue_one_pid=$!
enqueue_concurrent_v2 '57575757-5757-4757-8757-575757575757' "$enqueue_two_error" &
enqueue_two_pid=$!
if wait "$enqueue_one_pid"; then enqueue_one_status=0; else enqueue_one_status=$?; fi
if wait "$enqueue_two_pid"; then enqueue_two_status=0; else enqueue_two_status=$?; fi
enqueue_one_error_text="$(head -c 4096 "$enqueue_one_error")"
enqueue_two_error_text="$(head -c 4096 "$enqueue_two_error")"
enqueue_success_count=0
enqueue_duplicate_count=0
for outcome in "$enqueue_one_status:$enqueue_one_error_text" "$enqueue_two_status:$enqueue_two_error_text"; do
  case "$outcome" in
    0:*) enqueue_success_count=$((enqueue_success_count + 1)) ;;
    *23505*) enqueue_duplicate_count=$((enqueue_duplicate_count + 1)) ;;
  esac
done
if [ "$enqueue_success_count" != "1" ] || [ "$enqueue_duplicate_count" != "1" ] || [ "$(psql_db -Atq -c "SELECT count(*) FROM public.notification_events WHERE recipient_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND type = 'swell_watch' AND payload ->> 'schema_version' = 'swell-watch-notification.v2' AND (payload ->> 'regional_event_id')::uuid = '52525252-5252-4252-8252-525252525252'::uuid")" != "1" ]; then
  echo "concurrent v2 enqueue did not leave exactly one event" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('62626262-6262-4262-8262-626262626262', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('schema_version', 'swell-watch-notification.v2', 'regional_event_id', 'abcdefab-cdef-4abc-8def-abcdefabcdef'));" >/dev/null
expect_sqlstate "v2 UUID case re-enqueue" 23505 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('63636363-6363-4363-8363-636363636363', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('schema_version', 'swell-watch-notification.v2', 'regional_event_id', 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF'));"
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('64646464-6464-4464-8464-646464646464', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('regional_event_id', 'abcdefab-cdef-4abc-8def-abcdefabcdef')), ('65656565-6565-4565-8565-656565656565', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('regional_event_id', 'abcdefab-cdef-4abc-8def-abcdefabcdef')), ('66666666-6666-4666-8666-666666666666', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'like', '{}'::jsonb), ('67676767-6767-4767-8767-676767676767', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'like', '{}'::jsonb);" >/dev/null
if [ "$(psql_db -Atq -c "SELECT count(*) FROM public.notification_events WHERE id IN ('64646464-6464-4464-8464-646464646464', '65656565-6565-4565-8565-656565656565', '66666666-6666-4666-8666-666666666666', '67676767-6767-4767-8767-676767676767')")" != "4" ]; then
  echo "v2 permanent dedupe affected v1 or non-Swell queue rows" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users (id) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'); INSERT INTO public.profiles (id) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'); INSERT INTO public.favorite_beaches (user_id, beach_id, custom_spot_id, alerts_enabled) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', NULL, true); INSERT INTO public.user_devices (user_id, retired_at) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL);" >/dev/null
ownerless_claim=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.claim_swell_watch_recipient_announcement('58585858-5858-4858-8858-585858585858', '42424242-4242-4242-8242-424242424242', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')" | tail -n 1)
if [ "$ownerless_claim" != "t" ]; then
  echo "fixture could not create historical ownerless announcement" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) SELECT '59595959-5959-4959-8959-595959595959', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', type, payload FROM public.notification_events WHERE id = '45454545-4545-4545-8545-454545454545';" >/dev/null
ownerless_release=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT allowed || ':' || reason_code FROM public.swell_watch_validate_notification_release('42424242-4242-4242-8242-424242424242', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', (SELECT (payload ->> 'forecast_at')::timestamptz FROM public.notification_events WHERE id = '59595959-5959-4959-8959-595959595959'), '59595959-5959-4959-8959-595959595959')")
if [ "$ownerless_release" != "false:recipient_deduplicated" ] || [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE recipient_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND notification_event_id IS NULL")" != "1" ]; then
  echo "historical ownerless announcement was not safely suppressed" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users (id) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'); INSERT INTO public.notification_events (id, recipient_user_id, type, payload) SELECT '60606060-6060-4060-8060-606060606060', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', type, payload FROM public.notification_events WHERE id = '45454545-4545-4545-8545-454545454545';" >/dev/null
expect_sqlstate "failed v2 enqueue" 23505 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) SELECT '61616161-6161-4161-8161-616161616161', recipient_user_id, type, payload FROM public.notification_events WHERE id = '60606060-6060-4060-8060-606060606060';"
if [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE regional_event_id = '42424242-4242-4242-8242-424242424242' AND recipient_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'")" != "0" ]; then
  echo "failed enqueue consumed a swell-watch receipt" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('47474747-4747-4747-8747-474747474747', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('regional_event_id', '42424242-4242-4242-8242-424242424242', 'beach_id', '11111111-1111-4111-8111-111111111111', 'forecast_at', to_char((now() - interval '2 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')));" >/dev/null
policy_stale_release=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT allowed || ':' || reason_code FROM public.swell_watch_validate_notification_release('42424242-4242-4242-8242-424242424242', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (SELECT (payload ->> 'forecast_at')::timestamptz FROM public.notification_events WHERE id = '47474747-4747-4747-8747-474747474747'), '47474747-4747-4747-8747-474747474747')")
if [ "$policy_stale_release" != "false:forecast_stale" ]; then
  echo "reviewed staleness policy did not govern release freshness: $policy_stale_release" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('46464646-4646-4646-8646-464646464646', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'swell_watch', jsonb_build_object('regional_event_id', '42424242-4242-4242-8242-424242424242', 'beach_id', '11111111-1111-4111-8111-111111111111', 'forecast_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')));" >/dev/null
competing_release=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT allowed || ':' || reason_code FROM public.swell_watch_validate_notification_release('42424242-4242-4242-8242-424242424242', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (SELECT (payload ->> 'forecast_at')::timestamptz FROM public.notification_events WHERE id = '46464646-4646-4646-8646-464646464646'), '46464646-4646-4646-8646-464646464646')")
if [ "$competing_release" != "false:recipient_deduplicated" ]; then
  echo "competing notification event acquired an existing receipt: $competing_release" >&2
  exit 1
fi
provider_replay=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT held || ':' || reason_code FROM public.swell_watch_record_provider_delivery_outcome('45454545-4545-4545-8545-454545454545', 1, 1, 0)")
provider_replay_again=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT held || ':' || reason_code FROM public.swell_watch_record_provider_delivery_outcome('45454545-4545-4545-8545-454545454545', 1, 1, 0)")
if [ "$provider_replay" != "false:allowed" ] || [ "$provider_replay_again" != "$provider_replay" ]; then
  echo "exact provider outcome replay was not idempotent: $provider_replay / $provider_replay_again" >&2
  exit 1
fi
expect_sqlstate "conflicting provider outcome replay" 23505 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT * FROM public.swell_watch_record_provider_delivery_outcome('45454545-4545-4545-8545-454545454545', 1, 2, 0)"
provider_hold=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT held || ':' || reason_code FROM public.swell_watch_record_provider_delivery_outcome('45454545-4545-4545-8545-454545454545', 2, 20, 2)")
if [ "$provider_hold" != "true:provider_failure_rate" ] || [ "$(psql_db -Atq -c "SELECT actor_kind || ':' || system_actor FROM public.swell_watch_automation_control_transitions ORDER BY epoch DESC LIMIT 1")" != "system:swell_watch_provider_monitor" ]; then
  echo "provider failure window did not persist an authenticated system hold: $provider_hold" >&2
  exit 1
fi
reset_after_failure=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch FROM public.transition_swell_watch_automation_control('reset_shadow', 4, 'operator_reset', 'swell-watch-control-6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
rearmed_after_failure=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch FROM public.transition_swell_watch_automation_control('arm', 5, 'operator_arm', 'swell-watch-control-7', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
if [ "$reset_after_failure" != "shadow:5" ] || [ "$rearmed_after_failure" != "armed:6" ]; then
  echo "provider hold did not require explicit audited reset and arm" >&2
  exit 1
fi
stale_binding=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $release_sql")
if [ "$stale_binding" != "false:notification_binding_mismatch" ]; then
  echo "control reset after queue did not invalidate notification binding: $stale_binding" >&2
  exit 1
fi

psql_db -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users (id) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'); INSERT INTO public.profiles (id) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'); INSERT INTO public.favorite_beaches (user_id, beach_id, custom_spot_id, alerts_enabled) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', NULL, true); INSERT INTO public.user_devices (user_id, retired_at) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL); INSERT INTO public.notification_events (id, recipient_user_id, type, payload) VALUES ('48484848-4848-4848-8848-484848484848', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'swell_watch', jsonb_build_object('regional_event_id', '42424242-4242-4242-8242-424242424242', 'beach_id', '11111111-1111-4111-8111-111111111111', 'forecast_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')));" >/dev/null
psql_db -v ON_ERROR_STOP=1 -c "SELECT set_config('app.swell_watch_internal_write', 'on', false); INSERT INTO public.swell_watch_production_approval_authority (record_id, authority_id, authority_epoch, state, revokes_authority_id, policy_hash, policy_provenance, policy_values, approval_id, approval_evidence_hash, production_scope, reviewer, not_before, expires_at) VALUES ('adadadad-adad-4dad-8dad-adadadadadad', 'acacacac-acac-4cac-8cac-acacacacacac', 2, 'active', NULL, repeat('a', 64), 'production_approved', '{\"volume_caps\":{\"maximum_candidates_per_region\":50,\"maximum_recipients_per_event\":1000,\"maximum_projected_sends_per_window\":1000,\"projected_send_window_hours\":24},\"provider_failure_hold\":{\"window_minutes\":60,\"maximum_failure_rate\":0.05,\"minimum_samples\":20},\"staleness\":{\"maximum_forecast_age_hours\":1},\"partition_matching\":{\"maximum_direction_delta_deg\":30,\"maximum_period_delta_s\":3,\"maximum_arrival_delta_hours\":12},\"stability\":{\"minimum_genuine_evaluations\":2}}'::jsonb, 'fixture-approval-two', repeat('c', 64), 'swell_watch_push', 'fixture-reviewer', now() - interval '1 hour', now() + interval '1 hour');" >/dev/null
reused_authority_release=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT allowed || ':' || reason_code FROM public.swell_watch_validate_notification_release('42424242-4242-4242-8242-424242424242', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (SELECT (payload ->> 'forecast_at')::timestamptz FROM public.notification_events WHERE id = '48484848-4848-4848-8848-484848484848'), '48484848-4848-4848-8848-484848484848')")
if [ "$reused_authority_release" != "false:notification_binding_mismatch" ]; then
  echo "reused authority id at a new epoch released an older queued event: $reused_authority_release" >&2
  exit 1
fi

psql_db -v ON_ERROR_STOP=1 -c "SELECT set_config('app.swell_watch_internal_write', 'on', false); INSERT INTO public.swell_watch_production_approval_authority (record_id, authority_id, authority_epoch, state, revokes_authority_id, policy_hash, policy_provenance, policy_values, approval_id, approval_evidence_hash, production_scope, reviewer, not_before, expires_at) VALUES ('aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae', 'afafafaf-afaf-4faf-8faf-afafafafafaf', 3, 'active', NULL, repeat('a', 64), 'production_approved', '{\"volume_caps\":{\"maximum_candidates_per_region\":50,\"maximum_recipients_per_event\":1000,\"maximum_projected_sends_per_window\":1000,\"projected_send_window_hours\":24},\"provider_failure_hold\":{\"window_minutes\":60,\"maximum_failure_rate\":0.05,\"minimum_samples\":20},\"staleness\":{\"maximum_forecast_age_hours\":1},\"partition_matching\":{\"maximum_direction_delta_deg\":30,\"maximum_period_delta_s\":3,\"maximum_arrival_delta_hours\":12},\"stability\":{\"minimum_genuine_evaluations\":2}}'::jsonb, 'fixture-expired', repeat('c', 64), 'swell_watch_push', 'fixture-reviewer', now() - interval '2 hours', now() - interval '1 hour');" >/dev/null
expired_provider=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT held || ':' || reason_code FROM public.swell_watch_record_provider_delivery_outcome('45454545-4545-4545-8545-454545454545', 2, 1, 0)")
if [ "$expired_provider" != "false:authority_unavailable" ]; then
  echo "provider monitor fell back from the newest expired authority: $expired_provider" >&2
  exit 1
fi
held_for_authority_test=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch FROM public.transition_swell_watch_automation_control('hold', 6, 'operator_hold', 'swell-watch-control-8', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
shadow_for_authority_test=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT state || ':' || epoch FROM public.transition_swell_watch_automation_control('reset_shadow', 7, 'operator_reset', 'swell-watch-control-9', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')")
if [ "$held_for_authority_test" != "held:7" ] || [ "$shadow_for_authority_test" != "shadow:8" ]; then
  echo "could not prepare newest-authority arm tests: $held_for_authority_test / $shadow_for_authority_test" >&2
  exit 1
fi
expect_sqlstate "newest expired authority blocks arm" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT * FROM public.transition_swell_watch_automation_control('arm', 8, 'operator_arm', 'swell-watch-control-10', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"
psql_db -v ON_ERROR_STOP=1 -c "SELECT set_config('app.swell_watch_internal_write', 'on', false); INSERT INTO public.swell_watch_production_approval_authority (record_id, authority_id, authority_epoch, state, revokes_authority_id, policy_hash, policy_provenance, policy_values, approval_id, approval_evidence_hash, production_scope, reviewer, not_before, expires_at) VALUES ('bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc', 'bdbdbdbd-bdbd-4dbd-8dbd-bdbdbdbdbdbd', 4, 'active', NULL, repeat('a', 64), 'production_approved', '{\"volume_caps\":{\"maximum_candidates_per_region\":50,\"maximum_recipients_per_event\":1000,\"maximum_projected_sends_per_window\":1000,\"projected_send_window_hours\":24},\"provider_failure_hold\":{\"window_minutes\":60,\"maximum_failure_rate\":0.05,\"minimum_samples\":20},\"staleness\":{\"maximum_forecast_age_hours\":1},\"partition_matching\":{\"maximum_direction_delta_deg\":30,\"maximum_period_delta_s\":3,\"maximum_arrival_delta_hours\":12},\"stability\":{\"minimum_genuine_evaluations\":2}}'::jsonb, 'fixture-revoked', repeat('c', 64), 'swell_watch_push', 'fixture-reviewer', now() - interval '1 hour', now() + interval '1 hour'), ('bebebebe-bebe-4ebe-8ebe-bebebebebebe', 'bfbfbfbf-bfbf-4fbf-8fbf-bfbfbfbfbfbf', 5, 'revoked', 'bdbdbdbd-bdbd-4dbd-8dbd-bdbdbdbdbdbd', repeat('a', 64), 'production_approved', '{\"volume_caps\":{\"maximum_candidates_per_region\":50,\"maximum_recipients_per_event\":1000,\"maximum_projected_sends_per_window\":1000,\"projected_send_window_hours\":24},\"provider_failure_hold\":{\"window_minutes\":60,\"maximum_failure_rate\":0.05,\"minimum_samples\":20},\"staleness\":{\"maximum_forecast_age_hours\":1},\"partition_matching\":{\"maximum_direction_delta_deg\":30,\"maximum_period_delta_s\":3,\"maximum_arrival_delta_hours\":12},\"stability\":{\"minimum_genuine_evaluations\":2}}'::jsonb, 'fixture-revocation', repeat('c', 64), 'swell_watch_push', 'fixture-reviewer', now() - interval '1 hour', now() + interval '1 hour');" >/dev/null
expect_sqlstate "newest revoked authority blocks arm" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT * FROM public.transition_swell_watch_automation_control('arm', 8, 'operator_arm', 'swell-watch-control-11', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"

run_service_file "$root/__tests__/fixtures/swell-watch-event-pipeline-probe.sql"

expect_sqlstate "owner append-only update" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "UPDATE public.swell_watch_regional_events SET region_key = 'changed' WHERE id = '55555555-5555-4555-8555-555555555555'"
expect_sqlstate "stale expected version" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT public.append_swell_watch_state_transition(gen_random_uuid(), '55555555-5555-4555-8555-555555555555', 1, 'candidate', 'synthetic_fixture:two')"
expect_sqlstate "arbitrary stable transition" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT public.append_swell_watch_state_transition(gen_random_uuid(), '55555555-5555-4555-8555-555555555555', 2, 'stable', 'synthetic_fixture:two')"
expect_sqlstate "conflicting observation retry" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT public.ingest_swell_watch_evaluation(gen_random_uuid(), gen_random_uuid(), '55555555-5555-4555-8555-555555555555', 'synthetic_fixture:one', '11111111-1111-4111-8111-111111111111', 'southern-california', 'pacific-swell', 'noaa', '2026-09-03T12:00:00Z', 's2', 2, 13, 170, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64), 'synthetic_fixture', '2026-09-06T12:00:00Z', '2026-09-06T18:00:00Z')"
expect_sqlstate "conflicting evaluation retry" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT public.advance_swell_watch_event('55555555-5555-4555-8555-555555555555', 'synthetic_fixture:three', '16161616-1616-4161-8161-161616161616', '2026-09-06T15:00:00Z', '2026-09-06T20:00:00Z', gen_random_uuid())"

psql_db -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_swell_watch_evaluation('32323232-3232-4232-8232-323232323232', '33333333-3333-4333-8333-333333333334', '55555555-5555-4555-8555-555555555555', 'synthetic_fixture:race', '11111111-1111-4111-8111-111111111111', 'southern-california', 'race-component', 'noaa', '2026-09-04T15:00:00Z', 's1', 1, 12, 150, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64), 'synthetic_fixture', '2026-09-08T12:00:00Z', '2026-09-08T18:00:00Z')" >/dev/null 2>&1 &
advance_race_pid=$!
psql_db -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.append_swell_watch_state_transition('13131313-1313-4131-8131-131313131313', '55555555-5555-4555-8555-555555555555', 2, 'suppressed', 'synthetic_fixture:two')" >/dev/null 2>&1 &
suppress_race_pid=$!
if wait "$advance_race_pid"; then advance_status=0; else advance_status=$?; fi
if wait "$suppress_race_pid"; then suppress_status=0; else suppress_status=$?; fi
if [ "$advance_status" -ne 0 ]; then
  echo "advance race failed" >&2
  exit 1
fi
race_state=$(psql_db -Atq -c "SELECT state FROM public.swell_watch_event_state_transitions WHERE regional_event_id = '55555555-5555-4555-8555-555555555555' ORDER BY version DESC LIMIT 1")
race_version=$(psql_db -Atq -c "SELECT max(version) FROM public.swell_watch_event_state_transitions WHERE regional_event_id = '55555555-5555-4555-8555-555555555555'")
if [ "$race_version" != "3" ]; then
  echo "race produced unexpected transition version: $race_version" >&2
  exit 1
fi
if [ "$race_state" = "stable" ]; then
  if [ "$suppress_status" -eq 0 ]; then
    echo "suppression CAS unexpectedly succeeded after stable advance" >&2
    exit 1
  fi
  expect_sqlstate "stale suppression CAS" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT public.append_swell_watch_state_transition(gen_random_uuid(), '55555555-5555-4555-8555-555555555555', 2, 'suppressed', 'synthetic_fixture:two')"
  psql_db -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.append_swell_watch_state_transition(gen_random_uuid(), '55555555-5555-4555-8555-555555555555', 3, 'suppressed', 'synthetic_fixture:two')" >/dev/null
elif [ "$race_state" = "suppressed" ]; then
  if [ "$suppress_status" -ne 0 ]; then
    echo "suppression race failed without a stable winner" >&2
    exit 1
  fi
else
  echo "race ended in unexpected state: $race_state" >&2
  exit 1
fi
suppressed_version=$(psql_db -Atq -c "SELECT max(version) FROM public.swell_watch_event_state_transitions WHERE regional_event_id = '55555555-5555-4555-8555-555555555555'")

for replay in 1 2; do
  replay_result=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.advance_swell_watch_event('55555555-5555-4555-8555-555555555555', 'synthetic_fixture:three', '16161616-1616-4161-8161-161616161616', '2026-09-06T14:00:00Z', '2026-09-06T20:00:00Z', gen_random_uuid())")
  if [[ "$replay_result" != *"candidate"* ]]; then
    echo "suppressed replay unexpectedly restored stability: $replay_result" >&2
    exit 1
  fi
done
if [ "$(psql_db -Atq -c "SELECT max(version) FROM public.swell_watch_event_state_transitions WHERE regional_event_id = '55555555-5555-4555-8555-555555555555'")" != "$suppressed_version" ]; then
  echo "replay mutated a committed suppression" >&2
  exit 1
fi

concurrent_ingest() {
  local event_id="$1" observation_id="$2" impact_id="$3"
  psql_db -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_swell_watch_evaluation('$observation_id', '$impact_id', '$event_id', 'synthetic_fixture:concurrent', '11111111-1111-4111-8111-111111111111', 'southern-california', 'concurrent-component', 'noaa', '2026-09-04T18:00:00Z', 's1', 1, 12, 150, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64), 'synthetic_fixture', '2026-09-08T12:00:00Z', '2026-09-08T18:00:00Z')" >/dev/null
}
concurrent_ingest '26262626-2626-4262-8262-262626262626' '27272727-2727-4272-8272-272727272727' '28282828-2828-4282-8282-282828282828' &
retry_one_pid=$!
concurrent_ingest '29292929-2929-4292-8292-292929292929' '30303030-3030-4030-8030-303030303030' '31313131-3131-4131-8131-313131313131' &
retry_two_pid=$!
if wait "$retry_one_pid"; then retry_one_status=0; else retry_one_status=$?; fi
if wait "$retry_two_pid"; then retry_two_status=0; else retry_two_status=$?; fi
if [ "$retry_one_status" -ne 0 ] || [ "$retry_two_status" -ne 0 ]; then
  echo "concurrent exact retry failed" >&2
  exit 1
fi
if [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_event_evaluations WHERE evaluation_id = 'synthetic_fixture:concurrent'")" != "1" ] || [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_observations WHERE evaluation_id = 'synthetic_fixture:concurrent'")" != "1" ]; then
  echo "concurrent exact retry created duplicate evidence" >&2
  exit 1
fi
if [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_regional_events WHERE id IN ('26262626-2626-4262-8262-262626262626', '29292929-2929-4292-8292-292929292929')")" != "1" ]; then
  echo "concurrent exact retry created an orphan regional event" >&2
  exit 1
fi

psql_db -v ON_ERROR_STOP=1 -c "CREATE FUNCTION public.swell_watch_test_delay_regional_insert() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN PERFORM pg_sleep(0.25); RETURN NEW; END; \$\$; CREATE TRIGGER swell_watch_test_delay_regional_insert BEFORE INSERT ON public.swell_watch_regional_events FOR EACH ROW EXECUTE FUNCTION public.swell_watch_test_delay_regional_insert();" >/dev/null
concurrent_new_event_ingest() {
  local evaluation_id="$1" observation_id="$2" impact_id="$3" source_point_id="$4" source_slot="$5" physical_key="$6"
  psql_db -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.ingest_swell_watch_evaluation('$observation_id', '$impact_id', '34343434-3434-4434-8434-343434343434', '$evaluation_id', '$source_point_id', 'southern-california', '$physical_key', 'noaa', '2026-09-05T00:00:00Z', '$source_slot', 1, 12, 150, 2, 'fixture-policy', repeat('a', 64), repeat('b', 64), 'synthetic_fixture', '2026-09-10T12:00:00Z', '2026-09-10T18:00:00Z')" >/dev/null
}
concurrent_new_event_ingest 'synthetic_fixture:shared-new-one' '35353535-3535-4535-8535-353535353535' '36363636-3636-4636-8636-363636363636' '11111111-1111-4111-8111-111111111111' 's1' 'shared-component-one' &
new_event_one_pid=$!
concurrent_new_event_ingest 'synthetic_fixture:shared-new-two' '37373737-3737-4737-8737-373737373737' '38383838-3838-4838-8838-383838383838' '22222222-2222-4222-8222-222222222222' 's2' 'shared-component-two' &
new_event_two_pid=$!
if wait "$new_event_one_pid"; then new_event_one_status=0; else new_event_one_status=$?; fi
if wait "$new_event_two_pid"; then new_event_two_status=0; else new_event_two_status=$?; fi
if [ "$new_event_one_status" -ne 0 ] || [ "$new_event_two_status" -ne 0 ]; then
  echo "concurrent distinct observations for one new event did not both succeed" >&2
  exit 1
fi
if [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_regional_events WHERE id = '34343434-3434-4434-8434-343434343434'")" != "1" ] || [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_observations WHERE evaluation_id IN ('synthetic_fixture:shared-new-one', 'synthetic_fixture:shared-new-two')")" != "2" ] || [ "$(psql_db -Atq -c "SELECT count(*) FROM public.swell_watch_event_evaluations WHERE regional_event_id = '34343434-3434-4434-8434-343434343434'")" != "2" ]; then
  echo "concurrent distinct observations did not retain one event with both evidence rows" >&2
  exit 1
fi
psql_db -v ON_ERROR_STOP=1 -c "DROP TRIGGER swell_watch_test_delay_regional_insert ON public.swell_watch_regional_events; DROP FUNCTION public.swell_watch_test_delay_regional_insert();" >/dev/null

nonfinite_before=$(psql_db -Atq -c "SELECT count(*) || ':' || (SELECT count(*) FROM public.swell_watch_beach_impacts) || ':' || (SELECT count(*) FROM public.swell_watch_regional_events) || ':' || (SELECT count(*) FROM public.swell_watch_event_evaluations) || ':' || (SELECT count(*) FROM public.swell_watch_event_aliases) FROM public.swell_watch_observations")
expect_nonfinite() {
  local field="$1" label="$2" value="$3" height="1" period="12" projected="2"
  case "$field" in
    height) height="$value" ;;
    period) period="$value" ;;
    projected) projected="$value" ;;
    *) echo "unknown non-finite field: $field" >&2; exit 1 ;;
  esac
  expect_sqlstate "non-finite $field $label" P0001 psql_db -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "SET ROLE service_role; SELECT public.ingest_swell_watch_evaluation(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'synthetic_fixture:nonfinite-${field}-${label}', '11111111-1111-4111-8111-111111111111', 'southern-california', 'nonfinite-$field', 'noaa', '2026-09-05T03:00:00Z', 's1', $height, $period, 150, $projected, 'fixture-policy', repeat('a', 64), repeat('b', 64), 'synthetic_fixture', '2026-09-10T12:00:00Z', '2026-09-10T18:00:00Z')"
}
for nonfinite_case in "nan|'NaN'::numeric" "positive-infinity|'Infinity'::numeric" "negative-infinity|'-Infinity'::numeric"; do
  nonfinite_label="${nonfinite_case%%|*}"
  nonfinite_value="${nonfinite_case#*|}"
  expect_nonfinite height "$nonfinite_label" "$nonfinite_value"
  expect_nonfinite period "$nonfinite_label" "$nonfinite_value"
  expect_nonfinite projected "$nonfinite_label" "$nonfinite_value"
done
if [ "$(psql_db -Atq -c "SELECT count(*) || ':' || (SELECT count(*) FROM public.swell_watch_beach_impacts) || ':' || (SELECT count(*) FROM public.swell_watch_regional_events) || ':' || (SELECT count(*) FROM public.swell_watch_event_evaluations) || ':' || (SELECT count(*) FROM public.swell_watch_event_aliases) FROM public.swell_watch_observations")" != "$nonfinite_before" ]; then
  echo "non-finite evaluation input persisted swell-watch records" >&2
  exit 1
fi

first_claim=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.claim_swell_watch_recipient_announcement('ffffffff-ffff-4fff-8fff-ffffffffffff', '55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" | tail -n 1)
second_claim=$(psql_db -Atq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.claim_swell_watch_recipient_announcement('12121212-1212-4121-8121-121212121212', '55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" | tail -n 1)
if [ "$first_claim" != "t" ] || [ "$second_claim" != "f" ]; then
  echo "recipient claim idempotence output was unexpected" >&2
  exit 1
fi

echo "swell watch disposable Postgres fixture: PASS"
