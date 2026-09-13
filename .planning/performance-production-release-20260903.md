# Performance production release — 2026-09-03

PR https://github.com/SteveChandler/quiver/pull/681 merged normally after all required gates passed.
Production commit: `152d16259ef27dac6409df0f0ae7e94c2cd0b9a4`.
Vercel deployment: `dpl_H5gUq6vhxk6eNpSG5JgsyScpZ4BP`, READY, exact SHA and www.quiversurf.app alias verified. Root URL HTTP 200.
Main/prod file contents identical after merge. Cron index already applied; no DB mutation during promotion.

## Changes during final review
Production files: components/map/interactive-map.tsx; components/map/swell-field/field-sampler.ts.
Tests modified: __tests__/components/map/interactive-map.test.tsx; __tests__/components/map/swell-field/field-sampler.test.ts.
Fix: keep water-mask retry pending when loaded tiles produce an untrusted pass; stop idle queries after success. Regression failed before fix.
Documentation merge resolved by preserving newer main release receipts; existing prod outreach tracker entries preserved.

## Verification and exact commands
PASS (85 tests):
```sh
CI=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=gate-unit-tests-placeholder yarn test:unit --runInBand __tests__/components/map/interactive-map.test.tsx __tests__/components/map/swell-field/field-sampler.test.ts
```
Initial same command without environment placeholders FAILED during environment validation before tests; rerun above passed.

PASS:
```sh
yarn eslint --max-warnings=0 components/map/interactive-map.tsx components/map/swell-field/field-sampler.ts __tests__/components/map/interactive-map.test.tsx __tests__/components/map/swell-field/field-sampler.test.ts
git diff --check
```

Reviewed and ran existing E2E files e2e/guest-landing-media-budget.spec.ts and e2e/guest-whats-new.spec.ts; no E2E changes in this promotion turn.
PASS 6/6 on each target:
```sh
BASE_URL=https://dev.quiversurf.app SKIP_AUTH_SETUP=true SKIP_E2E_CLEANUP=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder yarn test:e2e e2e/guest-landing-media-budget.spec.ts e2e/guest-whats-new.spec.ts --project=guest --workers=1 --retries=0
BASE_URL=https://www.quiversurf.app SKIP_AUTH_SETUP=true SKIP_E2E_CLEANUP=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder yarn test:e2e e2e/guest-landing-media-budget.spec.ts e2e/guest-whats-new.spec.ts --project=guest --workers=1 --retries=0
```

CI https://github.com/SteveChandler/quiver/actions/runs/33801371622 PASSED on exact final head c0da7e48acf1a56dff83d05575a4885ed96f41d3: Build, Lint, TypeScript, 1391 unit suites / 17731 tests, 19 Playwright smoke tests. 197 unit tests skipped and 1 todo.
PASS `gh pr checks 681` before merge.
PASS `gh pr merge 681 --merge --match-head-commit c0da7e48acf1a56dff83d05575a4885ed96f41d3`.

Production artifact utility PASS:
```sh
python3 /Users/stevenchandler/.codex/skills/release-artifact-summary/scripts/summarize_release_artifact.py --url https://www.quiversurf.app --platform web --profile production --build-number 152d16259ef27dac6409df0f0ae7e94c2cd0b9a4 --channel prod --target www.quiversurf.app --notes 'Vercel dpl_H5gUq6vhxk6eNpSG5JgsyScpZ4BP READY; exact prod SHA and www alias verified' --format json
```

## Limits
No unresolved release findings. Real-user OAuth flows, native/device UI, and long-term performance improvement were not measured during promotion. Historical credential exposure remediation is separate. Earlier local generated-route/build issues did not reproduce in successful CI/Vercel builds. No additional production database changes made. Active worktrees and untracked DB evidence preserved.

## Full promoted file list
```
.impeccable/config.json
.planning/evidence/2026-09-03-catalog-gap-beaches/README.md
.planning/evidence/2026-09-03-catalog-gap-beaches/release-artifact.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-before-digests.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-browser-checks.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-deployment.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-followup-deployment.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-migration-output.txt
.planning/evidence/2026-09-03-catalog-gap-beaches/release-postflight.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-preview-photo-checks.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-production-photo-checks.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-receipt.md
.planning/evidence/2026-09-03-catalog-gap-beaches/release-thumbnail-upstreams.json
.planning/evidence/2026-09-03-catalog-gap-beaches/release-web-api-checks.json
.planning/perf-auth-report.md
.planning/perf-db-report.md
.planning/perf-pages-report.md
.planning/perf-release-verification.md
.planning/performance-implementation-report.md
.planning/supabase-fixture.cjs
.planning/verify-started-cron-index.sql
__tests__/actions/forecast-actions.test.ts
__tests__/app/whats-new-page.test.tsx
__tests__/components/field-guide/quiver-field-guide-landing.test.tsx
__tests__/components/landing/autoplay-video.test.tsx
__tests__/components/landing/field-guide-features.test.tsx
__tests__/components/map/interactive-map.test.tsx
__tests__/components/map/swell-field/field-sampler.test.ts
__tests__/components/store-download-buttons.test.tsx
__tests__/lib/api-utils.test.ts
__tests__/lib/monitoring/redact-secrets.test.ts
__tests__/lib/monitoring/sentry-redaction.test.ts
__tests__/lib/services/beach-query-service.test.ts
__tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts
__tests__/lib/services/enhanced-forecast-service.test.ts
__tests__/lib/services/observations/nowcast-anchor.test.ts
__tests__/lib/supabase/auth-session-recovery.test.ts
app/globals.css
app/sitemap.ts
app/whats-new/page.tsx
components/app-header.tsx
components/app-store/send-to-phone-cta.tsx
components/intent/water-temp-hero-section.tsx
components/landing-page/field-guide/autoplay-video.tsx
components/landing-page/field-guide/field-guide-hero.tsx
components/landing-page/field-guide/field-guide-inside-app.tsx
components/landing-page/field-guide/field-guide-release-strip.tsx
components/landing-page/navbar.tsx
components/landing-page/store-download-buttons.tsx
components/map/interactive-map.tsx
components/map/swell-field/field-sampler.ts
docs/BEACH_CATALOG_GAPS.md
e2e/guest-landing-media-budget.spec.ts
e2e/guest-landing.spec.ts
e2e/guest-whats-new.spec.ts
instrumentation-client.ts
lib/api-utils.ts
lib/constants/footer-links.ts
lib/data/whats-new.ts
lib/monitoring/redact-secrets.ts
lib/services/beach-query-service.ts
lib/services/discovery/surf-discovery-orchestrator.ts
lib/services/enhanced-forecast-service.ts
lib/services/observations/nowcast-anchor.ts
next.config.mjs
patches/@supabase+auth-js+2.100.0.patch
public/images/whats-new/alerts-poster.jpg
public/images/whats-new/beach-poster.jpg
public/images/whats-new/home-poster.jpg
public/images/whats-new/spot-poster.jpg
public/videos/whats-new/alerts.mp4
public/videos/whats-new/beach.mp4
public/videos/whats-new/home.mp4
public/videos/whats-new/spot.mp4
sentry.edge.config.ts
sentry.server.config.ts
supabase/migrations/20260903200100_index_started_cron_runs.sql
```
