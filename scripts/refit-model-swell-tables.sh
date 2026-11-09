#!/usr/bin/env bash
# Refits both model-hour factor tables on the same rows and the same truth:
#   MODEL_SWELL_CALIBRATION_FACTORS  (lib/utils/model-swell-calibration-factors.ts)
#   ECMWF_HYBRID_K_FACTORS           (lib/utils/ecmwf-hybrid-k-factors.ts)
#
# Run it monthly, and after any change to beaches.shoaling_factors, direction_shadow,
# the CDIP station table or wave-height-transformer.ts: each of those moves the buoy
# ruler that both tables are fit to.
#
# Read-only against the DB, CDIP THREDDS and Open-Meteo. Without --write it prints the
# fits and changes no tracked file. With --write it writes both tables,
# scripts/hybrid-k-eligible.json and the Gate G seam fixtures, then runs the
# shoaling regression.
#
# Steps (stop at the first failure):
#   1. hybrid-replay-collect.ts      fresh cache; logged model rows + CDIP truth + ECMWF
#   2. hybrid-replay-ruler-check.py  truth / (buoy Hs x bucket) = 0.97-1.03 at every beach, before any fit
#   3. replay-model-swell-calibration.ts --dump-rows   production fit, same window
#   4. hybrid-replay-analyze.py      held-out-by-week scores
#   5. hybrid-replay-vs-refit.py     hybrid k on clamped r, entry gate, same-rows check
#   6. hybrid-k-write-table.py       (--write) ECMWF_HYBRID_K_FACTORS from the eligible set
#   7. shoaling-regression.ts        (--write) Gate G is report-only on model-failure days
#
# Usage: scripts/refit-model-swell-tables.sh <env file> [days=30] [--write]
#    or: yarn refit:model-swell <env file> [days] [--write]
# Under the Claude Code sandbox, set NODE_USE_ENV_PROXY=1.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${1:?usage: scripts/refit-model-swell-tables.sh <env file> [days] [--write]}"
shift
DAYS=30
WRITE=0
for arg in "$@"; do
  case "$arg" in
    --write) WRITE=1 ;;
    *) DAYS="$arg" ;;
  esac
done
CACHE=scripts/.hybrid-cache
COMMIT="$(git rev-parse --short HEAD)"

node --import tsx scripts/hybrid-replay-collect.ts "$ENV_FILE" "$DAYS" | tail -1
python3 scripts/hybrid-replay-ruler-check.py > "$CACHE/ruler.txt" || { grep -E "OUT|FAILED" "$CACHE/ruler.txt"; exit 1; }
tail -1 "$CACHE/ruler.txt"

# The production fit writes its table and the seam fixtures before the hybrid checks run. If any
# later step fails, put every tracked output back so one table never ships without the other.
TRACKED=(lib/utils/model-swell-calibration-factors.ts lib/utils/ecmwf-hybrid-k-factors.ts
  scripts/hybrid-k-eligible.json scripts/__fixtures__/model-seam-fixtures.json)
if [ "$WRITE" = 1 ]; then
  mkdir -p "$CACHE/backup"
  for f in "${TRACKED[@]}"; do cp "$f" "$CACHE/backup/$(basename "$f")"; done
  restore() {
    for f in "${TRACKED[@]}"; do cp "$CACHE/backup/$(basename "$f")" "$f"; done
    echo "refit failed: restored ${TRACKED[*]}" >&2
  }
  trap restore ERR
fi

PROD_ARGS=("$ENV_FILE" "$DAYS" "--dump-rows=$CACHE/prod-fit-rows.jsonl")
[ "$WRITE" = 1 ] && PROD_ARGS+=(--write --seam-fixtures)
node --import tsx scripts/replay-model-swell-calibration.ts "${PROD_ARGS[@]}" > "$CACHE/prod-fit.txt"
tail -4 "$CACHE/prod-fit.txt"

python3 scripts/hybrid-replay-analyze.py > "$CACHE/analysis.txt"
ELIGIBLE="$CACHE/hybrid-k-eligible.json"
python3 scripts/hybrid-replay-vs-refit.py --require-prod-rows --out "$ELIGIBLE" > "$CACHE/vs-refit.txt"
tail -5 "$CACHE/vs-refit.txt"

if [ "$WRITE" = 0 ]; then
  echo "dry run: reports in $CACHE (prod-fit, analysis, vs-refit, ruler); no tracked file changed"
  exit 0
fi
cp "$ELIGIBLE" scripts/hybrid-k-eligible.json
python3 scripts/hybrid-k-write-table.py "$DAYS" "$COMMIT"
node --import tsx scripts/shoaling-regression.ts > "$CACHE/regression.txt"
grep -E "^\[|PASS:|note:" "$CACHE/regression.txt"
trap - ERR
