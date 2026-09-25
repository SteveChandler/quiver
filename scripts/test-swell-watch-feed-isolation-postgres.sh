#!/usr/bin/env bash
set -euo pipefail
study_root="$(cd "$(dirname "$0")/.." && pwd)"
study_container="swell-watch-feed-test-$$"
trap 'docker rm -fv "$study_container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$study_container" -e POSTGRES_PASSWORD=disposable postgres:15 >/dev/null
deadline=$((SECONDS + 30))
until docker exec "$study_container" sh -c 'test "$(head -n 1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)" = 1 && pg_isready -U postgres -d postgres' >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Disposable PostgreSQL startup failed' >&2; exit 1; fi
  sleep 0.1
done
run_file() { docker exec -i "$study_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$1" >/dev/null; }
run_file "$study_root/__tests__/fixtures/swell-watch-study-base.sql"
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
  run_file "$study_root/supabase/migrations/$migration.sql"
done
normalization=("$study_root"/supabase/migrations/*_normalize_swell_watch_provider_direction.sql)
[ "${#normalization[@]}" -eq 1 ]
run_file "${normalization[0]}"
for migration in \
  20260914050000_amend_swell_watch_study_partition_coverage \
  20260914190000_amend_swell_watch_study_model_partition_count \
  20260916170000_amend_swell_watch_study_swell_system_count \
  20260918180000_harden_swell_watch_study_epochs_and_extend \
  20260924180000_isolate_swell_watch_feed_qualification; do
  run_file "$study_root/supabase/migrations/$migration.sql"
done
run_file "$study_root/__tests__/fixtures/swell-watch-study-receipts.sql"
run_file "$study_root/__tests__/fixtures/swell-watch-study-probe.sql"
echo 'Swell Watch feed isolation PostgreSQL checks passed'
