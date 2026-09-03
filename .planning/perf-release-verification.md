# Performance release verification — 2026-09-03

## Shipped application batch

Four commits pushed normally to main: 8038d6561 (auth), 03049199d (database), 8a58613bc (discovery), a4f2dedd3 (landing). Only task-owned changes were transferred onto origin/main0b1835fa2. Unrelated local Hawaii catalog and email policy commits were excluded. All four pre-commit secret scans and guardrails passed; no hooks bypassed.

Vercel deployment dpl_3L59eGwdJAd1v9hP2KL6t7pDMUDL is Ready and dev.quiversurf.app points to exact SHA a4f2dedd3f949f50a4a30df5101bd8a89a418378. Its clean install applied auth-js2.100.0 patch successfully; Turbopack build passed. HTTP200 confirmed by release-artifact-summary. The earlier local webpack/generated-type failures and dev-server E2E failures did not reproduce on this Vercel deployment.

## Checks

- Same45-suite focused unit command from performance-implementation-report.md rerun on shipping base: PASS570 tests.
- `BASE_URL=https://dev.quiversurf.app SKIP_AUTH_SETUP=true SKIP_E2E_CLEANUP=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder yarn test:e2e e2e/guest-landing-media-budget.spec.ts --project=guest --workers=1 --retries=0`: PASS4/4 on deployed dev (desktop/mobile lazy media, reduced-motion/Save-Data manual playback). No authenticated setup or data cleanup performed.
- Prod Gate33798054768: lint and TypeScript passed; unit tests failed7 cases across3 suites; downstream build/smoke canceled.6 failures were stale consumer mocks missed by the initial focused selection.1 was the pre-existing release video budget violation.

## Follow-up corrections

- __tests__/actions/forecast-actions.test.ts: RPC mock supports server filter; assert requested RPC and exact beach filter.
- __tests__/components/field-guide/quiver-field-guide-landing.test.tsx: deterministic viewport hook mock; new offscreen-to-visible assertion keeps source/autoplay checks meaningful.
- public/videos/whats-new/beach.mp4:1050790→795886bytes; spot.mp4:1469579→804351bytes. Both below819200byte gate. H264720×1566/30fps and durations22.333333/27.166667s preserved. Two-pass libx264 slow270k/220k, yuv420p, faststart. Full ffmpeg decode passed; matching10s/12s frames inspected and labels readable, some fine map texture reduction.
- .impeccable/config.json: narrowly suppress broken-image detector for intentional Next Image mock in that one test file; src is forwarded through props. No production design warning suppressed.

Focused follow-up:

```sh
CI=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=gate-unit-tests-placeholder yarn test:unit --runInBand __tests__/actions/forecast-actions.test.ts __tests__/components/field-guide/quiver-field-guide-landing.test.tsx
# PASS42 tests. Initial new assertion incorrectly pinned max_age_hours4; corrected to assert RPC and beach filter without pinning unrelated freshness configuration.
yarn eslint --max-warnings=0 __tests__/actions/forecast-actions.test.ts __tests__/components/field-guide/quiver-field-guide-landing.test.tsx
# PASS.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3134 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key yarn test:unit --runInBand __tests__/assets/public-media-budget.test.ts
# PASS2 tests in asset worker.
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,pix_fmt -of json FILE
ffmpeg -v error -i FILE -f null -
# PASS for both compressed videos.
```

Full-suite command and final result:

```sh
CI=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=gate-unit-tests-placeholder yarn test:unit --runInBand --bail=0
```

Full suite PASS:1,390 suites,17,707 tests,4 snapshots;195 skipped,1todo,16 skipped suites. Runtime270.091seconds. All three previously failing suites pass. Final local source diff check and scoped lint passed.

## Remaining rollout

Production has not been promoted. Existing main→prod PR681 includes earlier unreleased work as well as this batch. Require review and passing release gates before merging. The cron index SQL is committed, not applied. Vercel does not execute the migration. Follow docs/MIGRATION_SAFETY.md: verify migration history and fresh backup, produce exact owner-connection plan, obtain plan approval token, apply and verify index/query plan. Production cron application changes run only after prod deployment. Historical exposed credential remediation remains a separate production action.

## Concurrent main update

First follow-up push was safely rejected non-fast-forward after another task pushed27f3ee1d6. Rebased the two follow-up commits onto that current main without conflicts or force. Full-suite result above predates that unrelated catalog/camera update; final rebased tip passed118 tests across6 suites:

```sh
CI=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=unit-test-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 SUPABASE_SERVICE_ROLE_KEY=gate-unit-tests-placeholder yarn test:unit --runInBand __tests__/actions/forecast-actions.test.ts __tests__/components/field-guide/quiver-field-guide-landing.test.tsx __tests__/assets/public-media-budget.test.ts __tests__/api/beaches-sources-native-fields.test.ts __tests__/components/beach-detail/cams-section.test.tsx __tests__/lib/media/cam-embed.test.ts
```
