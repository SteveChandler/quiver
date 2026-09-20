# Automated Swell Watch study

Implementation plan, September 10, 2026. Deployment and a fresh provider run are authorized by Steven after implementation, tests, and review pass.

1. Extend the existing hourly acquisition job to recover retained fresh runs oldest-first, then acquire, validate, accept, complete, evaluate, and record the fixed ten-source cohort. Reuse the receipt collector, shadow evaluator, and collection lease. Recovery remains bounded by the policy freshness window; older failures remain gaps.
2. Add narrowly scoped database study authority and atomic automatic completion. Bind authority to the evaluation policy, cohort, coordinates, and terrain inputs; compare the inputs actually evaluated with this snapshot. Retain raw evidence, missingness, freshness, latest-revision, revocation, and disabled-send checks. Do not grant the generic attestation function to the service role.
3. Persist evaluated and suppressed outcomes. Count a UTC day only when all four distinct provider issuances have successful fresh evaluations covering every source under the same study authority. Retries cannot add days; suppressed runs cannot qualify. Zero candidates can qualify after a complete evaluation. This measures collection coverage, not forecast usefulness.
4. Test runtime ordering, disabled controls, failures, retries, and durable PostgreSQL behavior. Independently review the diff and fix findings before release.
5. Apply the reviewed database change, deploy, enable the automated study, and verify a fresh cycle. Preserve both disabled send flags and the absence of push authority.
6. Monitor hourly through the current Codex task, using Luna at medium effort for routine evidence checks. Escalate failures for investigation; notify only actionable changes and completion. Stop study processing at the configured target or expiry. The observation target is 30 qualifying days; elapsed days alone do not complete it.

The provider response does not itself echo the requested issuance. Automated acceptance records validation under the installed provider contract; it must not claim an independent upstream signature or confirmation that does not exist.

Verification:

- `yarn typecheck`: passed.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-key yarn test:unit --runInBand`: passed after review fixes, 1,418 suites / 18,299 tests; 16 existing skipped suites, 197 skipped tests, one todo.
- Scoped `yarn eslint --max-warnings=0` on changed TypeScript: passed after removing a conditional test assertion.
- `VERCEL_ENV=preview yarn build`, using existing Supabase build configuration: passed. Earlier attempts failed on a dependency symlink and then an empty test database during prerendering; neither was an application failure.
- Built HTTP smoke: acquisition without authentication returns 401; authenticated disabled acquisition returns 200 with zero enqueues; no-store headers preserved; evaluation without authentication returns 401. No browser UI changed; browser E2E was not added.
- `yarn deadcode` with test environment values: reports existing repository findings. Its output is byte-for-byte identical to a clean deployed baseline (`diff -u` exit 0); no new finding.
- `git diff --check`: passed.
- `bash scripts/test-swell-watch-study-postgres.sh`: passed in both implementation-agent and main-agent runs after review fixes. `bash -n scripts/test-swell-watch-study-postgres.sh`: passed.
- `bash /tmp/swell-watch-study-release.mCCrw4/test-tracked-migration.sh`: passed the same database suite using the exact production wrapper, including a SHA-256 equality assertion for the atomically stored migration source.
- GitHub Prod Gate completed successfully: typecheck, lint, unit tests, build, and 20 Playwright smoke tests. Contrary to the prior documented Actions limitation, this release did run CI. Browser smoke took 3.4 minutes.
- Main integration: `yarn typecheck` passed; `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-key yarn test:unit --runInBand --testPathPatterns=swell-watch` ran the full suite and passed 1,418 suites / 18,304 tests. The patch matched the production change exactly before this report update.

Production preflight at 15:45 UTC: evaluation epoch 2 remains active with the reviewed policy hash and October 25 expiry; durable control disabled at epoch 0; zero push-authority and shadow-demand rows. Owner connection reports `postgres`. The new migration is absent.

Fresh schema backup: `/Users/stevenchandler/.codex/swell-watch-study-backup.yHQina/public-schema.sql`, created by `supabase db dump --linked --schema public --file ...`; 1,541,980 bytes, SHA-256 `8e7da0907146c06f2ffd2231c5079fe6b745dfc3b7a084cc25e1d6c50a0c2109`. It contains the existing provider-currentness function definition. New study tables are initially empty; activation only appends study authority.

Activation uses `swell-watch-study-activate.sql`. Rollback uses `swell-watch-study-revoke.sql` and disables `SWELL_WATCH_STUDY_ENABLED` in the deployed environment. Retain the schema and evidence tables. A revoked authority invalidates machine-accepted evidence; it cannot be used to authorize sends. Keep both sending flags false.

Hourly monitoring is installed in the current Codex task as **Swell Watch automated study monitor**, using a Luna sub-agent at medium effort for routine checks and Sol at high effort for concrete failures. Vercel runs acquisition independently of this local monitor. Monitoring distinguishes pending deployment, suppressed evaluations, qualifying days, target completion, and expiry.

The first independent review held release for incomplete result validation, mutable beach inputs, rollover retry coverage, and loose rollback idempotence. Those fixes are implemented. Final independent review is GREEN with no actionable P0–P3 findings, including the exact production wrapper. The updated PostgreSQL suite passed both implementation-agent and main-agent runs, including pinned-input mutation rejection, complete-result validation, real legacy ingestion denial after authority revocation, preservation of manual evidence, and exact rollback temporal-field regressions. The wrapper suite also passed. Live activation and an unattended cycle are verified below.

## Authorized production execution

- Target: linked Quiver production Supabase project `vawdnbbgawichorsjiwe`, verified owner/session role `postgres`.
- Apply only `supabase/migrations/20260910180000_automate_swell_watch_study.sql`, with its exact source in a migration-tracking row in the same transaction. Do not push unrelated migrations or repair unrelated drift.
- Affected objects: three new append-only study tables, restricted study RPCs and guards, a wrapper retaining the original provider-currentness checks, and a study-only observation guard. No user-data deletion, push authority, policy renewal, or generic service-role attestation grant.
- Run the guarded `docs/operations/swell-watch-study-activate.sql` once; retain the existing policy and expiry. Back up and retain the existing schema artifact listed above.
- Set only `SWELL_WATCH_STUDY_ENABLED=true` for production; preserve existing producer configuration, shadow evaluation, and both false send flags. Release only the tested study delta from the deployed baseline, leaving unrelated main-branch SEO changes out of production.
- Verify a Ready production deployment, the `www.quiversurf.app` alias, and the existing hourly acquisition schedule. Trigger one authenticated acquisition and inspect durable outcomes, study health, disabled controls, and zero send authority/enqueues.
- On failure, retain evidence and report the actual cause; use the exact revocation artifact and disable the study flag if containment is needed. Do not weaken qualification rules to obtain a successful day.

Reviewed artifact checksums (SHA-256): migration `dff182f9b44e1fcc9e6224782b446d206596e52894337d5e62e6911735a7e3c6` (30,778 bytes); activation `a1749d8fcbc02d81f23ccec357784ad59d95140f6101a4199c8340dacf652e48`; revocation `6010ef865de6f851e3cbd9a2ec666c807e54bea2c8182f65cb9717aa4a64cdab`. The production wrapper is `/tmp/swell-watch-study-release.mCCrw4/apply-study.sql`; it adds only exact migration tracking before the migration's commit.

## Changed surface and test scope

Production TypeScript: the acquisition cron, new `lib/alerts/swell-watch/study.ts`, and successful per-scope diagnostics in the existing shadow evaluator. Database: the single study migration. Operations: activation/revocation SQL, this report, and the disposable PostgreSQL harness with four SQL fixtures.

Tests added or modified: study orchestration unit tests, acquisition route unit tests, shadow-evaluation diagnostics assertions, and disposable database integration checks. Existing relevant API tests and the current Prod Gate workflow were reviewed. No browser UI or native contract changed; browser E2E tests were not added or run locally. Built HTTP smoke checks passed again after review fixes, and CI passed all 20 browser smoke tests.

## Verified live release

- Production PR: [Automate no-send study acquisition and completion](https://github.com/SteveChandler/quiver/pull/724), merged as `0bd771314101b5def64dfcdd28f7874c5308d229`. The production tree exactly matches the locally tested implementation commit `b62b38e43fed735b17d907659ee91edb6c8f52b7`.
- Vercel deployment `dpl_6C8jB5vgu6v1qyhSUPXHcLSsWyVV` is Ready and serves [www.quiversurf.app](https://www.quiversurf.app). `vercel inspect www.quiversurf.app --scope stcha0004-9905s-projects` verified the alias; the release-artifact utility verified HTTP 200.
- Live Vercel project configuration confirms crons enabled, this exact deployment selected, and acquisition schedule `15 * * * *`.
- Production schema and migration-source hash match the reviewed artifact. Authority epoch 1 is active with unchanged October 25 expiry. All ten runtime-normalized scope inputs exactly match the authority snapshot. Service-role health and pending-run reads passed.
- At 09:38–09:39 Pacific on September 10, the authenticated production acquisition returned HTTP 200 with no-store headers. It recovered one retained run without failures, then acquired ten new raw receipts for the latest available 06:00 UTC issuance. This was a fresh acquisition, not a newly issued forecast.
- Automatic acceptance, completion, and durable evaluation accounting succeeded. Eight sources were derived; San Francisco was suppressed for `unbounded_episode`, and Outer Banks for `incomplete_partition`. The immutable ledger retained one suppressed result across recovery and the equivalent retry.
- Cron history records `ok` in 11.0 seconds. Study health is active with zero evaluated runs, one suppressed result, and zero of thirty qualifying days. Ten source outcomes were retained. Both disabled send controls remain required; durable control is disabled, production push authority count is zero, and notification-binding count is zero.
- The first trigger using an old local credential returned 401 and did not run the job. Retrying through `vercel env run -e production` used the current credential in memory and succeeded. No credential was printed, rotated, or copied into the repository.

Production commands applied: `supabase db query --linked --file /tmp/swell-watch-study-release.mCCrw4/apply-study.sql --output json`; the same command with the guarded activation file; `vercel env add SWELL_WATCH_STUDY_ENABLED production --value true --yes --no-sensitive --scope stcha0004-9905s-projects`; reviewed PR merge; authenticated acquisition through `vercel env run -e production`. Read-only live verification used `supabase db query --linked --file /tmp/swell-watch-study-release.mCCrw4/verify-live.sql --output json`.

Remaining limits: the live run proves the complete unattended path for a suppressed outcome, not a successful qualifying day. Success/day accounting is covered by database tests. The provider does not echo issuance identity, two sources currently fail qualification, and thirty qualifying days may not accumulate before expiry. No thresholds were weakened. The installed hourly monitor continues read-only checks with Luna/medium and escalates concrete failures with Sol/high; no manual per-run acceptance or study-completion action is required.

Main synchronization also merged after all four Main Gate checks passed: [Sync deployed automated study to main](https://github.com/SteveChandler/quiver/pull/725), commit c30f34eb4d82913a827cc8f508f02b13d7c794bb. Production implementation files are identical across main and prod. The independent Luna monitoring check confirmed the active hourly heartbeat, live ledger, disabled control, zero push authority, and zero notification bindings. The public production alias remained Ready on the reviewed production commit after main synchronization. The original user checkout remains clean; the implementation checkout retains only this updated local release report as an uncommitted change, with the code and core report already committed to main.

## September 11 coordinate-authority refresh

The 17:15 UTC acquisition failed closed after a separately approved catalog correction changed Ocean Beach SF – Middle (`e8a921b7-c2b5-4259-9e5c-bd06765f7ae4`) longitude from `-122.513` to `-122.51229`. A fresh production snapshot confirms this is the only changed pinned field. Five acceptances and five suppressed evaluations remain intact; no send authority or notification binding exists.

The user explicitly approved refreshing the study authority after tests and independent review. Execution plan: append active epoch 2 for exactly that coordinate correction, retaining the original policy, cohort, provider contract, evidence, and October 25 expiry. Start current-epoch accounting at the refresh time without deleting historical evidence. Add a separate exact epoch-2 revocation artifact; leave the original activation/revocation and applied migration unchanged. No application deployment, catalog reversal, policy renewal, or sending changes are included.

Target is production Supabase project `vawdnbbgawichorsjiwe`, owner `postgres`; only `public.swell_watch_study_authorities` is to receive an appended row. Before applying, run the disposable PostgreSQL harness and independent review, then verify active health, the exact new snapshot, unchanged historical rows/expiry, and disabled sending. Existing immutable receipt batches must not be rewritten to accommodate the new coordinates; collection may need the next provider issuance.

Fresh backup: `/Users/stevenchandler/.codex/swell-watch-study-refresh-backup.UPcWSl/public-schema.sql`, SHA-256 `7d5aca4ac3dae4922fc7c66ae751a7d8bd5d7315143ea2ca4f7b167839b5c442`. Scoped pre-write evidence: `study-before.json` in the same private directory, SHA-256 `8447eef8a5cce518e1211c1b2686a893d7313b4f0b43043aeb1f5b20abbfcf87`. The first dump failed authentication; a sequential retry succeeded.

Refresh checks and independent Sol/high review are GREEN:

- `bash scripts/test-swell-watch-study-postgres.sh`: PASS in implementation, main-agent, and independent-review runs. The initial main run failed because fixture serialization removed PostgreSQL numeric lexemes from the pinned hash; the fixture now preserves the database's exact JSON text. The suite covers initial/retry drift and armed-control rejection, exact retries, temporal revocation guards, unchanged historical evidence, reset accounting, frozen issuance conflicts, and corrected-issuance completion/evaluation. A pre-existing time-of-day pending-fixture collision was isolated in the test fixture.
- `bash -n scripts/test-swell-watch-study-postgres.sh scripts/test-swell-watch-study-refresh.sh`: PASS.
- `git diff --check`: PASS.
- No application TypeScript, deployed schema, original activation/revocation, or applied migration changed. Typecheck/build/browser E2E were not rerun for this SQL-only operational change; no E2E tests were modified. Database integration is the relevant end-to-end check and passed.

Changed files: the new refresh and refreshed-revocation SQL artifacts, three `swell-watch-study-refresh*.sql` fixtures, `scripts/test-swell-watch-study-refresh.sh`, its integration into the existing PostgreSQL harness, the pending-test isolation in `swell-watch-study-probe.sql`, and this report. Supabase safety checks supplied live preflight/backup verification; Ponytail kept the production change to existing authority machinery without runtime or schema changes.

Applied command, PASS: `supabase db query --linked --file /Users/stevenchandler/.codex/worktrees/swell-watch-automated-study/docs/operations/swell-watch-study-refresh-ocean-beach-sf.sql --output json`. Reviewed SHA-256: refresh `d4e7d432c5d3ed53f30aa435ba9fd7b63f211dab2413c6858b04a3fce848ec38`; matching revoke `ee2d75f75ed87abe293daacda07289c8b0f6c43bd9a1db5dd08801777f951bc0` (tested locally, not applied to production).

Production epoch 2 became active at `2026-09-11T18:14:46.270885Z`, config hash `7390521c13f45cb5a1ce9a0cbe7a53d092a2e05ff187e5f2b773b75df74b3d7e`. Live scope equality, unchanged original authority/expiry, and unchanged five historical acceptance/evaluation rows passed before the next scheduled run. Post-write evidence is retained in `study-after.json` beside the backup.

The ordinary 18:15 UTC cron then succeeded in 8,664 ms, without a manual trigger. It acquired the September 11 12:00 UTC issuance with corrected SF longitude `-122.51229`, automatically accepted/completed it, and recorded a suppressed result: seven sources derived; Santa Cruz `unclosed_episode`, SF `unbounded_episode`, Outer Banks `incomplete_partition`. Durable totals are six acceptances and six evaluations, with all five prior rows unchanged. Epoch 2 health is active, one suppressed result, zero evaluated runs and zero of thirty qualifying days. Enqueued notifications, send authority, and notification bindings remain zero; durable control remains disabled. Verification SELECTs and local before/after assertions passed; evidence is in `study-resumed.json`.

No actionable review findings remain. Hourly monitoring received the new epoch baseline and matching rollback path. The study still needs qualifying data; successful unattended processing of a suppressed result is not study completion. Existing provider-identity and expiry limitations remain unchanged. No commits or application redeployment were performed for this refresh.
