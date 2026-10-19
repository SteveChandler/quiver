#!/usr/bin/env bash
# Disposable local cluster only. No env files, URLs, or existing databases.
set -euo pipefail
model_root="$(cd "$(dirname "$0")/.." && pwd)"
model_pg_bin="${MODEL_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TMPDIR=/tmp
model_tmp="$(mktemp -d /tmp/quiver-session-match-test.XXXXXX)"
cleanup() {
  "$model_pg_bin/pg_ctl" -D "$model_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$model_tmp"
}
trap cleanup EXIT
"$model_pg_bin/initdb" -D "$model_tmp/data" -A trust --no-locale >/dev/null
"$model_pg_bin/pg_ctl" -D "$model_tmp/data" -l "$model_tmp/postgres.log" \
  -o "-k $model_tmp -c listen_addresses='' -c jit=off" -w start >/dev/null
"$model_pg_bin/psql" -X -h "$model_tmp" -p 5432 -U "$(id -un)" -d postgres \
  -v ON_ERROR_STOP=1 "$@" -f "$model_root/supabase/tests/session_match_comparison_unknown_inputs.sql"
