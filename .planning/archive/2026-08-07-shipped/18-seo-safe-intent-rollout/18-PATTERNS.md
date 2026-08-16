# Phase 18 Codebase Patterns

## Existing Surfaces

- Generic city intent route: `app/[intent]/[city]/page.tsx`.
- Generic intent public module: `components/intent/todays-intent-plan.tsx`.
- Beginner route component: `components/beginner/BeginnerPageContent.tsx`.
- Dedicated tide component: `components/intent/tide-page-content.tsx`.
- Dedicated water-temp component: `components/intent/water-temp-page-content.tsx`.
- Dedicated dawn/sunset components: `components/intent/dawn-patrol-page-content.tsx`, `components/intent/sunset-page-content.tsx`.
- Best-time city page: `app/best-time-to-surf/[city]/page.tsx`.
- Spot Session Intelligence pilot: `components/beach-detail/session-intelligence-pilot.tsx`.
- Shared Session Intelligence UI: `components/session-intelligence/*`.
- Existing internal-link block: `components/seo/seo-funnel-next-steps.tsx`.

## Reuse Rules

- Reuse `BestSurfWindows` only for pages whose primary intent is choosing surf windows.
- Reuse `SeoFunnelNextSteps` for pages whose primary intent is utility, seasonal, or contextual guidance.
- Reuse `buildSurfWindowSourceFlags()`, `buildSurfWindowDataNotes()`, and existing source hints before adding source copy.
- Reuse `public/images/quiver-stickers` assets by stable web paths; use `manifest.json` for labels and dimensions when needed.
- Reuse existing event names for first-pass measurement.

## Guardrail Rules

- No canonical URL changes.
- No metadata retargeting for water-temp, tide, or best-time pages.
- No broad spot rollout without an explicit allowlist.
- No new ML model.
- No new data fetch path unless a plan explicitly verifies duplicate-fetch and timing impact.
- No production deploy, alias promotion, production mutation, outbound send, payment, or entitlement action.

## E2E Pattern

- Guest SEO specs must call `setupErrorDetection(page)` in `beforeEach`.
- Guest SEO specs must call `assertNoErrors(page, errorCapture)` in `afterEach`.
- Use explicit waits tied to load/visible UI.
- Use stable user-facing selectors or `data-testid` when the component is intentionally testable.
- Check mobile and desktop for new SEO-facing modules.
