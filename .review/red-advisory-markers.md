# Red advisory markers

## Ordering decision

The nearby service keeps `rankBeaches()` as the authority for identifying safe beaches, recovers the RPC rows missing from that ranked result as held beaches, restores the two sets to one distance-sorted list, and then applies the existing `limit`.

This keeps the map's meaning coherent: it shows the closest beaches regardless of advisory status. Safe beaches retain their existing relative distance order. A closer held beach can occupy a slot ahead of a farther safe beach, but it cannot reorder the safe beaches themselves. Both the spatial RPC path and bounded fallback use this behavior.

## Additive API contract

Every beach returned by the nearby/map path now carries:

```ts
waterQualityHold: boolean
```

`true` means the beach was removed by the unchanged recommendation hold resolver and is restored for map visibility only. `false` means it remained in the safe ranked result. No existing field was renamed, removed, or repurposed.

## La Jolla Shores bootstrap response

Before, La Jolla Shores had no entry in `data.beaches` (other nearby controls remained):

```json
{
  "success": true,
  "data": {
    "beaches": [
      {
        "id": "<another nearby beach id>"
      }
    ],
    "forecast": "..."
  }
}
```

After, its existing beach fields remain unchanged and the additive hold flag is present alongside the other nearby beaches:

```json
{
  "success": true,
  "data": {
    "beaches": [
      {
        "id": "<La Jolla Shores beach id>",
        "name": "La Jolla Shores",
        "waterQualityHold": true
      },
      {
        "id": "<another nearby beach id>",
        "waterQualityHold": false
      }
    ],
    "forecast": "..."
  }
}
```

The marker ignores any positive forecast summary while this flag is true. It uses the darkened brand-red gradient `#991B1B` to `#B91C1C`, exposes “La Jolla Shores water quality advisory” as its accessible name, and uses “Water quality advisory” instead of a positive surf call. The gradient endpoints have 8.31:1 and 6.47:1 contrast against white, respectively.

## Commands and results

- PASS — `/Users/stevenchandler/.codex/skills/git-worktree-safety-summary/scripts/git_safety_summary.sh .`
- PASS — `git fetch origin main && git worktree add -b fix/red-advisory-markers /Users/stevenchandler/Desktop/dev/quiver-red-advisory-markers origin/main`
- FAIL (environment setup) — `yarn typecheck`; the fresh worktree had no `node_modules`, so `tsc` was not found.
- PASS — `test -d /Users/stevenchandler/Desktop/dev/quiver/node_modules && ln -s /Users/stevenchandler/Desktop/dev/quiver/node_modules node_modules && yarn typecheck`
- FAIL (environment setup) — `yarn test:unit --runInBand __tests__/lib/nearby-beach-service.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/lib/utils/forecast-hub-utils.test.ts`; Next config required public Supabase variables before Jest config loading.
- FAIL (same environment setup) — the same focused test command after adding a worktree-local `.env.local` symlink; Next config still needed the variables exported before loading.
- MIXED, superseded — `set -a; source .env.local; set +a; yarn test:unit --runInBand __tests__/lib/nearby-beach-service.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/lib/utils/forecast-hub-utils.test.ts`; shell parsing reported errors for non-shell-compatible env values, while Jest itself passed 3 suites and 40 tests. Later runs used `dotenv/config` instead.
- PASS — `./node_modules/.bin/prettier --write ...`; the formatter produced broad legacy-format churn, so that mechanical output was reverted and the scoped semantic changes were reapplied.
- PASS — `yarn typecheck` (final: TypeScript completed with no errors).
- PASS — `yarn lint` (final: ESLint completed with zero warnings/errors).
- PASS — `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config --disable-warning=DEP0040" yarn test:unit --runInBand __tests__/app/api/map/bootstrap.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/lib/utils/forecast-hub-utils.test.ts` (final: 4 suites, 42 tests).
- PASS — local WCAG contrast calculation for `#991B1B` and `#B91C1C` against white (8.31:1 and 6.47:1).
- PASS — `git diff --check` (no whitespace errors).

Expected test logging remained: the forecast-hub failure-path tests emit their existing console errors, the fallback service test emits its expected warning, and the environment warns that `NEXT_PUBLIC_SITE_URL` is unset.

## Deliberately not done

- Did not change `rankBeaches()`, `selectBeach()`, or any recommendation/canonical-decision semantics.
- Did not add advisory kind. The current ranking boundary exposes held membership, not the winning advisory source/type; adding it would require widening the shared resolver or duplicating hold queries beyond this scoped visibility fix.
- Did not alter the database, add or run migrations, deploy, promote, open a PR, or modify the native repository.
- Did not run E2E tests or a production build; the requested service/API/marker behavior is covered by focused unit tests, and no E2E files were changed.

## Closure vs advisory follow-up

### Severity resolution

The shared water-quality resolver now returns
`waterQualityStatusByBeachId: Record<string, 'advisory' | 'closure'>` alongside
the unchanged `heldBeachIds`. Sampled `beach_water_quality.status` and fresh
`county_beach_advisories.advisory_type` values are merged per beach. If the
sources disagree, the more severe state wins: `closure` overrides `advisory`.
Owner-held beaches without either known status remain held without inventing a
kind.

The nearby/map API keeps `waterQualityHold: boolean` and adds exactly:

```ts
waterQualityStatus: 'advisory' | 'closure' | null
```

`rankBeaches()` and `selectBeach()` retain their existing selection behavior.
The nearby service only observes the already-resolved status metadata while it
restores held beaches for map visibility.

### Callout copy and accessibility

- Closure: `Closed — county water-quality data`
- Advisory: `Advisory — county water-quality data`

Both states use explicit wording in the visible badge and its accessible name;
colour is not the differentiator. The badge uses `#FFF7E8` text on `#2E2A26`
for **13.37:1** contrast. Its `#F2A24C` border against `#2E2A26` is **6.81:1**.
The badge is positioned in the scaled center-to-link corridor, above the
`Full forecast →` pill, with an opaque surface over radial arrows.

### Follow-up commands and results

- FAIL (expected test-first red state) — `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/lib/recommendations/major-event-hold/water-quality.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/app/api/map/bootstrap.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/lib/recommendations/selection.test.ts` — 3 suites failed, 2 passed; 4 tests failed, 29 passed because the new resolver status, nearby field, and callout badge were not implemented yet.
- PASS — `yarn typecheck` — TypeScript completed with no errors after the initial implementation.
- PASS — `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/lib/recommendations/major-event-hold/water-quality.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/app/api/map/bootstrap.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/lib/recommendations/selection.test.ts` — 5 suites, 33 tests.
- PASS — `npx eslint --max-warnings=0 components/map/conditions-callout.ts components/map/interactive-map.tsx lib/recommendations/major-event-hold/service.ts lib/recommendations/major-event-hold/water-quality.ts lib/recommendations/selection/index.ts lib/services/nearby-beach-service.ts types/api/map.ts` — zero warnings/errors.
- FAIL (format check only; no files rewritten) — `./node_modules/.bin/prettier --check components/map/conditions-callout.ts components/map/interactive-map.tsx lib/recommendations/major-event-hold/service.ts lib/recommendations/major-event-hold/water-quality.ts lib/recommendations/selection/index.ts lib/services/nearby-beach-service.ts types/api/map.ts __tests__/api/coach-picks.radius.test.ts __tests__/app/api/map/bootstrap.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/lib/recommendations/major-event-hold/service.test.ts __tests__/lib/recommendations/major-event-hold/water-quality.test.ts` — 12 existing files do not match whole-file Prettier formatting; no broad formatting churn was applied.
- PASS — `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/lib/recommendations/major-event-hold/water-quality.test.ts __tests__/lib/recommendations/major-event-hold/service.test.ts __tests__/lib/recommendations/selection.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/app/api/map/bootstrap.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/components/map/interactive-map.test.tsx __tests__/lib/utils/forecast-hub-utils.test.ts __tests__/api/coach-picks.radius.test.ts` — initial broad run: 10 suites, 123 tests.
- FAIL (fixed) — `yarn typecheck` — TypeScript rejected a status assignment that was not narrowed from the full sampled-status union. The condition was narrowed inline.
- PASS — `yarn lint` — ESLint completed with zero warnings/errors in the same validation pass.
- PASS — `yarn typecheck` — final TypeScript run completed with no errors.
- PASS — local WCAG calculation for `#FFF7E8` on `#2E2A26` and `#F2A24C` on `#2E2A26` — 13.37:1 and 6.81:1 respectively.
- PASS — final `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/lib/recommendations/major-event-hold/water-quality.test.ts __tests__/lib/recommendations/major-event-hold/service.test.ts __tests__/lib/recommendations/selection.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/app/api/map/bootstrap.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/components/map/interactive-map.test.tsx __tests__/lib/utils/forecast-hub-utils.test.ts __tests__/api/coach-picks.radius.test.ts` — 10 suites, 123 tests.
- PASS — final `yarn lint` — ESLint completed with zero warnings/errors.
- PASS — `git diff --check` — no whitespace errors.

Expected test logging remained in failure-path coverage: the map loader's mocked
500 warning, forecast-hub fetch errors, missing-table/query-error water-quality
logs, the bounded-fallback warning, and the unset `NEXT_PUBLIC_SITE_URL`
environment warning.

No E2E test was added or changed: the behavior is isolated resolver/API/DOM
logic covered by unit tests. No production deployment, migration, promotion, or
PR action was performed.

## Closure label fix and single-field pass

### Bug and fix

`getConditionMarkerCall()` received only a boolean hold flag, so every held
marker and preview call was labelled `Water quality advisory`, even when the
resolver knew the beach was closed. The map path now preserves the hold kind
through the bootstrap payload, preload marker, interactive marker, preview,
conditions callout, and accessible names.

The pinned labels are:

- `closure` -> `Water quality closure`
- `advisory` -> `Water quality advisory`
- `held` -> `Water quality hold`

The new closure regression was run before the implementation and failed with
expected `Water quality closure`, received `Water quality advisory`. It passes
after the fix and also pins the closure callout copy.

### Final field shape and copy

`MapBeach` is now exported by `lib/services/nearby-beach-service.ts` and has one
nullable field:

```ts
waterQualityHold: "advisory" | "closure" | "held" | null
```

`null` means not held. `advisory` and `closure` retain the known county/sample
kind. `held` means an owner-directed hold with no known sampled/county kind.
There is no compatibility field or second status field.

The unknown-kind callout copy is **`Water quality hold`**. It states the hold
plainly and contains no county attribution. Its visible text and accessible name
match. Closure and advisory retain their county copy. The existing badge colours,
border, and text remain `#2E2A26`, `#F2A24C`, and `#FFF7E8`, preserving the
previously verified 6.81:1 border and 13.37:1 text contrast.

### Complexity cuts

Line savings are source LOC against `991ce8966` before this pass:

- Single map field plus `MapBeach` relocation: **1 line saved** at the
  producer/type boundary (2 saved by deleting/relocating the type, 1 added by
  the explicit `held` fallback); the serialized response loses one property per
  beach.
- Direct `onWaterQualityResolution` observer call: **8 lines saved**.
- Inlined `countyAdvisoryToHoldStatus`: **6 lines saved**.
- Shared `(state, snapshot)` empty county-resolution helper across 10 returns:
  **26 lines saved**.
- Shared marker return after computing the label: **6 lines saved**.
- Hold gradient calls no longer pass an ignored summary: **1 line saved**.
- Shared conditions-callout pill base styling: **11 lines saved** while retaining
  each pill's size, interaction, colour, border, text, and top offset.

Across all production files in this pass, the requested cuts and single-field
threading are net **37 lines removed**. Updated and new regression coverage adds
42 test lines net.

### Commands and results for this pass

- PASS — baseline `git diff --shortstat origin/main...HEAD`: 638 insertions, 30
  deletions, net **+608** lines.
- FAIL (expected red) — `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/components/map/conditions-callout.test.ts` — 1 suite failed; 1 test failed, 11 passed. The closure marker call returned advisory.
- PASS (green) — `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/components/map/conditions-callout.test.ts` — 1 suite, 12 tests.
- PASS — `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/app/api/map/bootstrap.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/components/map/map-marker-preview-popup.test.ts` — 4 suites, 24 tests.
- PASS — final `DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runInBand __tests__/lib/recommendations/major-event-hold/water-quality.test.ts __tests__/lib/recommendations/major-event-hold/service.test.ts __tests__/lib/recommendations/selection.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/app/api/map/bootstrap.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/components/map/map-marker-preview-popup.test.ts __tests__/components/map/interactive-map.test.tsx __tests__/lib/utils/forecast-hub-utils.test.ts __tests__/api/coach-picks.radius.test.ts` — 11 suites, 136 tests.
- PASS — final `yarn typecheck` — TypeScript completed with no errors.
- PASS — final `yarn lint` — ESLint completed with zero warnings/errors.
- PASS — `git diff --check` — no whitespace errors.
- PASS — final `git diff --shortstat origin/main...HEAD`: 796 insertions, 101
  deletions, net **+695** lines.

Expected failure-path logging remained in the focused suites: the mocked bulk
forecast 500, forecast-hub fetch errors, missing-table/query-error water-quality
logs, bounded-fallback warning, and unset `NEXT_PUBLIC_SITE_URL` warning.

No E2E test was added, changed, or run. No production build was run because the
requested validation was typecheck, lint, and focused unit coverage. No deploy,
promotion, migration, or PR action was performed.
