# Vercel budget controls — September 15, 2026

## Result

The approved $20 on-demand budget, notifications, and automatic project pause were saved and verified in Vercel. With the current $20 Pro subscription this targets roughly $40/month before taxes or other billable extras. Metering delay means it is not an exact invoice ceiling.

The changes below are prepared for `main` and release PR [#787](https://github.com/SteveChandler/quiver/pull/787), which promotes `main` to `prod`. They were integrated on top of `main` at `1f64da19b`. The production migration is not applied, and production savings have not been measured.

| Work | Change | Constraint retained |
| --- | --- | --- |
| Email retry loop | `claim_gmail_reply_sync` uses the existing durable run ledger to back off consecutive failures for 1, 2, 4, 8, then 15 minutes. Deferred requests do no OAuth/Gmail work, return HTTP 503 with `Retry-After`, and omit duplicate exception alerts. | Missing messages remain unresolved, outbound eligibility stays closed, healthy sync cadence and the 90-second freshness gate are unchanged. |
| City cache churn | City reports use the oldest valid update timestamp among displayed forecast sources. The server renders an absolute UTC time, avoiding changes caused only by the clock advancing. Unknown freshness is not presented as a new update. | Forecast queries, conditions, and all refresh intervals remain unchanged. |
| Build costs | Retained docs/test-only exclusions and `main`/`prod`/`preview/**` deployment restrictions. Fixed the missing-previous-SHA case to build conservatively. Tests cover missing Git history, configuration changes, and unknown runtime paths. Documented batching in `docs/GIT_WORKFLOW.md`. | Runtime changes earlier in a deployment batch still build, even with a docs-only final commit. |

Live read-only diagnostics found 764 `gmail_message_gaps_unresolved` failures and one OAuth 503 in the preceding 12 hours. These are genuine unresolved mailbox records. Backoff reduces repeated work; it does not recover or dismiss those messages. Recovery still requires recovered metadata or a separately reviewed determination that a message is unrecoverable.

## Files

Production behavior:

- `vercel.json`
- `lib/email/gmail-replies.ts`
- `app/api/cron/email-replies/route.ts`
- `supabase/migrations/20260915132444_gmail_reply_retry_backoff.sql`
- `actions/city/city-conditions-actions.ts`
- `components/city/city-conditions-hero.tsx`

Validation and documentation:

- `__tests__/lib/email/gmail-replies.test.ts`
- `__tests__/app/api/cron/email-replies/route.test.ts`
- `__tests__/integration/email-reply-backoff.sql`
- `__tests__/actions/city/city-conditions-actions.test.ts`
- `__tests__/components/city/city-conditions-hero.test.tsx`
- `__tests__/config/vercel-config.test.js`
- `contracts/email-system/automation.http-contract.ts`
- `scripts/test-email-lifecycle.sh`
- `scripts/test-email-system-http.sh`
- `docs/GIT_WORKFLOW.md`
- This report.

## Verification

Commands run from this worktree. Tests use local placeholders, not production credentials:

```sh
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=local-fixture
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export SUPABASE_SERVICE_ROLE_KEY=local-fixture
```

Passed: 46 tests in six suites:

```sh
yarn test:unit --runInBand --runTestsByPath __tests__/lib/email/gmail-replies.test.ts __tests__/app/api/cron/email-replies/route.test.ts __tests__/app/api/cron/email-automation-monitoring.test.ts __tests__/actions/city/city-conditions-actions.test.ts __tests__/components/city/city-conditions-hero.test.tsx __tests__/config/vercel-config.test.js
```

Passed:

```sh
bash scripts/test-email-lifecycle.sh
bash scripts/test-email-system-http.sh
yarn typecheck
yarn deadcode
git diff --check
```

The first script runs a disposable PostgreSQL database, migration assertions, and existing concurrent-claim checks. The second runs three contracts through real local PostgREST/PostgreSQL, with external provider requests replaced by fixtures and external network calls rejected. It verifies deferred retries do not read Gmail or create reply-sync runs, then verifies recovery after the fixture deadline is advanced.

Scoped ESLint passed:

```sh
yarn eslint --max-warnings=0 actions/city/city-conditions-actions.ts app/api/cron/email-replies/route.ts components/city/city-conditions-hero.tsx lib/email/gmail-replies.ts __tests__/actions/city/city-conditions-actions.test.ts __tests__/app/api/cron/email-replies/route.test.ts __tests__/lib/email/gmail-replies.test.ts __tests__/config/vercel-config.test.js __tests__/components/city/city-conditions-hero.test.tsx contracts/email-system/automation.http-contract.ts
```

Passed:

```sh
VERCEL_ENV=preview yarn build
```

The build used the local placeholder environment above. Compilation, type validation, and prerendering completed. Expected local data-read errors reported invalid placeholder JWTs, so this is build evidence, not verification against production forecast data. Next also warned about the parent worktree lockfile/root inference.

After the deployment-filter fix, the focused configuration tests passed again:

```sh
yarn test:unit --runInBand --runTestsByPath __tests__/config/vercel-config.test.js
```

Browser E2E and production recovery/deployment were not run. UI tests verify the rendered timestamp remains identical across clock advances and is omitted for unknown source freshness.

## Push verification on refreshed main

`yarn typecheck` passed after integrating `main` at `1f64da19b` and correcting the timestamp test's nullable assertion. The focused timestamp suite passed again (2 tests):

```sh
yarn test:unit --runInBand --runTestsByPath __tests__/components/city/city-conditions-hero.test.tsx
```

Full push gate, using the same local environment above:

```sh
yarn test:unit --bail=0 --runInBand
```

Initial result before the follow-up below: **1,447 suites / 18,535 tests passed; one unrelated baseline test failed**. There were 16 skipped suites, 195 skipped tests, and one todo. The failure is `scripts/__tests__/session-acquisition-funnel-report.test.ts:635`: web's validation-code set includes `wave_height_required`, while the sibling native form's error-code set does not. This same failure was already documented in PR #787 before the budget changes; neither source involved was changed here. All budget suites passed in the full run. The initial budget build passed before the refreshed-main SEO commit was incorporated; the refreshed tree then passed typecheck and the affected tests.

PR #787 already had conflicts in the surf-game generated bundle/index and `docs/operations/swell-watch-native-tracking-release-20260913.md` before these changes. This task adds the budget commits to `main`; it does not merge the release PR or resolve unrelated production divergence.

## Native validation-code follow-up

The report now matches the current native form, where wave height is optional. It retains `wave_height_required` as a legacy code so events from older installed builds and historical reports keep their original classification. Native form behavior is unchanged.

Changed `scripts/session-acquisition-funnel-report.ts` and `scripts/__tests__/session-acquisition-funnel-report.test.ts`. The regression checks current-code exclusion, historical aggregation in both report windows, saved-report validation, and Markdown rendering. It failed before the fix and passed afterward.

Using the same local placeholder environment, all follow-up checks passed:

```sh
yarn test:unit --runInBand --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts
yarn typecheck
yarn eslint --max-warnings=0 scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
yarn test:unit --bail=0 --runInBand
git diff --check
```

Focused result: **93 tests passed**. Full result: **1,448 suites / 18,537 tests passed**, with 16 skipped suites, 195 skipped tests, one todo, and all four snapshots passing. This resolves the cross-repository failure documented above. Build and browser E2E were not rerun for this reporting-only follow-up.

## Production migration and release integration (2026-09-15)

Steven authorized the migration and PR #787 production merge. Applied only `20260915132444_gmail_reply_retry_backoff.sql` through the production `postgres` owner connection, in one transaction with canonical migration tracking. Statement SHA-256: `ab1324859e62956afb0904603adc6c944985d24c5630a178052d874b257e7bf3`.

- Fresh full `pg_dump` custom-format backup: `/Users/stevenchandler/Desktop/dev/.backups/prod-before-vercel-budget-20260915.dump`, 265,410,517 bytes; SHA-256 `a97a101c7f2c4042a349bf826da5875811ae01cc6b095a78907c4a77b79b5646`. PostgreSQL 15 dump completed successfully; `pg_restore --list` verified the archive catalog contains the claim function, reply state, run ledger, and migration history. The default PostgreSQL 14 binary initially rejected server version 15; the successful backup used the installed PostgreSQL 15 binary.
- Retained the previous function definition beside the backup as `gmail-reply-claim-before-20260915.sql`.
- Postflight passed: migration version/name tracked; index valid; function remains invoker-owned by `postgres`; grants remain `postgres` and `service_role` only. Function definition MD5: `99624fe984de22c6d9f744ed7c7507a6`.
- A transaction-rolled-back claim check asserted a retry between 1 and 900 seconds, unchanged run count, unchanged mailbox state, and outbound readiness false. All 51 unresolved Gmail messages remain unresolved.

Release preflight found Vercel rejected the 261-character `ignoreCommand` before building. Removing the redundant nested-Markdown exclusion reduced it below the 256-character limit; Git's existing `*.md` exclusion handles nested Markdown too. Added tests for Vercel's length limit and a nested component README. All three configuration tests and scoped ESLint passed. Vercel accepted the corrected configuration and started the next build.

Conflict resolution retains the newer `main` game bundle, its matching HTML and accessibility changes, the complete budget/backoff implementation, and the extended swell-watch release record. Production's existing camera/SEO fixes remain in the release tree. The release uses a regular merge from `main` into a branch based on `prod`, preserving one-way history; no `prod` merge enters `main`.

Merged-tree local validation passed: `yarn typecheck`; `yarn test:unit --bail=0 --runInBand` (1,448 suites / 18,535 tests passed, 16 skipped suites, 195 skipped tests, one todo, four snapshots); `bash scripts/test-email-lifecycle.sh`; `bash scripts/test-email-system-http.sh` (three contracts); `git diff --cached --check`; and verification that the game HTML references existing assets. The test count differs from the earlier main-only run because the merged tree preserves production’s camera/SEO test changes.

## Production-only forecast hotfix preservation

PR #788 merged to `prod` as `596dace1462f43813328de71305b4fed328ab2e9` after Prod Gate passed typecheck, lint, unit tests, build, and all 20 browser smoke tests; the separate email/offer contracts also passed. PR #787 was closed as superseded after verifying its main head was an ancestor of production. The camera/SEO backport to main has the same tree as that release.

Final deployment inspection found the live production alias was serving CLI deployment `dpl_MC5vStau7PV9vbZ6yqHwt9L357NJ` from a dirty worktree based on `86bffa8f0`, with `forecastFix=cd03f4202`. Those deployed forecast fixes were absent from both Git branches. The replacement deployment `dpl_3DnUnucd6znUZPAx55wQJgpG7yHv` was canceled before promotion; `www.quiversurf.app` was verified still on the existing healthy deployment.

The follow-up preserves that deployed hotfix in Git: current-window countdown bounds, shared condition scoring, scored-forecast range/board context, surf-call source-row identity, and the existing blue Maybe map marker. All 17 restored source/test files exactly match `/private/tmp/quiver-window-production-20260914`; the original worktree was only read. No additional forecast behavior was introduced. The database retry migration remains applied and verified while the final application release is checked.

Preservation validation: typecheck and scoped ESLint passed. The full run passed 18,560 tests and exposed one stale session-decision test mock missing the real `resolveNativeSkillLevel` helper. Preserving the module’s actual exports fixed that test; its two-test suite and lint passed. Production code still exactly matches the deployed hotfix. The final production CI gate reruns the complete suite. The live sync ledger records attempts at 14:10:21 and 14:26:21 UTC, verifying bounded retry recovery after a 16-minute gap rather than the previous one-minute loop; 51 unresolved message holds remain.

## Original release plan (migration completed above)

1. Review and authorize the code release, then use the normal feature → main → prod flow in one batch. The application is compatible with the existing claim RPC before the migration is applied.
2. Before the database change, take a fresh production backup (proposed artifact: `prod-before-vercel-budget-20260915.sql`); no backup has been created by this task.
3. Separately authorize migration `20260915132444_gmail_reply_retry_backoff.sql` on `vawdnbbgawichorsjiwe` using the production owner connection and normal migration tracking. It replaces one existing invoker function and adds an index. It does not update mailbox history, resolve missing messages, change grants, or enable sending.
4. Verify actual scheduled attempts defer while the deadline is active and resume when due; HTTP 503 remains expected while gaps persist. Read the sync ledger and confirm no history was skipped and outbound eligibility remains closed.
5. Compare full-day Vercel infrastructure spend and ISR write units at similar traffic after deployment. Minute-level function invocations remain scheduled; the savings come from avoiding repeated provider work and unnecessary content changes. Do not assume a dollar saving until measured.

If rollback is required, restore the previous `claim_gmail_reply_sync(text)` definition from `20260914170000_gmail_reply_reconciliation.sql` with the production owner; the added index can remain. Roll back application changes through the normal reviewed release flow. Do not clear reply gaps or change contact controls as part of rollback.

References: [Vercel ISR pricing](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing), [Vercel spend management](https://vercel.com/docs/spend-management). Unchanged revalidation output does not incur ISR writes; spend management checks can lag usage.
