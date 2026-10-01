#!/usr/bin/env bash
# Disposable PG15 run of the session tide trigger against migration 20261002090000.
# --before runs the tests against the pre-migration functions (expected to fail).
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/quiver-session-tide.XXXXXX")"
pg_bin="${SESSION_TIDE_TEST_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
if [[ ! -x "$pg_bin/initdb" ]]; then pg_bin="$(pg_config --bindir)"; fi
"$pg_bin/initdb" -D "$test_dir/data" -A trust -U postgres > "$test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$test_dir/data" -m fast stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$test_dir/data" -l "$test_dir/server.log" -o "-k $test_dir -h '' -p 55439" start >/dev/null
psql_local() { "$pg_bin/psql" -X -q -v ON_ERROR_STOP=1 -h "$test_dir" -p 55439 -U postgres -d postgres "$@"; }
psql_local -f "$repo_dir/__tests__/fixtures/session-tide-snapshot.sql"
if [[ "${1:-}" != "--before" ]]; then
  psql_local -f "$repo_dir/supabase/migrations/20261002090000_session_conditions_capture.sql"
fi
psql_local -f "$repo_dir/__tests__/integration/session-tide-snapshot.sql"
printf 'PASS: session tide snapshot. Evidence: %s\n' "$test_dir"
