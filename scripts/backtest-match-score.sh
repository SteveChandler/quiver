#!/usr/bin/env bash
# Replay pseudonymized production sessions only in a disposable local cluster.
set -euo pipefail

model_root="$(cd "$(dirname "$0")/.." && pwd)"
model_pg_bin="${MODEL_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
model_data="${1:?Usage: bash scripts/backtest-match-score.sh DATA.json OUTPUT_DIR}"
model_out="${2:?Usage: bash scripts/backtest-match-score.sh DATA.json OUTPUT_DIR}"
case "$(realpath "$model_data")" in "$model_root"/*) echo 'Data must stay outside the repository' >&2; exit 2;; esac
mkdir -p "$model_out"
case "$(realpath "$model_out")" in "$model_root"/*) echo 'Output must stay outside the repository' >&2; exit 2;; esac

export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TMPDIR=/tmp
model_tmp="$(mktemp -d /tmp/quiver-match-backtest.XXXXXX)"
cleanup() {
  "$model_pg_bin/pg_ctl" -D "$model_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$model_tmp"
}
trap cleanup EXIT

python3 "$model_root/scripts/backtest-match-score.py" prepare "$model_data" "$model_out" "$model_root"
"$model_pg_bin/initdb" -D "$model_tmp/data" -A trust --no-locale >/dev/null
"$model_pg_bin/pg_ctl" -D "$model_tmp/data" -l "$model_tmp/postgres.log" \
  -o "-k $model_tmp -c listen_addresses='' -c jit=off" -w start >/dev/null
model_psql=("$model_pg_bin/psql" -X -h "$model_tmp" -p 5432 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${model_psql[@]}" -q -f "$model_out/setup.sql" -f "$model_root/supabase/migrations/20260420180000_add_parse_numeric_from_text.sql" \
  -f "$model_root/supabase/migrations/20260609201625_session_fit_match_score.sql" -f "$model_out/verify-fit.sql" \
  -f "$model_out/A.sql" \
  -f "$model_out/replay-A.sql" -f "$model_out/B.sql" -f "$model_out/replay-B.sql" \
  > "$model_out/postgres.log" 2>&1 || { tail -80 "$model_out/postgres.log" >&2; exit 1; }
"${model_psql[@]}" -At -F $'\t' -c 'SELECT candidate,user_id,session_id,rating,score FROM predictions ORDER BY candidate,user_id,session_id' \
  > "$model_out/predictions.tsv"
python3 "$model_root/scripts/backtest-match-score.py" metrics "$model_out/predictions.tsv" "$model_out/metrics.json"
