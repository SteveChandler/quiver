#!/usr/bin/env bash
# Disposable PostgreSQL 15 only; no environment files or production connections.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
container="swell-watch-epoch7-test-$$"
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=disposable postgres:15 >/dev/null
deadline=$((SECONDS + 30))
until docker exec "$container" sh -c 'test "$(head -n 1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)" = 1 && pg_isready -U postgres -d postgres' >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Disposable PostgreSQL startup failed' >&2; exit 1; fi
  sleep 0.1
done
database=postgres
run_file() { # prints the database error, never the NOTICE/WARNING noise of the reviewed migrations
  local output
  if ! output=$(docker exec -i "$container" psql -X -U postgres -d "$database" -v ON_ERROR_STOP=1 -q -f - < "$1" 2>&1); then
    printf '%s\n' "$output" | grep -v '^NOTICE\|^WARNING\|^HINT\|^QUERY\|^LINE\|^ *\^' >&2 || true
    return 1
  fi
}
run_file_loud() { run_file "$@"; }
query() { docker exec "$container" psql -X -U postgres -d "$database" -v ON_ERROR_STOP=1 -Atqc "$1"; }
expect_failure() { # <message fragment> <file>
  local output
  if output=$(docker exec -i "$container" psql -X -U postgres -d "$database" -v ON_ERROR_STOP=1 -q -f - < "$2" 2>&1); then
    echo "Unexpected success: $2" >&2; exit 1
  fi
  [[ "$output" == *"$1"* ]] || { echo "Expected '$1' from $2, got: $output" >&2; exit 1; }
}
assert_eq() { [ "$1" = "$2" ] || { echo "Assertion failed: $3 (got '$1', expected '$2')" >&2; exit 1; }; }
authorities() { query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a'; }
policies() { query 'SELECT jsonb_agg(to_jsonb(p) ORDER BY epoch)::text FROM public.swell_watch_evaluation_policies p'; }
health() { query "SELECT public.read_swell_watch_study_health()->>'$1'"; }

migrations=(
  20260824120000_create_swell_watch_event_pipeline 20260824130000_create_swell_watch_production_approval_authority
  20260904120001_add_swell_watch_v2_enqueue_dedupe 20260904140000_create_swell_watch_provider_run_receipts
  20260905010000_add_swell_watch_owner_attestation 20260905020000_resolve_swell_watch_event_identity
  20260905030000_retain_swell_watch_unavailable_components 20260905040000_require_current_swell_watch_run_evidence
  20260905050000_read_attested_swell_watch_run 20260905060000_ingest_swell_watch_run_atomically
  20260905070000_read_swell_watch_delivery_health 20260905080000_read_swell_watch_run_scope
  20260905090000_ingest_swell_watch_cohort 20260906140000_add_swell_watch_collection_lease
  20260906150000_separate_swell_watch_evaluation_policy 20260906160000_record_swell_watch_shadow_demand
  20260910180000_automate_swell_watch_study)
run_file "$root/__tests__/fixtures/swell-watch-study-base.sql"
for migration in "${migrations[@]}"; do run_file "$root/supabase/migrations/$migration.sql"; done
normalization=("$root"/supabase/migrations/*_normalize_swell_watch_provider_direction.sql)
[ "${#normalization[@]}" -eq 1 ]
run_file "${normalization[0]}"
for migration in 20260914050000_amend_swell_watch_study_partition_coverage 20260914190000_amend_swell_watch_study_model_partition_count \
  20260916170000_amend_swell_watch_study_swell_system_count 20260918180000_harden_swell_watch_study_epochs_and_extend \
  20260924180000_isolate_swell_watch_feed_qualification; do
  run_file "$root/supabase/migrations/$migration.sql"
done
run_file "$root/__tests__/fixtures/swell-watch-study-activation.sql"
run_file "$root/__tests__/fixtures/swell-watch-epoch-6-state.sql"
assert_eq "$(health authorityEpoch)" 6 'fixture is at authority epoch 6'
assert_eq "$(health status)" active 'epoch 6 is active'
assert_eq "$(query 'SELECT max(epoch) FROM public.swell_watch_evaluation_policies')" 3 'fixture is at policy epoch 3'

activation="$root/docs/operations/swell-watch-study-activate-epoch-7.sql"
migration7="$root/supabase/migrations/20261004150000_add_swell_watch_trailing_baseline_read.sql"
rollback="$root/docs/operations/swell-watch-study-rollback-epoch-7.sql"
revoke="$root/docs/operations/swell-watch-study-revoke-epoch-7.sql"
signature='public.read_swell_watch_trailing_baseline(uuid,uuid,integer,integer)'

# Activation refuses to run before the reviewed migration is applied, and changes nothing.
before_authorities=$(authorities); before_policies=$(policies)
expect_failure 'reviewed trailing baseline migration required' "$activation"
assert_eq "$(authorities)" "$before_authorities" 'refused activation left authorities unchanged'
assert_eq "$(policies)" "$before_policies" 'refused activation left policies unchanged'
query 'CREATE DATABASE epoch6_premigration TEMPLATE postgres'

# The migration is additive: it pins its own post hash and redefines nothing else.
function_hashes() { query "SELECT md5(jsonb_object_agg(oid::regprocedure::text,encode(extensions.digest(pg_get_functiondef(oid),'sha256'),'hex'))::text) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname<>'read_swell_watch_trailing_baseline'"; }
hashes_before=$(function_hashes)
run_file_loud "$migration7"
assert_eq "$(function_hashes)" "$hashes_before" 'migration redefined an existing function'
pinned=$(sed -n "s/.*<>'\([0-9a-f]\{64\}\)'.*/\1/p" "$migration7" | head -n 1)
assert_eq "$(query "SELECT encode(extensions.digest(pg_get_functiondef('${signature}'::regprocedure),'sha256'),'hex')")" "$pinned" 'migration post hash pin'
assert_eq "$(query "SELECT (has_function_privilege('service_role','${signature}','EXECUTE'))::text||(has_function_privilege('anon','${signature}','EXECUTE'))::text||(has_function_privilege('authenticated','${signature}','EXECUTE'))::text||(has_function_privilege('public','${signature}','EXECUTE'))::text")" truefalsefalsefalse 'trailing baseline grants'
assert_eq "$(query "SELECT provolatile::text||prosecdef::text FROM pg_proc WHERE oid='${signature}'::regprocedure")" strue 'stable security definer'

# Trailing read semantics against real receipts, attestations and completions.
query 'CREATE DATABASE epoch7_trailing TEMPLATE postgres'
database=epoch7_trailing
run_file "$root/__tests__/fixtures/swell-watch-study-receipts.sql"
run_file "$root/__tests__/fixtures/swell-watch-epoch-7-trailing.sql"
p1=11111111-1111-4111-8111-111111111111
batch() { query "SELECT provider_batch_id FROM public.e7_runs WHERE k=$1"; }
frames() { query "SELECT jsonb_array_length(public.read_swell_watch_trailing_baseline('$(batch "$1")','$p1',$2,$3))"; }
sql_assert() { query "SELECT public.e7_assert($1,'$2')" >/dev/null; }
assert_eq "$(frames 8 48 12)" 48 'full trailing coverage'
sql_assert "(SELECT (f->>'forecastAt')::timestamptz=(SELECT run_utc FROM public.e7_runs WHERE k=8)-interval '48 hours' FROM jsonb_array_elements(public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)) f LIMIT 1)" 'window starts 48h before issuance'
sql_assert "(SELECT max((f->>'forecastAt')::timestamptz)=(SELECT run_utc FROM public.e7_runs WHERE k=8)-interval '1 hour' FROM jsonb_array_elements(public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)) f)" 'window ends one hour before issuance'
sql_assert "(SELECT bool_and(jsonb_array_length(f->'components')=2) FROM jsonb_array_elements(public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)) f)" 'both partitions per frame'
sql_assert "(SELECT (f#>>'{components,0,heightM}')::numeric=1.1 AND (f->>'runUtc')::timestamptz=(SELECT run_utc FROM public.e7_runs WHERE k=7) FROM jsonb_array_elements(public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)) f ORDER BY f->>'forecastAt' DESC LIMIT 1)" 'freshest prior issuance supplies the latest hour'
sql_assert "(SELECT (f#>>'{components,0,heightM}')::numeric=0.4 FROM jsonb_array_elements(public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)) f ORDER BY f->>'forecastAt' LIMIT 1)" 'oldest hour from the oldest issuance'
assert_eq "$(frames 8 48 6)" 48 'six hour lead cap is enough when every issuance exists'
assert_eq "$(frames 4 48 12)" 24 'later issuances never contribute'
assert_eq "$(query "SELECT public.read_swell_watch_trailing_baseline('$(batch 8)','33333333-3333-4333-8333-333333333333',48,12)::text")" '[]' 'unknown source point'
query "SELECT public.e7_error(\$q\$SELECT public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',5,12)\$q\$,'trailing baseline scope is required')" >/dev/null
query "SELECT public.e7_error(\$q\$SELECT public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,0)\$q\$,'trailing baseline scope is required')" >/dev/null
query "SELECT public.e7_error(\$q\$SELECT public.read_swell_watch_trailing_baseline(gen_random_uuid(),'$p1',48,12)\$q\$,'completed provider run is required')" >/dev/null
query "SET ROLE service_role; SELECT jsonb_array_length(public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12))" >/dev/null
query "SET ROLE anon; SELECT public.e7_error(\$q\$SELECT public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)\$q\$,'permission denied')" >/dev/null
# A rejected issuance is skipped; the next freshest one fills its hours while within the lead cap.
query "SELECT public.attest_swell_watch_provider_run(gen_random_uuid(),(SELECT revision_set_id FROM public.e7_runs WHERE k=6),'rejected','fixture',repeat('b',64),'fixture')" >/dev/null
assert_eq "$(frames 8 48 12)" 48 'a rejected issuance is bridged by the previous one'
sql_assert "(SELECT (f->>'runUtc')::timestamptz=(SELECT run_utc FROM public.e7_runs WHERE k=5) FROM jsonb_array_elements(public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)) f WHERE (f->>'forecastAt')::timestamptz=(SELECT run_utc FROM public.e7_runs WHERE k=8)-interval '7 hours')" 'rejected issuance replaced by the older issuance'
query "SELECT public.attest_swell_watch_provider_run(gen_random_uuid(),(SELECT revision_set_id FROM public.e7_runs WHERE k=5),'rejected','fixture',repeat('b',64),'fixture')" >/dev/null
assert_eq "$(frames 8 48 12)" 42 'two rejected issuances leave a six hour gap past the lead cap'
# The target itself must be current attested evidence.
query "SELECT public.attest_swell_watch_provider_run(gen_random_uuid(),(SELECT revision_set_id FROM public.e7_runs WHERE k=8),'revoked','fixture',repeat('b',64),'fixture',(SELECT attestation_id FROM public.e7_runs WHERE k=8))" >/dev/null
query "SELECT public.e7_error(\$q\$SELECT public.read_swell_watch_trailing_baseline('$(batch 8)','$p1',48,12)\$q\$,'current provider attestation is required')" >/dev/null
database=postgres

# Activation, exact retry, and health.
query 'CREATE DATABASE epoch7_activated TEMPLATE postgres'
database=epoch7_activated
prior_policies=$(query 'SELECT jsonb_agg(to_jsonb(p) ORDER BY epoch)::text FROM public.swell_watch_evaluation_policies p WHERE epoch<4')
prior_authorities=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a WHERE epoch<7')
run_file_loud "$activation"
run_file_loud "$activation"
after_policies=$(policies)
assert_eq "$(query 'SELECT jsonb_agg(to_jsonb(p) ORDER BY epoch)::text FROM public.swell_watch_evaluation_policies p WHERE epoch<4')" "$prior_policies" 'prior policy rows unchanged'
assert_eq "$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a WHERE epoch<7')" "$prior_authorities" 'prior authority rows unchanged'
authority_rows=$(authorities)
run_file_loud "$activation"
assert_eq "$(authorities)" "$authority_rows" 'activation retry changed authorities'
assert_eq "$(policies)" "$after_policies" 'activation retry changed policies'
assert_eq "$(query 'SELECT max(epoch) FROM public.swell_watch_study_authorities')" 7 'authority epoch 7'
assert_eq "$(query 'SELECT max(epoch) FROM public.swell_watch_evaluation_policies')" 4 'policy epoch 4'
assert_eq "$(query "SELECT policy_hash FROM public.swell_watch_evaluation_policies WHERE epoch=4")" "$(python3 -c 'import json; print(json.load(open("'"$root"'/docs/operations/swell-watch-no-send-producer-config-v3-proposed.json"))["policy"]["value_hash"])')" 'policy hash matches the proposed v3 config'
assert_eq "$(health status)" active 'health active after activation'
assert_eq "$(health authorityEpoch)" 7 'health epoch'
assert_eq "$(health cycleStartEpoch)" 7 'new study cycle starts at epoch 7'
assert_eq "$(health qualifyingDays)" 0 'no qualifying days carry over'
assert_eq "$(health targetDays)" 30 'target unchanged'
assert_eq "$(health policyHash)" "$(query 'SELECT policy_hash FROM public.swell_watch_evaluation_policies WHERE epoch=4')" 'health reports the epoch 7 policy hash'
assert_eq "$(query "SELECT (a.cohort=b.cohort AND a.scope_inputs=b.scope_inputs AND a.qualification_rule=b.qualification_rule AND a.expires_at=b.expires_at AND a.target_days=b.target_days AND a.provider_contract_ref=b.provider_contract_ref)::text FROM public.swell_watch_study_authorities a, public.swell_watch_study_authorities b WHERE a.epoch=7 AND b.epoch=6")" true 'epoch 7 keeps cohort, scope, rule, expiry and target'
assert_eq "$(query "SELECT public.swell_watch_study_cycle_start(6)")" 5 'epoch 5/6 cycle is unchanged and ends at 6'
assert_eq "$(query 'SELECT state FROM public.swell_watch_get_automation_control() LIMIT 1')" disabled 'sends stay disabled'
assert_eq "$(query 'SELECT count(*) FROM public.swell_watch_production_approval_authority')" 0 'no send authority created'
# Issuances accepted under epoch 6 stop being study-current after activation, yet still feed the trailing baseline.
query 'CREATE DATABASE epoch7_history TEMPLATE postgres'
database=epoch7_history
run_file "$root/__tests__/fixtures/swell-watch-study-receipts.sql"
run_file "$root/__tests__/fixtures/swell-watch-epoch-7-trailing.sql"
query "SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_study_acceptances(revision_set_id,authority_epoch,attestation_id,evidence_manifest) SELECT revision_set_id,6,attestation_id,'{}'::jsonb FROM public.e7_runs WHERE k IN (5,6,7)" >/dev/null
assert_eq "$(query "SELECT public.swell_watch_provider_evidence_is_current(provider_batch_id)::text FROM public.e7_runs WHERE k=7")" true 'epoch 6 acceptance is current under epoch 6'
run_file_loud "$activation"
assert_eq "$(query "SELECT public.swell_watch_provider_evidence_is_current(provider_batch_id)::text FROM public.e7_runs WHERE k=7")" false 'epoch 6 acceptance is not study-current under epoch 7'
assert_eq "$(frames 8 48 12)" 48 'trailing baseline survives the epoch change'
database=postgres

# Activation guards: exact epoch 6 and disabled sends.
query 'CREATE DATABASE epoch7_guard TEMPLATE epoch6_premigration'
database=epoch7_guard
run_file "$migration7"
query "SELECT set_config('app.swell_watch_internal_write','on',false); ALTER TABLE public.swell_watch_study_authorities DISABLE TRIGGER swell_watch_study_authority_guard; UPDATE public.swell_watch_study_authorities SET reviewer='tampered' WHERE epoch=6; ALTER TABLE public.swell_watch_study_authorities ENABLE TRIGGER swell_watch_study_authority_guard" >/dev/null
expect_failure 'exact reviewed epoch 6 study authority required' "$activation"
assert_eq "$(query 'SELECT max(epoch) FROM public.swell_watch_study_authorities')" 6 'refused activation left authority at epoch 6'
database=postgres

# Revocation stops the study; health reports blocked; retry is exact.
query 'CREATE DATABASE epoch7_revoked TEMPLATE epoch7_activated'
database=epoch7_revoked
run_file_loud "$revoke"
run_file_loud "$revoke"
assert_eq "$(query 'SELECT epoch||state FROM public.swell_watch_study_authorities WHERE epoch=(SELECT max(epoch) FROM public.swell_watch_study_authorities)')" 8revoked 'epoch 8 revoked'
assert_eq "$(health status)" blocked 'health blocked after revocation'
database=postgres

# Rollback restores the epoch 6 detector from epoch 7, and from a revoked epoch 8.
for start in direct after_revoke; do
  query "CREATE DATABASE epoch7_rollback_$start TEMPLATE epoch7_activated"
  database="epoch7_rollback_$start"
  [ "$start" = after_revoke ] && run_file_loud "$revoke"
  run_file_loud "$rollback"
  run_file_loud "$rollback"
  expected_epoch=8; [ "$start" = after_revoke ] && expected_epoch=9
  assert_eq "$(query 'SELECT max(epoch) FROM public.swell_watch_study_authorities')" "$expected_epoch" "rollback authority epoch ($start)"
  assert_eq "$(query 'SELECT max(epoch) FROM public.swell_watch_evaluation_policies')" 5 "rollback policy epoch ($start)"
  assert_eq "$(health status)" active "health active after rollback ($start)"
  assert_eq "$(health policyHash)" 86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f "rollback restores the epoch 6 policy hash ($start)"
  assert_eq "$(health cycleStartEpoch)" "$expected_epoch" "rollback starts a new cycle ($start)"
  assert_eq "$(query "SELECT (a.cohort=b.cohort AND a.scope_inputs=b.scope_inputs AND a.qualification_rule=b.qualification_rule AND a.expires_at=b.expires_at)::text FROM public.swell_watch_study_authorities a, public.swell_watch_study_authorities b WHERE a.epoch=$expected_epoch AND b.epoch=6")" true "rollback reuses the epoch 6 scope ($start)"
  assert_eq "$(query 'SELECT policy_values=(SELECT policy_values FROM public.swell_watch_evaluation_policies WHERE epoch=3) FROM public.swell_watch_evaluation_policies WHERE epoch=5')" t "rollback policy values equal epoch 3 ($start)"
  database=postgres
done
# Rollback refuses an unexpected ledger.
expect_failure 'exact reviewed epoch 6 and epoch 7 study authorities required' "$rollback"
echo 'Swell Watch epoch 7 PostgreSQL checks passed'
