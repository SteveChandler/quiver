#!/usr/bin/env bash
# Disposable PostgreSQL 15 only; no environment files or production connections.
# Verifies the sub-floor tracking migration, its rollback, the record-function gate, and the two activation scripts.
set -euo pipefail
study_root="$(cd "$(dirname "$0")/.." && pwd)"
study_container="swell-watch-tracking-test-$$"
trap 'docker rm -fv "$study_container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$study_container" -e POSTGRES_PASSWORD=disposable postgres:15 >/dev/null
deadline=$((SECONDS + 30))
until docker exec "$study_container" sh -c 'test "$(head -n 1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)" = 1 && pg_isready -U postgres -d postgres' >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Disposable PostgreSQL startup failed' >&2; exit 1; fi
  sleep 0.1
done
study_database=postgres
run_file() { docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - < "$1" >/dev/null; }
query() { docker exec "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -Atqc "$1"; }
function_hash() { query "SELECT encode(extensions.digest(pg_get_functiondef('public.$1'::regprocedure),'sha256'),'hex')"; }
expect_hash() { [ "$(function_hash "$1")" = "$2" ] || { echo "Unexpected definition hash for $1" >&2; exit 1; }; }
# The activation scripts are inert until the approval sentence is filled in; tests fill it with a fixture sentence.
filled() { sed 's|<<FILL AT APPROVAL: "Steven Chandler approved on YYYY-MM-DD ...">>|Steven Chandler approved on 2026-10-04 (disposable fixture)|' "$1"; }
run_filled() { filled "$1" | docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - >/dev/null; }
admin() { docker exec "$study_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "$1"; }
fail_with() { # expected message, command...
  local expected=$1; shift
  local output
  if output=$("$@" 2>&1); then echo "Expected failure containing: $expected" >&2; exit 1; fi
  [[ "$output" == *"$expected"* ]] || { echo "Expected '$expected', got: $output" >&2; exit 1; }
}
run_filled_capture() { filled "$1" | docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - 2>&1; }

GUARD_PRE=0746463f7308dc48acce42a70dfe3c01dc72e0ac97f6540e294d80dd16d808e8
GUARD_POST=fc2486d6e78c083df6f961bbd0a57e00ab41610fa1d5e34246be46809c48a891
HEALTH_PRE=db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2
HEALTH_POST=b48d69a9ffb135ce9116b519bc63daeed07e736b689d4cfead1460f7b4ad70f5
RECORD_PRE=9c0671783aa5ee045c89107c8910d6e0f649072cb932f5544e5196b7cdb2071c
RECORD_POST=99e5cbded55cd87b91f36bca9f3b007464f2cc0cb7f8b70fa51f646f47d60d4c
CYCLE_START=9fdc723c2a458b8f43ba82e758299428d4b9701d9826ae0324c32f466be5cb2e
migration="$study_root/supabase/migrations/20261010120000_add_swell_watch_study_sub_floor_tracking.sql"
operations="$study_root/docs/operations"

run_file "$study_root/__tests__/fixtures/swell-watch-study-base.sql"
for m in \
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
  run_file "$study_root/supabase/migrations/$m.sql"
done
normalization=("$study_root"/supabase/migrations/*_normalize_swell_watch_provider_direction.sql)
[ "${#normalization[@]}" -eq 1 ]
run_file "${normalization[0]}"
for m in \
  20260914050000_amend_swell_watch_study_partition_coverage \
  20260914190000_amend_swell_watch_study_model_partition_count \
  20260916170000_amend_swell_watch_study_swell_system_count \
  20260918180000_harden_swell_watch_study_epochs_and_extend \
  20260924180000_isolate_swell_watch_feed_qualification; do
  run_file "$study_root/supabase/migrations/$m.sql"
done

# The replayed chain must reproduce production's reviewed definitions before the amendment is applied.
expect_hash 'guard_swell_watch_study_authority()' "$GUARD_PRE"
expect_hash 'read_swell_watch_study_health()' "$HEALTH_PRE"
expect_hash 'record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)' "$RECORD_PRE"
expect_hash 'swell_watch_study_cycle_start(bigint)' "$CYCLE_START"
complete_hash=$(function_hash 'complete_swell_watch_study_run(uuid,text,jsonb,jsonb)')
record_grants=$(query "SELECT proacl::text FROM pg_proc WHERE oid='public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure")

run_file "$migration"
run_file "$migration"
expect_hash 'guard_swell_watch_study_authority()' "$GUARD_POST"
expect_hash 'read_swell_watch_study_health()' "$HEALTH_POST"
expect_hash 'record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)' "$RECORD_POST"
expect_hash 'swell_watch_study_cycle_start(bigint)' "$CYCLE_START"
[ "$(function_hash 'complete_swell_watch_study_run(uuid,text,jsonb,jsonb)')" = "$complete_hash" ]
[ "$(query "SELECT proacl::text FROM pg_proc WHERE oid='public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure")" = "$record_grants" ] || { echo 'Record grants changed' >&2; exit 1; }
[ "$(query "SELECT column_default FROM information_schema.columns WHERE table_name='swell_watch_study_authorities' AND column_name='tracking_mode'")" = "'none'::text" ]

for clone in tracking_rollback tracking_probe tracking_activation tracking_legacy_probe; do admin "CREATE DATABASE $clone TEMPLATE postgres"; done

# Rollback restores the exact reviewed definitions and is reversible.
study_database=tracking_rollback
run_file "$operations/swell-watch-study-sub-floor-tracking-rollback.sql"
run_file "$operations/swell-watch-study-sub-floor-tracking-rollback.sql"
expect_hash 'guard_swell_watch_study_authority()' "$GUARD_PRE"
expect_hash 'read_swell_watch_study_health()' "$HEALTH_PRE"
expect_hash 'record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)' "$RECORD_PRE"
[ "$(query "SELECT proacl::text FROM pg_proc WHERE oid='public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure")" = "$record_grants" ]
run_file "$migration"
expect_hash 'record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)' "$RECORD_POST"

# Existing study behaviour is unchanged with the migration applied: the full pre-existing probe still passes.
study_database=tracking_legacy_probe
run_file "$study_root/__tests__/fixtures/swell-watch-study-clock.sql"
run_file "$study_root/__tests__/fixtures/swell-watch-study-receipts.sql"
docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - < "$study_root/__tests__/fixtures/swell-watch-study-probe.sql" >/dev/null

# Record-function gate and authority binding.
study_database=tracking_probe
run_file "$study_root/__tests__/fixtures/swell-watch-study-clock.sql"
run_file "$study_root/__tests__/fixtures/swell-watch-study-receipts.sql"
run_file "$study_root/__tests__/fixtures/swell-watch-tracking-probe.sql"

# Activation scripts against a production-shaped epoch 6 ledger.
# The scripts pin production function hashes, so the clock fixture (which rewrites function settings) is not used;
# they also expire with the study window, so this section is skipped once that window has closed.
if [ "$(date -u +%s)" -ge "$(date -u -j -f '%Y-%m-%dT%H:%M:%SZ' 2026-12-31T00:00:00Z +%s 2>/dev/null || date -u -d 2026-12-31T00:00:00Z +%s)" ]; then
  echo 'Study window closed; activation script checks skipped'; exit 0
fi
study_database=tracking_activation
run_file "$study_root/__tests__/fixtures/swell-watch-study-activation.sql"
run_file "$study_root/__tests__/fixtures/swell-watch-tracking-activation.sql"
[ "$(query "SELECT public.read_swell_watch_study_health()->>'status'")" = active ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'trackingMode'")" = none ]
cycle_before=$(query "SELECT public.read_swell_watch_study_health()->>'cycleStartEpoch'")
admin 'CREATE DATABASE tracking_activation_revoke TEMPLATE tracking_activation'

# Both scripts are inert until the approval sentence is recorded.
fail_with 'approval evidence not recorded' docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - < "$operations/swell-watch-study-amend-tracking.sql"
fail_with 'approval evidence not recorded' docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - < "$operations/swell-watch-study-amend-period-floor.sql"
# The period-floor amendment refuses to run before the tracking epoch exists.
fail_with 'exact reviewed epoch 7 study authority required' run_filled_capture "$operations/swell-watch-study-amend-period-floor.sql"
[ "$(query 'SELECT count(*) FROM public.swell_watch_study_authorities')" = 6 ]

# Epoch 7: tracking only. Same policy hash and inputs, so the qualifying-day cycle continues.
run_filled "$operations/swell-watch-study-amend-tracking.sql"
tracking_rows=$(query "SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a")
run_filled "$operations/swell-watch-study-amend-tracking.sql"
[ "$(query "SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a")" = "$tracking_rows" ] || { echo 'Tracking activation retry changed authority' >&2; exit 1; }
[ "$(query 'SELECT count(*) FROM public.swell_watch_study_authorities')" = 7 ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'status'")" = active ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'trackingMode'")" = sub_floor_tracking.v1 ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'cycleStartEpoch'")" = "$cycle_before" ] || { echo 'Tracking-only epoch reset the qualifying-day cycle' >&2; exit 1; }
[ "$(query "SELECT public.read_swell_watch_study_health()->>'policyHash'")" = 86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f ]
fail_with 'revoke the active tracking authority' docker exec -i "$study_container" psql -X -U postgres -d "$study_database" -v ON_ERROR_STOP=1 -f - < "$operations/swell-watch-study-sub-floor-tracking-rollback.sql"

# Epoch 8: period floor. New policy hash, so a new qualifying-day cycle starts; policy 4 and authority 8 land together.
run_filled "$operations/swell-watch-study-amend-period-floor.sql"
floor_rows=$(query "SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a")
floor_policy=$(query "SELECT jsonb_agg(to_jsonb(p) ORDER BY epoch)::text FROM public.swell_watch_evaluation_policies p")
run_filled "$operations/swell-watch-study-amend-period-floor.sql"
[ "$(query "SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch)::text FROM public.swell_watch_study_authorities a")" = "$floor_rows" ] || { echo 'Period-floor retry changed authority' >&2; exit 1; }
[ "$(query "SELECT jsonb_agg(to_jsonb(p) ORDER BY epoch)::text FROM public.swell_watch_evaluation_policies p")" = "$floor_policy" ] || { echo 'Period-floor retry changed policy' >&2; exit 1; }
[ "$(query 'SELECT count(*) FROM public.swell_watch_study_authorities')" = 8 ]
[ "$(query "SELECT policy_values #>> '{partition_matching,minimum_period_s}' FROM public.swell_watch_evaluation_policies WHERE epoch=4")" = 9 ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'status'")" = active ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'policyHash'")" = f5535096a2eb18e911f22a9adf0dbd2e17b5b214c6c266e5659c3959c86eb95e ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'cycleStartEpoch'")" = 8 ] || { echo 'Period floor should start a new qualifying-day cycle' >&2; exit 1; }
[ "$(query "SELECT public.read_swell_watch_study_health()->>'qualifyingDays'")" = 0 ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'trackingMode'")" = sub_floor_tracking.v1 ]

# Revocation: period floor first (epoch 9), then verify the study is blocked and the revoke is exact-retry idempotent.
run_file "$operations/swell-watch-study-revoke-period-floor.sql"
run_file "$operations/swell-watch-study-revoke-period-floor.sql"
[ "$(query 'SELECT count(*) FROM public.swell_watch_study_authorities')" = 9 ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'status'")" = blocked ]

# Tracking revoke on its own clone of the epoch 7 state.
study_database=tracking_activation_revoke
run_filled "$operations/swell-watch-study-amend-tracking.sql"
run_file "$operations/swell-watch-study-revoke-tracking.sql"
run_file "$operations/swell-watch-study-revoke-tracking.sql"
[ "$(query 'SELECT count(*) FROM public.swell_watch_study_authorities')" = 8 ]
[ "$(query "SELECT public.read_swell_watch_study_health()->>'status'")" = blocked ]
[ "$(query "SELECT state FROM public.swell_watch_study_authorities WHERE epoch=8")" = revoked ]
echo 'Swell Watch sub-floor tracking PostgreSQL checks passed'
