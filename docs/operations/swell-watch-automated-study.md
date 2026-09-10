# Automated Swell Watch study

Implementation plan, September 10, 2026. Deployment and a fresh provider run are authorized by Steven after implementation, tests, and review pass.

1. Extend the existing hourly acquisition job to recover retained fresh runs oldest-first, then acquire, validate, accept, complete, evaluate, and record the fixed ten-source cohort. Reuse the receipt collector, shadow evaluator, and collection lease. Recovery remains bounded by the policy freshness window; older failures remain gaps.
2. Add narrowly scoped database study authority and atomic automatic completion. Bind authority to the evaluation policy, cohort, coordinates, and terrain inputs; compare the inputs actually evaluated with this snapshot. Retain raw evidence, missingness, freshness, latest-revision, revocation, and disabled-send checks. Do not grant the generic attestation function to the service role.
3. Persist evaluated and suppressed outcomes. Count a UTC day only when all four distinct provider issuances have successful fresh evaluations covering every source under the same study authority. Retries cannot add days; suppressed runs cannot qualify. Zero candidates can qualify after a complete evaluation. This measures collection coverage, not forecast usefulness.
4. Test runtime ordering, disabled controls, failures, retries, and durable PostgreSQL behavior. Independently review the diff and fix findings before release.
5. Apply the reviewed database change, deploy, enable the automated study, and verify a fresh cycle. Preserve both disabled send flags and the absence of push authority.
6. Monitor hourly through the current Codex task, using Luna at medium effort for routine evidence checks. Escalate failures for investigation; notify only actionable changes and completion. Stop study processing at the configured target or expiry. The observation target is 30 qualifying days; elapsed days alone do not complete it.

The provider response does not itself echo the requested issuance. Automated acceptance records validation under the installed provider contract; it must not claim an independent upstream signature or confirmation that does not exist.

Verification so far:

- `yarn typecheck`: passed.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-key yarn test:unit --runInBand`: passed after review fixes, 1,418 suites / 18,299 tests; 16 existing skipped suites, 197 skipped tests, one todo.
- Scoped `yarn eslint --max-warnings=0` on changed TypeScript: passed after removing a conditional test assertion.
- `VERCEL_ENV=preview yarn build`, using existing Supabase build configuration: passed. Earlier attempts failed on a dependency symlink and then an empty test database during prerendering; neither was an application failure.
- Built HTTP smoke: acquisition without authentication returns 401; authenticated disabled acquisition returns 200 with zero enqueues; no-store headers preserved; evaluation without authentication returns 401. No browser UI changed; browser E2E was not added.
- `yarn deadcode` with test environment values: reports existing repository findings. Its output is byte-for-byte identical to a clean deployed baseline (`diff -u` exit 0); no new finding.
- `git diff --check`: passed.
- `bash scripts/test-swell-watch-study-postgres.sh`: passed in both implementation-agent and main-agent runs after review fixes. `bash -n scripts/test-swell-watch-study-postgres.sh`: passed.
- `bash /tmp/swell-watch-study-release.mCCrw4/test-tracked-migration.sh`: passed the same database suite using the exact production wrapper, including a SHA-256 equality assertion for the atomically stored migration source.

Production preflight at 15:45 UTC: evaluation epoch 2 remains active with the reviewed policy hash and October 25 expiry; durable control disabled at epoch 0; zero push-authority and shadow-demand rows. Owner connection reports `postgres`. The new migration is absent.

Fresh schema backup: `/Users/stevenchandler/.codex/swell-watch-study-backup.yHQina/public-schema.sql`, created by `supabase db dump --linked --schema public --file ...`; 1,541,980 bytes, SHA-256 `8e7da0907146c06f2ffd2231c5079fe6b745dfc3b7a084cc25e1d6c50a0c2109`. It contains the existing provider-currentness function definition. New study tables are initially empty; activation only appends study authority.

Activation uses `swell-watch-study-activate.sql`. Rollback uses `swell-watch-study-revoke.sql` and disables `SWELL_WATCH_STUDY_ENABLED` in the deployed environment. Retain the schema and evidence tables. A revoked authority invalidates machine-accepted evidence; it cannot be used to authorize sends. Keep both sending flags false.

Hourly monitoring is installed in the current Codex task as **Swell Watch automated study monitor**, using a Luna sub-agent at medium effort for routine checks and Sol at high effort for concrete failures. Vercel runs acquisition independently of this local monitor. Monitoring distinguishes pending deployment, suppressed evaluations, qualifying days, target completion, and expiry.

The first independent review held release for incomplete result validation, mutable beach inputs, rollover retry coverage, and loose rollback idempotence. Those fixes are implemented. Final independent review is GREEN with no actionable P0–P3 findings, including the exact production wrapper. The updated PostgreSQL suite passed both implementation-agent and main-agent runs, including pinned-input mutation rejection, complete-result validation, real legacy ingestion denial after authority revocation, preservation of manual evidence, and exact rollback temporal-field regressions. The wrapper suite also passed. Live activation remains pending.

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

Tests added or modified: study orchestration unit tests, acquisition route unit tests, shadow-evaluation diagnostics assertions, and disposable database integration checks. Existing relevant API tests were reviewed. No browser UI or native contract changed; browser E2E tests were not added or run. Built HTTP smoke checks passed again after the review fixes. GitHub Actions are unavailable; local checks are the release evidence.
