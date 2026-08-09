# Phase 20 Research: Domain, App Links, Analytics, And QA

**Created:** 2026-06-02
**Status:** ready for planning

## Scope

Phase 20 is the release-readiness layer for Session Intelligence. It verifies
that web-to-native handoff works, that measurement events can land, and that
the rollout survives the fallback and viewport matrix documented in Phase 14.

No deploy, alias promotion, production database mutation, outbound send,
payment action, or entitlement action is part of planning. Any live production
mutation remains approval-gated.

## Current App-Link State

- `app/.well-known/apple-app-site-association/route.ts` exists.
- Current required AASA paths include `/auth/*`, `/sessions/*`, `/beach/*`,
  `/profile/*`, `/map*`, `/invite/*`, and `/settings*`.
- Phase 20 requires validation for `/app/spot/:slug?window=:id`; current AASA
  does not explicitly include `/app/*` or `/app/spot/*`.
- `app/.well-known/assetlinks.json/route.ts` exists and emits Android package
  rows from env, with fingerprints from `ANDROID_SHA256_FINGERPRINTS`.
- `lib/recommendations/surf-window-links.ts` currently builds window-specific
  links from `/beach/{slug}?window={id}`.
- `components/session-intelligence/app-deep-link-cta.tsx` prefers universal
  link, then app deep link, then `IOS_APP_STORE_URL`.
- `lib/constants/app-store.ts` points to live App Store app id `6759300320`.

## Current Analytics State

- Accepted `/api/events` names come from `lib/analytics/event-taxonomy.ts`.
- The API route exports those arrays from `app/api/events/route.ts`.
- `user_events.event_type` is protected by a database CHECK constraint.
- `__tests__/api/events-allowlist-db-sync.test.ts` proves every
  `VALID_EVENTS` entry appears in a migration.
- `__tests__/api/events-taxonomy-characterization.test.ts` hashes the current
  event sets and must be updated intentionally when the taxonomy changes.
- Phase 20 event names are currently absent:
  - `surf_window_impression`
  - `surf_window_click`
  - `why_this_call_opened`
  - `app_deeplink_clicked`
  - `forecast_accuracy_table_viewed`
  - `save_alert_clicked`
  - `seo_intent_page_window_clicked`

## Current Measurement State

- `scripts/gsc-stats.py` can query Google Search Console and reports clicks,
  impressions, CTR, and average position.
- `scripts/seo/export-posthog.ts` and SEO agent workflow utilities exist for
  behavior exports.
- Phase 18 verification explicitly says dated GSC/PostHog evidence is required
  before claiming SEO lift.
- Measurement work must separate baseline evidence from claims. If a connector
  or credential is unavailable, the doc should record the blocker instead of
  inventing a number.

## Current QA State

- Phase 16 added `e2e/guest-session-intelligence-components.spec.ts` covering
  360, 390, 412, tablet, and desktop widths for the dev preview.
- Phase 18 added `e2e/guest-session-intelligence-seo-rollout.spec.ts` for
  public SEO-safe Session Intelligence surfaces.
- Phase 19 added `e2e/guest-forecast-accuracy.spec.ts` for the trust page.
- `e2e/utils/error-detection.ts` is required for browser specs.
- The remaining Phase 20 matrix includes app-link fallback, canonical/schema
  checks, route performance, and data-sparse conditions such as no buoy, no
  tide, no cam, no user reports, model only, and low confidence.

## Planning Implications

Phase 20 should be split into:

1. App-link route/manifests/link-builder alignment.
2. Analytics allowlists, migration file, and emitters.
3. Before/after measurement documentation.
4. Expanded public QA matrix.
5. Final live verification and phase closeout.

## Open Risks

- Native app routing for `/app/spot/:slug?window=:id` may require iOS/native
  changes outside this repo. The web repo can verify manifests and web fallback,
  but native behavior must remain an explicit release gate.
- Applying the analytics migration to production is not authorized by this
  phase plan. The migration file can be authored and locally checked; execution
  against production requires approval.
- GSC has a 2-3 day lag, so "after" measurements cannot be claimed immediately
  after release.
