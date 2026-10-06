#!/usr/bin/env bash
# Disposable local cluster only. No env files, URLs, or existing databases.
set -euo pipefail
outcomes_root="$(cd "$(dirname "$0")/.." && pwd)"
outcomes_pg_bin="${SCOUT_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TMPDIR=/tmp
outcomes_tmp="$(mktemp -d /tmp/quiver-swell-outcomes-test.XXXXXX)"
cleanup() {
  "$outcomes_pg_bin/pg_ctl" -D "$outcomes_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$outcomes_tmp"
}
trap cleanup EXIT
for outcomes_binary in initdb pg_ctl psql; do
  if [[ ! -x "$outcomes_pg_bin/$outcomes_binary" ]]; then
    echo "Missing disposable-cluster binary: $outcomes_pg_bin/$outcomes_binary" >&2
    exit 1
  fi
done
"$outcomes_pg_bin/initdb" -D "$outcomes_tmp/data" -A trust --no-locale >/dev/null
"$outcomes_pg_bin/pg_ctl" -D "$outcomes_tmp/data" -l "$outcomes_tmp/postgres.log" -o "-k $outcomes_tmp -c listen_addresses=''" -w start >/dev/null
"$outcomes_pg_bin/psql" -X -h "$outcomes_tmp" -p 5432 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1 -f "$outcomes_root/supabase/tests/swell_snapshot_outcomes.sql"
