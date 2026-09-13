#!/usr/bin/env bash
set -euo pipefail
# Dedicated disposable PostgreSQL instance; never connects to a configured DB.
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d /tmp/quiver-email-policy.XXXXXX)"
pg_bin="$(pg_config --bindir)"
"$pg_bin/initdb" -D "$test_dir/data" -A trust -U postgres > "$test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$test_dir/data" -m fast stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$test_dir/data" -l "$test_dir/server.log" -o "-k $test_dir -h '' -p 55439" start >/dev/null
"$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$test_dir" -p 55439 -U postgres -d postgres \
  -f "$repo_dir/__tests__/fixtures/email-contact-policy.sql" \
  -f "$repo_dir/supabase/migrations/20260903180000_email_contact_policy.sql" \
  -f "$repo_dir/__tests__/integration/email-contact-policy.sql"
"$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$test_dir" -p 55439 -U postgres -d postgres -c 'UPDATE email_contact_controls SET enabled = true' >/dev/null
pids=()
for email_type in weekly_recap session_prompt; do
  "$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$test_dir" -p 55439 -U postgres -d postgres \
    -c "SELECT claim_email_contact('11111111-1111-4111-8111-111111111111', 'surfer@example.com', '$email_type')" > "$test_dir/$email_type.log" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
"$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$test_dir" -p 55439 -U postgres -d postgres \
  -c 'DO $$ BEGIN ASSERT (SELECT count(*) FROM email_contact_attempts) = 1; END; $$;'
printf 'PASS: isolated PostgreSQL policy assertions. Logs retained at %s\n' "$test_dir"
