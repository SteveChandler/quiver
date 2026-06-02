# Phase 14 Pattern Map: Guardrails, Data Inventory, And Template Safety

Gathered: 2026-06-01

## Purpose

Map existing Quiver patterns the Phase 14 executor should reuse while creating
Session Intelligence guardrails, template inventory, validation checklists, and
planning closeout evidence.

## Documentation Patterns

### Active docs index pattern

Analog: `docs/README.md`

- New docs need a clear purpose, owner, and expected update trigger.
- Prefer updating existing docs before creating duplicates.
- Long-running planning/spec files should be summarized after major milestones.
- For Phase 14, create one focused doc under
  `docs/session-intelligence/phase-14-template-inventory.md`.

Recommended doc header:

```markdown
# Session Intelligence Phase 14 Template Inventory

Owner: Quiver Web
Created: 2026-06-01
Update trigger: Before adding Session Intelligence recommendation UI to a new template.
```

### Refactor tracker pattern

Analog: `docs/refactor-roadmap.md`

- Use `Current Goal`, `Current Status`, `Active Requirements`, `Open Gaps`,
  `Decisions Already Made`, `Recent Progress`, `Next Actions`, and
  `Historical Notes` when the doc is a living tracker.
- Phase 14's inventory doc is narrower than `docs/refactor-roadmap.md`; use
  concise sections and checklist tables rather than a long slice history.

## Source Guard Patterns

### Exact-string source guards

Analog: Phase 13 source guards and `rg` validation in
`.planning/phases/13-controlled-refactor-completion/13-VALIDATION.md`.

Use `rg -n` to prove required content exists:

```bash
rg -n "Ahrefs|fixed crawl cap|GSC|Vercel|PostHog" docs/session-intelligence/phase-14-template-inventory.md
```

Use no-output guards for prohibited changes:

```bash
git diff -- app layout.tsx lib/constants/seo.ts
```

Phase 14 should not edit `app/layout.tsx`, `lib/constants/seo.ts`, or route
metadata unless a later approved phase explicitly scopes that work.

### Playwright registration checks

Analog: E2E instructions in `e2e/ARCHITECTURE.md`, `e2e/README.md`, and prior
GSD plans.

For broad E2E surfaces, prefer a cheap syntax/registration check first:

```bash
npx playwright test --list e2e/push-deeplink-routing.spec.ts e2e/beach-detail.spec.ts e2e/forecast-hub.spec.ts e2e/beginner-page.spec.ts
```

Do not run full broad E2E unless the phase changes browser behavior. Phase 14 is
documentation/inventory, so listing the reviewed specs is enough unless the
executor adds or edits tests.

## Structured Data Patterns

### Schema component unit tests

Analogs:

- `__tests__/lib/seo/structured-data.test.ts`
- `__tests__/components/seo/tide-dataset-schema.test.tsx`
- `__tests__/components/seo/water-temp-dataset-schema.test.tsx`

Pattern:

- Render the schema component.
- Collect `script[type="application/ld+json"]`.
- Parse JSON.
- Assert `@context`, `@type`, URL, provider, spatial coverage, and optional
  fields when data is present.
- Assert optional source fields are omitted when data is null.

Phase 14 should reference these existing tests and add checklist rows for:

- `TideDatasetSchema`
- `WaterTempDatasetSchema`
- `BeachPageStructuredData`
- `WebPageSchema`
- `ItemListSchema`
- `BreadcrumbStructuredData`

### Route-level structured data wiring

Analogs:

- `app/[intent]/[city]/[beachSlug]/page.tsx`
- `lib/utils/beach-sub-page-utils.tsx`
- `app/[intent]/[city]/page.tsx`
- `app/best-time-to-surf/[city]/page.tsx`
- `app/forecast/page.tsx`
- `app/forecast-accuracy/page.tsx`

Pattern:

- Server page composes schema components close to route render.
- Metadata uses `buildPageMetadata` or specialized dynamic metadata helpers.
- Route-level schemas use full `baseUrl` and route-specific URLs.
- Dataset schemas omit unsupported measured variables when data is missing.

## Template Data Flow Patterns

### Spot page data flow

Analog: `app/[intent]/[city]/[beachSlug]/page.tsx`

Data is fetched in parallel:

- `getSpotSurfReportPublic(beach)`
- `getNearbyBeaches()`
- `getBeachReviews()`
- `getBestTimeToSurfUrl()`
- `mv_beach_amenities`
- `beach_water_quality`
- `getBeachCameraUrl()`
- approved `beach_photos`

The inventory must distinguish these fetched sources from data shown in child
tabs after hydration.

### Intent page branch pattern

Analog: `app/[intent]/[city]/page.tsx`

This route has materially different branches:

- State-level intent page.
- Dedicated beginner page.
- Dedicated tide page.
- Dedicated water-temp page.
- Dedicated dawn-patrol page.
- Dedicated sunset page.
- Generic intent branch, including longboard and least-crowded.

The inventory should not collapse these into one row.

### Beach subpage pattern

Analog: `lib/utils/beach-sub-page-utils.tsx`

Tide and water-temp subpages share one utility that:

- Fetches the beach by slug or id.
- Fetches nearby beaches and page-specific metadata in parallel.
- Renders page-specific dataset schema.
- Falls back to crawl copy when hero metadata is missing.
- Reuses `BeachDetailClient` with selected default tab/subtab.
- Adds alert CTA, next steps, nearby spots, and sticky signup.

## App Link / Deep Link Patterns

### AASA manifest contract

Analogs:

- `app/.well-known/apple-app-site-association/route.ts`
- `__tests__/app/well-known-app-links.test.ts`

Current iOS universal-link paths include:

- `/auth/*`
- `/sessions/*`
- `/beach/*`
- `/profile/*`
- `/map*`
- `/invite/*`
- `/settings*`

Phase 14 should document these as the current contract. Later phases may need
new paths for session-window-specific links, but Phase 14 should not add them.

### Forecast alert deeplink contract

Analogs:

- `__tests__/lib/services/forecast-alerts-deeplink.test.ts`
- `e2e/push-deeplink-routing.spec.ts`

Current forecast-alert deeplink format is `/beach/{beach_slug}`. The E2E spec
contains skipped bug-quarantine tests; record that limitation in the inventory
instead of claiming complete end-to-end coverage.

## Analytics Patterns

### Event taxonomy guard

Analogs:

- `lib/analytics/event-taxonomy.ts`
- `/api/events/route.ts`
- `__tests__/api/events-taxonomy-characterization.test.ts`
- `__tests__/api/events-allowlist-db-sync.test.ts`

Pattern:

- Reuse existing event types when possible.
- If a later phase adds events, update `VALID_EVENTS`,
  `ANONYMOUS_ALLOWED_EVENTS`, `PRE_AUTH_ONLY_EVENTS`, DB constraint, and TypeScript
  event unions together.
- Pre-auth CTA events must self-guard in components and be blocked server-side
  for authenticated users.

Phase 14 should document likely reusable events, not add event types.

## Validation Command Patterns

Use Node 22 for local gates:

```bash
source ~/.nvm/nvm.sh && nvm use 22
```

Recommended Phase 14 checks:

```bash
rg -n "Ahrefs|fixed crawl cap|GSC|Vercel|PostHog|canonical URLs are unchanged|new ML model|unsupported data-source claims" docs/session-intelligence/phase-14-template-inventory.md
rg -n "forecast horizon|tide|water-temp|buoy|cam|user reports|local spot intel|CTA|deep-link" docs/session-intelligence/phase-14-template-inventory.md
rg -n "TideDatasetSchema|WaterTempDatasetSchema|BeachPageStructuredData|WebPageSchema|ItemListSchema" docs/session-intelligence/phase-14-template-inventory.md
npx playwright test --list e2e/push-deeplink-routing.spec.ts e2e/beach-detail.spec.ts e2e/forecast-hub.spec.ts e2e/beginner-page.spec.ts
```

If Markdown lint is unavailable or ignored by ESLint, use source guards instead
of pretending Markdown was linted.

## Implementation Landmines

- Do not edit `lib/constants/seo.ts` or `app/layout.tsx` for this phase.
- Do not change canonical URLs.
- Do not rename route segments or change redirects.
- Do not claim water-temp pages are surf-report pages.
- Do not claim buoy, cam, tide, or user-report support unless the template
  actually fetches or renders that source.
- Do not add package dependencies for docs validation.
- Do not run destructive Supabase operations or production mutations.
