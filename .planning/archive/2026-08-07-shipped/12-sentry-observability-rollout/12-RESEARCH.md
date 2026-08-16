# Phase 12 Research: Sentry Observability Rollout

## Source Email

- Sender: Greg Kumparak, Sentry
- Received: 2026-05-27
- Summary: Quiver was accepted into Sentry for Startups with $5,000 in credits. The unused balance expires one year from receipt, on 2027-05-27. A credit card is required before selecting a paid plan; charges draw against the credit until it expires or runs out.

## Current Quiver State

- Web uses `@sentry/nextjs@10.27.0` through `instrumentation-client.ts`, `instrumentation.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and `next.config.mjs`.
- Native uses `@sentry/react-native@~7.11.0` through `index.ts`, `src/lib/sentry.ts`, the Expo config plugin, iOS/Android Sentry scripts, and release metadata.
- Native and web currently appear to share the `javascript-nextjs` Sentry project/DSN, so native Android/iOS issues show under a web-named project.
- Web production tracing is currently broad (`tracesSampleRate: 1.0` client/server configs), while recent weekly email showed high transaction volume and dropped transactions.
- Native release scripts and `eas.json` set `SENTRY_DISABLE_AUTO_UPLOAD=true`, so source-map/debug-symbol upload is intentionally disabled for release builds.
- Existing app code already captures high-value failures around auth, RevenueCat, push notifications, analytics retries, pending session flush, cron probes, sitemap health, Firebase admin init, and error boundaries.
- Existing internal cron observability uses `cron_runs`; Sentry Cron monitors should supplement that with external "did this job fire and finish" alerts.

## Recent Sentry Signal

- Weekly report for 2026-05-15 through 2026-05-22: 59 project errors, 69.4k transactions, 35.6k dropped transactions.
- Weekly report for 2026-05-01 through 2026-05-08: 484 project errors, 58.4k transactions, 31.1k dropped transactions.
- Recent high-value issues included RevenueCat test API key blocked in release build, iOS watchdog termination, `user_events_event_type_check` analytics failures, location failures, URL-opening failures, and fallback events.

## Recommended Direction

Use the credit for a controlled rollout, not blanket high-volume capture:

1. Split Sentry projects/DSNs by deployable surface: web, native, and later Seaside if needed.
2. Fix release/source-map/debug-symbol upload before expanding Seer, tracing, replay, or profiling usage.
3. Replace blanket production tracing with route/flow-aware sampling.
4. Keep replay conservative: high on error, very low for full sessions, with text/media masking.
5. Add logs and tags only for critical product flows where they reduce support/debug time.
6. Add Sentry Cron monitors for critical production jobs while keeping `cron_runs` as the detailed internal run ledger.
7. Add monthly usage/budget review before increasing replay, log, tracing, or profiling volume.

## Implementation Started

- Web Sentry config now centralizes DSN fallback, environment detection, release/dist lookup, and trace sampling in `lib/monitoring/sentry-config.ts`.
- Server and edge Sentry initialization no longer rely on `NODE_ENV=production` alone, so Vercel Preview and `dev.quiversurf.app` traffic are classified as preview and dropped instead of being tagged production.
- Blanket `tracesSampleRate: 1.0` was replaced with a route-aware sampler:
  - static assets, monitoring tunnel, and health checks: 0%
  - auth, onboarding, RevenueCat, cron, push/notification routes: 50%
  - launch conversion routes such as `/pbsc`, `/pricing`, and iOS/download paths: 25%
  - forecast, beach, map, and analytics ingestion routes: 15%
  - routine traffic: 5%
- Session Replay remains lazy-loaded and masked, with session/error replay rates still disabled until project split, source-map hygiene, and usage budget guardrails are verified.

## Docs Reviewed

- Sentry Next.js manual setup: `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `onRequestError`, source-map upload, fixed tunnel route, tracing, replay, and logs guidance.
- Sentry JavaScript options: `release`, `environment`, `enabled`, `beforeSend`, `tracesSampleRate`, `tracesSampler`, replay sample rates, and trace propagation behavior.
- Sentry sampling guidance: `tracesSampler` can apply different rates per transaction type, filter health checks, and use `inheritOrSampleWith` for distributed trace inheritance.
- Sentry Cron Monitoring / JavaScript API: `captureCheckIn` supports `monitorSlug`, `status`, `checkInId`, crontab schedules, check-in margin, max runtime, and timezone.
- Sentry React Native Expo setup and source maps.
- Sentry Projects.
- Sentry pricing and usage model.
