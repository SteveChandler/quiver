# Readiness implementation result

Local implementation and historical replay complete; overall production readiness NOT complete. Terra/high implementation with parent finishing residual assertions; final independent Sol review PASS, including independent six-suite/75-test rerun. Branch `orch/readiness-implementation`; no commits, integration, deploy, or production writes.

## Files and behavior

- `lib/alerts/swell-watch/provider-impact-ingestion.ts`: collect per-scope domain suppression diagnostics before returning; incomplete cohort performs no ingestion. Hard attestation/RPC failures still throw.
- `lib/alerts/swell-watch/shadow-evaluation.ts`: include scope diagnostics for suppressed responses only; preserve successful-response privacy.
- `lib/alerts/swell-watch/impact-evaluator.ts`: preserved earlier reviewed evaluation-policy fix.
- Tests modified: `__tests__/lib/alerts/swell-watch/{attested-run,provider-impact-ingestion,shadow-evaluation}.test.ts`. Cover policy/push separation, all-scope diagnostics, no ingestion on incomplete evidence, hard failures, and complete zero-event evaluation.
- Preserved qualification evidence and original v1 config unchanged. `horizon-derivation.ts` implements the user-approved optional normalized assignment rule; `policy.ts` validates its exact version literal. Absent version retains legacy behavior. The separate `swell-watch-no-send-producer-config-v2-proposed.json` has hash `86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f`; it is NOT installed in production.
- Added `horizon-derivation.test.ts`, `shadow-evaluation-replay.test.ts`, and immutable captured fixture `__tests__/fixtures/swell-watch-attested-replay-20260910.ts`. The shadow replay invokes real derivation/cohort/shadow logic with only read RPCs allowed; tests cover configured order/regions, reversed fixture rows, exact shared identities, 168 two-component samples per scope, and missingness counts.

## Checks

Final parent verification on September 10: six suites / 75 tests PASS; typecheck PASS; scoped ESLint PASS; diff-check PASS. After adding the last matcher permutation test, the full six-suite command ran again, followed by `yarn typecheck && npx eslint --max-warnings=0 __tests__/lib/alerts/swell-watch/horizon-derivation.test.ts && git diff --check`. The broad scoped lint command below had already passed before that test-only addition. Documentation-only corrections followed.

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --runTestsByPath __tests__/lib/alerts/swell-watch/attested-run.test.ts __tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts __tests__/lib/alerts/swell-watch/horizon-derivation.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation-replay.test.ts
yarn typecheck
npx eslint --max-warnings=0 lib/alerts/swell-watch/horizon-derivation.ts lib/alerts/swell-watch/policy.ts lib/alerts/swell-watch/impact-evaluator.ts lib/alerts/swell-watch/provider-impact-ingestion.ts lib/alerts/swell-watch/shadow-evaluation.ts __tests__/lib/alerts/swell-watch/attested-run.test.ts __tests__/lib/alerts/swell-watch/provider-impact-ingestion.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts __tests__/lib/alerts/swell-watch/horizon-derivation.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation-replay.test.ts scripts/replay-swell-watch-attested-run.ts
git diff --check
```

Browser/native E2E neither reviewed nor run: no UI changes. No production build/deployment of this diff. `scripts/replay-swell-watch-attested-run.ts` is read-only per-scope derivation, not the full shadow replay; the separate Jest replay proves the full path offline.

## Evidence and unresolved work

Full historical captured-input cohort/shadow replay uses batch `60b88e41-6cbf-415e-bafb-080a23eabcb5` and explicit offline time `2026-09-10T00:00:00Z`. With the proposed v2 rule: 7 scopes derive; San Francisco suppresses `unbounded_episode`; Outer Banks and Rincon suppress `incomplete_partition`. In configured cohort order the top-level reason is `unbounded_episode`. Missing components remain Outer Banks 24, Rincon 1, all others 0. Shadow counts remain null, enqueued 0, and no write RPC is allowed. This is historical offline evidence, not a fresh live production evaluation.

User approved the heuristic for no-send evaluation only. It ranks admissible injective assignments by maximum cardinality, minimum worst normalized gate use, then minimum summed gate use; exact ties suppress. No slot/height tie-break or widened gates. Missing tuples remain unavailable; no interpolation or coverage claim. A separately approved production policy installation and deployment are still required before live v2 persistence.

Qualifying-day accounting is not established: 30 observed days is documented but cadence/timezone/completeness rule remains unverified. Do not infer qualifying days from accepted runs. Daily launch-health automation was updated to distinguish raw acquisition, accepted provenance, evaluations, and qualifying days and to stop repeating the resolved policy blocker.

Release risk: local policy/diagnostics changes remain uncommitted and unintegrated. Subsequent production deployments from another branch may omit them. Further production writes require separate approval; sends remain outside this task's authorization.
