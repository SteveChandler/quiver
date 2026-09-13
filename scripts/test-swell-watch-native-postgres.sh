#!/usr/bin/env bash
# Disposable PostgreSQL/PostgREST. No linked project, .env files, or production keys.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
name="swell-watch-native-test-$$"
cleanup() { docker rm -f "$name-rest" "$name-db" >/dev/null 2>&1 || true; docker network rm "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker network create "$name" >/dev/null
docker run -d --name "$name-db" --network "$name" --network-alias db -e POSTGRES_PASSWORD=disposable postgres:15 >/dev/null
deadline=$((SECONDS+30))
until docker exec "$name-db" sh -c 'test "$(head -n 1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)" = 1 && pg_isready -U postgres' >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Disposable database startup failed' >&2; exit 1; fi
  sleep 0.2
done
run_file() { docker exec -i "$name-db" psql -X -U postgres -v ON_ERROR_STOP=1 -q -f - < "$1"; }
run_file "$root/__tests__/fixtures/swell-watch-study-base.sql"
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
  run_file "$root/supabase/migrations/$migration.sql"
done
normalization=("$root"/supabase/migrations/*_normalize_swell_watch_provider_direction.sql)
if [ "${#normalization[@]}" -ne 1 ] || [ ! -f "${normalization[0]}" ]; then echo 'Expected one normalization migration' >&2; exit 1; fi
run_file "${normalization[0]}"
# Reproduce the Supabase service role, not broader table-write or attestation grants.
docker exec -i "$name-db" psql -X -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
ALTER ROLE service_role BYPASSRLS;
ALTER TABLE public.beaches ADD COLUMN slug text DEFAULT 'synthetic';
ALTER TABLE public.beaches ADD COLUMN timezone text DEFAULT 'UTC';
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.beaches TO service_role;
SQL
secret="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
docker run -d --name "$name-rest" --network "$name" -p 127.0.0.1::3000 \
  -e PGRST_DB_URI=postgres://postgres:disposable@db:5432/postgres \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$secret" \
  public.ecr.aws/supabase/postgrest:v12.2.3 >/dev/null
port="$(docker port "$name-rest" 3000/tcp | sed 's/.*://')"
export SWELL_NATIVE_TEST_URL="http://127.0.0.1:$port"
export SWELL_NATIVE_TEST_SECRET="$secret"
deadline=$((SECONDS+30))
until curl -sf "$SWELL_NATIVE_TEST_URL/" >/dev/null; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Disposable PostgREST startup failed' >&2; exit 1; fi
  sleep 0.2
done
cd "$root"
node --import tsx scripts/test-swell-watch-native-postgres.mjs "$name-db"
