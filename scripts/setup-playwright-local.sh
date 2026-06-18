#!/bin/bash

set -euo pipefail

echo "Playwright local setup"
echo "======================"
echo ""

if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx not found. Install Node.js first."
    exit 1
fi

if [ ! -f ".env.playwright" ]; then
    echo "Creating .env.playwright from template..."
    cp .env.playwright.example .env.playwright
fi

if [ ! -f ".env.playwright.local" ]; then
    echo "Error: .env.playwright.local is required for local parallel-safe E2E."
    echo "Add local Supabase keys, E2E_POOL_PASSWORD, E2E_PROD_READ_URL, and E2E_PROD_READ_KEY."
    exit 1
fi

echo "Installing Chromium if needed..."
npx playwright install chromium

mkdir -p e2e/.auth
rm -f e2e/.auth/worker-*.json
E2E_LOCAL_DB_URL="${E2E_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_START_EXCLUDES="${SUPABASE_START_EXCLUDES:-studio,mailpit}"

echo ""
echo "Starting local Supabase..."
if [ -n "$SUPABASE_START_EXCLUDES" ]; then
    supabase start -x "$SUPABASE_START_EXCLUDES"
else
    supabase start
fi

echo ""
echo "Resetting local Supabase database..."
supabase db reset --db-url "$E2E_LOCAL_DB_URL"

echo ""
echo "Snapshotting production reference data into local Supabase..."
yarn e2e:snapshot-ref

echo ""
echo "Seeding worker pool users..."
yarn e2e:seed-pool

echo ""
echo "Verifying local reference data..."
psql "$E2E_LOCAL_DB_URL" -At -c "select slug from beaches where slug='blacks' limit 1;"
psql "$E2E_LOCAL_DB_URL" -At -c "select count(*) from profiles where is_mock=true and full_name like 'E2E Worker%';"

echo ""
echo "Setup complete."
echo "Run: yarn test:e2e"
