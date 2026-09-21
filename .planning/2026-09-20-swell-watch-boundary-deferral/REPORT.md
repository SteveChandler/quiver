# Swell Watch boundary deferral implementation

Branch: `fix/swell-watch-boundary-deferral`; starting HEAD: `eabecd79c`. No branch switch, push, PR, database access, or migration. The concurrent reviewer directory was not opened, staged, or deleted. Existing run logs remain untracked.

## Result and files changed

- `lib/alerts/swell-watch/horizon-derivation.ts`: explicit episode deferrals for a single actionability boundary, deterministically sorted by arrival-window latest time then onset source slot; no event for a deferred episode. Both-boundary straddles retain the existing error.
- `lib/alerts/swell-watch/native-sampling.ts`: derivation version `swell-watch-horizon-derivation.v3`.
- `lib/alerts/swell-watch/provider-impact-ingestion.ts`: carries `boundaryDeferrals` per scope, including when another scope suppresses the cohort.
- `__tests__/lib/alerts/swell-watch/horizon-derivation.test.ts`: minimum/maximum boundaries, unaffected later episode on the same track, unbounded/unclosed deferrals, ordering, immutability, and empty diagnostics.
- `__tests__/lib/alerts/swell-watch/partition-coverage.test.ts`: long single-boundary gaps, unavailable interruption, both-boundary rejection, retained Hatteras derived with the exact deferral.
- `__tests__/lib/alerts/swell-watch/shadow-evaluation-replay.test.ts`: v3 pins, empty deferrals, actual cohort-to-shadow propagation of nonempty diagnostics on evaluated and suppressed results using local retained data and fake RPC responses.
- `__tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts`: v3 pins, scope diagnostics, deferrals retained when event diagnostics are capped.
- `__tests__/lib/alerts/swell-watch/attested-run.test.ts`: v3 pin.
- `scripts/test-swell-watch-normalization.mjs`: v3 pin, persisted empty deferrals, retained Hatteras now evaluated with a minimum deferral, and corresponding health totals (5 evaluated, 0 suppressed).
- `docs/operations/swell-watch-boundary-deferral-20260920.md`: problem, supplied production evidence, new semantics, and founder decisions. The historical September 13 document is unchanged.
- `.planning/2026-09-20-swell-watch-boundary-deferral/REPORT.md`: this report.

The existing shadow result needs no duplicate field/type edit: `lib/alerts/swell-watch/shadow-evaluation.ts:14` derives its type from cohort ingestion and `:43` directly assigns `cohort.derivation`. `lib/alerts/swell-watch/study.ts:117` passes that result directly to the recording RPC.

The downstream guard review confirms `isActionable` protects `arrival_window_unobserved` and `unbounded_episode` at `lib/alerts/swell-watch/horizon-derivation.ts:169`; it becomes `episode.actionable` at `:173`. Event emission is guarded at `:181`, and `episode_interrupted_by_unavailable_partition` / `unclosed_episode` are guarded at `:197`. A deferral returns false, so all four behave exactly as for an outside-actionability episode. Physical validation is unchanged.

## Validation

Every Node command used Node v22.22.0 via `source ~/.nvm/nvm.sh && nvm use 22`. No full Jest suite was run. Jest RPC responses are local fixtures/mocks; no database was touched.

### TDD red, before production edits

```sh
source ~/.nvm/nvm.sh && nvm use 22 && npx jest --runTestsByPath __tests__/lib/alerts/swell-watch/horizon-derivation.test.ts __tests__/lib/alerts/swell-watch/partition-coverage.test.ts
```

Expected FAIL: **2 failed suites; 10 failed, 42 passed, 52 total tests; 0 snapshots**. The old closure still threw on single-boundary straddles, returned suppression for retained Hatteras, and had no v3 diagnostics.

After adding ordering and cohort/shadow coverage, still before production edits:

```sh
source ~/.nvm/nvm.sh && nvm use 22 && npx jest --runTestsByPath __tests__/lib/alerts/swell-watch/horizon-derivation.test.ts __tests__/lib/alerts/swell-watch/partition-coverage.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation-replay.test.ts
```

Expected FAIL: **3 failed suites; 17 failed, 43 passed, 60 total tests; 0 snapshots**. After implementation, the exact same command PASS: **3 passed suites; 60 passed, 60 total tests; 0 snapshots**.

### All requested targeted suites

Exact command (the command substitution selects only test files in the two requested trees that reference `swell-watch`):

```sh
source ~/.nvm/nvm.sh && nvm use 22 && npx jest --runTestsByPath $(rg -l 'swell-watch' __tests__/lib/alerts/swell-watch/ __tests__/api/cron/ -g '*.test.ts' | sort)
```

PASS: **18 passed suites; 350 passed, 350 total tests; 0 snapshots**. Selected paths:

```text
__tests__/api/cron/swell-watch-acquire-outcomes.test.ts
__tests__/api/cron/swell-watch-acquire.test.ts
__tests__/api/cron/swell-watch-evaluate.test.ts
__tests__/api/cron/swell-watch.test.ts
__tests__/lib/alerts/swell-watch/acquisition.test.ts
__tests__/lib/alerts/swell-watch/attested-run.test.ts
__tests__/lib/alerts/swell-watch/direction-normalization.test.ts
__tests__/lib/alerts/swell-watch/event-matcher.test.ts
__tests__/lib/alerts/swell-watch/horizon-derivation.test.ts
__tests__/lib/alerts/swell-watch/native-sampling.test.ts
__tests__/lib/alerts/swell-watch/partition-coverage.test.ts
__tests__/lib/alerts/swell-watch/persisted-history.test.ts
__tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts
__tests__/lib/alerts/swell-watch/provider-run-store.test.ts
__tests__/lib/alerts/swell-watch/shadow-evaluation-replay.test.ts
__tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts
__tests__/lib/alerts/swell-watch/single-run-diagnostics.test.ts
__tests__/lib/alerts/swell-watch/study.test.ts
```

The SQL-source contract test uses underscore names rather than the hyphenated search term, so it was also run explicitly:

```sh
source ~/.nvm/nvm.sh && nvm use 22 && npx jest --runTestsByPath __tests__/lib/alerts/swell-watch/study-partition-coverage-sql.test.ts
```

PASS: **1 passed suite; 1 passed, 1 total test; 0 snapshots**. Across both targeted selections, all **19 distinct suites / 351 distinct tests** pass. The four cron test files are also the complete result of a case-insensitive `swell[-_]?watch` reference search in `__tests__/api/cron/`.

### Final focused and static checks

```sh
source ~/.nvm/nvm.sh && nvm use 22 && npx jest --runTestsByPath __tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts
```

PASS after strengthening the event-cap preservation assertion: **1 passed suite; 24 passed, 24 total tests; 0 snapshots**.

```sh
source ~/.nvm/nvm.sh && nvm use 22 && node --check scripts/test-swell-watch-normalization.mjs
source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/alerts/swell-watch/horizon-derivation.ts lib/alerts/swell-watch/native-sampling.ts lib/alerts/swell-watch/provider-impact-ingestion.ts
```

Both PASS (exit 0; no output/diagnostics). Script syntax only; it was not executed.

```sh
source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit -p .
```

FAIL (exit 2): **21 diagnostics, all in `.next/types`; 15 TS2344 and 6 TS2307**. No diagnostic references a changed file. These concern unchanged Next route exports/signatures and stale generated references to missing routes. The affected source files have no diff against HEAD; both missing cron route files are also absent from HEAD. The existing `buildSwellWatchCopy` export in the swell-watch route is present at HEAD and is unrelated to horizon derivation. No generated output or unrelated route was changed to hide the failure.

Exact diagnostic locations and causes:

| Generated path under `.next/types/` | Line(s) | Cause |
| --- | --- | --- |
| `app/api/auth/apple-recovery/assess/route.ts` | 14 | TS2344: extra `assessHandler` export |
| `app/api/auth/apple-recovery/confirm/route.ts` | 14 | TS2344: extra `confirmHandler` export |
| `app/api/auth/check-session/route.ts` | 42 | TS2344: optional first request parameter |
| `app/api/cron/home-morning-call/route.ts` | 2, 7 | TS2307: missing route module |
| `app/api/cron/similarity-alerts/route.ts` | 2, 7 | TS2307: missing route module |
| `app/api/cron/swell-watch/route.ts` | 14 | TS2344: extra `buildSwellWatchCopy` export |
| `app/api/events/route.ts` | 14 | TS2344: extra `ANONYMOUS_ALLOWED_EVENTS` export |
| `app/api/forecasts/scored/[beachId]/route.ts` | 14 | TS2344: extra `scoreForecastSlots` export |
| `app/api/me/profile/route.ts` | 14 | TS2344: extra `handleGet` export |
| `app/api/surf/call/route.ts` | 53 | TS2344: optional route context parameter |
| `app/api/surf/discover/route.ts` | 14 | TS2344: extra `stripInternalRankingScore` export |
| `app/api/v1/auth/apple-orphan-detection/route.ts` | 14 | TS2344: extra `detectionHandler` export |
| `app/api/v1/auth/apple-orphan-precheck/route.ts` | 14 | TS2344: extra `precheckHandler` export |
| `app/best-time-to-surf/[city]/page.ts` | 14 | TS2344: extra `buildBestTimeMetadataCopy` export |
| `app/cams/[region]/page.ts` | 14 | TS2344: extra `CamsRegionDirectoryPage` export |
| `app/profile/[id]/page.ts` | 14 | TS2344: extra `buildProfileShareMetadata` export |
| `app/us-open-of-surfing-forecast/page.ts` | 14 | TS2344: extra `US_OPEN_FORECAST_FALLBACK_COPY` export |
| `validator.ts` | 1943, 2078 | TS2307: the two missing cron route modules |

`git diff --check`: PASS (exit 0; no whitespace errors).

`node scripts/test-swell-watch-normalization.mjs` was **not run**: it requires a named Docker PostgreSQL container (`scripts/test-swell-watch-normalization.mjs:17`), invokes `docker exec ... psql` (`:31`), and applies/rolls back migrations (`:78`). This is incompatible with the instruction not to touch any database. Its changed SQL integration expectations remain unverified at runtime. Browser E2E was not run because this change affects backend derivation and the requested cron/unit suites cover the affected surface.

## Database validation answer

**No migration is needed to accept `boundaryDeferrals` inside `derivation` or `derivation.scopes[]`, based on the latest repository SQL.** This is a source review conclusion, not a claim about a live database.

- The latest function body amendment is `supabase/migrations/20260918180000_harden_swell_watch_study_epochs_and_extend.sql:195`: it loads the epoch-5 definition and changes the acceptance check to the current cycle at `:202`–`:205`. Its later `:351`–`:352` statements only set timeouts. No new derivation-key restriction is introduced.
- The complete body is established by `supabase/migrations/20260914050000_amend_swell_watch_study_partition_coverage.sql:140`. At `:165`, the result must be an object and at most 131072 bytes. At `:181`–`:200`, derivation validation checks object type, authority qualification rule, scopes array, distinct source counts, and association with a derived scope outcome. It does **not** reject extra keys in either derivation object or scope objects, nor pin derivation version.
- The strict extra-key check is for `scopeOutcomes`, at that migration's `:173`–`:180` (`s-'sourcePointId'-'status'-'reason'`). This fix does not add keys there. Partition coverage validation starts at `:201` and the whole result is inserted as `p_result` at `:274`–`:275`, retaining extra derivation keys.
- `supabase/migrations/20260914190000_amend_swell_watch_study_model_partition_count.sql:35`–`:110` replaces the coverage-validation block; `supabase/migrations/20260916170000_amend_swell_watch_study_swell_system_count.sql:29`–`:49` adjusts absent-partition checks. Neither adds a derivation/scope key allowlist. The table stores JSONB without a derivation schema (`supabase/migrations/20260910180000_automate_swell_watch_study.sql:78`).
- Zod: `lib/alerts/swell-watch/attested-run.ts:18` validates provider input, not derivation output. `lib/alerts/swell-watch/study.ts:9` and `:16` validate configuration and completion receipts; `:113`–`:124` sends the shadow result unchanged and validates only the recording receipt. No result Zod schema strips or rejects the additional field.

## OPEN DECISIONS

### Founder: v3 study-cycle separation

A new authority epoch is **not technically required** to accept v3 output. It is **advisable for provenance**, but an otherwise identical new active epoch is **insufficient to prevent v2/v3 mixing**. Recommend a separately reviewed cycle boundary before rollout if the study must measure one derivation version.

Evidence:

- Authorities are append-only, and epochs advance by exactly one: `supabase/migrations/20260914050000_amend_swell_watch_study_partition_coverage.sql:30`–`:33`. The config hash includes contract/evidence and qualification-rule metadata at `:52`–`:55`.
- `swell_watch_study_cycle_start` in `supabase/migrations/20260918180000_harden_swell_watch_study_epochs_and_extend.sql:21`–`:39` walks backward over contiguous active epochs with equal `policy_hash`, `qualification_rule`, `cohort`, `scope_inputs`, and `target_days`. It ignores derivation version, config hash, provider contract reference, evidence hash, and expiry/not-before changes. Thus merely bumping an epoch or recording v3 in contract/evidence metadata does not split the study cycle.
- The current health function at the same migration's `:138`–`:150` counts evaluated results across the entire cycle and requires four distinct UTC issuance times per day after the cycle's initial `not_before`. It does not filter `result.derivation.version`. Its extension fixture explicitly expects epoch 6 to retain cycle start 5 (`scripts/test-swell-watch-normalization.mjs`, assertion `extendedHealth.cycleStartEpoch, 5`).
- Evaluations record the active authority epoch (`supabase/migrations/20260914050000_amend_swell_watch_study_partition_coverage.sql:274`), and successful results are immutable (`:233`). The application skips already-evaluated batches (`lib/alerts/swell-watch/study.ts:111`). Deployment therefore does not relabel or replay old successes as v3.

Founder decision: accept a mixed cycle with explicit version diagnostics, or authorize a real cycle break. An intervening revoked authority followed by a new active authority would break the current contiguous-active rule; a version-aware cycle contract would instead require separate reviewed SQL work. Neither is implemented or authorized by this fix. No threshold/rule was altered merely to force a reset.

### Verification gaps

- Production evidence (7/17 runs, five source points, epochs 5–6) was supplied in the task and was not independently queried.
- No live database validation, normalization integration execution, deployment verification, or study-authority mutation occurred. Static repository validation supports accepting the field; live migration parity remains unverified.
- Retained Hatteras replay clocks are bounds, not the exact historical evaluator clock. Both supplied bounds now derive with the same explicit deferral.
- Repository-wide typechecking remains blocked by the 21 generated Next type diagnostics listed above. No green repository typecheck is claimed; those unrelated routes were left outside this bounded fix.
