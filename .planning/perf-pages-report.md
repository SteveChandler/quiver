# Homepage / ISR performance work — 2026-09-03

## Reviewed plan
1. Trace current landing media and all AutoplayVideo callers, existing media-budget/guest E2E and cache invalidation paths.
2. Gate shared video source attachment on visibility plus motion/data preference; preserve explicit playback and poster layout. Use existing framer-motion viewport hook. No TTL changes without causal evidence.
3. Verify regression tests, scoped lint/typecheck, local guest-media E2E and build where possible. Review diff.

Confirmed source issue: AutoplayVideo always emits src + metadata preload, then plays on hydration even below fold; Save-Data is ignored and reduced-motion still downloads metadata. Both homepage hero and walkthrough share it, as do release previews. This proves unnecessary media work, not that it alone caused the 10.2s P75 observed in 10 production events.

## Changes
- Production: `components/landing-page/field-guide/autoplay-video.tsx` only. Use existing `useInView` to defer src attachment until first visibility. No video request until reduced-motion and Save-Data checks permit it; explicit play remains available. Preserve poster/layout and retry manual play after failed playback.
- Added `__tests__/components/landing/autoplay-video.test.tsx`: 3 regression cases (offscreen, reduced motion, Save-Data), including manual playback. All three fail against original implementation.
- Updated `e2e/guest-landing-media-budget.spec.ts`: verify below-fold inside-app preview has no src/request, scroll to it and prove playback; retain initial media budget and verify explicit playback in both safety modes.
- Reviewed `e2e/guest-landing.spec.ts`, media budget spec, E2E architecture/config/setup/cleanup/error helper. Did not run the broad guest spec because its deleted-photo group creates DB rows and has weak conditional assertions unrelated to this change.

## Cache review
Both intent/city and intent/city/beach routes already use force-static + revalidate 3600; metadata/page share React cache for resolution. Public reads use createPublicReadClient. Hold transitions enumerate/deduplicate affected paths and invalidate them explicitly; indexability snapshots use stable beach-ID fingerprints with an hourly cache. No evidence supports changing TTL, removing hold invalidation, or caching personal content. The production write/read counts alone cannot distinguish expected cold paths/crawler churn from waste. Defer ISR changes pending route-level cache-miss reasons and post-deploy traffic measurements.

## Commands / evidence
All commands executed in this isolated worktree. No secrets or production DB writes.

1. `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key yarn test:unit --runInBand __tests__/components/landing/autoplay-video.test.tsx` — expected FAIL, 3/3 cases fail before implementation.
2. `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3134 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key yarn test:unit --runInBand __tests__/components/landing/autoplay-video.test.tsx __tests__/components/landing/field-guide-features.test.tsx __tests__/app/whats-new-page.test.tsx` — PASS, 13 tests/3 suites (also passed earlier with synthetic54321).
3. `yarn eslint --max-warnings=0 components/landing-page/field-guide/autoplay-video.tsx __tests__/components/landing/autoplay-video.test.tsx e2e/guest-landing-media-budget.spec.ts` — PASS twice.
4. `git diff --check` — PASS.
5. `yarn typecheck` — interrupted per root request to avoid four concurrent typechecks; not validated here. Root combined gate required.
6. `env NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3134 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key VERCEL_ENV=preview NEXT_PUBLIC_PLAYWRIGHT_TEST=true PLAYWRIGHT_TEST=true NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS=true NEXT_PUBLIC_E2E_DISABLE_AUTH_REFRESH=true NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/e2e/fixtures/next-font-google-mock.cjs" yarn next build --webpack` — interrupted per root request before completion; build not validated here.
7. Same env as (6), `yarn next dev --webpack -p 3113` — server starts successfully, homepage200. Local fixture on3134 returns empty public reads and401 auth. Earlier54321 synthetic key was rejected (as expected), causing server errors reflected into dev-browser console.
8. `BASE_URL=http://localhost:3113 SKIP_AUTH_SETUP=true SKIP_E2E_CLEANUP=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3134 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key yarn test:e2e e2e/guest-landing-media-budget.spec.ts --config=perf-pages.playwright.config.ts --project=guest --workers=1` — first fixture run3PASS/1FAIL; desktop deferred media and both explicit preference-play flows pass. Mobile reports `Uncaught: Invalid or unexpected token` and never hydrates. Identical rerun4FAIL with same dev script parsing error, before playback assertions. Do not report E2E green. Need combined production-build E2E to determine whether this is local dev streaming/cache or product failure. Earlier default-config attempt failed because reuseExistingServer=false; temporary override only disables webServer and otherwise inherits config.
9. Read-only Node fetch + vm.Script compilation of homepage inline/external scripts — PASS, no syntax errors reproduced outside browser.

## Visual and limits
CUA inspected local desktop homepage and displayed screenshot: hero playing, readable heading and CTA, no overlap observed. Mobile visual QA not completed because E2E hydration fails. Failure screenshots remain in test-results. This is not a measured production LCP improvement: 3.6MB buoy-loop is deferred only while offscreen, and release preview similarly no longer starts below-fold. Need production-build browser gate and later real-user measurements before claiming the sparse10-event P75 issue resolved.

No commit/push/deploy. Root to run combined typecheck/build and browser gate. Rollback: revert the one production component and its tests.
