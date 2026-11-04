#!/usr/bin/env bash
# Disposable local cluster only. No env files, URLs, or existing databases.
set -euo pipefail
founding_root="$(cd "$(dirname "$0")/.." && pwd)"
founding_pg_bin="${FOUNDING_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TMPDIR=/tmp
founding_tmp="$(mktemp -d /tmp/quiver-founding-access-test.XXXXXX)"
cleanup() {
  "$founding_pg_bin/pg_ctl" -D "$founding_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$founding_tmp"
}
trap cleanup EXIT
"$founding_pg_bin/initdb" -D "$founding_tmp/data" -A trust --no-locale >/dev/null
"$founding_pg_bin/pg_ctl" -D "$founding_tmp/data" -l "$founding_tmp/postgres.log" \
  -o "-k $founding_tmp -c listen_addresses='' -c jit=off" -w start >/dev/null
"$founding_pg_bin/psql" -X -h "$founding_tmp" -p 5432 -U "$(id -un)" -d postgres \
  -v ON_ERROR_STOP=1 "$@" -f "$founding_root/supabase/tests/founding_surfer_access.sql"
