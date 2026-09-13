#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
db="supabase_db_phase26-worker-drill"
rest="phase26-worker-rest"
for name in "$db" "$rest"; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    echo "Dedicated drill container already exists: $name" >&2
    exit 1
  fi
done
scratch="$(mktemp -d)"
cleanup() {
  docker rm -f "$rest" >/dev/null 2>&1 || true
  supabase --workdir "$scratch" stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$scratch"
}
trap cleanup EXIT
mkdir "$scratch/supabase"
cat > "$scratch/supabase/config.toml" <<'CONFIG'
project_id = "phase26-worker-drill"
[api]
port = 55431
[db]
port = 55432
shadow_port = 55430
major_version = 15
[db.migrations]
enabled = false
[db.seed]
enabled = false
[studio]
enabled = false
[local_smtp]
enabled = false
[analytics]
enabled = false
CONFIG
supabase --workdir "$scratch" start -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
docker exec "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qc 'CREATE ROLE posthog_readonly NOLOGIN'
for file in supabase/snapshots/schema.sql supabase/migrations/20260818120000_surf_alert_trust_invariants.sql supabase/migrations/20260824120000_create_swell_watch_event_pipeline.sql supabase/migrations/20260824130000_create_swell_watch_production_approval_authority.sql supabase/migrations/20260904120001_add_swell_watch_v2_enqueue_dedupe.sql supabase/migrations/20260904140000_create_swell_watch_provider_run_receipts.sql supabase/migrations/20260905010000_add_swell_watch_owner_attestation.sql; do
  docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/$file"
done
sed -n '1,/^\$\$;/p' "$root/__tests__/fixtures/swell-watch-provider-run-receipts-probe.sql" | docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905020000_resolve_swell_watch_event_identity.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905030000_retain_swell_watch_unavailable_components.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905040000_require_current_swell_watch_run_evidence.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905050000_read_attested_swell_watch_run.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905060000_ingest_swell_watch_run_atomically.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905070000_read_swell_watch_delivery_health.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905080000_read_swell_watch_run_scope.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260905090000_ingest_swell_watch_cohort.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260906140000_add_swell_watch_collection_lease.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260906150000_separate_swell_watch_evaluation_policy.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$root/supabase/migrations/20260906160000_record_swell_watch_shadow_demand.sql"
docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -v policy_values="$(node -p "JSON.stringify(require('$root/__tests__/fixtures/swell-watch-provisional-policy.json').policy_values)")" < "$root/__tests__/fixtures/swell-watch-evaluation-policy-probe.sql"
docker exec "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qc "INSERT INTO auth.users(id,email) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','phase26@example.invalid'); INSERT INTO public.profiles(id,display_name,timezone,notif_push_enabled,notif_forecast_alerts,allow_implicit_tracking) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fixture','UTC',true,true,false) ON CONFLICT (id) DO UPDATE SET timezone='UTC',notif_push_enabled=true,notif_forecast_alerts=true,allow_implicit_tracking=false; INSERT INTO public.user_devices(user_id,platform,device_token) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ios','fixture-only-token');"
docker run --rm -d --name "$rest" --network supabase_network_phase26-worker-drill -p 127.0.0.1:55433:3000 -e PGRST_DB_URI=postgres://postgres:postgres@supabase_db_phase26-worker-drill:5432/postgres -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=service_role public.ecr.aws/supabase/postgrest:v12.2.3 >/dev/null
deadline=$((SECONDS + 30))
until curl --fail --silent http://127.0.0.1:55433/ >/dev/null; do
  if [ "$SECONDS" -ge "$deadline" ]; then echo 'Local REST service did not become ready' >&2; exit 1; fi
  sleep 1
done
cd "$root"
PHASE26_WORKER_DRILL=local NEXT_PUBLIC_SUPABASE_URL=http://localhost:55433 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --testMatch='**/swell-watch-worker-postgres.drill.ts'
