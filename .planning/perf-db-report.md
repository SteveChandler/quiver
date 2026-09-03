# Database performance changes — 2026-09-03

Worktree: `quiver/.worktrees/perf-db-20260903`; branch remains uncommitted. Implementation lane: parent-selected Codex worker, inherited model/reasoning. No production changes or index removals.

## Reviewed plan and implementation

1. Index only unfinished cron runs by `started_at`, matching the shared cleanup predicate. Keep normal transactional migration and limit lock wait to 2 seconds, statement duration to 30 seconds. No application cleanup behavior changes.
2. Add the existing inclusive 48-hour IOOS water-temperature cutoff to the database query before sorting/limit. Preserve the post-fetch freshness check so a row aging out during the request remains rejected.
3. Apply PostgREST `.eq('beach_id', beachId)` to the existing set-returning anchor RPC for single-beach requests. Reuse shared conversion/error behavior. Batch callers retain the unfiltered RPC and their complete map. SQL function signature and client responses remain unchanged.
4. Review large indexes, defer destructive removals until actual workload and catalog evidence justify them.

Inspected repository soul, migration safety, service/database architecture, test architecture, Jest setup/config, Main Gate, direct consumers and existing service tests. No E2E files modified or added; no browser behavior change. E2E was not run (status: not assessed).

## Files

Production:
- `lib/services/enhanced-forecast-service.ts`
- `lib/services/observations/nowcast-anchor.ts`
- `supabase/migrations/20260903200100_index_started_cron_runs.sql`

Tests:
- `__tests__/lib/services/enhanced-forecast-service.test.ts`: query cutoff, inclusive boundary, stale rejection and empty fallback.
- `__tests__/lib/services/observations/nowcast-anchor.test.ts`: single-beach server filter; batched reads remain unfiltered; existing conversion/error tests retained.
- `.planning/verify-started-cron-index.sql`: runnable PostgreSQL regression check in an empty disposable database; validates idempotency, planner use, real cleanup update and rollback.

## Verification

Node `v22.23.1`. Unit test environment was synthetic; no credentials read.

Initial regression run **failed as expected**, two new assertions failed before implementation (filter and cutoff absent), 19 existing assertions passed:

```sh
CI=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=unit-placeholder yarn test:unit --runTestsByPath __tests__/lib/services/observations/nowcast-anchor.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts --maxWorkers=2
```

Same focused command after implementation: **PASS, 21 tests**.

Expanded consumer command: **PASS, 7 suites / 56 tests** (repeated after final stale-row assertion):

```sh
CI=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=unit-placeholder yarn test:unit --runTestsByPath __tests__/lib/services/observations/nowcast-anchor.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/services/enhanced-forecast-prefetch.test.ts __tests__/lib/services/enhanced-forecast-update-selection.test.ts __tests__/lib/enhanced-forecast-cdip-integration.test.ts __tests__/lib/enhanced-forecast-service.unit.test.ts __tests__/app/api/major-event-hold-routes.test.ts --maxWorkers=2
```

Scoped lint command **PASS**:

```sh
yarn eslint --max-warnings=0 lib/services/observations/nowcast-anchor.ts lib/services/enhanced-forecast-service.ts __tests__/lib/services/observations/nowcast-anchor.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts
```

`git diff --check`: **PASS**. `yarn typecheck`: **STOPPED, not passed** at parent request due concurrent typechecks/resource pressure. It emitted no diagnostic before termination; parent will run one combined typecheck. No typecheck-success claim is made.

Disposable PostgreSQL validation **PASS**. Exact executed Python orchestration (via `python3` from worktree):

```python
import subprocess
from pathlib import Path
name = 'perf_db_20260903_check'
base = ['docker', 'exec', '-i', 'supabase_db_quiver']
subprocess.run(base + ['createdb', '-U', 'postgres', name], check=True)
try:
    sql = Path('.planning/verify-started-cron-index.sql').read_text()
    migration = Path('supabase/migrations/20260903200100_index_started_cron_runs.sql').read_text()
    sql = sql.replace('\\ir ../supabase/migrations/20260903200100_index_started_cron_runs.sql', migration)
    result = subprocess.run(base + ['psql', '-U', 'postgres', '-d', name, '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, capture_output=True)
    print(result.stdout)
    print(result.stderr)
    result.check_returncode()
finally:
    subprocess.run(base + ['dropdb', '-U', 'postgres', name], check=True)
```

209,000 synthetic rows, ten unfinished/stale. Before: parallel sequential scan, 13.964 ms, 1,332 shared buffers. After: index scan, 0.032 ms, two buffers. Applied twice successfully, actual UPDATE touched exactly ten rows, rollback removed only the new index. Disposable database removed; shared local Supabase database never reset or modified. These synthetic local timings are evidence of the plan improvement, **not a production speedup estimate**.

## Index removal review — deferred

- `idx_marine_forecasts_nws_wind_mv_lookup` was explicitly created for LATERAL NWS wind lookups in materialized-view refresh (`20260120140000_optimize_mv_beach_hourly_scores_indexes.sql`). Covers `(beach_id, ts)` plus wind values, partial `source='nws_wind'`. A zero scan count is inadequate to discard a periodic refresh dependency.
- `idx_marine_forecasts_beach_ts_utc` and `idx_tide_forecasts_beach_ts_utc` index generated compatibility columns `ts_utc` (`20250820132000_add_generated_hourly_columns.sql`). Direct TypeScript service searches did not reveal current table-column use, but stored SQL, external Seaside consumers, and production catalog dependencies need review. Repository absence does not establish dead code.
- `idx_ef_beach_forecast_at` and `enhanced_forecasts_beach_forecast_at_unique` were created together on the same columns (`20260214183146_add_forecast_at_column.sql`). This is the strongest redundancy candidate. Preserve the unique constraint used for upsert semantics; verify production index definitions, validity, opclasses, predicates and dependencies before removing the nonunique index.
- Reported production sizes/zero-scan statistics came from parent investigation, not this worker. No production catalog or statistics calls were made here. Require representative workload including scheduled refreshes and reset timestamps before removal.

## Rollout and rollback

Changes are ready for review, not applied. Follow `docs/MIGRATION_SAFETY.md`: production owner connection, fresh backup within 24h, reviewed exact migration plan and explicit maintainer approval. Migration creates only `public.idx_cron_runs_started_at_started`; it can briefly block cron writes while building. Lock/statement timeouts fail the transaction safely rather than waiting indefinitely. If production contention defeats bounded normal creation, review a concurrent index rollout separately.

After approved apply, inspect `pg_index.indisvalid` and the actual sweep `EXPLAIN (ANALYZE, BUFFERS)` within a read-only transaction. Compare cron duration/error rates over a representative window. No production benchmark performed here. No full schema replay or Supabase reset performed; the SQL test intentionally used an isolated minimal table matching indexed columns.

Rollback under separate approval:

```sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP INDEX IF EXISTS public.idx_cron_runs_started_at_started;
COMMIT;
```

Reverting the two TypeScript patches restores old request queries. The index is independent of app deployment, so deployment ordering introduces no schema contract dependency. Anchor filtering reduces returned rows; because the SECURITY DEFINER RPC may not inline, do not claim that it eliminates all internal materialized-view work. Live PostgREST endpoint and actual IOOS query-plan measurement remain release validation gaps.
