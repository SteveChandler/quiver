#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Always creates a private local cluster; never uses DATABASE_URL or .env files.
if [[ -d /opt/homebrew/opt/postgresql@15/bin ]]; then
  export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
fi
eval_tmp=$(mktemp -d /tmp/quiver-evaluation.XXXXXX)
cleanup() {
  pg_ctl -D "$eval_tmp/db" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$eval_tmp"
}
trap cleanup EXIT
initdb -D "$eval_tmp/db" -A trust -U postgres > "$eval_tmp/init.log"
pg_ctl -D "$eval_tmp/db" -l "$eval_tmp/server.log" -o "-h '' -k $eval_tmp" -w start >/dev/null
psql_args=(-X -h "$eval_tmp" -U postgres -d postgres -v ON_ERROR_STOP=1)
psql "${psql_args[@]}" -f __tests__/fixtures/forecast-evaluation-v1.sql
# Only the real view DDL, not this old migration's refresh or spatial changes.
sed -n '/CREATE OR REPLACE VIEW public.unified_wave_observations/,/^  );/p' \
  supabase/migrations/20260410163128_expand_observable_and_add_ndbc_direct.sql > "$eval_tmp/unified.sql"
psql "${psql_args[@]}" -f "$eval_tmp/unified.sql"
# Exercise inventory against legacy columns before applying the additive contract.
psql "${psql_args[@]}" -c "INSERT INTO ml_predictions_log(id, beach_id, predicted_at, observed_m, raw_display_height_m) VALUES ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000001',now()-interval '2 days',1,2), ('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-000000000001',now()+interval '2 days',NULL,2)"
psql "${psql_args[@]}" --csv -f scripts/forecast-evaluation-readiness.sql > "$eval_tmp/inventory.csv"
python3 - "$eval_tmp/inventory.csv" <<'PYTEST'
import csv
import sys
from pathlib import Path
lines = Path(sys.argv[1]).read_text().splitlines()
start = next(i for i, line in enumerate(lines) if line.startswith('beach_id,'))
rows = list(csv.DictReader(line for line in lines[start:] if line != 'ROLLBACK'))
assert len(rows) == 1 and rows[0]['sampled_rows'] == '1'
assert rows[0]['operationally_matched_rows'] == '1'
assert rows[0]['strict_eligible_rows'] == ''
assert 'missing_match_provenance' in rows[0]['limitations']
print('PASS: legacy inventory excludes future rows and does not fabricate strict counts')
PYTEST
psql "${psql_args[@]}" -c "DELETE FROM ml_predictions_log WHERE id IN ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000098')"
psql "${psql_args[@]}" -f supabase/migrations/20260908160000_forecast_evaluation_contract_v1.sql
psql "${psql_args[@]}" -f __tests__/integration/forecast-evaluation-v1.sql
psql "${psql_args[@]}" -f scripts/forecast-evaluation-readiness.sql
