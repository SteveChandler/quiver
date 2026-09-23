#!/usr/bin/env bash
# Disposable local cluster only. No env files, URLs, or existing databases.
set -euo pipefail
scout_root="$(cd "$(dirname "$0")/.." && pwd)"
scout_pg_bin="${SCOUT_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TMPDIR=/tmp
scout_tmp="$(mktemp -d /tmp/quiver-match-test.XXXXXX)"
cleanup() {
  "$scout_pg_bin/pg_ctl" -D "$scout_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$scout_tmp"
}
trap cleanup EXIT
"$scout_pg_bin/initdb" -D "$scout_tmp/data" -A trust --no-locale >/dev/null
"$scout_pg_bin/pg_ctl" -D "$scout_tmp/data" -l "$scout_tmp/postgres.log" \
  -o "-k $scout_tmp -c listen_addresses='' -c jit=off" -w start >/dev/null
scout_args=(-v benchmark=false -v baseline=false -v benchmark_legacy=false)
if [[ "${1:-}" == "--benchmark" || "${1:-}" == "--benchmark-current" ]]; then
  scout_args=(-v benchmark=true -v baseline=false -v "benchmark_legacy=$([[ "${1:-}" == "--benchmark" ]] && echo true || echo false)")
  if [[ -n "${SCOUT_BASELINE_REV:-}" ]]; then
    git -C "$scout_root" show "$SCOUT_BASELINE_REV:supabase/migrations/20260923040000_share_match_score_inputs.sql" > "$scout_tmp/baseline-core.sql"
    git -C "$scout_root" show "$SCOUT_BASELINE_REV:supabase/migrations/20260923041000_week_scout_personalization_context.sql" > "$scout_tmp/baseline-scout.sql"
    scout_args+=(-v baseline=true -v "baseline_core=$scout_tmp/baseline-core.sql" -v "baseline_scout=$scout_tmp/baseline-scout.sql")
  fi
fi
"$scout_pg_bin/psql" -X -h "$scout_tmp" -p 5432 -U "$(id -un)" -d postgres \
  "${scout_args[@]}" -v ON_ERROR_STOP=1 -f "$scout_root/supabase/tests/week_scout_match_equivalence.sql"
