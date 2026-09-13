# Forecast evaluation v1 — database handoff (2026-09-08)

Local repairs are ready for review. Real model comparison is **not ready**:
there is no verified row-level dataset with qualified target labels, exact
issue times, and complete feature availability manifests. Synthetic test error
is not evidence of surf-forecast accuracy.

## Scope and verified baseline

- Source checkout: `/Users/stevenchandler/Desktop/dev/quiver`, branch
  `fix/seo-outreach-digest-contact-guard`, HEAD
  `c0fa2bfd8bbad44e7d56c1fbffd1208bbd011dcb`.
- Isolated worktree: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/forecast-evaluation-20260908`,
  branch `orch/forecast-evaluation-20260908`, same base SHA; no commits made.
- Seaside companion: `/Users/stevenchandler/Desktop/dev/.worktrees/seaside-forecast-evaluation-20260908`,
  base `78ebd50ae2c8e285ec88f5c8a31419fe215a0000`.
  Its `docs/forecast_evaluation_contract_v1.md` contains the complete data contract,
  evidence, exclusions and task handoff. Primary-checkout dirty-file inventories
  are saved under its `.planning/evidence/forecast-evaluation-20260908/`.

The September 4 Python earliest-reading finding remains reproducible in source.
The latest SQL backup definition (`20260205131343`) already orders by distance
from valid time; it lacks complete ties and Python's spatial fallback. The
September 4 lead therefore does **not** describe both implementations equally.
The June 10 resolver supersedes the June 4 radius/recency implementation: its
current radius is 25 km, not the 50 km mentioned in older reports. This migration
preserves its tiers, radius and swell-overlap rules, adding stable station ties.

## Migration and operational policy

`supabase/migrations/20260908160000_forecast_evaluation_contract_v1.sql`:

1. Adds nullable observation revision/availability fields and a nullable frozen
   `ml_predictions_log.observation_match` JSON snapshot. No old rows are certified,
   rewritten, backfilled, or reopened.
2. Records server ingestion time and revision 1 on new observations; a changed
   station/event/height increments the revision and records when that revision
   became available. Unchanged duplicate updates preserve times. The source stores
   retain only their current revision; frozen match snapshots preserve the exact
   selected value. Uncaptured older revisions cannot be reconstructed.
3. Adds a service-role-only `security_invoker` evaluation view, keeping the public
   unified view and IOOS/NDBC duplicate suppression unchanged.
4. Implements `select_wave_observation_v1`: direct mapped observations first;
   only when none are usable, use the current station resolver (explicit CDIP,
   direct IOOS, spatial IOOS, direct NDBC, spatial NDBC). Within a winning tier,
   order by absolute event/valid-time difference, earlier event, IOOS before
   NDBC direct, station ID in C collation, observation ID in C collation.
5. Filters to finite positive heights at most 30 m, the full **inclusive ±12 h**
   event-time window, and readings/revisions ingested by the matching cutoff.
   Unknown legacy revision time may serve operational coverage using ingestion
   time, but never receives strict eligibility. Provider quality is **not**
   inferred: these rows remain `range_checked`, `unqualified_label`.
6. Both Python and the SQL backup call `match_ml_observation_v1`. Its row lock
   serializes the first label write. Raw/corrected/display predictions, existing
   matches, and historical `-1` sentinels stay unchanged. Legacy error magnitude
   fields stay compatible; they are operational diagnostics, not strict metrics.
7. Missing outcomes remain NULL and retryable for the existing seven-day processing
   horizon; new terminal sentinels/deletions are not produced. Batches prioritize
   never-attempted/least-recently-attempted rows to avoid starvation. The backup
   now uses the same two-hour maturity floor as Python, and keeps its result
   columns (`sentinel_marked=0`, `expired_deleted=0`). Rows beyond seven days remain
   unscored and are not deleted by this function. Existing retention is unchanged.

The one-hour strict scoring window is an **offline eligibility rule**, not a
reduction of operational tolerance. Matching an 11-hour-old buoy reading remains
possible, with explicit temporal exclusion from strict scoring.

## Consumers and compatibility

- `forecast-builder.ts` captures pre-offset face height; `log-display-prediction.ts`
  inserts with `ignoreDuplicates: true` on the existing snapshot conflict key.
  Neither producer is modified. Raw OM Hs and face height remain distinct fields.
- `actions/accuracy-actions.ts` → `get_yesterday_accuracy` → beach forecast tab,
  plus the retained `beach_ml_performance_baseline` materialized view, consume
  legacy metrics. Their shape and analytics semantics are unchanged; **do not**
  use them for v1 model-comparison evidence.
- Seaside's repaired offset cron rejects the present unqualified buoy/face pairs,
  reports a limitation, and leaves existing offsets untouched. Existing serving
  flags and freshness gates still control whether prior offsets are applied.
- No migration, production flag change, deploy, model promotion, or production
  data write was performed. Generated database types were not hand-edited.

## Validation

`bash scripts/test-forecast-evaluation.sh` **PASS** on local PostgreSQL 15; output
is in `forecast-evaluation-v1-sql-test.txt`. The script creates and removes its own
private cluster, ignores environment database URLs, applies the actual migration,
and uses the actual unified view definition. Checks cover nearest time, complete
ties, source priority, invalid/sentinel/NaN heights, stale-only and missing data,
late arrivals, revision timestamps, frozen raw predictions, first label wins,
nullable corrected predictions, CDIP fallback, backup parity, fair retries,
function privileges and view security. Geography primitives are stubs: this is
real relational SQL execution, **not** real PostGIS/spatial coverage validation.
Concurrent separate-session contention and production query plans were not tested.

`git diff --check` **PASS**. No TypeScript changed; Jest/typecheck/build and browser
E2E were not run in Quiver. No screenshots/recordings: no UI was modified.
The full Supabase migration ledger reset was not run; the isolated PostgreSQL
fixture cannot certify all production-schema dependencies or extension placement.

`scripts/forecast-evaluation-readiness.sql` is a prepared read-only, aggregate-only
sample query (seven days through 24 hours ago, deterministic maximum 1,000 rows). It was not run
against production. It explicitly reports exclusions and operational coverage;
it does not invent issue-time or feature provenance.

## Release order, rollback and remaining gates

After cross-repository review and explicit operator approval, apply the database
migration before deploying the Seaside RPC client. Missing RPC/schema fails as an
error; there is no fallback to the old earliest-reading algorithm. Inspect actual
production definitions, pg_cron registrations, source RLS/extension privileges,
query plans and row counts before any release. Existing SELECT grants on source
tables must support the service role through the new invoker view.

Rollback the Seaside application first if necessary. The added columns, view,
functions and observation provenance triggers can safely remain; older clients
ignore them. Do not drop collected provenance or rewrite prediction history.
If a full SQL-function rollback is required, restore the reviewed pre-migration
`backfill_ml_observations_batch` body from `20260205131343` and the resolver from
`20260610001850`, retaining added columns. This would restore old sentinel/deletion
behavior and requires separate review/approval; do not blindly execute an old
migration ledger. No historical source revision or forecast issue time can be
recovered through rollback.

Remaining gates: production sample access, qualified QC/face labels, archived
issue-time feature vintages, real PostGIS and scale/query-plan checks, and operator
review. The current public `/crons/status` confirms these jobs are registered,
but does not verify their deployed code SHA or database/serving configuration.

## Implemented model-comparison continuation

The operator authorized the follow-up plan. Seaside now includes a closed feature
schema, explicit measurement/qualification protocol and an immutable offline
`forecast-comparison/v1` snapshot → prepare → score workflow. It verifies fixed
maturity label selection against archived revisions, binds both models and transforms
to the same input cases, fits only on training, selects only on validation, and
reports paired test coverage/errors with time-block uncertainty and locked gates.
Its full executable contract and commands are in the companion Seaside handoff.
No Quiver runtime producer, serving flag, entitlement, ranking or analytics contract
was changed by this continuation. Local CLI snapshots do not modify operational
first-write labels or historical predictions.

The read-only inventory now works on **legacy schema before migration** using
nullable JSON projection for added provenance. It samples valid times from the last
seven days that are at least 24 hours old (≤1,000 newest deterministic rows), so
future forecasts cannot crowd out matured cases. It groups coverage by beach, date,
station, source and horizon with overlapping limitation reasons. Strict eligibility
is NULL / NOT_EVALUATED: this operational log is not an audited v1 evaluation export.
Qualified eligibility counts must come from Seaside's actual validator.

`bash scripts/test-forecast-evaluation.sh` was rerun successfully. The private
PostgreSQL fixture now inserts a past and future forecast before the migration and
asserts that only the past row is counted, operational match coverage is one, missing
provenance is reported and strict count is NULL. It then applies the actual migration
and runs the existing matching/revision/first-write/privilege tests and post-migration
inventory. No remote schema/data was read or written. SQL evidence is in
`forecast-evaluation-v1-sql-test.txt`.

Real comparison is still NOT READY: no authorized qualified row export with exact
issue/input availability exists in this task; qualification, source history and
artifact training audits remain needed. PostGIS, PostgREST, full-ledger integration,
concurrent contention and production scale remain separate unrun release gates.
