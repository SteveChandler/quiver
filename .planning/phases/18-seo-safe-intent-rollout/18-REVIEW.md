---
phase: 18-seo-safe-intent-rollout
reviewed: 2026-08-03T15:26:06Z
depth: deep
files_reviewed: 32
files_reviewed_list:
  - __tests__/actions/beach/beach-location-actions.test.ts
  - __tests__/api/beaches/beaches-nearby.test.ts
  - __tests__/app/mexico-beach-subpage-route.test.ts
  - __tests__/app/sitemap.test.ts
  - __tests__/components/NearbyBeaches.test.tsx
  - __tests__/components/beach-card-session-link.test.tsx
  - __tests__/hooks/useNearbyBeaches.test.tsx
  - __tests__/lib/seo/gsc-performance-protection.test.ts
  - __tests__/lib/utils/beach-url-utils.test.ts
  - __tests__/middleware.integration.test.ts
  - actions/beach/beach-location-actions.ts
  - app/api/beaches/nearby/route.ts
  - app/beaches/[country]/[state]/[city]/not-found.tsx
  - app/mexico/[region]/[city]/[beachSlug]/tides/page.tsx
  - app/mexico/[region]/[city]/[beachSlug]/water-temp/page.tsx
  - app/sitemap.ts
  - components/NearbyBeaches.tsx
  - components/beach-card.tsx
  - components/beach-detail/nearby-spots-enriched.tsx
  - components/beach-detail/zine/zine-nearby-spots.tsx
  - components/home-screen/nearby-beach-chips.tsx
  - components/landing-page/popular-beaches-section.tsx
  - components/landing-page/surf-highlights-section.tsx
  - components/landing-page/surf-spot-card.tsx
  - components/map/nearby-beach-scroll.tsx
  - hooks/useNearbyBeaches.ts
  - lib/data/server/featured-beaches.ts
  - lib/seo/gsc-performance-protection.ts
  - lib/seo/gsc-performance-protection.v1.json
  - lib/utils/beach-sub-page-utils.tsx
  - lib/utils/beach-url-utils.ts
  - proxy.ts
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-08-03T15:26:06Z
**Depth:** deep
**Files Reviewed:** 32
**Status:** issues_found

## Summary

The follow-up fixes genuinely resolve the stale country-dependent `BeachCard` href (prior CR-01), reject lookup errors and missing rows in both hydration paths (part of prior CR-02), and validate Mexico route/body/metadata canonicals against the sitemap-authoritative GSC set (prior CR-03). The location-family lastmod was restored, the nearby API change is additive, no native consumer references `/api/beaches/nearby`, and the rolling GSC snapshot is valid, sorted, deduplicated, threshold-compliant, and covers 2026-07-04 through 2026-07-31.

The rollout is still not shippable. Explicitly unknown or blank countries remain inconsistently interpreted: the shared builder and sitemap manufacture invalid US-shaped paths for non-US rows, while both hydration implementations accept blank/null values as successful and the client hook can prefer an invalid RPC value over a valid database lookup. The passing tests do not exercise those cases. The new beach-family lastmod also churns every US beach and subpage even though the reviewed behavior change is Mexico-specific.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 [BLOCKER]: The shared URL builder still converts explicit unknown countries into broken US routes

**Files:** `lib/utils/beach-url-utils.ts:162-170,213-243,402-468`; `app/sitemap.ts:307-349`

**Issue:** `getBeachHrefSafe()` now treats `country: null` as unknown, but `buildBeachUrl()` still routes every falsy country as USA. Direct callers therefore disagree with the safe wrapper. A reviewed runtime reproduction returns `/baja-california/puerto-nuevo/k-40` for both `country: null` and `country: ""`; the stricter proxy rejects that three-segment path as an invalid international route. `buildBeachRoutes()` calls `buildBeachUrl()` directly and only filters for slug/city/state, so an indexable Baja row with a missing or blank country is published in the authoritative sitemap under that broken path. Other direct canonical/redirect callers inherit the same contract.

**Fix:** Give the builder an explicit three-state contract: omitted `country` may retain the legacy USA default, but `null`, empty, and whitespace-only values must be treated as unknown and return the country-independent `/beach/{slug}` fallback (or no canonical URL where the caller requires a hierarchy). In `buildBeachRoutes()`, emit an unknown-country row only when its state is a valid US state; otherwise exclude it until country is authoritative. Add direct builder and sitemap regressions for Baja with `null`, `""`, and whitespace country values.

```ts
function classifyCountry(country: string | null | undefined) {
  if (country === undefined) return "legacy-usa";
  const normalized = country.trim().toLowerCase();
  if (!normalized) return "unknown";
  return normalized === "usa" || normalized === "us" ? "usa" : "international";
}
```

### CR-02 [BLOCKER]: Country hydration declares blank/null rows complete and can discard a valid hydrated country

**Files:** `actions/beach/beach-location-actions.ts:88-128`; `hooks/useNearbyBeaches.ts:53-103`

**Issue:** Both implementations correctly trigger hydration when the RPC country is absent or blank, but completeness is checked only with `Map.has(id)`. A database row with `country: null`, `""`, or whitespace is accepted as successfully hydrated. The client hook then resolves `b.country ?? countryById.get(b.id)`, so an RPC value of `""` or whitespace wins over a valid country returned by the follow-up query. Empty string reaches `getBeachHrefSafe()` and reproduces the broken Baja URL from CR-01. The server action prefers the lookup map, but it also preserves an empty lookup value and returns success. This violates the stated fail-closed behavior and the comment promising that every nearby card can build a canonical international URL.

**Fix:** Normalize both RPC and lookup values with `trim()`, use only non-empty strings as authoritative, prefer the hydrated value whenever the RPC value failed validation, and treat missing/null/blank hydrated values as incomplete (or deliberately return normalized `null` for the safe fallback). Validate every returned row, including rows without usable IDs, before reporting success.

```ts
const normalizeCountry = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const hydratedCountry = normalizeCountry(countryById.get(row.id));
const rpcCountry = normalizeCountry(row.country);
const country = rpcCountry ?? hydratedCountry;
if (!country) throw new Error("Nearby beach country hydration was incomplete");
```

## Warnings

### WR-01 [WARNING]: A Mexico-only routing change advances lastmod for every beach and subpage

**File:** `app/sitemap.ts:41-48,313-345`

**Issue:** The prior location-family churn was fixed by restoring `locationTemplate` to `2026-02-01`, but the replacement `beachTemplate: "2026-08-03"` is now used as a floor for every US beach detail, tide, and water-temperature URL. The reviewed shared renderer change is conditional on `expectedMexicoLocation`, and the new routes are Mexico-specific; unchanged US pages are nevertheless all advertised as modified on August 3. The new tests explicitly lock this blanket date for an old US row, so they encode the churn rather than protecting unrelated pages from it.

**Fix:** Keep the existing beach fallback/date behavior for unchanged US routes. Use a Mexico-subpage template version (or a route-specific floor) only for the new Mexico URLs, while continuing to take the latest real row/editorial timestamp where applicable. Add an assertion that a Mexico route receives the new date and an unchanged US route retains its prior lastmod.

### WR-02 [WARNING]: The regression suite misses the exact unknown-country inputs that still fail

**Files:** `__tests__/actions/beach/beach-location-actions.test.ts:373-438`; `__tests__/hooks/useNearbyBeaches.test.tsx:155-229`; `__tests__/lib/utils/beach-url-utils.test.ts:483-529`; `__tests__/app/sitemap.test.ts:908-1124`; `__tests__/app/mexico-beach-subpage-route.test.ts:42-79`

**Issue:** The new hydration tests cover a returned error and a completely missing lookup row, but never a present row whose country is null/empty/whitespace, nor an invalid RPC country paired with a valid lookup country. The URL test checks only explicit `null`, even though `""` follows a different and broken branch. Sitemap tests supply a complete Mexico country and never assert fail-closed behavior for a Baja row with unknown country. Mexico validation tests call the shared helpers directly only on malformed inputs; they do not import both route modules or prove a valid body/metadata canonical. This is why all 270 focused tests pass while CR-01 and CR-02 remain reproducible.

**Fix:** Add table-driven null/empty/whitespace tests across the action, hook, shared URL builder, and sitemap. Add mixed-RPC/lookup precedence coverage, then import both Mexico page modules and test one valid and one mismatched location for body and metadata wiring.

## Verification

- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn jest --runInBand --runTestsByPath __tests__/actions/beach/beach-location-actions.test.ts __tests__/api/beaches/beaches-nearby.test.ts __tests__/app/mexico-beach-subpage-route.test.ts __tests__/app/sitemap.test.ts __tests__/components/NearbyBeaches.test.tsx __tests__/components/beach-card-session-link.test.tsx __tests__/hooks/useNearbyBeaches.test.tsx __tests__/lib/seo/gsc-performance-protection.test.ts __tests__/lib/utils/beach-url-utils.test.ts __tests__/middleware.integration.test.ts` — passed (10 suites, 270 tests).
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn typecheck` — passed.
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx eslint --max-warnings=0 <31 scoped TypeScript/TSX files>` — passed.
- `./node_modules/.bin/tsx -e <country URL reproduction>` — passed as a diagnostic and reproduced the defect: direct null/empty country produced `/baja-california/puerto-nuevo/k-40`; safe empty country produced the same broken path.
- Snapshot integrity checks (`jq empty`, duplicate/order/threshold validation) — passed: 269 entries, 0 duplicates, deterministic sort, 0 entries outside policy thresholds, rolling window 2026-07-04 through 2026-07-31.
- `rg -n '/api/beaches/nearby|beaches/nearby|nearest_beaches' ../quiver-native/src ../quiver-native` — no native consumer references found; the API response addition remains backward-compatible.
- E2E tests were not run; no E2E spec is included in the review scope. Route behavior was covered only by the scoped Jest suites and static call-chain review.

## Standalone Implementation Handoff

Use an isolated implementation worktree. Fix CR-01 and CR-02 together by defining one normalized country-state contract shared by URL builders and both hydration paths. Preserve the additive `/api/beaches/nearby` response. Then scope the August 3 sitemap floor to the Mexico routes that actually changed and add the missing null/blank/whitespace, precedence, sitemap, and route-module regressions from WR-02. Re-run the 10-suite Jest command, scoped ESLint, `yarn typecheck`, snapshot integrity checks, and targeted browser checks for a valid Mexico subpage, a mismatched Mexico subpage, a null-country Baja beach, and an unchanged US beach lastmod.

---

_Reviewed: 2026-08-03T15:26:06Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
