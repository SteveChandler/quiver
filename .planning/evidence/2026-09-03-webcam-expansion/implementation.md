# Expanded camera implementation — 2026-09-03

Seven verified camera assignments prepared; [all98 outcomes](full-review.md). No production writes, commits, or deployment in this continuation.

## Files changed

Production files:
- `lib/media/cam-embed.ts`: six verified provider domains use existing external link-out rendering. Existing Ozolio subdomain embeds remain unchanged.
- `supabase/migrations/20260903190000_add_verified_provider_cameras.sql`: seven UUID+slug-matched active beaches, camera_url only, preserves existing non-null URLs.

Tests changed:
- `__tests__/lib/media/cam-embed.test.ts`: six provider destinations, existing Ozolio embed regressions, prototype-property hostname guard.
- `__tests__/api/beaches-sources-native-fields.test.ts`: provider link-out API fields and real200 status.
- `verify-migration.py` in this evidence folder: executes actual migration locally, repeatability and preservation assertions, rolls back.

Evidence: three regional per-listing reviews, full-review.{json,csv,md}, selected-cameras.json, this report, and replacement production-plan.md.

## Checks

- PASS `python3 .planning/evidence/2026-09-03-webcam-expansion/verify-migration.py`: seven exact assignments; second run no-op; preserves existing cameras, unrelated sources and forecast settings; rolled back.
- PASS `yarn jest --runInBand __tests__/api/beaches-sources-native-fields.test.ts __tests__/lib/media/cam-embed.test.ts __tests__/components/beach-detail/cams-section.test.tsx`:64 tests,3 suites.
- PASS `yarn typecheck`.
- PASS `npx eslint --max-warnings=0 lib/media/cam-embed.ts __tests__/lib/media/cam-embed.test.ts __tests__/api/beaches-sources-native-fields.test.ts`.
- PASS `git diff --check`.
- Independent read-only review: all seven UUID/slug/URL tuples checked against current catalog/evidence, existing-camera guard and provider handling reviewed; no actionable findings.
- E2E reviewed: `e2e/guest-cam-funnel-analytics.spec.ts`; not modified or run because this batch reuses the existing renderer and targeted component/API tests cover changed classification. No E2E pass claim. All seven external provider views were checked in an actual browser; no local app screenshot pass claimed.

## Remaining limits

Production unchanged; exact-plan approval is required by docs/MIGRATION_SAFETY.md before release. Earlier two-camera hash superseded.
Native UI unchanged and unverified on-device; current native hero has no provider-page link control. These sources add web link-outs.
No embedding permission claimed. Cameras can go offline; Jacksonville YouTube video ID may change. Poipu briefly showed corruption and recovered. Recheck at rollout.

- PASS `VERCEL_ENV=preview yarn build > /tmp/quiver-camera-build.log 2>&1`: completed in94.72 seconds.
- PASS read-only inventory assertions:98 unique outcomes, all referenced UUIDs exist,17 existing assignments and7 empty slots match the refreshed snapshot.
