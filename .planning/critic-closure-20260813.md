# Architecture critic closure — 2026-08-13

Policy reviewed: `docs/adr/002-water-quality-holds.md`.
Critic reviewed: `.planning/critic-architecture-20260813.md`.

## Findings

### 1. Bluesky raw selection — not fixed, intentionally skipped

The Bluesky edge function still has raw beach selectors, but it is the explicitly excluded dead channel. I did not inspect it further or modify `supabase/functions/bluesky-auto-post/`.

### 2/3. Similarity alerts use the configured beach — verified already fixed

`app/api/cron/similarity-alerts/route.ts` now selects `alert_rules.beach_id`, carries it as `configured_beach_id`, always retains that configured beach, and runs alternatives through `selectBeach()`. The notification payload also carries the configured ID used by the exemption logic.

Both directions are covered:

- `notification-water-quality.integration.test.ts` — `delivers the configured held beach but suppresses a held alternative in its notification provenance`. It seeds both IDs in the held-beach table, asserts the configured alert is allowed, and asserts the suggested alternative is suppressed with `water_quality_hold`.
- `similarity-alerts.test.ts` — `retains a held configured beach while excluding a held alternative`, which uses different configured/home IDs and verifies the queue payload names the configured beach; `removes a held alternative from the similarity candidate pool before scoring` verifies the route does not score/enqueue the held alternative.

### 4. NPC selection is hold-gated — verified already fixed

`lib/npc/beach-selection.ts` now uses `selectBeach()`/the safe weighted selector, and `lib/npc/npc-selection.ts` uses that path for both weighted and fallback selection. `npc-selection.test.ts` — `does not return a held weighted home beach` — seeds a held beach and verifies it cannot be selected.

### 5. Worker test mocks the resolver — fixed now

`__tests__/notifications/worker.test.ts` no longer mocks `resolveWaterQualityHolds` or the notification hold adapter. Its new test, `suppresses a Quiver feedback nudge through the worker's real resolver`, seeds `water_quality_held_beaches` through the fake service-role table, runs the real `processPendingEvents`, injects the real `resolveNotificationMajorEventHold` with `mode: "enforce"`, and asserts the worker records `skipped_disabled` with `water_quality_hold` and processes the event.

The unrelated worker-mechanics fixtures retain an explicit test-only allowed-decision dependency for their invalid/non-UUID fixture payloads. The named seeded integration test bypasses that helper and exercises the real resolver. There is no resolver-module Jest mock and no forced `applyWaterQualityHolds: false` path.

### 6. Session-decision test mocks discovery — fixed now

`__tests__/app/api/surf/session-decision-route.test.ts` no longer mocks `surf-discovery-service` or the canonical decision service. Its new test, `resolves one server-owned decision through real discovery and hold resolution`, calls the real route, real discovery orchestration, real canonical decision service, and real water-quality resolver against a seeded held beach plus a safe beach. Lower-level candidate/forecast/formatting dependencies are stubbed only to make the scenario deterministic. The response must select the safe beach and must not select the held beach.

### 7. Truncate before hold filtering — verified already fixed

The inspected paths do not truncate the final recommendation set before applying holds:

- Intent/state actions rank first and slice afterward.
- v1 recommendations request `candidate_limit + 5`, rank/filter, then slice.
- Candidate-pool and nearby services over-fetch by five (or use the bounded fallback), rank/filter, then trim.
- Surf discovery and canonical decision apply their final hold boundary before final selection/truncation.

Relevant regression tests include `evaluates the full sorted pool with verified experience and filters before maxResults`, `filters the complete ranked pool before selecting and reranking three top picks`, `should remove held beaches before discovery pool ordering`, `requests the full candidate pool limit from PostGIS on every tier`, and `does not return a held beach from nearby recommendations`.

### 8. Brand boundary — verified already documented

`lib/recommendations/selection/index.ts` now explicitly documents that `RankedBeach` is a cooperative, compile-time-only brand, is lost across JSON, is not a runtime security boundary, and has `as RankedBeach`/`as unknown as` as the deliberate audit surface. The audit found no production assertion outside the selection primitive. This documents the limitation; it does not and is not intended to create runtime enforcement.

## Changes made

- `__tests__/notifications/worker.test.ts`: replaced the resolver mock path with a seeded real-resolver worker integration test.
- `__tests__/app/api/surf/session-decision-route.test.ts`: replaced canonical/discovery mocks with a real route/discovery/canonical/hold-resolution scenario.
- `.planning/critic-closure-20260813.md`: this closure report.

No production files were changed in this closure. I did not apply migrations, touch `quiver-native/`, or touch the excluded Bluesky edge function.

## Validation

Targeted hold/discovery suites: passed — 11 suites, 110 tests.

Final requested gate, with the requested environment:

```text
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
export NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
yarn typecheck && yarn lint && npx jest --ci
```

Passed: TypeScript, ESLint, and Jest — 1,295 suites passed; 16,726 tests passed; 0 failures. Jest also reported 195 skipped and 1 todo, consistent with the repository’s suite output.

Scoped ESLint and `git diff --check` also passed. No E2E specs were changed or run; this closure is covered by the unit/integration gate above.

## Remaining limits

Finding 1 remains intentionally unclosed because the channel is explicitly dead and out of scope. The brand remains compile-time/cooperative rather than runtime-enforced by design. Live Supabase migration/schema state and external/native callers of the user-match SQL function were not changed or validated; no migration was applied.
