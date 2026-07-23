# Forecast Source Handoff Shadow Design

Date: 2026-07-16

Status: approved Phase 0 foundation; implementation pending review

Parent architecture: [Canonical Session Decision Engine Design](./2026-07-17-canonical-session-decision-engine-design.md)

## Scope Within Phase 0

This document governs only GFS-Wave shadow capture, source monitoring, and
source-policy-boundary extraction. The interim recommendation hold, legacy
decision envelope, attribution instrumentation, and observation-matching
correction are separate Phase 0 workstreams governed by the parent architecture
and their own implementation plans.

## Problem

The July 2026 Elida event exposed a large gap between external forecaster calls
and Quiver's Southern California surf heights. The event also crosses Quiver's
hard 72-hour source boundary: NOAA/NWS supplies the first three days and
Open-Meteo becomes primary afterward. GFS-Wave issue-time capture, which was
created to evaluate this class of source disagreement, stopped on 2026-06-18
because capture is hard-disabled in code.

The current evidence proves that the forecast needs investigation and better
source observability. It does not yet prove that multiplying heights, choosing
the largest source, or changing beach decay factors would improve accuracy.

## Product Decision

Keep all discrepancy handling internal. Do not show a low-confidence badge,
warning, or other user-facing confidence treatment.

Use a staged rollout:

1. Restore report-only GFS-Wave issue-time capture.
2. Add internal freshness, coverage, discrepancy, and source-seam monitoring.
3. Isolate the 72-hour source decision behind a tested policy boundary while
   preserving current serving behavior by default.
4. Change serving only after matured observations validate a candidate policy.

Beach decay, shoaling, displayed confidence, and forecast formulas remain
unchanged during evidence collection.

## Considered Approaches

### Immediate production source switch

Replace the 72-hour cutoff now or select the largest available source. This may
raise the current event forecast, but it can create broad overforecasting and
has no matured-observation evidence. Rejected.

### Monitoring only

Keep serving unchanged and only run the forecaster comparison. This detects the
problem but does not restore the missing source evidence needed to fix it.
Rejected as incomplete.

### Staged shadow evaluation

Restore source capture, make the handoff decision testable, and require
issue-time truth scoring before serving changes. Selected because it preserves
the current product contract while producing the evidence needed for a safe
fix.

## Stage 1: Restore GFS-Wave Capture

Replace the hardcoded capture disable in
`lib/services/noaa-wavewatch/gfs-wave-shadow.ts` with a new default-off revision
capture gate. Capture requires both
`FORECAST_SOURCE_REVISION_CAPTURE_ENABLED=true` and
`GFS_WAVE_SHADOW_CAPTURE_ENABLED=true`. The double latch prevents a stale
production value for the old flag from activating writes immediately on deploy.

Preserve the existing safeguards:

- observable-beach scope only;
- non-blocking fetch outside the display forecast dependency chain;
- request timeout and abort behavior;
- all-zero and missing-height payload rejection;
- append-only immutable issuance revisions and candidate rows;
- no writes to `enhanced_forecasts` from the shadow source.

The old production environment flag may already exist. The new revision gate is
introduced default-off, and code deployment, flag activation, and first-write
verification remain separate release steps.

### Immutable source identity

P0-C persists five levels of evidence:

1. `forecast_source_capture_runs` records execution status, shard and code
   version, expected scope, and completion counts.
2. `forecast_source_capture_scope` records the immutable beach membership,
   region, coordinates, horizon anchor, and scope hash selected when the run is
   atomically started. Run denominators come from these rows, not caller counts.
3. `forecast_source_capture_attempts` records exactly one immutable retrieval
   outcome per run and beach. This is the current-run coverage truth even when
   the provider payload resolves to an issuance revision first created by an
   earlier run.
4. `forecast_source_issuance_revisions` separates stable
   `issuance_identity` from immutable `issuance_revision_id` and records source,
   model, grid or beach identity, provider issue time when available, retrieval
   time, request fingerprint, raw payload hash, adapter/parser versions, quality
   status, the creating capture run, and `supersedes_revision_id`.
5. `forecast_source_candidates` records valid time, horizon, partitions,
   measurement basis, units, and candidate quality for the exact revision.

Scope rows, attempts, issuance revisions, and candidates are append-only. A capture-run
manifest is operational state: it may make one guarded, idempotent `started` to
terminal transition through its finalization RPC and is immutable afterward.
The finalizer derives every count from immutable attempt rows; callers never
self-report coverage. Its final counts therefore describe the current retrieval
run even when that run reuses an unchanged immutable issuance revision first
recorded by an earlier run.

A changed provider payload or parser version creates a new revision. It never
rewrites an earlier revision. If the upstream proxy does not expose a provider
cycle, `source_issued_at` remains null, issuance identity stays stable at the
source/model/beach unknown-cycle stream, and exact raw/parsed payloads are
deduplicated across capture runs. Run/beach attempts preserve retrieval
coverage, but repeated retrievals are not counted as independent model cycles.
Evidence capture for one beach is sampled no more often than every six hours
and the Phase 0 campaign stops for storage review after 90 days. Existing GFS
rows are classified
`legacy_identity_incomplete` and excluded from promotion evidence.

## Stage 2: Internal Monitoring

Extend the existing read-only WaveCast comparison tooling rather than creating
a user-facing surface. The monitor will report:

- scraper snapshot age and failed-source count;
- aligned, under, over, jumpy, and missing comparison counts;
- largest regional undercall and affected beaches/dates;
- the active data source and transformation provenance;
- NOAA-to-Open-Meteo seam timing and height discontinuity;
- GFS-Wave latest issue time, nonzero coverage, and staleness.

The script should support a machine-readable summary and a strict mode with a
nonzero exit code when the scraper is stale, shadow capture is stale, or a
configured critical discrepancy threshold is exceeded. Normal forecast serving
must never depend on this script succeeding.

The local forecaster scrape remains the input for the WaveCast comparison. The
monitor may run after a successful local scrape, but failures only alert the
operator; they do not alter displayed forecasts.

## Stage 3: Source Policy Boundary

Extract the current source choice from `NOAAWaveWatchService.mergeForecasts`
into a pure, unit-tested policy function with an injected anchor time. The
initial default policy exactly
preserves today's behavior:

- NOAA/NWS at or before 72 hours;
- Open-Meteo after 72 hours when the matching slot exists;
- NOAA fallback when Open-Meteo is absent;
- Open-Meteo extension beyond NOAA's available range.

The policy interface will accept both candidate rows, forecast horizon, and a
policy mode and will return the selected source, stable reason code, and
`legacy-72h.v1` policy version. Candidate modes must remain shadow-only until
the evidence gate is met. The GFS candidate is captured beside the decision but
cannot enter serving selection during P0-C. This change creates a safe seam for
later evaluation without silently changing production heights.

No candidate policy will use `max(NOAA, Open-Meteo, GFS)` or a storm multiplier.
The eventual policy must be selected from issue-time comparisons against matured
observations.

## Evidence Gate For Serving Changes

Collect healthy issue-time rows until the sample, coverage, and diversity gates
are met; calendar time alone is not sufficient and there is no four-week upper
bound. Correct the existing nearest-observation matcher before using it as a
promotion gate. Score identical offshore source slots against correctly
time-matched matured buoy observations; do not treat offshore significant wave
height as breaking-face-height truth.

A target segment requires at least 30 independent issue cycles, 500 matured
aligned rows across at least five beaches, both sides of the 72-hour seam where
relevant, and at least 95% expected capture coverage. Event-aware policies also
require at least three distinct historical or live event cases. Use the frozen
two-way product-weight cluster bootstrap: independently resample paired issue
cycles and observation station (region only when station is absent), then
apply the product of both multiplicities so correlated beach, valid-time, and
shared-truth rows are not treated as independent samples.

At minimum, compare:

- current best-match policy;
- NOAA/NWS candidate values where available;
- Open-Meteo values;
- pinned `ncep_gfswave016` values;
- mixed-swell and non-mixed conditions;
- horizon buckets including the 60-96 hour seam and 121-168 hours;
- exposed and sheltered beach groups.

Use the existing Phase 9 gate for GFS-Wave: at least 0.02 m and 5% relative MAE
improvement in the target mixed segment, with the lower bound of the frozen 95%
two-way paired-cycle × station/region cluster-bootstrap interval above zero. A candidate is rejected if
protected-segment MAE worsens by more than 0.02 m absolute or more than 5%
relative; both guardrails must pass. A
NOAA/Open-Meteo handoff candidate must likewise beat the current policy on
identical rows without violating those shorter-horizon or non-mixed guards.

Any production-serving enablement requires a separate approval after the report
is reviewed. Passing this source gate certifies only the source reconciliation
policy. Beach transformation and session ranking changes must separately pass
the beach-response and decision gates in the parent architecture.

P0-C can collect and characterize evidence, but it cannot pass a promotion gate
until P0-D has produced approved nearest-time observation matches with exact
candidate, station, issue-cycle, and tolerance lineage. Historical rows without
that lineage cannot be relabeled as trusted evidence.

## Testing And Verification

Implementation follows test-driven development:

1. Change the capture-gate test to require env-controlled enablement and observe
   it fail while the hard disable remains.
2. Add monitoring parser/summary tests for stale, missing, aligned, and critical
   discrepancy cases.
3. Add immutable revision tests for unchanged retrievals, provider corrections,
   parser corrections, unknown provider cycles, and rejected payload attempts.
4. Add source-policy characterization tests at 72 hours, immediately after 72
   hours, with a missing Open-Meteo slot, and beyond the NOAA range.
5. Run the focused Jest tests, scoped ESLint, and `yarn typecheck` on Node 22.
6. Run the live read-only GFS validation and WaveCast comparison. Record network
   or upstream blockers explicitly rather than treating fixtures as live proof.

No browser E2E is required for the source-only changes in this document. The
parent Phase 0 recommendation hold, legacy decision envelope, attribution, and
any response-contract changes require their own API, web, native, alert, and
messaging-path tests. Existing forecast E2E coverage will be reviewed for blast
radius.

## Rollout And Rollback

Rollout order:

1. Land capture and monitoring code with legacy serving policy as the default.
2. Deploy Quiver.
3. Verify fresh, nonzero GFS-Wave rows and unchanged display-path health.
4. Accumulate and score evidence.
5. Request approval for any serving-policy change.

Rollback is immediate: set `FORECAST_SOURCE_REVISION_CAPTURE_ENABLED=false`
(or disable the narrower `GFS_WAVE_SHADOW_CAPTURE_ENABLED` latch). The display
forecast path remains on the legacy policy throughout the evidence phase, so
capture rollback does not alter user-visible forecasts.

## Explicit Non-Goals

- No low-confidence UI or warning.
- No suppression or modification of objective forecast data. The separately
  specified parent-architecture safety hold may suppress positive
  recommendations without changing displayed physical heights.
- No beach decay, shoaling, or offset changes.
- No direct GFS-Wave serving.
- No model retraining or correction-layer revival.
- No production database mutation outside the structured source-capture writer
  and approved append-only evidence schema within this source-only workstream.
  Other Phase 0 workstreams have separately reviewed append-only persistence
  requirements.
