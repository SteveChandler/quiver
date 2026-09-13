# Swell Watch qualification and evaluation result

Verified 2026-09-10 03:11 UTC. Production deployment `dpl_4wLcUtUXemxvHdwNZY4N55HK4fzq` is READY and serves www.quiversurf.app.

- Accepted provenance and completed provider batch: `60b88e41-6cbf-415e-bafb-080a23eabcb5`. Immutable evidence: `swell-watch-run-qualification-20260909.md`, SHA-256 `f26d5e6eb85aaca8961aea36732ae27acbae5c7eb259c9f4ff0b5f44f4fc4`.
- Fixed physical calculation policy validation to accept hash-valid v2 pending-review evaluation policies. Push authorization still requires production approval; no approval metadata was changed.
- Acquisition and shadow evaluation enabled; both send flags remain false. Evaluation is an authenticated POST, not an automatic qualification scheduler.
- Live POST with completed batch returned HTTP 200, suppressed `ambiguous_partition_path`, enqueued 0. This is the existing conservative adjacent-partition matching guard; it is not a policy rejection. No trajectory matching change was made.
- Missing component tuples also remain: Outer Banks 24, Rincon 1. Do not count this as complete coverage or a qualifying study day.
- Post-check database: completed batches 1, event evaluations 0, announcements 0, notification bindings 0. Unauthorized POST 401; malformed authenticated POST 400; all responses private/no-store.

## Verification

Regression failed before the fix and passed afterward. Four targeted suites passed, 65 tests:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --runTestsByPath __tests__/lib/alerts/swell-watch/attested-run.test.ts __tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts
yarn typecheck
npx eslint --max-warnings=0 lib/alerts/swell-watch/impact-evaluator.ts __tests__/lib/alerts/swell-watch/attested-run.test.ts
git diff --check
```

This historical result predates the proposed v2 no-send trajectory-assignment policy and must not be read as current readiness. The frozen v1 configuration and its hash remain unchanged. The proposed v2 artifact adds `max-cardinality-minimax-normalized.v1`; it is uninstalled and has no production authority. A static captured-run Jest replay now executes real cohort derivation and shadow evaluation with all non-read RPCs forbidden; it remains suppressed because missing components and an unbounded episode persist. No qualifying-day definition, count, or readiness conclusion is established. Browser/native E2E were not run: no UI changes.

## Current local replay (uninstalled v2 proposal)

The proposed v2 policy hashes to `86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f`; it is local-only and neither installed nor production-authorized. The captured batch replay uses the configured ten-scope order and real region keys at `2026-09-10T00:00:00Z` only for offline freshness reproduction. Real cohort and shadow paths suppress on San Francisco `unbounded_episode`; diagnostics are seven derived scopes, Outer Banks and Rincon `incomplete_partition`, and zero enqueue/write calls. This remains neither readiness evidence nor a qualifying day.

Latest local checks: six focused Jest suites / 73 tests, `yarn typecheck`, scoped ESLint, and `git diff --check`. No browser/native E2E, production write, policy installation, send, commit, or deployment occurred.
