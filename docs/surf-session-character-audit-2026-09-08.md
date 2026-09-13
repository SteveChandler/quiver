# Surf-session character audit

Follow-up: the [September 9 decision report](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/docs/surf-session-character-decision-2026-09-09.md) supersedes the draft-clearing behavior and incomplete-review status below. This original cohort report remains a historical baseline.

Audit date: September 8, 2026, America/Los_Angeles. Local implementation only; no commit, push, deployment, remote migration, or production mutation.

## Conclusion

Quiver has surface-condition classification and a narrow, active heavy/closeout setup warning. It does not have demonstrated session-level predictive accuracy for closeouts, barrels, makeable barrels, rideable-wave opportunities, waits between sets, or wave-to-wave consistency. A good recommendation score is not evidence that those conditions were predicted correctly.

The bounded patch repairs observation capture, preserves the cause of explicit warnings through native presentation, and withholds unsupported numeric frequency/wait estimates from three nullable consumer paths. It does not tune forecast thresholds or recommendation weights. The retained legacy scored-forecast endpoint remains an unresolved numeric-frequency exposure.

The audit includes 107 real-user sessions, but recovers **zero matching saved pre-session outputs**. Current-code replay provides diagnostics, not historical accuracy. No improvement percentage, calibrated probability, false-warning rate, or held-out predictive-performance claim is warranted.

## Findings, ordered by impact

1. **Native forecast hints were becoming observations without confirmation.** Forecast prefill inserted surface tags into session state; save then persisted them as feedback. Restored drafts could carry the same contamination. Native now keeps hints out of selected characteristics until a user taps them, including draft restoration. Numeric wave-height prefill remains and is not treated as independent truth in this audit. Previously saved surface tags cannot be retrospectively certified as independent.
2. **Warning causes were being lost in presentation.** Web character generation described every composite skip as blown out, including non-wind setup/size restrictions. Native current-condition translation could then overwrite a server skip with a favorable local verdict. The patch preserves the actual non-wind reason and returns an explicit server skip unchanged in the shared native translator. Existing wind/setup safety rules and scoring ceilings remain intact.
3. **Numeric opportunity and wait estimates have no recovered observational calibration.** The calculator turns periods, pairwise beat intervals, assumed waves/set, and break/wind/tide factors into hourly counts and set intervals. Forecast confidence is not event-prediction calibration. Surf-call, conditions mapping, and email enrichment now return null for these quantities. Existing nullable contracts and null-safe displays are reused. The legacy number-typed scored API is deliberately not silently broken.
4. **Session snapshot actuals omit the reported tags.** All 105 recovered snapshots lack `actual_conditions.wave_characteristics`, despite 78 sessions having tags. Calibration joins also omitted the session field. An additive local migration copies authoritative session tags into actuals on snapshot insertion, updates them when session tags change, and backfills existing matching records. It preserves the saved forecast and its timestamps; it does not repair historical observation provenance.
5. **Most requested session-character dimensions are capability or evidence gaps, not measurable model misses.** Closeouts were explicitly tagged in 24 sessions, but none of 90 replayable rows triggered the existing narrow setup warning. Barrels occurred in 12 sessions from only three users, with five also tagged closeouts. No makeability observation was recovered. Do not equate barreling with makeable, walled with closeout, or rating/board fit with physical shape.

## Cohort and evidence provenance

The earlier 68-session/17-answer cohort was not reproduced. This report uses the explicitly bounded fallback window, without comparing the two cohorts as if identical.

| Item | Result |
| --- | --- |
| Local window | June 1 through September 8, 2026, inclusive; September 8 partial |
| UTC filter | `[2026-06-01T07:00:00Z, 2026-09-09T07:00:00Z)` |
| Extraction timestamp | `2026-09-09T04:36:04.019Z` |
| Session timing | Actual arrival; logged-time fallback for null arrival |
| Completed rows queried | 126 |
| Excluded | 12 deleted; 7 mock/system/non-real |
| Included | 107 sessions, 26 users, 40 beach IDs, 99 beach-days |
| Notes / characteristic tags | 49 / 78 sessions |
| Accuracy answers | 7 inaccurate, 22 somewhat, 13 accurate; 65 missing |
| Saved session forecast snapshots | 105; 2 absent |
| Recommendation IDs / impressions / session contexts | 0 / 0 / 0 |
| Feedback contexts fetched | 19; no matching saved pre-session output |

Accuracy answers describe user feedback, not independently adjudicated accuracy in each physical dimension. Session source values were 43 `auto_title`, 62 `manual`, and 2 missing; these are not installed-app-version or tag-origin provenance.

| Evidence class | Sessions | Meaning |
| --- | ---: | --- |
| A: saved output before surfing | 0 | No trusted historical prediction/outcome comparisons |
| B: pre-session input revision | 70 | Source row vintage qualifies; historical code/configuration and full-session output do not |
| C: hindsight or incompatible match | 35 | 20 post-session revisions; 15 beach/custom-peak/owner mismatches |
| D: unavailable | 2 | No snapshot |

Matching checks beach/peak and owner compatibility, issue/revision/fetch timing, and a 90-minute start-slot tolerance. Forecast valid time alone is insufficient. Every retained comparison is a single hourly slot, **not a forecast covering the whole session**. No whole-session predictions were recovered. B is not promoted to A: beach configuration at surf time is unavailable, and all replay uses inspected current code and current beach configuration.

The replay denominator is 90: 70 B rows plus 20 explicitly hindsight-only C rows. The 15 incompatible matches and 2 absent snapshots are not replayed. C is never counted as validated historical accuracy.

### Input availability

Among 105 snapshots: wave height 105, period 103, wind speed/direction 105, tide height/status 105, primary swell height 105/period 104/direction 105, secondary swell fields 98, wind-wave height 105/period 93/direction 105, and raw forecast payload 105. These are populated fields, not a guarantee of correct units, local representativeness, or historical delivery.

Existing bulk/partition metadata can support diagnostic hypotheses. The extraction does not provide a local wave-event series, observed set schedules, directional spreading, or session-level opportunity counts sufficient to validate the requested event predictions. No new ingestion was built.

## Capability and evidence matrix

Denominator is 107 included sessions. Counts overlap across dimensions. "Usable" means conservatively interpretable user evidence for that dimension, not externally verified truth or a complete-session label. Unknown includes unreported, ambiguous, and provenance-uncertain evidence. Users and beach-days refer to usable observations. Every row has **0 trusted historical output matches**.

| Dimension | Reported | Usable | Unknown | Users | Beach-days | B input matches | Capability assessment |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Surface texture | 76 | 8 | 99 | 5 | 8 | 6 | Active wind-based classification; legacy surface tags are contaminated/uncertain |
| Shape / closeouts | 38 | 29 | 78 | 8 | 29 | 18 | Narrow setup warning; no general demonstrated peeling/closeout prediction |
| Barrel occurrence | 12 | 12 | 95 | 3 | 12 | 6 | No demonstrated per-session predictor |
| Barrel makeability | 0 | 0 | 107 | 0 | 0 | 0 | Missing target observations and demonstrated capability |
| Worthwhile-wave frequency | 1 | 1 | 106 | 1 | 1 | 1 | Existing heuristic, not calibrated opportunity prediction |
| Sets / lulls | 5 | 5 | 102 | 5 | 5 | 3 | Reports exist; no demonstrated timing forecast |
| Arrival consistency | 0 | 0 | 107 | 0 | 0 | 0 | Unknown |
| Size consistency | 0 | 0 | 107 | 0 | 0 | 0 | Unknown |
| Shape consistency | 0 | 0 | 107 | 0 | 0 | 0 | Unknown |
| Unspecified consistency | 0 | 0 | 107 | 0 | 0 | 0 | Unknown; do not infer a subtype |
| Power / takeoff character | 51 | 51 | 56 | 13 | 47 | 30 | Tag-based reports; size/period and static spot descriptors are only proxies |
| Within-session evolution | 2 | 2 | 105 | 2 | 2 | 1 | Hourly trend/stability exists; not validated against full-session changes |
| Observed size, notes only | 4 | 4 | 103 | 1 | 4 | 2 | Numeric prefill excluded as independent truth |
| Ride direction | 11 | 11 | 96 | 4 | 11 | 8 | Observations, not a measured directional prediction |

Surface evidence is deliberately conservative: 68 surface-tag sessions have no user-written surface note. Eight usable note cases include scoped or negative statements; they are not eight binary whole-session labels. Across replayable rows, only four produce a non-unknown surface diagnostic, including two capability gaps.

Shape extraction retains 24 mixed/ambiguous observations rather than silently turning `walled` or `peaky` into closeout labels. Raw tag counts are: choppy 37, clean 27, glassy 25, fat 29, mushy 20, powerful 15, steep 6, peaky 11, walled 13, closeouts 24, barreling 12, reform 5, lefts 8, rights 9, blown_out 3. Closeout tags span seven users/24 beach-days, with 14 B input matches; barrel tags span three users/12 beach-days, with six B matches. These are clustered, self-selected reports, not independent random samples.

The parser preserves source, minimal note span, negation, mixed status, early/later scope, and interval bounds. A wait for good waves is not an assertion of no waves. A lower-bound wait remains lower-bounded. Forecast quotations are not observations. Twenty-six of 49 notes contain no recognized condition phrase; private originals remain available for a later manual adjudication rather than being labeled negative.

## Diagnostic replay, not historical performance

| Diagnostic over 90 replayable rows | Result |
| --- | ---: |
| Surface: unknown observation | 86 |
| Surface: missed warning | 1 |
| Surface: agreement on warning | 1 |
| Surface: capability gap | 2 |
| Closeout: unknown observation | 69 |
| Closeout: capability gap | 21 |
| Active setup-risk warnings | 0 |
| Real cases exercising corrected non-wind label | 0 |
| Candidate numeric frequency outputs withheld | 90 |
| Score changes | 0 |
| Trained/tuned rules | 0 |
| Held-out predictive performance | Unavailable |

There is no adequate explicitly negative closeout cohort and no historical output denominator for a false-warning rate. Zero recorded false warnings must not be presented as zero false-warning risk. The existing calculator emitted 90 numeric estimates in the 0-60 waves/hour range, including 58 beat-interval cases. Withholding them is a removal of unsupported specificity, not a demonstrated forecasting-accuracy gain.

### Traceable, redacted examples

Case keys are HMAC pseudonyms, reproducible with the private audit salt. Minimal spans below locate evidence without publishing full session notes or user IDs. Current replay text is clearly distinguished from what a user actually saw.

| Case | Evidence and diagnostic |
| --- | --- |
| `2e5ebac64e87883c` | Huntington Beach Pier Northside, July 26, B input, saved slot 60 minutes before arrival. Note span `choppy` at offset 40. Current replay describes small/clean/glassy: a diagnostic miss, not recovered historical copy. |
| `6bfc587d8c466c46` | Newport Upper Jetties, June 8, B input, slot at arrival. Note span `choppy` at offset 16. Current replay describes small/choppy/onshore: a positive control, not proof of the historical prediction shown. |
| `af0210a5a5c76b89` | B input. `10 to 15 mins` at offset 62 refers to worthwhile waves. Preserve the interval and target; do not label the ocean flat. |
| `a66dd64ea530391b` | B input. `long lulls` at offset 17 and `20 mins +` at offset 48. Preserve the 20-minute lower bound and unknown upper bound for sets. |
| `c6debd5d83c68f01` | C input. `5-10 min` at offset 43 refers to waves. Retained as observation/hindsight evidence, excluded from historical accuracy. |
| `ca5999725f7d4168` | B input. `long waits` at offset 16 is qualitative, not an invented numeric count. |
| `1f3bb87ac55a0058` | C input. `waves just stopped coming` at offset 119 describes within-session evolution, not necessarily a flat whole session. |

There are no trusted A-class examples of either correct or incorrect delivered forecasts. The positive control is included to avoid selecting only diagnostic misses while remaining explicit about that limitation.

## Production-path trace and bounded changes

### Observation capture and snapshot persistence

Web session characteristics start empty; web prefill fills numeric/environmental fields, not characteristic tags. Native `inferWaveType` derives surface hints from wind/aspect. The native reducer previously selected those hints automatically. The patch removes that selection and strips unconfirmed legacy draft tags. Existing chip hint rendering and manual selection remain; session payload shapes are unchanged.

The calibration action now selects `wave_characteristics` in both session joins. The optional actuals type is additive. The migration uses a fixed-search-path SECURITY DEFINER function, matching session ownership before copying tags, and revokes public function execution. It synchronizes snapshot actuals on insert/update and session-tag changes, including empty/null values. Its backfill does not relabel historical forecast-prefilled tags as user-origin observations. No remote migration was run.

### Physical restrictions before presentation

Discovery uses the existing scoring engine, including wind, tide, swell, setup-risk, trend, and stability plugins. Scoring ceilings remain minimum constraints rather than another duplicate wind penalty. The active setup heuristic requires a beach break, at least 6-foot height, at least 10-second period, dropping tide, and a sufficiently low tide (at/below zero or one foot below the preferred minimum). Its existing warning is retained, not newly calibrated.

Web character generation preserves a non-blown-out skip reason verbatim. Native `translateCurrentSurfCall`, shared by home and surf-decision consumers, preserves an explicit `skip` character before favorable display-context reclassification. Affinity, distance, preference, board fit, scalar weights, and safety thresholds are unchanged. Two native regression cases cover both setup and wind reasons under otherwise favorable display conditions.

### Frequency and full-session limitations

The unchanged calculator uses single-swell `3600 / period`, pairwise `T1*T2 / abs(T1-T2)` beat intervals, a 60-600-second clamp, assumed 2-7 waves/set, and modifiers, capped at 60/hour. Those implementation choices are not evidence of observed rideable-wave arrival rates.

The patch nulls frequency/wait output in surf-call logic, conditions mapping, and email enrichment; it does not change the physical forecast or scores. The audit reuses the existing calculator for baseline diagnostics and the patched mapper for candidate output. **The legacy `app/api/forecasts/scored/[beachId]/route.ts` still returns numeric slot and peak frequency.** No current native source consumer was found in the scoped search, but that is not proof there are no external/installed consumers. Retire it through an explicit versioned contract, not an incompatible type change hidden in this patch.

Static spot-profile punchiness is not a per-session barrel or makeability predictor. Hourly stability is not wave-arrival consistency. A previous surf-zone-intel plan is a proposal, not deployed closeout code; its proposed proxy thresholds were not activated. Seaside was inspected read-only and remains unchanged.

### Inspected versions

| Surface | Evidence |
| --- | --- |
| Web task base | `c0fa2bfd8bbad44e7d56c1fbffd1208bbd011dcb` |
| Native task base | `68dabb8b85f20a19e7ddae2a50a6529b41de68b2` |
| Seaside inspected | `78ebd50ae2c8e285ec88f5c8a31419fe215a0000` |
| READY production deployment at inspection | `dpl_BSLYHwoW5SQSiP4wiyrJEkErEFgd`, prod SHA `cf192eced7b7ca53413078255d2b18a3c1372888` |

Both task worktrees use branch `orch/surf-session-character-20260908` in their separate repositories. Dirty parent worktrees were preserved. Current production deployment identity does not establish the deployment at each historical surf time. No feature gate was found around the inspected scoring/frequency functions; production environment flag values were not retrieved. Installed native versions for these sessions are unknown.

## Files changed

### Web production code and migration

- [actions/forecast-calibration-actions.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/actions/forecast-calibration-actions.ts): include characteristic tags in calibration session joins.
- [types/forecast-snapshot.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/types/forecast-snapshot.ts): optional actuals field.
- [lib/domains/scoring/condition-character.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/lib/domains/scoring/condition-character.ts): preserve non-wind skip causes.
- [lib/utils/surf-call-logic.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/lib/utils/surf-call-logic.ts): withhold unsupported frequency/wait numbers.
- [lib/mappers/conditions-mappers.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/lib/mappers/conditions-mappers.ts): null numeric frequency fields.
- [lib/email/signal-enrichment.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/lib/email/signal-enrichment.ts): withhold frequency/wait/confidence output.
- [supabase/migrations/20260909050000_preserve_session_wave_characteristics.sql](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/supabase/migrations/20260909050000_preserve_session_wave_characteristics.sql): new additive tag synchronization/backfill; local only.

### Audit tools and web tests

- [scripts/analysis/surf-session-character.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/scripts/analysis/surf-session-character.ts): new conservative observation/matching helpers.
- [scripts/analysis/surf-session-character-audit.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/scripts/analysis/surf-session-character-audit.ts): new read-only extraction and offline replay CLI.
- [__tests__/scripts/surf-session-character.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/__tests__/scripts/surf-session-character.test.ts): new parser/provenance regressions, including requested synthetic distinctions, negation, missingness, mixed evidence, prefill, wait ranges, time/owner/peak mismatch, and duplicates.
- [__tests__/lib/domains/scoring/condition-character-cause.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/__tests__/lib/domains/scoring/condition-character-cause.test.ts): new actual setup-risk engine regression, preserved cause/score.
- [__tests__/integration/session-wave-characteristics.sql](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/__tests__/integration/session-wave-characteristics.sql): new disposable-database migration checks.
- [__tests__/actions/forecast-calibration-actions.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/__tests__/actions/forecast-calibration-actions.test.ts): added both-query field assertion.
- [__tests__/lib/utils/surf-call-logic.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/__tests__/lib/utils/surf-call-logic.test.ts): modified normal/early-return null expectations.
- [__tests__/lib/mappers/conditions-mappers.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/__tests__/lib/mappers/conditions-mappers.test.ts): modified supported null-output expectations.
- [__tests__/lib/email/signal-enrichment.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/__tests__/lib/email/signal-enrichment.test.ts): modified null expectations and assertion that numeric calculator is not called.
- This report is new.

### Native production code and tests

- [src/lib/session-form-state.ts](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/surf-session-character-20260908/src/lib/session-form-state.ts): hints no longer silently selected; unconfirmed draft tags cleared.
- [src/lib/current-surf-translation.ts](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/surf-session-character-20260908/src/lib/current-surf-translation.ts): preserve explicit server skip.
- [src/__tests__/session-form-state.test.ts](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/surf-session-character-20260908/src/__tests__/session-form-state.test.ts): modified prefill and confirmed-draft expectations; added confirmed/unconfirmed restoration cases.
- [src/__tests__/session-form-screen.test.tsx](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/surf-session-character-20260908/src/__tests__/session-form-screen.test.tsx): modified hint/manual-selection/time-change and confirmation-dependent feedback coverage.
- [src/__tests__/current-surf-translation.test.ts](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/surf-session-character-20260908/src/__tests__/current-surf-translation.test.ts): added setup/wind warning preservation cases.

## Reproduce the audit without production writes

Run in the web task worktree. The CLI only uses HTTP GET for extraction, checks the expected production hostname, paginates with bounded requests, rejects duplicate identities, and fails on request errors. Output must be outside the repository. Private records and the HMAC salt remain in the restricted local evidence directory, not committed with this report.

```sh
yarn tsx scripts/analysis/surf-session-character-audit.ts --env /Users/stevenchandler/Desktop/dev/quiver/.env.local --output /Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/audit
```

Result: PASS. Authoritative extraction above. This reads the already-authorized project-local credential file without printing its values.

Offline replay, no network or new credentials required:

```sh
yarn tsx scripts/analysis/surf-session-character-audit.ts --input /Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/audit/input.private.json --output /Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/audit
```

Result: PASS, same cohort/provenance; 90 frequency outputs withheld and 0 scores changed. Keep the salt private to preserve traceability without publishing user/session identifiers.

Artifacts: [aggregate summary](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/audit/summary.json), [restricted case evidence](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/audit/cases.private.json). The latter is private user data despite pseudonymization; do not publish it.

## Verification ledger

Commands below ran in the corresponding task worktree unless noted. A focused pass is not a full-repository or E2E pass. Failed invocations are retained rather than hidden by the successful reruns.

### Web focused unit tests

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-placeholder SUPABASE_SERVICE_ROLE_KEY=unit-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand __tests__/scripts/surf-session-character.test.ts __tests__/lib/domains/scoring/condition-character-cause.test.ts __tests__/lib/domains/scoring/condition-character.test.ts __tests__/lib/domains/scoring/setup-risk-scorer.test.ts __tests__/actions/forecast-calibration-actions.test.ts __tests__/lib/utils/surf-call-logic.test.ts __tests__/lib/mappers/conditions-mappers.test.ts __tests__/lib/email/signal-enrichment.test.ts
```

Final result: PASS, 8 suites / 226 tests. Earlier run before the added calibration assertion: PASS, 225 tests.

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-placeholder SUPABASE_SERVICE_ROLE_KEY=unit-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand __tests__/actions/forecast-calibration-actions.test.ts __tests__/lib/mappers/conditions-mappers.test.ts __tests__/lib/utils/surf-call-verdict-gate.test.ts __tests__/app/api/sessions/get-session-with-snapshot.test.ts __tests__/hooks/use-session-form.test.ts
```

Result: PASS, 5 suites / 74 tests; existing React `act` warnings in form-hook tests. Counts overlap the focused run and should not be summed as unique tests.

### Native focused unit/screen/contract tests

```sh
npm test -- --runInBand src/__tests__/session-form-state.test.ts src/__tests__/session-form-utils.test.ts src/__tests__/api-contracts.test.ts
npm test -- --runInBand src/__tests__/session-form-screen.test.tsx src/__tests__/session-form-draft-store.test.ts
npm test -- --runInBand src/__tests__/session-form-screen.test.tsx src/__tests__/session-form-state.test.ts src/__tests__/session-form-draft-store.test.ts src/__tests__/session-form-utils.test.ts src/__tests__/api-contracts.test.ts
npm test -- --runInBand src/__tests__/session-form-screen.test.tsx src/__tests__/session-form-state.test.ts src/__tests__/session-form-draft-store.test.ts src/__tests__/session-form-utils.test.ts src/__tests__/api-contracts.test.ts src/__tests__/current-surf-translation.test.ts
```

Results in order: PASS 123 tests; FAIL 2 outdated autofill expectations / 89 passed; FAIL 2 remaining old draft/feedback expectations / 214 passed; final PASS **6 suites / 223 tests**. Fixtures now distinguish explicit confirmation from untouched forecast hints. No failing unit assertion remains in the final focused run.

### Typechecks

```sh
yarn typecheck --incremental false
npm run typecheck -- --incremental false
```

Web: PASS. Native: PASS, including the final reducer/translator changes.

### Scoped lint and dead-code checks

```sh
./node_modules/.bin/eslint --max-warnings=0 actions/forecast-calibration-actions.ts types/forecast-snapshot.ts lib/domains/scoring/condition-character.ts lib/utils/surf-call-logic.ts lib/mappers/conditions-mappers.ts lib/email/signal-enrichment.ts scripts/analysis/surf-session-character.ts scripts/analysis/surf-session-character-audit.ts __tests__/scripts/surf-session-character.test.ts __tests__/lib/domains/scoring/condition-character-cause.test.ts
```

Result: PASS. Expanded web invocation appended `__tests__/actions/forecast-calibration-actions.test.ts __tests__/lib/utils/surf-call-logic.test.ts __tests__/lib/mappers/conditions-mappers.test.ts __tests__/lib/email/signal-enrichment.test.ts`: FAIL under zero-warning policy, four existing restricted-matcher warnings in the calibration test at lines 376, 729, 798, 824; zero errors. Its chained test command did not run, so tests were subsequently invoked separately and passed.

```sh
./node_modules/.bin/eslint src/lib/session-form-state.ts src/__tests__/session-form-state.test.ts --max-warnings=0
./node_modules/.bin/eslint src/lib/session-form-state.ts src/lib/current-surf-translation.ts src/__tests__/session-form-state.test.ts src/__tests__/session-form-screen.test.tsx src/__tests__/current-surf-translation.test.ts --max-warnings=0
```

Initial narrow native lint: PASS. Final expanded native lint: FAIL under zero-warning policy, zero errors / 16 warnings: 15 existing screen-test style/import/unused warnings, plus existing unused `normalizeWaveHeight` in the translator. These warnings are not hidden or fixed through an unrelated cleanup.

```sh
yarn deadcode
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-placeholder SUPABASE_SERVICE_ROLE_KEY=unit-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn deadcode
```

First attempt: FAIL, missing environment configuration. Configured attempts: FAIL, repository-wide findings. The audit now imports the existing wave-frequency barrel instead of leaving that barrel newly orphaned. Final findings include 6 unused files, 1 unused dependency, 13 unused dev dependencies, 32 unlisted dependencies, 5 unlisted binaries, and 557 unused exports. No full clean-baseline comparison was run, so not every finding is attributed as pre-existing. See [final dead-code log](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/deadcode-final.log). Repository-wide cleanup is not part of this physical-forecast patch.

### Local database migration checks

```sh
docker exec supabase_db_quiver createdb -U postgres quiver_character_audit_20260909
psql postgresql://postgres:postgres@127.0.0.1:54322/quiver_character_audit_20260909 -X -v ON_ERROR_STOP=1 -f __tests__/integration/session-wave-characteristics.sql
docker exec supabase_db_quiver createdb -U postgres quiver_character_audit_20260909_final
psql postgresql://postgres:postgres@127.0.0.1:54322/quiver_character_audit_20260909_final -X -v ON_ERROR_STOP=1 -f __tests__/integration/session-wave-characteristics.sql
```

Both disposable-database runs: PASS. Final coverage includes backfill, attempted actuals overwrite, empty/null edits, unchanged saved forecast and snapshot creation timestamp, and new snapshot insertion. These use minimal local tables and the actual migration, not a full deployed schema/RLS/load test. The shared primary local database and production database were not migrated. The two task-owned disposable databases remain available for inspection.

### Build

The first `yarn build` used the same placeholder local Supabase values as the unit tests and `VERCEL_ENV=preview`: FAIL at `/forecast/orange-county` prerender with invalid JWT `PGRST301`; compilation/typechecking had passed.

The successful rerun used valid local-only Supabase credentials, not production credentials:

```js
const { execFileSync, spawn } = require('child_process');
const local = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(local.API_URL)) {
  throw new Error('Expected local Supabase');
}
const env = {
  ...process.env, VERCEL_ENV: 'preview',
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};
const p = spawn('yarn', ['build'], { env, stdio: 'inherit' });
p.on('exit', code => { process.exitCode = code ?? 1; });
```

Result: PASS, all 185 pages generated, exit 0. Warnings included inferred workspace root from linked dependencies and absent local `water_quality_held_beaches`. This is not production-data or native-device validation.

### Review and E2E status

`git diff --stat`, `git diff --check`, and the scoped web production diff were inspected earlier; whitespace check passed at that point. No commit was made. The final native guard and test-fixture edits are covered by the final tests/typecheck, but no additional final full-diff reread was performed. Operator/Sol final review remains required.

Reviewed existing E2E material: [web calibration honesty](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/e2e/calibration-honesty.spec.ts), the opening portion of [web session form](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/e2e/session-form.spec.ts), [web E2E guidance](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/e2e/README.md), and [native session logging flow](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/surf-session-character-20260908/.maestro/flows/session/log-session-basic.yaml). The native flow explicitly creates a real production session, so it was not run under the no-production-write constraint.

**Final E2E status: NOT RUN, not a pass.** No E2E files were changed. Native renderer tests are not device E2E. No simulator screenshots or before/after visual QA were captured. Full repository unit suites and a native release build were not run.

## Rollback, remaining risks, and next decisions

No production rollback is currently necessary because nothing was deployed. For eventual rollout, review web/native independently and stage the additive database migration first. Roll back only this task's application hunks; do not reset dirty parent worktrees. Migration rollback is to remove its two synchronization triggers and function while retaining the additive JSON key. Deleting the copied observations is unnecessary and risks data loss. Reverting the native observation fix would reintroduce contamination; reverting frequency suppression would restore unsupported specificity.

Remaining risks: unknown installed-native provenance; old saved/drafted surface tags; sparse and clustered self-reports; parser under-recall and incomplete manual adjudication; no historical exposure/configuration or whole-session coverage; a conservative native skip guard that still needs aligned-time device QA; the legacy numeric API; minimal-schema rather than full-schema migration testing; zero-warning lint/dead-code failures; and unrun E2E/visual/release gates. Additive backfill cost and production locking have not been measured. No threshold calibration or predictive model should be approved from this sample alone.

Top three decisions:

1. **Review the provenance and warning-preservation patch for rollout, not as a forecasting-accuracy release.** Complete isolated non-production session-save/device checks and full-schema migration validation before operator approval. Keep physical restrictions authoritative.
2. **Retire unsupported numeric opportunity/wait claims through explicit contracts.** The nullable consumer changes are ready for review; separately version the scored endpoint and audit its consumers. Do not replace removed numbers with invented confidence bands or deterministic set schedules.
3. **Collect the minimum independent, time-bounded evidence before tuning.** Preserve manual-vs-prefill origin and prediction exposure/vintage; distinguish occurrence, makeability, opportunities, waits, and consistency subtypes. Seek explicit opposite-condition controls and more independent users/beach-days. Only then define a held-out evaluation and consider bounded physical-rule changes.
