# Phase 18: SEO-Safe Intent Rollout - Research

**Researched:** 2026-06-02
**Domain:** Next.js App Router programmatic SEO, surf-window recommendations, crawler-safe internal linking
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions
- Roll out Session Intelligence only after Phase 17 pilot validation evidence is recorded.
- Preserve page intent, canonical URLs, schema semantics, and current route shapes.
- Keep useful basic answers visible without sign-in; gate alerts or personalization only.
- Do not retarget water-temp pages as surf-report pages.
- Do not create duplicate thin pages, mass-change metadata, add unsupported source claims, or introduce a new ML model.
- Use Brand-Vault assets and the mirrored `public/images/quiver-stickers` sticker-sheet assets where Phase 18 introduces new visual treatment.
- Deploys, production mutations, outbound sends, payment actions, and entitlement changes remain approval-gated.

### the agent's Discretion
- Exact component extraction boundaries for SEO-safe Session Intelligence rollout modules.
- Exact targeted unit and Playwright test file split, provided existing E2E patterns are followed.
- Whether an allowlisted surface renders `BestSurfWindows` or a lighter contextual next-step module.

### Deferred Ideas
- Broad sitewide rollout to every city, state, utility, and spot page.
- New analytics event names unless existing events cannot measure the behavior.
- Native app-link route expansion, which remains Phase 20 scope.
- Forecast accuracy trust-page changes, which remain Phase 19 scope.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
| --- | --- | --- | --- |
| Rollout eligibility and source-claim policy | Frontend Server | Browser/Client | Route and template decisions are made before rendering; client components consume already-honest props. |
| Generic intent public surf-window answer | Browser/Client | Frontend Server | `TodaysIntentPlan` already receives server-built summaries and controls auth gating. |
| Dedicated tide, water-temp, dawn, sunset page handoffs | Frontend Server | Browser/Client | Dedicated page components own intent copy, internal links, schema-adjacent rendering, and CTAs. |
| Best-time and Malibu spot enrichment | Frontend Server | Browser/Client | Existing route components own canonical metadata and SSR content; `BestSurfWindows` remains a client component inside existing page chrome. |
| Measurement and SEO QA | Browser/Client | Frontend Server | Playwright verifies rendered canonicals, schema scripts, links, and public content; docs record before/after measurement procedure. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 18 should not be a blanket Session Intelligence mount. The codebase has separate branches for generic city intents, beginner pages, dedicated tide pages, dedicated water-temperature pages, dedicated sun-time pages, best-time city pages, and beach detail pages. Each branch has different data availability and source-claim limits recorded in Phase 14.

The safest rollout pattern is an allowlisted set of thin vertical slices. First create a shared rollout policy that makes eligibility, source claims, and public-answer rules explicit. Then update one family of templates at a time, using existing data (`getIntentForecastSummary`, expanded tide/water-temp/sun-time data, best-time top beaches, and spot surf report forecasts) rather than adding new fetch paths. Final QA should verify canonicals/schema/internal links and record measurement instructions instead of claiming live CTR movement prematurely.

**Primary recommendation:** ship Phase 18 as five small plans: policy guards, generic/beginner public answers, dedicated utility/sun-time handoffs, best-time plus Malibu enrichment, and final SEO/measurement QA.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library or Tool | Version | Purpose | Why Standard |
| --- | --- | --- | --- |
| Next.js App Router | 16.x | Route rendering, metadata, ISR | Existing app stack and SEO route owner. |
| React | 19.x | Client and server components | Existing UI framework. |
| TypeScript | strict | Compile-time route/component contracts | Existing repo gate. |
| Playwright | repo version | Browser SEO and public-page checks | Existing E2E stack with guest/auth projects. |
| Jest + Testing Library | repo version | Component and helper regression tests | Existing unit stack. |

### Supporting
| Library or Tool | Purpose | When to Use |
| --- | --- | --- |
| `BestSurfWindows` | Full Session Intelligence card stack | Only where page intent directly benefits from upcoming surf windows. |
| `SeoFunnelNextSteps` | Crawlable internal link handoff block | Utility pages and best-time pages where a full surf-window card would blur intent. |
| `public/images/quiver-stickers` | Brand-Vault sticker assets | New Phase 18 visual affordances, especially condition, tide, water-temp, wind, tape, and arrow assets. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
| --- | --- | --- |
| Full `BestSurfWindows` everywhere | Intent-specific handoff modules | Preserves water-temp/tide intent and avoids unsupported source claims. |
| New analytics event names | Existing `page_view`, `beach_view`, `forecast_interaction`, `ios_app_cta_click` | Avoids allowlist/database churn during SEO rollout. |
| New forecast query per template | Existing summaries and forecast rows | Prevents performance regressions and duplicate reads. |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Data Flow

Route request -> route-specific data fetch -> rollout eligibility policy -> intent-safe module props -> public rendered answer -> existing CTA/internal-link tracking -> Playwright/schema/canonical verification.

### Component Responsibilities

| Area | Existing File | Phase 18 Responsibility |
| --- | --- | --- |
| Generic intent pages | `app/[intent]/[city]/page.tsx`, `components/intent/todays-intent-plan.tsx` | Keep basic best-window answers public and preserve top picks, map, FAQ, and links. |
| Beginner pages | `components/beginner/BeginnerPageContent.tsx` | Add a beginner-safe public decision module without hiding safety basics. |
| Tide pages | `components/intent/tide-page-content.tsx` | Add tide-window surf decision handoff without altering tide schema semantics. |
| Water-temp pages | `components/intent/water-temp-page-content.tsx` | Add gear-to-session handoff on allowlisted pages only, without surf-report retargeting. |
| Dawn/sunset pages | `components/intent/dawn-patrol-page-content.tsx`, `components/intent/sunset-page-content.tsx` | Pair sun-time utility with live-condition next steps and exact spot links. |
| Best-time pages | `app/best-time-to-surf/[city]/page.tsx` | Keep seasonal intent while linking to live conditions and exact spot pages for allowlisted cities. |
| Spot pages | `components/beach-detail/session-intelligence-pilot.tsx`, `app/[intent]/[city]/[beachSlug]/page.tsx` | Enrich Malibu Surfrider without changing spot canonical or duplicating `/surf-report/malibu-today`. |

### Anti-Patterns to Avoid
- Adding `BestSurfWindows` to water-temp pages as if they are surf-report pages.
- Moving canonical URLs, changing route metadata paths, or adding duplicate SEO pages.
- Showing `buoy + model`, `model + tide`, cam, or user-report source labels where the template does not fetch those sources.
- Requiring sign-in to see the basic answer that brought a search visitor to the page.
- Adding a new database-backed analytics event without updating all event allowlists and constraints.
</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Existing Public Gating
**What goes wrong:** `TodaysIntentPlan` blurs exact windows for anonymous users.
**How to avoid:** Make basic window timing public; use auth only for saved alerts, personalization, and app actions.
**Warning signs:** Playwright sees `Sign in to reveal exact windows` on SEO intent pages.

### Broad Spot Rollout
**What goes wrong:** A pilot component mounted in shared beach detail UI becomes a de facto all-spot rollout.
**How to avoid:** Add an explicit allowlist/policy for high-impression spot enrichment and test Malibu plus one pilot spot.
**Warning signs:** `session-intelligence-pilot` appears on arbitrary low-evidence spot URLs.

### Water-Temp Retargeting
**What goes wrong:** Water-temp pages start saying "surf report" in titles/headings or full Session Intelligence cards dominate the page.
**How to avoid:** Keep temperature, wetsuit, gear, and companion-link language primary; use handoffs, not surf-report replacement.
**Warning signs:** Metadata or H1 for `/water-temp/*` no longer contains water temperature as the primary intent.

### Source Claim Drift
**What goes wrong:** A shared module claims buoy/tide/cam/user reports on pages that do not fetch them.
**How to avoid:** Centralize support hints and assert absent-source behavior in unit tests.
**Warning signs:** `High - buoy + model` appears in generic intent or utility-page tests without supporting data.
</common_pitfalls>

<validation_strategy>
## Validation Strategy

- Unit tests for rollout eligibility, source-claim policy, public-answer rendering, best-time handoff links, and water-temp copy.
- Playwright guest tests for allowlisted SEO routes across mobile and desktop, using `setupErrorDetection()` and `assertNoErrors()`.
- Canonical/schema checks on selected intent, tide, water-temp, best-time, and Malibu spot pages.
- Internal-link checks connecting spot, tide, water-temp, forecast, best-time, and exact spot/window URLs.
- Scoped ESLint for touched files, `yarn typecheck`, and targeted Playwright registration/run commands.
- Measurement docs recording pre/post GSC CTR, average position, impressions, PostHog multi-page behavior, and cannibalization checks without making live claims before data exists.
</validation_strategy>

## RESEARCH COMPLETE
