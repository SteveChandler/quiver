#!/usr/bin/env bash
set -euo pipefail
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder
export SUPABASE_SERVICE_ROLE_KEY=local-placeholder
export NEXT_PUBLIC_SITE_URL=http://localhost:3119
export EMAIL_LIFECYCLE_ENABLED=false PRO_OFFERS_ENABLED=false EMAIL_GMAIL_REPLY_SYNC_ENABLED=false
export SENTRY_DSN='' NEXT_PUBLIC_SENTRY_DSN=''
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
task_name="quiver-email-contract-$$"
cleanup() { docker rm -f "$task_name-rest" "$task_name-db" >/dev/null 2>&1 || true; docker network rm "$task_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker network create "$task_name" >/dev/null
docker run -d --name "$task_name-db" --network "$task_name" --network-alias db -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15 >/dev/null
for attempt in {1..30}; do
 if docker exec "$task_name-db" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
for migration in __tests__/fixtures/email-lifecycle.sql supabase/migrations/20260903180000_email_contact_policy.sql supabase/migrations/20260912010000_startup_email_lifecycle.sql supabase/migrations/20260622090000_create_earned_pro_grants.sql supabase/migrations/20260912020000_gmail_reply_ingestion.sql supabase/migrations/20260912030000_pro_offer_fulfillment.sql supabase/migrations/20260912040000_automated_lifecycle_offers.sql supabase/migrations/20260912050000_lifecycle_audience_copy.sql supabase/migrations/20260912214631_lifecycle_full_audience.sql contracts/email-system/setup.sql; do
 docker exec -i "$task_name-db" psql -U postgres -v ON_ERROR_STOP=1 < "$repo_dir/$migration" >/dev/null
done
fixture_secret='local-email-contract-only-jwt-secret-32-characters'
docker run -d --name "$task_name-rest" --network "$task_name" -p 127.0.0.1::3000 -e PGRST_DB_URI=postgres://postgres@db:5432/postgres -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$fixture_secret" public.ecr.aws/supabase/postgrest:v12.2.3 >/dev/null
rest_port="$(docker port "$task_name-rest" 3000/tcp | sed 's/.*://')"
export EMAIL_CONTRACT_URL="http://127.0.0.1:$rest_port"
export EMAIL_CONTRACT_JWT_SECRET="$fixture_secret"
for attempt in {1..30}; do
 if curl -sf "$EMAIL_CONTRACT_URL/" >/dev/null; then break; fi
 sleep 1
done
cd "$repo_dir"
yarn test:unit --config jest.email-system.config.js --runInBand
