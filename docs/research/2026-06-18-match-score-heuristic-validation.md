# Match Score Heuristic Validation

Date: 2026-06-18

## Scope

Track C asks whether the current personal match-score component weights align
with real session ratings. This report validates the hand-set base weights from
`compute_user_match_score_core`:

| Component | Current weight |
| --- | ---: |
| Wave height | 35% |
| Period | 25% |
| Wind speed | 20% |
| Tide | 10% |
| Wind direction | 10% |

This is read-only analysis. It does not ship a learned model or mutate
production data.

## Method

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/validate-match-score-heuristic.ts --output-json /tmp/quiver-match-score-heuristic-validation-20260620-refresh.json
```

Gate command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/validate-match-score-heuristic.ts --output-json /tmp/quiver-match-score-heuristic-validation-20260620-gated-refresh.json --fail-on-not-ready
```

Saved-report validation:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/validate-match-score-heuristic.ts --validate-output-json /tmp/quiver-match-score-heuristic-validation-20260620-refresh.json --max-report-age-hours 24
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/validate-match-score-heuristic.ts --validate-output-json /tmp/quiver-match-score-heuristic-validation-20260620-gated-refresh.json --max-report-age-hours 24
```

Machine-readable aggregate artifact from the latest rerun:

- `/tmp/quiver-match-score-heuristic-validation-20260620-refresh.json`
- `/tmp/quiver-match-score-heuristic-validation-20260620-gated-refresh.json` (exits `2`, as expected, because the gate is not ready)

The validator pulls completed rated sessions from an exact 12-month
measurement window, excludes mock, system, deleted, analytics-excluded, and
missing-profile users, requires `session_forecast_snapshots.forecast_snapshot`,
and parses the same forecast fields used by the RPC.

The production-readiness gate scores each session against that user's prior
same-break-type history only. This avoids lookahead leakage from future
sessions. The same run also emits an RPC-floor same-user diagnostic using one
prior same-break-type sample, plus a broad cohort diagnostic that scores against
other users' same-break-type ratings with leave-one-out history. Both
diagnostics are read-only sanity checks; neither is production personalization
approval evidence.
The JSON artifact now separates current-heuristic validation, RPC-floor
same-user diagnostics, broad cohort sanity checking, and reweighting readiness.
`currentHeuristicValidation` asks whether the deployed weights are supported by
the strict prior-history rating sample, `rpcFloorDiagnostic` shows how much
same-user signal is scoreable at the RPC's one-positive-sample floor while
marking it `productionEvidence: false`, `cohortSanityCheck` makes the broader
leave-one-out cohort diagnostic machine-readable while marking it
`productionEvidence: false`, and `reweightingReadiness` asks whether the sample
is large enough to nominate a reviewed reweighting experiment. The gate blocks
include stable `findingCodes` alongside human-readable findings, so Track C
automation does not need to parse prose.
The saved JSON now includes `reportSchemaVersion: 4`, `measurementWindow`, a
validated `rpcFloorDiagnostic`, deterministic user-level reweighting holdout,
and the non-production cohort sanity block. `--validate-output-json` fails
closed on stale/missing schema version, missing/malformed RPC-floor evidence,
RPC-floor loaded-sample mismatches, missing/malformed holdout evidence,
malformed counts/correlations, drifted current weights, stale `generatedAt`,
stale/missing/future/inconsistent measurement windows, UUID-bearing aggregate
output, hand-edited cohort sanity evidence that does not match the cohort
diagnostic, any artifact that marks diagnostic evidence as production evidence,
or any artifact that marks `reweightingReadiness.readyForProduction` as true.
`reweightingReadiness.readyForExperiment` now requires both the in-sample
best-grid Pearson and the held-out user Pearson to clear the same correlation
floor.

## Results

Verified real-user rerun on 2026-06-20 at `2026-06-20T12:27:42.831Z`
for measurement window `2025-06-20T12:27:42.831Z` to
`2026-06-20T12:27:42.831Z`.
The gated `--fail-on-not-ready` artifact was refreshed at
`2026-06-20T12:27:49.213Z` for measurement window
`2025-06-20T12:27:49.213Z` to `2026-06-20T12:27:49.213Z` and exited `2`,
as expected. Both saved artifacts validated with
`--validate-output-json --max-report-age-hours 24`.

Rating inventory:

| Stage | Sessions | Users |
| --- | ---: | ---: |
| Raw completed rated sessions | 62 | 17 |
| Real-profile rated sessions | 45 | 15 |
| Loaded sessions with forecast snapshots | 45 | 15 |

Attrition:

- Excluded non-real/deleted/system/missing-profile sessions: 17.
- Real-profile rated sessions missing forecast snapshots: 0.
- Sessions missing complete wave/period/wind/tide/wind-direction components after snapshot parse: 1.
- Strict prior-history gate drop: 44 complete-component sessions -> 5 scored sessions because only 1 user has enough prior same-break-type history.
- RPC-floor diagnostic reach: 12 prior-only same-user sessions from 2 users are scoreable at the RPC's one-positive-sample floor, but current-weight Pearson is still negative.
- Broad cohort diagnostic reach: 36 sessions from 11 users are scoreable with other users' leave-one-out same-break-type history, but this is not production evidence.

| Metric | Value |
| --- | ---: |
| Rated sessions loaded | 45 |
| Users loaded | 15 |
| Complete-component sessions | 44 |
| Prior-history scored sessions | 5 |
| Scored users represented | 1 |
| Pearson(score, rating) | -0.891 |
| Spearman(score, rating) | -0.447 |

RPC-floor same-user diagnostic:

| Metric | Value |
| --- | ---: |
| Profile scope | user |
| History mode | prior-only |
| Minimum same-break-type prior history | 1 |
| RPC-floor scored sessions | 12 |
| RPC-floor scored users represented | 2 |
| Pearson(score, rating) | -0.408 |
| Spearman(score, rating) | -0.370 |

This diagnostic mirrors the RPC's one-positive-sample floor more closely than
the strict gate, but it remains diagnostic only. It shows the current weights
are still negatively aligned even when near-cold-start same-user sessions are
included.

Component closeness vs rating:

| Component | Pearson | Spearman | Current weight |
| --- | ---: | ---: | ---: |
| Wave height | -0.263 | 0.112 | 35% |
| Period | -0.443 | -0.229 | 25% |
| Wind speed | -0.715 | -0.783 | 20% |
| Tide | -0.669 | -0.224 | 10% |
| Wind direction | 0.152 | 0.224 | 10% |

Average current score by actual rating:

| Rating | N | Avg current score |
| --- | ---: | ---: |
| 2 | 3 | 7.42 |
| 3 | 1 | 7.58 |
| 5 | 1 | 5.25 |

Exploratory grid search over 5% weight increments found:

| Scenario | Pearson(score, rating) | Weights |
| --- | ---: | --- |
| Current | -0.891 | wave 35%, period 25%, wind 20%, tide 10%, wind direction 10% |
| Best diagnostic grid | 0.152 | wave 0%, period 0%, wind 0%, tide 0%, wind direction 100% |

User-level holdout for the diagnostic grid:

| Split | Sessions | Users | Pearson |
| --- | ---: | ---: | ---: |
| Train | 5 | 1 | 0.152 |
| Holdout | 0 | 0 | n/a |

Broad cohort diagnostic, same run:

| Metric | Value |
| --- | ---: |
| Profile scope | cohort |
| History mode | leave-one-out |
| Minimum same-break-type cohort history | 3 |
| Cohort scored sessions | 36 |
| Cohort scored users represented | 11 |
| Pearson(score, rating) | -0.164 |
| Spearman(score, rating) | -0.159 |

Broad cohort component closeness vs rating:

| Component | Pearson | Spearman | Current weight |
| --- | ---: | ---: | ---: |
| Wave height | -0.061 | -0.071 | 35% |
| Period | -0.024 | -0.059 | 25% |
| Wind speed | -0.203 | -0.387 | 20% |
| Tide | 0.080 | 0.173 | 10% |
| Wind direction | -0.183 | 0.006 | 10% |

Broad cohort grid search found best Pearson `0.080` by putting 100% weight on
tide. That is diagnostic only and is weaker than the production-readiness
threshold.

## Cohort Sanity Check

The validator now emits a machine-readable `cohortSanityCheck` block for the
broad cohort diagnostic. This block is intentionally non-production evidence:
it uses other users' same-break-type history with leave-one-out scoring, which
increases signal coverage but is not the production personalization path.

| Criterion | Threshold | Observed | Status |
| --- | ---: | ---: | --- |
| Cohort scored sessions | 100 | 36 | fail |
| Cohort scored users represented | 25 | 11 | fail |
| Cohort current-weight Pearson | 0.200 | -0.164 | fail |

Verdict: `insufficient-signal`.

Finding codes:

- `cohort_not_production_evidence`
- `cohort_scored_sessions_floor`
- `cohort_scored_users_floor`
- `cohort_current_weight_pearson_floor`

## Current-Heuristic Validation

The validator now emits a machine-readable `currentHeuristicValidation` block
so Track C can distinguish "the current production weights are supported" from
"there may be enough data for a reweighting experiment."

| Criterion | Threshold | Observed | Status |
| --- | ---: | ---: | --- |
| Prior-history scored sessions | 100 | 5 | fail |
| Scored users represented | 25 | 1 | fail |
| Current-weight Pearson | 0.200 | -0.891 | fail |

Verdict: `not-validated`.

Findings:

- Prior-history scored sessions 5 is below 100.
- Scored users represented 1 is below 25.
- Current-weight Pearson -0.891 is below 0.200.

Finding codes:

- `current_scored_sessions_floor`
- `current_scored_users_floor`
- `current_weight_pearson_floor`

## Reweighting Readiness Gate

The validator now emits a machine-readable `reweightingReadiness` block,
including the history mode used for the gate, and can exit `2` with
`--fail-on-not-ready`.

| Criterion | Threshold | Observed | Status |
| --- | ---: | ---: | --- |
| Prior-history scored sessions | 100 | 5 | fail |
| Scored users represented | 25 | 1 | fail |
| Best diagnostic grid Pearson | 0.200 | 0.152 | fail |
| User-level holdout Pearson | 0.200 | n/a | fail |

Verdict: `not-ready`.

Finding codes:

- `scored_sessions_floor`
- `scored_users_floor`
- `best_grid_pearson_floor`
- `holdout_grid_pearson_unavailable`

This makes Track C an explicit guardrail: the diagnostic grid is interesting,
but the dataset is not large enough for even a reviewed reweighting experiment.
`readyForProduction` is always `false`; this validator can only nominate a
candidate experiment after sample floors, in-sample grid correlation, and
held-out user correlation pass.

## Interpretation

The current base heuristic is negatively aligned with observed real-user
ratings in the strict prior-history scored sample. The RPC-floor same-user
diagnostic also shows negative alignment across 12 scoreable sessions, and the
broader cohort diagnostic shows a weak negative current-weight Pearson across
36 scored sessions, with only tide showing a weak positive component Pearson.
This means the current base weights are not supported by this dataset as-is.

This does not prove the heuristic should be reweighted to 100% wind direction
or 100% tide. The same-user samples are small and clustered by user, while the
cohort diagnostic intentionally uses other users' ratings and is not the
production personalization path.
The result does prove the current weights should be treated as
unvalidated product heuristics, not learned truth.

## Recommendation

Do not ship a learned reweighting from this sample.

Near-term product-safe options:

1. Keep current weights but label the match score as low-confidence until a user
   has more rated sessions.
2. Consider reducing wind-speed and wind-direction influence in a reviewed
   experiment only after Phase 0 and session-acquisition instrumentation are
   live.
3. Re-run this validator after Track B increases rated-session volume, and
   require a non-regressing user-level holdout before changing weights.
