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
