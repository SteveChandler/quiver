# AEO capability-page research

Date: 2026-08-19  
Scope: research/specification only; no implementation  
Target repository: Next.js 16 App Router (`app/`)

## Executive findings

1. `/best-free-surf-forecast-app` is not a new route. It already exists, is already in the sitemap, and contains claims that conflict with the current entitlement boundary. Rework that page in place; do not create a second page for the same query.
2. `/surf-session-log` and `/personal-surf-forecast` do not currently exist. Explicit static routes at those paths will take precedence over `app/[intent]`.
3. The defensible free promise is public access to forecast conditions. A signed-out visitor can browse public forecast/beach/map surfaces and a blurred, anonymized session-feed preview. A signed-in free user can log sessions; the create action is authenticated but has no Pro entitlement check.
4. The explicit personal-match product is paid: personal fit, reasons, ranked windows, personal alerts, best-spot decisions, and board-aware picks are gated to active Pro/trial users. Forecasts remain free.
5. Do not publish forecast-accuracy superiority, head-to-head accuracy, percentage-accuracy, or “most accurate” claims. The proposed pages should explain jobs and capabilities, not forecast superiority.
6. “Board comparison” is not verified as a shipped web experience. A database RPC computes per-board learned statistics, but no runtime consumer was found. The visible journal currently provides board-usage frequency, not comparative board performance.

## A. Proven page pattern

### Canonical reference: `/vs/surfline`

The reference is a self-contained ISR server page in `app/vs/surfline/page.tsx`. A new capability page should preserve this page's information rhythm, component language, and disclosure discipline without copying unsupported comparison claims.

#### Metadata and rendering

- `export const revalidate = 86400` gives the page a one-day ISR interval (`app/vs/surfline/page.tsx:41-42`).
- Metadata is built with `buildPageMetadata` and supplies title, description, canonical path, and keywords (`app/vs/surfline/page.tsx:48-63`). The helper expands these inputs into canonical alternates, Open Graph, Twitter, and robots fields (`lib/seo/meta.ts:18-74`).
- The page renders `BreadcrumbStructuredData` followed by `FAQSchema` (`app/vs/surfline/page.tsx:339-346`). Only the breadcrumb emits JSON-LD: `FAQSchema` is intentionally a compatibility no-op (`components/seo/faq-schema.tsx:1-27`), while the breadcrumb emits `BreadcrumbList` (`components/seo/breadcrumb-schema.tsx:15-36`).
- The page does **not** currently emit `SoftwareApplication`, `ItemList`, or `WebPage` schema. Older SEO notes that describe a broader schema graph do not match this runtime.
- The visual root is `ZineSurface` with cream/ink styling and an overflow-hidden page shell (`app/vs/surfline/page.tsx:348-352`).

#### Exact section order

| Order | Section | Evidence |
|---:|---|---|
| 1 | Hero: freshness sticker, H1, summary, primary sign-up CTA, secondary forecast CTA, two supporting internal links, product mockup | `app/vs/surfline/page.tsx:354-498` |
| 2 | “The Quick Take” answer block | `app/vs/surfline/page.tsx:500-520` |
| 3 | “Who Should Use What” three-card decision section | `app/vs/surfline/page.tsx:522-553` |
| 4 | Feature comparison, with a desktop table and separate mobile cards | `app/vs/surfline/page.tsx:555-687` |
| 5 | “Where Quiver fits” positioning plus evidence/proof rows | `app/vs/surfline/page.tsx:689-734` |
| 6 | Visible, PAA-shaped FAQ using native `<details>` | `app/vs/surfline/page.tsx:737-775` |
| 7 | Final CTA plus internal-link cluster | `app/vs/surfline/page.tsx:777-843` |
| 8 | Publisher/affiliation disclosure | `app/vs/surfline/page.tsx:845-859` |

#### Component vocabulary

- Page shell and decorative language: `ZineSurface`, `QuiverSticker` (`app/vs/surfline/page.tsx:32-35,348-352`).
- Motion vocabulary: `FadeInSection`, `AnimatedStickerBadge`, `AnimatedFeatureRow`, and `VsAnimationStyles` (`app/vs/surfline/page.tsx:36-39,337-338`). These wrappers use an intersection observer and include reduced-motion handling (`app/vs/surfline/animations.tsx:51-136,239-312`).
- Local page components: `StatusBadge`, `StickerBadge`, `DecisionCard`, `QuickTextLink`, and `ProofRow` (`app/vs/surfline/page.tsx:262-327,870-969`).
- CTAs are inline Next.js `Link` elements, not shared CTA components. Hero and closing CTAs point to `/auth/sign-up` and `/forecast`; supporting links point to capability/comparison pages (`app/vs/surfline/page.tsx:403-432,810-841`).
- The page derives its visible update label rather than hardcoding it (`app/vs/surfline/page.tsx:248-256,364-369`).

#### Species requirements for the three capability pages

- Use `buildPageMetadata`, a path-specific canonical, one H1, and `revalidate = 86400`.
- Use the same `ZineSurface`/sticker/cream-ink vocabulary and the existing animation primitives.
- Preserve the answer-first sequence: hero, concise answer block, user-choice/job section, evidence-backed capability table, mechanism/proof section, visible FAQ, final CTA/internal links, disclosure.
- Keep CTAs aligned with entitlement: public forecast CTA for free forecast intent; sign-up/log-session CTA for session intent; plans/sign-up CTA for Pro personalization.
- Keep a visible publisher disclosure even when the page is not a named comparison.
- Render FAQs for readers/AEO, but do not expect FAQ rich results and do not add a new `FAQPage` JSON-LD implementation.

### Nested variant: `/vs/surfline/free`

`app/vs/surfline/free/page.tsx` is a four-line barrel that re-exports metadata/default from `page-content.tsx` and sets the same one-day revalidation (`app/vs/surfline/free/page.tsx:1-4`). The content module also declares `revalidate = 86400` and builds path-specific metadata (`app/vs/surfline/free/page-content.tsx:45-68`).

It is recognizably the same page species, but differs as follows:

- The component is async and fetches the actual set/count of beaches with cameras (`app/vs/surfline/free/page-content.tsx:362-364`). It renders those through `LiveCamCard` (`app/vs/surfline/free/page-content.tsx:604-639`).
- It uses a hardcoded freshness label, `PAGE_UPDATED = "Jun 2026"`, with a warning to keep related dates synchronized (`app/vs/surfline/free/page-content.tsx:282-285`).
- It explicitly separates free forecast/tide/wind/cam reading from optional Pro session-based personalization (`app/vs/surfline/free/page-content.tsx:84-90,426-433,535-552`).
- Its order is: hero (`387-533`); short answer (`535-552`); decision cards plus mobile-app CTA (`554-602`); live-cam wall (`604-639`); desktop/mobile comparison (`641-769`); “Where Quiver fits” (`771-816`); FAQ (`819-857`); final CTA/link cluster (`859-922`); “Keep Reading” rail (`924-947`); disclosure (`949-963`).
- It includes more acquisition modules than the parent: mobile-app prompt, live-cam inventory, a public-roadmap row, and a learn-cluster rail.
- It uses the same breadcrumb plus no-op FAQ schema pattern (`app/vs/surfline/free/page-content.tsx:369-381`).

There is a routing workaround specific to this nested page. Next 16 resolves the three-segment public URL through a dynamic beach route, so `proxy.ts` rewrites `/vs/surfline/free` internally to `/seo-pages/vs-surfline-free` (`proxy.ts:126-135`). The internal page only re-exports the canonical page (`app/seo-pages/vs-surfline-free/page.tsx:1-4`), and direct visits to the internal URL redirect back to the canonical URL (`next.config.mjs:374-376`). This workaround is not needed for the proposed one-segment pages.

## B. Real capability inventory

### Entitlement baseline

Current code truth, in descending order of authority:

- RevenueCat-mirrored `user_entitlements` is the source for free versus premium. Missing rows, users with neither `is_pro` nor `is_trialing`, and expired users without a billing issue resolve to free (`lib/alerts/entitlements.ts:20-38,86-111`).
- Personal-match eligibility unlocks for an active Pro subscription or trial and otherwise returns a locked state (`lib/personalization/eligibility.ts:41-62,91-140`). The match-score endpoint requires authentication and applies that eligibility result (`app/api/personalization/match-score/route.ts:11-41`).
- The current product/pricing surfaces classify personal forecasting, best spot/window, board-aware picks, custom spots, and offline session saving as Pro; honest forecasts and wind/tide reads are free (`components/landing-page/field-guide/field-guide-features.tsx:21-58`; `components/pricing/founding-offer-surface.tsx:53-95`).
- Route protection makes `/profile`, `/journal`, `/discover`, and `/sessions/new` authenticated surfaces, while forecast, beach, and map surfaces are intentionally public (`lib/middleware/route-guard.ts:26-37,92-97`).
- Session creation is authenticated but has no Pro check (`actions/session-actions.ts:331-332`). Therefore a signed-in free user can log a session. A signed-out visitor cannot.
- The public `/sessions` route gives guests a blurred public-feed preview, replaces the author with “Surfer,” hides ratings, and only shows the log-session control to authenticated users (`app/sessions/page.tsx:63-79,145-146,203-272,367-395`).

### Page 1: “best free surf forecast app”

| Claim/spec statement | Evidence | Safe to publish? |
|---|---|:---:|
| Forecast, beach, and map reading are public; no subscription is required merely to read forecast conditions. | `lib/middleware/route-guard.ts:26-37,92-97`; `app/vs/surfline/free/page-content.tsx:84-90` | y |
| Public forecast surfaces include forecast conditions, tide, wind, and available live cams. | `app/vs/surfline/free/page-content.tsx:82-90,426-433`; `app/free-surf-reports/page.tsx:31-45` | y |
| A signed-in free user can log sessions. | `actions/session-actions.ts:331-332`; `lib/personalization/eligibility.ts:91-140` (no session-create gate) | y |
| A signed-out visitor can log sessions or see a private journal/history. | `/sessions/new` is protected in `lib/middleware/route-guard.ts:26-37`; guest preview behavior is in `app/sessions/page.tsx:367-395` | n |
| Free includes the explicit personal daily call, personal fit/reasons, ranked windows, or board-aware picks. | These are Pro/trial capabilities in `lib/personalization/eligibility.ts:41-62,91-140`, `components/landing-page/field-guide/field-guide-features.tsx:21-58`, and `components/pricing/founding-offer-surface.tsx:53-95` | n |
| “Past sessions tune the next call” as a free-tier promise. | Existing page makes this claim at `app/best-free-surf-forecast-app/page.tsx:61-62`, but the explicit personal-match contract is Pro-gated. Internal discovery has bounded signals, but that does not make the advertised Pro experience free. | n |
| Alerts are simply “free” without limits. | Free alert limits are one beach and three rules; personal similarity presets are separately Pro-gated (`lib/alerts/entitlements.ts:11-18,141-167`; `app/api/alerts/rules/route.ts:223-240`). | n |
| “Free forever,” “no paywall,” or “everything is free.” | RevenueCat entitlement and paid-feature gates exist (`lib/alerts/entitlements.ts:20-38,86-111`). | n |
| Current App Store rating/count, price, platform coverage, or competitor pricing as stated on the existing page. | Values were checked 2026-06-24 and are hardcoded at `app/best-free-surf-forecast-app/page.tsx:18-25,68-115`. No live source verification was performed in this repository-only research. | n — UNVERIFIED |
| Quiver is the “best” or “most accurate” app as an objective fact. | No supporting comparative benchmark is present; the current answer block asserts “best” at `app/best-free-surf-forecast-app/page.tsx:61-62`. | n |

Required correction to the existing page: replace its free-tier personalization statements with the real boundary: public forecasts are free; account-based logging is available without a Pro entitlement check; explicit personal matching/ranking is Pro. Revalidate every volatile third-party price/rating/count before retaining it.

### Page 2: “best app for surf session logging”

#### What the logger captures

The create payload supports:

- Spot name/ID, date and arrival time, duration, board, and notes (`lib/utils/session-data-builder.ts:20-31,72-83,205-232`).
- Overall rating, wave quality, water temperature, crowd, and parking (`lib/utils/session-data-builder.ts:33-41,86-90,236-248`).
- Observed wave height, wind speed/direction, tide height/status, wave characteristics/types, and rip-current data (`lib/utils/session-data-builder.ts:42-60,93-107,252-300`).
- Goals and skill ratings (`lib/utils/session-data-builder.ts:62-67,108-112,303-309`).
- Public/private visibility and feed muting (`lib/utils/session-data-builder.ts:68-70,114-115,210-213`; `components/session-forms/VisibilitySection.tsx:23-138`).
- Photos, uploaded after the session record is saved (`app/sessions/new/useSessionSubmission.ts:94-118,204-208`).
- Forecast-at-session fields and correctness/attribution fields used by the snapshot/comparison path (`lib/utils/session-data-builder.ts:14-16,93-107,267-300`). A database trigger creates the forecast snapshot on insert (`actions/session-actions.ts:535-538`).

#### What the user gets back

- Chronological personal history with beach, board, and photo relationships, newest first (`actions/session-actions.ts:187-214`).
- A journal surface under the authenticated profile sessions tab (`app/profile/page.tsx:84-92`; `components/profile-view.tsx:141-142,574-599`; `components/journal/journal-view.tsx:68-132`).
- Session totals, time surfed, average rating, favorite beach, board-use frequency, and monthly session/rating/hour summaries (`lib/analytics/session-analytics.ts:74-183,227-234`; `components/journal/session-analytics.tsx:142-206,475-608`).
- Per-session forecast-versus-reported-condition comparison when a snapshot exists, including wave, wind, tide, and water-temperature fields (`components/session-detail-view.tsx:643`; `components/session/forecast-comparison.tsx:144-179,196-281`).
- A post-save share prompt/card (`app/sessions/new/useSessionSubmission.ts:149-159,202-236`).
- Preference recomputation after a session is saved; this is fire-and-forget and non-fatal (`actions/session-actions.ts:535-540`).

| Claim/spec statement | Evidence | Safe to publish? |
|---|---|:---:|
| Signed-in users can log a session without a Pro entitlement check. | `actions/session-actions.ts:331-332`; protected route list at `lib/middleware/route-guard.ts:26-37` | y |
| Log spot, time, duration, rating, wave/condition observations, board, notes, goals, visibility, and photos. | `lib/utils/session-data-builder.ts:20-115,205-309`; `app/sessions/new/useSessionSubmission.ts:94-118` | y |
| Review a chronological session journal/history. | `actions/session-actions.ts:187-214`; `components/journal/journal-view.tsx:68-132` | y |
| See high-level session totals, hours, ratings, favorite beach, monthly activity, and board-use frequency. | `lib/analytics/session-analytics.ts:101-183,227-234`; `components/journal/session-analytics.tsx:142-206,475-608` | y |
| Compare the captured forecast with conditions reported for an individual session when a snapshot is available. | `actions/session-actions.ts:535-538`; `components/session/forecast-comparison.tsx:144-179,196-281` | y, qualify snapshot availability |
| Logging contributes data to the preference-learning pipeline after enough rated sessions. | `actions/session-actions.ts:535-540`; `lib/services/preference-learning-service.ts:4-18,173-177` | y, but do not imply the resulting Pro UI is free |
| The journal provides accurate wave-height analytics/trends in feet. | `lib/analytics/session-analytics.ts:115-121,191` computes this from `wave_quality`; `components/journal/session-analytics.tsx:211-225` labels it in feet. | n — implementation defect |
| The journal provides a measured wind-condition score. | `lib/analytics/session-analytics.ts:213` hardcodes `3.5` as a placeholder. | n — implementation defect |
| Users can compare boards by performance or receive a shipped board “best conditions” report. | A database RPC exists at `supabase/migrations/20260519190000_swell_scope_response_native_support.sql:394-490`, but no web/runtime consumer was found. The visible journal only counts uses (`lib/analytics/session-analytics.ts:136-151`). | n — UNVERIFIED |
| The session comparison proves forecast accuracy or a percentage accuracy result. | The component compares stored forecast and user-reported values; it is not a controlled comparative accuracy benchmark (`components/session/forecast-comparison.tsx:144-179`). | n |
| Session logging is available to signed-out visitors. | Session creation is protected/authenticated (`lib/middleware/route-guard.ts:26-37`; `actions/session-actions.ts:331-332`). | n |

The page should distinguish “board attached to a session” and “board-use frequency” from “board performance comparison.” Only the first two are verified user-facing capabilities.

### Page 3: “personal surf forecast app”

#### Defensible mechanism paragraph for implementers

Quiver keeps the physical condition forecast separate from the personal-fit layer. Logged, rated sessions and their forecast snapshots can produce learned ranges/preferences for wave height/period, wind, and tide after at least five eligible sessions; before that threshold the match is a starter read. Discovery also has bounded signals from engagement and beach affinity, with low-confidence signals suppressed and negative patterns able to reduce a bonus. For active Pro/trial users, the similarity layer evaluates candidate beach/windows against wave height, period, wind speed/direction, and tide, then attaches personal fit, reasons, and window selection without rewriting the underlying physical forecast. Free users keep the forecast but do not receive that explicit similarity result. Evidence: `lib/services/preference-learning-service.ts:4-18,173-177`; `lib/services/discovery/personalization-layer.ts:103-159,178-295`; `lib/services/discovery/similarity-layer.ts:4-5,58-87,154-218`; `lib/personalization/match-score.ts:283-308,397-471`; `lib/services/discovery/surf-discovery-orchestrator.ts:2217-2235`.

| Claim/spec statement | Evidence | Safe to publish? |
|---|---|:---:|
| The physical forecast and personal-fit score are separate. | `lib/services/discovery/similarity-layer.ts:4-5`; `lib/services/discovery/surf-discovery-orchestrator.ts:2217-2235` | y |
| The preference model learns from rated session history and condition snapshots after a minimum of five eligible sessions. | `lib/services/preference-learning-service.ts:4-18,173-177`; `lib/personalization/match-score.ts:397-471` | y |
| Learned inputs include wave height/period, wind speed/direction, and tide. | `lib/services/preference-learning-service.ts:29-35,59-82`; `lib/services/discovery/similarity-layer.ts:58-87` | y |
| Before five qualifying sessions, the product returns a starter read rather than claiming learned history. | `lib/personalization/match-score.ts:131-142,429-447` | y |
| Pro can add personal fit, reasons, ranked windows, personal alerts, best-spot decisions, and board-aware picks. | `lib/personalization/match-score.ts:283-308`; `lib/personalization/eligibility.ts:41-62,91-140`; `components/pricing/founding-offer-surface.tsx:53-95` | y |
| Free users still have access to the underlying forecast. | Locked-response copy at `lib/personalization/match-score.ts:283-308`; public routing at `lib/middleware/route-guard.ts:26-37,92-97` | y |
| Signed-in discovery may use bounded learned/implicit/affinity bonuses and avoidance penalties. | `lib/services/discovery/personalization-layer.ts:49-81,103-159,178-295`; orchestrator context fetch at `lib/services/discovery/surf-discovery-orchestrator.ts:1645-1667` | y for mechanism documentation; avoid presenting it as the free Pro experience |
| Personalization changes or improves the physical wave forecast itself. | The similarity layer explicitly keeps physical conditions separate (`lib/services/discovery/similarity-layer.ts:4-5`; `lib/services/discovery/surf-discovery-orchestrator.ts:2220-2228`). | n |
| Quiver “learns your spot” by training a verified per-spot forecast model uniquely for each user. | The inspected path learns user-condition fit and uses beach affinity; it does not establish a user-specific physical forecast model. | n |
| Every logged session immediately produces a learned personalized score. | The learned threshold is five; earlier results are starter state (`lib/personalization/match-score.ts:429-447`). | n |
| Personal matching is free. | The explicit similarity call is skipped when `isPro` is false (`lib/services/discovery/similarity-layer.ts:166-170`), and eligibility is Pro/trial gated (`lib/personalization/eligibility.ts:91-140`). | n |
| Personalization is more accurate than Surfline or any competitor. | No valid head-to-head evidence exists in the inspected code/docs; the mechanism measures fit, not comparative forecast accuracy. | n |

Use “learns what conditions fit you” or “uses your rated sessions to rank fit/windows” only with the five-session and Pro boundary represented nearby. Do not use “learns your spot” alone; it is too easy to read as physical model calibration.

## C. Claim safety and SEO constraints

### Absolute exclusions

Do not propose or publish any of the following on these pages:

- “most accurate,” “more accurate,” “beats Surfline,” or a named-competitor forecast-accuracy ranking;
- forecast-accuracy percentages, MAE comparisons, concordance percentages, or “X% accurate” language;
- user-reported forecast comparisons presented as controlled forecast-performance proof;
- fabricated or stale app ratings, review counts, prices, user counts, spot counts, cam counts, or competitor facts;
- “free forever,” “no paywall,” “everything free,” or free explicit personalization;
- board-performance comparison, wave-height trend, or measured wind-score claims based on the current journal implementation.

The reference comparison page already gives the correct answer pattern: it says it does not have a same-sample comparison and therefore does not publish an accuracy ranking (`app/vs/surfline/page.tsx:97-100`). Preserve that standard.

### Existing SEO guidance that constrains the work

- Current AEO tracking found the three target queries absent in two consecutive runs and specifically recommends capability-led pages, not branded rebuttals (`docs/seo/reports/aeo-citation-tracking/2026-08-19.md:48-55,94-104,135-140`). It explicitly assigns no action to “most accurate surf forecast app” (`docs/seo/reports/aeo-citation-tracking/2026-08-19.md:151-155`).
- The SEO workflow says smaller-competitor intent should be addressed through capability/job-to-be-done pages rather than new branded comparison footprints (`docs/seo/SEO_AGENT_WORKFLOW.md:73`).
- Runtime behavior, tests, and search evidence must be reconciled rather than trusting planning documents (`docs/seo/SEO_AGENT_WORKFLOW.md:81-90`).
- Active funnel imagery is subject to an explicit denylist and source/license requirements; the denylist is enforced by a unit test (`docs/seo/SEO_AGENT_WORKFLOW.md:92-105`). Do not select an image until it passes that policy.
- Structured-data guidance forbids fabricated ratings/reviews. Unsupported SoftwareApplication rich-result eligibility should be deferred rather than invented (`docs/seo/AHREFS_STRUCTURED_DATA_TRIAGE.md:68-74,111`).
- Historical guidance also rejects “free forever/no paywall” and fabricated head-to-head MAE (`docs/seo/specs/2026-06-23-aeo-brand-pages-design.md:43-49`). Its FAQ guidance remains current: FAQ is visible content while `FAQSchema` intentionally emits no JSON-LD (`docs/seo/specs/2026-06-23-aeo-brand-pages-design.md:168-173`).
- Some older guidance is stale. For example, the 2026-06 design document allows a concordance statistic (`docs/seo/specs/2026-06-23-aeo-brand-pages-design.md:37-39`), but the present assignment explicitly prohibits accuracy-superiority claims. The present constraint wins.

### Existing `/best-free-surf-forecast-app` safety defects

- Its answer block calls Quiver “the best” and says the free tier includes a personal daily call whose past sessions tune the next call (`app/best-free-surf-forecast-app/page.tsx:61-62`). That conflicts with the current Pro gate.
- Its comparison row repeats “daily call,” “session memory,” and a personal free-use positioning (`app/best-free-surf-forecast-app/page.tsx:68-76`). These statements require entitlement correction.
- Its `SoftwareApplication` JSON-LD hardcodes a free offer and an aggregate rating of 5.0 from four ratings (`app/best-free-surf-forecast-app/page.tsx:196-229`). The rating is volatile and must be externally reverified or removed before publication. No verification was performed in this repository-only audit.

## D. Route collision check

| Proposed route | Current result | Collision/risk | Final recommendation |
|---|---|---|---|
| `/best-free-surf-forecast-app` | Existing static page at `app/best-free-surf-forecast-app/page.tsx`; already in sitemap at `app/sitemap.ts:518-523` | Exact collision. Creating another page is impossible/unnecessary. It also overlaps semantically with `/best-surf-forecast-app`, so query ownership must remain clearly “free selection” versus broader app selection. | Keep `/best-free-surf-forecast-app`; correct/rebuild the existing page in place. |
| `/surf-session-log` | No static route, redirect, rewrite, or proxy rule found. | Low. Until a static folder exists, the one-segment URL falls through `app/[intent]` and returns not found because it is not a valid state intent. A new static segment wins route precedence. | Use `/surf-session-log`. |
| `/personal-surf-forecast` | No static route, redirect, rewrite, or proxy rule found. | Low, with the same temporary `[intent]` fallback behavior. | Use `/personal-surf-forecast`. |

Evidence for dynamic-route behavior: `app/[intent]/page.tsx:47-70` validates the segment and notes that explicit static routes take precedence. The reserved-state helper currently lists only generic roots and does not list these page slugs (`lib/geo/state-routing.ts:1-27`). Static route precedence is sufficient; adding the new slugs to the reserved set is optional defensive maintenance, not necessary for resolution while the static folders exist.

`next.config.mjs` has no matching rewrite for these routes (`next.config.mjs:314-328`) and its relevant redirects are confined to existing comparison aliases/internal rewrite cleanup (`next.config.mjs:363-391`). `proxy.ts` has no matching rule beyond the special nested `/vs/surfline/free` rewrite (`proxy.ts:126-135`). The route guard defaults non-protected routes to public (`lib/middleware/route-guard.ts:92-97`).

`app/seo-pages/` is an internal routing escape hatch for `/vs/surfline/free`, not the directory for normal SEO landing pages. Put the two new one-segment pages directly under `app/`, consistent with the existing acquisition pages.

## E. Sitemap and internal linking

### Exact sitemap change

`app/sitemap.ts:501-537` constructs static URLs from this array:

```ts
const staticRoutes = [
  "/",
  "/features",
  "/about",
  "/privacy",
  "/terms",
  "/plans",
  "/map",
  "/beaches",
  "/beaches/usa",
  "/beaches/mexico",
  "/for-surf-schools",
  "/for-businesses",
  "/free-surf-reports",
  "/best-surf-forecast-app",
  "/best-free-surf-forecast-app",
  "/forecast-accuracy",
  "/vs/surfline",
  "/vs/surfline/free",
  "/roadmap",
].map((route) => ({
  url: `${baseUrl}${route}`,
  lastModified: SITEMAP_CONTENT_VERSIONS.staticPages,
}));
```

Minimum required edit:

```ts
  "/best-free-surf-forecast-app", // already present; do not duplicate
  "/surf-session-log",
  "/personal-surf-forecast",
```

The sitemap collector merges and de-duplicates route families (`app/sitemap.ts:470-487`). Static routes currently inherit `SITEMAP_CONTENT_VERSIONS.staticPages = "2026-02-10"` (`app/sitemap.ts:61-75`). Implementation must make an explicit freshness choice:

- Minimal/no-refactor option: add the two route strings and bump `staticPages` to the release date, accepting that this changes `lastModified` for every static page.
- More precise option: add the new pages to `SITEMAP_ACQUISITION_ROUTES` with page-specific dates and leave the shared static date untouched. If using this option, keep the existing `/best-free-surf-forecast-app` in only one route family so de-duplication does not hide an accidental duplicate.

Add sitemap assertions for all three capability routes. Existing coverage checks `/free-surf-reports` and `/best-surf-forecast-app` but not the three target routes (`__tests__/app/sitemap.test.ts:327-349`).

### Internal-link plan

Use crawlable, contextual links in visible body content; do not rely on protected `/profile` or `/journal` as link sources.

| Destination | Best existing link sources | Reason/evidence |
|---|---|---|
| `/best-free-surf-forecast-app` | `/free-surf-reports`, `/best-surf-forecast-app`, `/vs/surfline/free`, `/features` | The first two already link to it (`app/free-surf-reports/page.tsx:117-123`; `app/best-surf-forecast-app/page.tsx:332-346`). `/vs/surfline/free` owns adjacent free-alternative intent. |
| `/surf-session-log` | `/sessions`, `/features`, `/vs/surfline`, `/vs/surfline/free`, `/best-surf-forecast-app` | These surfaces already discuss sessions/history; `/vs/surfline` links to `/sessions` from its proof section (`app/vs/surfline/page.tsx:215-246,720-723`). Add the capability page as the explanatory destination while keeping `/sessions` as the product destination. |
| `/personal-surf-forecast` | `/features`, `/plans`, `/vs/surfline`, `/vs/surfline/free`, `/best-surf-forecast-app` | These surfaces already discuss personal fit, session memory, or Pro packaging (`app/vs/surfline/page.tsx:77-89,689-734`; `components/pricing/founding-offer-surface.tsx:53-95`). |

Also cross-link the three capability pages where the relationship is genuine:

- Free page → session logging (“logging requires an account; explicit personal matching is Pro”).
- Session page → personal forecast (“rated history can become an input to Pro fit after enough eligible sessions”).
- Personal page → free forecast (“physical forecasts remain free”) and session logging (“history supplies preference evidence”).

Avoid funneling all anchor text through exact-match phrases. Use descriptive variants that state the relationship and preserve each page's distinct query ownership.

## Implementation handoff checklist

### `/best-free-surf-forecast-app` (existing page rework)

- Preserve the route and canonical.
- Replace the current unsupported free-personalization answer block and comparison row.
- Verify or remove all volatile third-party/app-store facts and aggregate-rating schema.
- Recast the page around public conditions access, with precise signed-out versus signed-in-free distinctions.
- Keep no forecast-accuracy ranking.

### `/surf-session-log` (new)

- Present capture fields in grouped, user-readable categories derived from the payload—not as an exhaustive database-field dump.
- Show verified outputs: journal/history, totals/hours/rating, favorite beach, monthly activity, board-use frequency, share card, and conditional per-session forecast comparison.
- Do not advertise current wave-height analytics, placeholder wind scoring, or board-performance comparison.
- State that logging requires an account; do not call it signed-out functionality.

### `/personal-surf-forecast` (new)

- Explain fit/ranking, not physical forecast correction or superiority.
- Make Pro/trial status visible near the first personalization claim and CTA.
- Explain starter versus learned state; use “at least five eligible/rated sessions” rather than “instantly learns.”
- Keep board-aware picks as a Pro feature, distinct from the unverified board-comparison RPC.
- State that underlying forecasts remain free.

### Validation expected during implementation

- Metadata/canonical tests for all three routes.
- Sitemap assertions for all three routes.
- Guest-render E2E coverage for all three routes using the repository's `setupErrorDetection` and `assertNoErrors` pattern (`e2e/guest-seo-updated-surfaces.spec.ts:12-13,76-80`). Existing coverage includes `/vs/surfline`, `/vs/surfline/free`, `/free-surf-reports`, and `/best-surf-forecast-app`, but not `/best-free-surf-forecast-app` (`e2e/guest-seo-updated-surfaces.spec.ts:85-149`).
- Assertions that would fail on entitlement-copy regressions: the free page must not say personal match is free; the personal page must say Pro; the session page must say sign-in/account required.
- Structured-data parse/validation tests, without fabricated aggregate ratings or FAQ JSON-LD.
- Internal-link assertions from at least one crawlable authority page to each new destination.

## Unverified items requiring external or runtime evidence before publication

- Current App Store platform listing, price, trial details, rating, rating count, and in-app purchase values.
- Current competitor pricing, plan features, platform support, cam counts, or coverage counts.
- Any current Quiver user, forecast, spot, cam, alert, or session volume.
- Whether the native clients expose a board-comparison UI that is absent from this web repository.
- Whether every session gets a usable forecast snapshot in all production edge cases; copy should say “when a snapshot is available.”
- Current GSC demand/cannibalization between `/best-surf-forecast-app` and `/best-free-surf-forecast-app`; the repository report establishes target absence, not page-level query ownership in live GSC.
