# Archived History

Status: Historical archive
Reason: Full pre-cleanup project tracker preserved before compressing active planning docs.
Archived on: 2026-05-31
Active tracker: [Project](../../PROJECT.md)

# Quiver Go-Live Campaign

## What This Is

Quiver is a surf decision app for surfers who want one clear call before they paddle out and a product that gets smarter as they use it. This project prepares the full public go-live campaign across web, iOS, outreach, app-store messaging, blog/content, social assets, landing-page conversion, and a founding lifetime membership offer.

The campaign teaches the core product loop: Quiver gives the forecast and surf call, the surfer checks the conditions, the surfer logs the session, and Quiver adjusts to how that surfer actually surfs.

## Core Value

Drive iOS downloads by making the Quiver loop obvious and compelling: forecast, check, log, and improve.

## Requirements

### Validated

- Existing web application foundation with Next.js App Router, React, TypeScript, Supabase auth/data, API routes, and server actions.
- Existing surf forecast, beach discovery, tide/cam/conditions, personalization, session logging, and community surfaces.
- Existing public SEO route families and finite `/blog` founder-notes surface.
- Existing notification, email, analytics, PostHog, Sentry, Vercel cron, Supabase, and App Store/TestFlight support infrastructure.
- Existing Brand-Vault asset source of truth for launch visuals, app screenshots, brand palette, and campaign media.
- Phase 01.1 validated the public zine refresh for `/forecast/santa-cruz`, `/learn`, and requested `/learn/[slug]` articles with shared zine primitives, typed app-local sticker paths, E2E coverage, browser checks, typecheck, and preview build.
- Phase 03-01 validated the current landing architecture map and confirmed later Phase 3 work must edit the active `AuthAwareLandingWrapper`/`LandingInteractiveSections` path, not the older inactive composed landing page.
- Phase 03-02 updated the active landing loop copy in the rendered forecast and ML pipeline sections while preserving existing App Store CTA/event behavior for the next plan.
- Phase 03-03 normalized active iOS CTA copy/events away from pre-order language, dual-fired product analytics to existing internal CTA events, and visually checked landing CTAs on desktop/mobile.
- Phase 03-04 validated active landing visuals against Brand-Vault/current assets and updated the landing architecture source map for the active screenshot set.
- Phase 03-05 closed landing validation with scoped ESLint, targeted Jest, TypeScript typecheck, focused guest landing Playwright coverage, and desktop/mobile browser evidence.
- Phase 04 added a waitlist-safe `/pricing` route, founding access CTA, landing teaser, metadata/schema, sitemap inclusion, tests, preview build, and desktop/mobile browser validation.
- Phase 05 prepared the finite `/blog` platform for multiple launch posts with helper-backed ordering, metadata/schema/sitemap tests, architecture notes, typecheck, and browser smoke captures.
- Phase 06 added two launch blog posts: a founder note about one surf call and the learning loop, plus a dawn-patrol SEO guide tied to real Quiver routes.
- Phase 07 aligned iOS destination truth: live Apple checks show the public App Store page is reachable but still serves preorder offer metadata for the 2026-05-25 release, so web CTAs now use `Open App Store`, analytics status `app_store_preorder`, a visible hero overlay, and Brand-Vault-first asset documentation.
- Phase 08 produced draft-only warm outreach, reviewer/DM copy, social captions, short scripts, Brand-Vault-backed visual briefs, channel rules, suppression rules, Apple relay/bounce hygiene, tracker states, and audit-log requirements.
- Phase 09 added launch campaign metadata to landing, pricing, blog index, and blog post page views; added blog cross-link click tracking through existing `cta_click` events; and documented a read-only launch reporting path across web analytics, App Store/TestFlight checks, Brand-Vault tracker state, and conversion notes.
- Phase 10 completed the local go-live verification gate with scoped lint, targeted unit tests, typecheck, guest E2E, preview build, local desktop/mobile browser captures, live App Store/TestFlight checks, and a go-live checklist. Local code is ready, but deployed `www`/`dev` aliases still return 404 for `/pricing` until an approved deploy updates them.

### Active

- [x] Define the full public launch campaign system across web, iOS, outreach, app-store messaging, social assets, landing page, pricing, and blog.
- [x] Update the landing page so first-time visitors understand the Quiver loop and are guided toward iOS download.
- [x] Add a public waitlist-safe pricing/founding access surface without unverified purchase claims.
- [ ] Publish public pay scale and lifetime purchase details after the payment release gate is verified.
- [x] Prepare the finite blog platform around founder notes/product transparency and SEO surf content.
- [x] Add the launch blog content batch.
- [x] Align app-store/TestFlight/launch messaging with the same product loop and founder offer.
- [x] Plan an outreach/email/social campaign that is useful, surf-first, and does not imply a delayed release when no public date was advertised.
- [x] Track launch conversion and campaign performance with existing analytics primitives.

### Out of Scope

- Rebuilding the core forecast pipeline - the campaign should explain and polish the existing product rather than restart forecast architecture.
- Broad subscription redesign beyond the founding lifetime offer - additional pricing tiers can be deferred unless required to ship the offer clearly.
- Native feature parity work unrelated to launch conversion - iOS launch messaging can call existing app value without bundling unrelated app feature development.
- Production database migrations unless the pricing/founding offer implementation requires an approved schema change.
- Generic lifestyle blogging detached from Quiver's product loop, surf decisions, founder transparency, or search demand.

## Context

Quiver already has a production-grade web foundation with surf forecasts, beach pages, personalization, sessions, social/community features, email and notification infrastructure, analytics, SEO surfaces, and a finite founder-notes blog. The current gap is not basic product existence; it is packaging the product for go-live so new surfers understand why to download the iOS app and how repeated use improves the experience.

The launch message should combine two angles:

1. Stop checking five apps before dawn. Quiver gives one surf call with forecast, cams, tides, and local context.
2. Quiver remembers how you surf. The loop is forecast, surfer checks, logs session, model adjusts.

The founder story should support that message, not replace it. Prior campaign memory also says not to frame launch messaging as a release delay if no public date was advertised. Brand and launch visuals should come from `/Users/stevenchandler/Desktop/dev/Brand-Vault` first, especially existing screenshots, promo assets, color/type guidance, and launch media work.

## Constraints

- **Primary conversion goal**: iOS downloads - Landing, App Store messaging, and campaign CTAs should prioritize getting surfers into the iOS app.
- **Offer**: Lifetime founding membership - Public pricing and promo copy must make the offer clear, truthful, and consistent with actual entitlement/payment implementation.
- **Brand source**: Brand-Vault first - Reuse canonical assets and brand rules before creating new visuals.
- **Messaging**: No fake release-delay framing - Do not imply a date changed or a launch slipped unless a public date was actually promised.
- **Product truth**: Claims must match shipped behavior - Public landing, pricing, blog, App Store, and schema/metadata copy must be checked against current product and entitlement logic.
- **Tech stack**: Existing Quiver web stack - Next.js 16, React 19, TypeScript, Tailwind, Supabase, Vercel, Playwright, Jest, and Yarn 1 on Node 22.
- **Repo safety**: Dirty worktree exists - Keep planning and later implementation commits scoped; do not stage unrelated SEO/script/local files.
- **SEO/content**: Blog expansion must update route, schema, sitemap, and docs together when adding or changing public content surfaces.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full public launch across web, iOS, outreach, app-store messaging, social assets, landing, pricing, and blog | The user wants the complete go-live campaign, not just a single page update | Pending |
| Primary objective is iOS downloads | This focuses campaign hierarchy, CTAs, app-store copy, and measurement | Pending |
| Core story is `one surf call` plus `forecast -> check -> log -> improve` | It explains both immediate utility and why Quiver gets better with use | Pending |
| Founder story supports product loop instead of replacing it | Keeps the campaign conversion-oriented while preserving transparency and founder-led trust | Pending |
| Founding offer is lifetime membership | Creates a concrete launch conversion hook and pay-scale requirement | Phase 2 complete: waitlist now, RevenueCat Web Billing later after release gates |
| Public pre-verification offer is a founding access waitlist | Prevents public checkout, price, lifetime, or cross-platform claims before RevenueCat Web Billing and entitlement sync are proven | Validated in Phase 02 |
| Existing beta/current users are protected | Prevents pricing launch from charging users, removing promo access, or confusing earned founder access with paid founder lifetime | Validated in Phase 02 |
| Pricing release gate is proof-first | Keeps Phase 3 and Phase 4 from publishing prices, checkout, lifetime, native unlock, or App Store purchase claims before they are proven | Added in Phase 02-04 |
| Active landing loop work belongs in the current `/` route path | The older `components/landing-page.tsx` and `HowItWorksSection` are not the active anonymous landing composition | Added in Phase 03-01 |
| Landing loop copy shipped before CTA/event normalization | The page teaches forecast, check, log, improve, and Phase 03-03 then normalized the App Store CTA/event layer | Added in Phase 03-02 |
| iOS CTA analytics use product events plus existing internal CTA events | `ios_app_cta_view` / `ios_app_cta_click` preserve launch-specific measurement while `/api/events` receives existing `cta_impression` / `cta_click`, avoiding a schema migration | Added in Phase 03-03 |
| Landing visuals stay vault-first | The active Forecast/Log/Check screenshots, nav icon, activity thumbnails, and SSR fallback imagery have exact Brand-Vault matches; hero media is an optimized derivative of the Brand-Vault launch-video render | Added in Phase 03-04 |
| Landing phase is validated before pricing work | Phase 3 passed scoped lint, targeted Jest, typecheck, focused guest landing Playwright checks, and desktop/mobile browser capture before Phase 4 starts | Validated in Phase 03 |
| Pricing surface is waitlist-safe until checkout is verified | `/pricing` and the landing teaser collect founding access interest through signup, but publish no prices, checkout links, lifetime purchase claims, or web/native entitlement claims | Validated in Phase 04 |
| Blog platform stays finite and helper-backed | `/blog`, `/blog/[slug]`, schema, static params, and sitemap now share `getAllBlogPosts`/related helpers instead of raw array assumptions | Validated in Phase 05 |
| Blog mix is founder notes plus SEO surf content | Phase 06 added a founder loop note and a practical dawn-patrol guide with real Quiver route links | Validated in Phase 06 |
| iOS App Store CTA stays status-neutral until Apple flips the offer state | Live Apple checks on 2026-05-24 show the App Store page is public but still preorder, so the web CTA says `Open App Store` and analytics record `app_store_preorder` | Validated in Phase 07 |
| TestFlight remains separate from public App Store and web pricing | The public TestFlight link is still live, but web founding/pricing copy stays waitlist-only and does not imply sandbox purchase carryover | Validated in Phase 07 |
| iOS launch visuals stay Brand-Vault-first | Phase 07 documented the 6.7/6.1 App Store screenshots, launch hero source render, and canonical app icon before any new visuals are generated | Validated in Phase 07 |
| Outbound launch work is approval-gated | Phase 08 created drafts and protocols only; no sends, posts, DMs, tracker writes, Play Console actions, entitlement grants, or production mutations are authorized without exact user approval | Validated in Phase 08 |
| Reddit remains comment-first | Phase 08 preserves warm users, reviewers, useful replies, and public founder/social posts as priorities while keeping broad Reddit launch/user-acquisition posts paused unless explicitly reopened | Validated in Phase 08 |
| Launch reporting uses existing event primitives | Phase 09 uses `page_view`, `cta_impression`, `cta_click`, and existing waitlist signup CTA events with metadata instead of adding launch-only event names or a DB migration | Validated in Phase 09 |
| Blog launch links are measurable through generic CTA events | Blog hub and post links now emit `cta_family=launch_blog_cross_link` with destination type/path metadata | Validated in Phase 09 |
| App Store/TestFlight truth remains a live report input | Phase 09 reporting docs require live Apple checks before launch readouts because store status can change outside the repo | Validated in Phase 09 |
| Public go-live requires an approved deploy after local verification | Phase 10 proved local routes/build/tests, but `www.quiversurf.app/pricing` and `dev.quiversurf.app/pricing` still return 404, so public claims wait for deploy/alias approval | Validated in Phase 10 |
| Store release status uses the exact Apple timestamp as the truth gate | iTunes lookup reports `2026-05-25T07:00:00Z`; App Store HTML is partially transitioned, so final release claims need a post-timestamp recheck | Validated in Phase 10 |
| Public zine surfaces should reuse shared primitives and typed sticker paths | Keeps forecast and learn refreshes aligned with beach-detail zine language without coupling routes to beach-detail-only components | Validated in Phase 01.1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections.
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-05-24 after Phase 08 completion*
