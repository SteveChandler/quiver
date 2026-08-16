# Selection primitive — Stage 1

Date: 2026-08-13

## API

`lib/recommendations/selection/index.ts` exports only:

```ts
declare const RankedBrand: unique symbol;
export type RankedBeach<T> = T & { readonly [RankedBrand]: true };

export async function rankBeaches<T extends { id: string }>(
  candidates: readonly T[],
  opts: { compare: (a: T, b: T) => number; asOf?: Date },
): Promise<RankedBeach<T>[]>;

export async function selectBeach<T extends { id: string }>(
  candidate: T | null | undefined,
  opts?: { asOf?: Date },
): Promise<RankedBeach<T> | null>;
```

The module is server-only. It resolves the real water-quality hold state before
returning anything, removes held candidates before sorting, and returns `null`
for an unsafe or unavailable single candidate. `rankBeaches` copies before
sorting so callers' arrays are not mutated. Invalid `asOf` values and resolver
exceptions fail closed.

The `RankedBrand` symbol is private to the module: it is declared but not
exported, and there is no exported cast/helper. A `@ts-expect-error` assertion
proves that a raw beach is not assignable to `RankedBeach<T>`. The brand is
compile-time only and does not survive JSON; it protects server-side
construction, which is where selection happens.

## Hold resolution and rollout tolerance

Selection calls `resolveWaterQualityHolds`. An owner-table query error with
Postgres code `42P01` is the explicit pre-migration case and resolves to an
empty hold set, so lists continue to populate before the migration is applied.
That branch is distinguished by error code, not message matching. Any other
owner-table error, quality-table error, malformed response/row, unresolved
state, or thrown resolver call excludes the beach. Existing-table failures
therefore fail closed, while a missing owner table does not create an outage.

The migration remains unapplied. No migration was run and generated database
types were not edited.

## Stage 1 conversions

- `lib/alerts/best-days.ts`: ranks subscribed beaches through `rankBeaches`
  before loading/scoring forecast slots.
- `app/api/v1/recommendations/route.ts`: wraps scored spot records in the
  branded ranker before ordering recommendations and top picks.
- `app/api/cron/home-morning-call/route.ts`: sends the canonical selected beach
  through `selectBeach` before constructing the payload, including the `NO`
  early-return path that previously named a beach without the resolver.

User-selected detail pages, search, sessions/profile data, and user-configured
alerts remain outside this primitive. They read the user's explicitly chosen
beach and are not Quiver selection paths.

## Notification provenance

The notification boundary no longer uses a type-wide `similarity_match`
exemption. `configured_beach_id` is carried in forecast and similarity
notification payloads. Only that exact beach ID is exempt; a suggested
alternative in `beach_id` is evaluated against the real water-quality hold set.
The integration regression test seeds both held beaches, runs the real
water-quality resolver through the service, verifies the configured held beach
is allowed, and verifies the held alternative is suppressed. The existing
mock-based adapter tests remain for decision-shape coverage; the new regression
does not mock the water-quality resolver.

## Tests added or changed

- `__tests__/lib/recommendations/selection.test.ts`: private-brand type
  assertion, held exclusion, `selectBeach` null, missing-table `42P01`
  tolerance, existing-table query failure, and thrown-resolution failure.
- `__tests__/alerts/best-days.test.ts`: seeded held beach is excluded before
  forecast scoring.
- `__tests__/app/api/v1/recommendations/route.test.ts`: seeded held spot is
  absent from recommendations and top picks.
- `__tests__/api/cron/home-morning-call.test.ts`: a held beach on the `NO`
  path returns before notification payload construction.
- `__tests__/lib/recommendations/major-event-hold/notification-water-quality.integration.test.ts`:
  real resolver coverage for configured-beach exemption versus a held
  alternative.
- `__tests__/lib/recommendations/major-event-hold/notification.test.ts` and
  `__tests__/api/cron/condition-alert-evaluate.test.ts`: updated payload and
  per-beach exemption expectations without weakening existing assertions.

## Stage 2 inventory — 16 remaining sites

This is the migration inventory for replacing per-site ordering/selection with
`RankedBeach`; it is not a claim that every row currently leaks water-quality
holds. “Genuine” means the path appears to choose, rank, or serialize a beach
for Quiver. “False positive / provenance” means the grep hit may only render a
user-selected or location-browse beach and needs confirmation before changing.

| # | Site | Estimate |
|---:|---|---|
| 1 | `app/api/surf/utils.ts` — legacy coordinate surf result | Genuine recommendation path |
| 2 | `lib/services/discovery/surf-discovery-orchestrator.ts` — discovery ranking | Genuine recommendation path |
| 3 | `app/api/surf/discover/route.ts` — discovery response boundary | Genuine recommendation path |
| 4 | `lib/services/discovery/week-scout.ts` — weekend window ranking | Genuine recommendation path |
| 5 | `lib/services/nearby-beach-service.ts` — nearby candidate ordering | Genuine recommendation path |
| 6 | `app/api/beaches/popular/route.ts` — popular beach ordering/fallback | Genuine recommendation path |
| 7 | `app/api/coach-picks/route.ts` — coach-pick ranking | Genuine recommendation path |
| 8 | `lib/data/server/featured-beaches.ts` — featured beach ordering | Genuine recommendation path |
| 9 | `actions/city/city-conditions-actions.ts` — best-right-now beach | Genuine recommendation path |
| 10 | `actions/forecast/intent-forecast-actions.ts` — intent forecast ranking | Genuine recommendation path |
| 11 | `actions/beach/beach-location-list-actions.ts` — location list ordering | Likely genuine; confirm whether browse-only |
| 12 | `actions/beach/beach-state-actions.ts` — state map beach set | False positive / provenance; map may be browse-only |
| 13 | `actions/beginner/beginner-actions.ts` — beginner editorial ranking | Likely genuine; confirm editorial intent |
| 14 | `lib/services/coast-pulse/coast-pulse-service.ts` — nearest/forecast pick | Mixed: forecast branch genuine, intel names likely false positives |
| 15 | `lib/share/forecast-window-share.ts` — shared forecast-window beach | False positive / provenance unless fed by a Quiver picker |
| 16 | `app/api/og/weekend-wave-check/route.tsx` — OG weekend recommendation | Genuine if the OG candidate is Quiver-selected |

No Stage 2 site was converted here beyond the three requested surfaces and the
notification provenance plumbing.

## Validation

With the requested Node 22 path and environment variables:

```text
yarn typecheck                         PASS
yarn lint                              PASS
npx jest --ci                          PASS
```

Final Jest result: 1,284 passed suites, 16 skipped suites; 16,691 passed
tests, 195 skipped, 1 todo, and 3 snapshots passed. Targeted selection,
conversion, resolver, and notification integration tests also passed.

E2E specs reviewed: `e2e/api/recommendations.spec.ts`,
`e2e/guest-api-recommendations.spec.ts`, `e2e/alerts.spec.ts`, and the
water-quality seed/helper coverage. No E2E test was added or run for Stage 1.

The worktree was already dirty; those unrelated changes were preserved. No
commit was created, `quiver-native/` was not touched, and the migration was not
applied.
