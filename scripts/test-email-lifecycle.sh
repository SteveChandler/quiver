#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/quiver-email-lifecycle.XXXXXX")"
pg_bin="${LIFECYCLE_TEST_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
if [[ ! -x "$pg_bin/initdb" ]]; then pg_bin="$(pg_config --bindir)"; fi
"$pg_bin/initdb" -D "$test_dir/data" -A trust -U postgres > "$test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$test_dir/data" -m fast stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$test_dir/data" -l "$test_dir/server.log" -o "-k $test_dir -h '' -p 55438" start >/dev/null
psql_local() { "$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$test_dir" -p 55438 -U postgres -d postgres "$@"; }
psql_local -f "$repo_dir/__tests__/fixtures/email-lifecycle.sql" \
  -f "$repo_dir/supabase/migrations/20260903180000_email_contact_policy.sql" \
  -f "$repo_dir/supabase/migrations/20260912010000_startup_email_lifecycle.sql" \
  -f "$repo_dir/__tests__/integration/email-lifecycle.sql" \
  -f "$repo_dir/__tests__/integration/email-lifecycle-rules.sql"
pids=()
for worker in 1 2; do
  psql_local -c "SELECT claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64))" > "$test_dir/worker-$worker.log" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
psql_local -c "DO \$\$ BEGIN ASSERT (SELECT count(*) FROM email_contact_attempts WHERE state='reserved')=1; END \$\$;"
psql_local -f "$repo_dir/supabase/migrations/20260622090000_create_earned_pro_grants.sql" \
  -f "$repo_dir/supabase/migrations/20260912020000_gmail_reply_ingestion.sql" \
  -f "$repo_dir/supabase/migrations/20260912030000_pro_offer_fulfillment.sql" \
  -f "$repo_dir/__tests__/integration/email-replies-offers.sql"
pids=()
for worker in 1 2; do
  psql_local -c "SELECT reserve_pro_offer('22222222-2222-4222-8222-222222222222',repeat('d',64),'Quiver Pro')" > "$test_dir/offer-worker-$worker.log" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
psql_local -c "DO \$\$ BEGIN ASSERT (SELECT count(*) FROM pro_offer_awards WHERE user_id='22222222-2222-4222-8222-222222222222' AND state='reserved')=1; END \$\$;"
python3 - "$test_dir" <<'PYTEST'
import pathlib,sys
texts = [p.read_text() for p in pathlib.Path(sys.argv[1]).glob('offer-worker-*.log')]
assert sum('"status": "reserved"' in s for s in texts)==1, texts
assert sum('"status": "busy"' in s for s in texts)==1, texts
PYTEST
psql_local -f "$repo_dir/supabase/migrations/20260912040000_automated_lifecycle_offers.sql" -f "$repo_dir/__tests__/integration/email-automation.sql"
printf 'PASS: disposable PostgreSQL lifecycle and concurrent claims. Evidence: %s\n' "$test_dir"
