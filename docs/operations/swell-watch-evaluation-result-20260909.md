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

All above gates passed. Independent Sol code/evidence review passed. Vercel production build passed. A standalone Node evaluation attempt failed before executing evaluation because `server-only` is resolved by Next, not the standalone runtime; the deployed HTTP check above replaced it. Browser/native E2E not reviewed or run: no UI changes. Source remains uncommitted on `fix/swell-watch-evaluation-policy`; preserve and integrate through the repository review process so a later deployment does not lose the fix.
