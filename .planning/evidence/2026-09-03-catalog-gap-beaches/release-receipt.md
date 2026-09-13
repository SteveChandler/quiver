# Catalog-gap release receipt

Approved plan: `e5541a9139468452474cd53752ce2f5f4b3acec634b8760ee1eb568be82e9d4e`.
Exact applied migration: `20260903200000_add_verified_catalog_gap_beaches.sql`, SHA256 `0c4d4eb8ca0b1a0fa27f5034905edfd5641a3a9c8e74932cd0bbe2864a80a83b`.

## Release and database

- Initial main commit: `27f3ee1d6adf5fecdcb571bcfe43a85fee80ec11`.
- Initial production release: [PR #684](https://github.com/SteveChandler/quiver/pull/684), merge `4f9cf4801d38c14e3f1c1083a04813f0cc4f1be6`. Vercel deployment `dpl_8TW8xtRk8WNQ6FgipBRAdTntRYYy` was Ready and aliased to `www.quiversurf.app` before any data writes.
- Applied the exact SQL as owner `postgres`, with `ON_ERROR_STOP`. Recorded the full successful SQL in `supabase_migrations.schema_migrations` after its transaction committed.
- Postflight passed: 28 exact beach records, 28 Open-Meteo mappings, 12 exact camera URLs, 5 exact licensed photo rows. Compared every imported metadata field and the full ledger SQL. Hash comparisons confirmed every pre-existing beach, source, and photo row unchanged.
- Backup SHA256 matched the approved artifact and was less than 24 hours old.
- No earlier Hawaii-10 or seven-existing-camera migration was applied.
- Main and production were published through isolated worktrees, excluding unrelated local email and unreleased performance changes from production.

## Browser findings and fixes

- All 28 new beaches appeared in production map search.
- The initial production browser pass verified 26 detail pages and 10 camera controls. It found missing DE/MD route mappings and an image-proxy rejection of the official `thumb.wikimedia.org` host.
- Fixed those two root causes in `lib/utils/beach-url-utils.ts` and `app/api/image-proxy/route.ts`, with regression tests. No SQL or imported data was changed.
- Follow-up main commits: `45082772d7c5895b9411f12d2f82af1e74ad9afe` and `bc315fb26e3c3404f54bb4a3400c0a26b65ae330`.
- Follow-up production release: [PR #685](https://github.com/SteveChandler/quiver/pull/685), merge `87bb6fe69fb92d84572f6ae306b0bfe4c7f9d724`.
- Preview verification passed for all 5 photo-proxy JPEG responses; the Kaanapali hero loaded at 960 pixels wide.
- Final production verification PASS: deployment `dpl_Hfvpku6aeEdEgUACtH5qr2rRZgPn` is Ready on revision `87bb6fe69fb92d84572f6ae306b0bfe4c7f9d724`, with `www.quiversurf.app` aliased to it. All 28 detail/search entries and 12 camera anchors were checked in the production browser. All five production image-proxy responses returned valid JPEG bytes; the Kaanapali hero loaded with naturalWidth=960. No unresolved release findings remain.

## Exact checks

- PASS `yarn typecheck` on both isolated release checkouts, and after both follow-up fixes.
- PASS `yarn jest --runInBand __tests__/api/beaches-sources-native-fields.test.ts __tests__/lib/media/cam-embed.test.ts __tests__/components/beach-detail/cams-section.test.tsx`: 74 tests, 3 suites, on isolated main and production.
- PASS `python3 .planning/evidence/2026-09-03-catalog-gap-beaches/verify-migration.py`: real local SQL insertion, exact records, idempotency with a later unrelated photo, preservation of existing rows, and UUID/coordinate conflict rollback. All test writes rolled back.
- PASS `yarn jest --runInBand __tests__/api/image-proxy.test.ts __tests__/lib/security/ip-validation.test.ts __tests__/lib/utils/beach-url-utils.test.ts __tests__/lib/geo/state-routing.test.ts --silent`: 117 tests, 4 suites, on the isolated production follow-up checkout.
- PASS `npx eslint --max-warnings=0 app/api/image-proxy/route.ts __tests__/api/image-proxy.test.ts`.
- PASS `npx eslint --max-warnings=0 lib/utils/beach-url-utils.ts __tests__/lib/utils/beach-url-utils.test.ts`.
- PASS `git diff --cached --check` before each commit; commit hooks reported no secret leaks and 14/14 local architecture checks.
- PASS `node /tmp/apply-catalog-approved.mjs --apply`: exact SQL/plan hashes, owner role, absent ledger/targets, exact postflight and existing-row preservation. This command must not be rerun: the migration is already applied.
- Raw HTTP search smoke `python3 /tmp/verify-catalog-web.py` failed with 403 responses. No access controls were changed; search was verified through the normal production browser UI instead. Its result is retained in `release-web-api-checks.json`.
- The first isolated Jest attempt lacked the untracked local environment; linking the existing `.env` resolved setup. New test drafts initially had uncleared fetch mock history and an incorrect expected state-root path; corrected, then all focused tests passed.
- Git staged-whitespace checks initially caught CRLF CSV lines and an extra EOF newline in evidence; normalized before commit.
- GitHub rejected a direct prod push because a PR is required. Released through normal PR merges, without bypassing the rule. No GitHub Actions pass is claimed.

## E2E and remaining limits

Reviewed `e2e/guest-cam-funnel-analytics.spec.ts`; it was not changed or run. Browser smoke uses real production map search, canonical beach pages, camera anchors, and image loading. Native/on-device appearance was not tested. The existing native hero lacks the provider-page controls; no native release is claimed.

Forecast generation and scoring inputs remain a follow-up. SEO/recommendation and terrain flags remain false, and shoaling factors remain null. Existing Velzyland coordinates and the held/ambiguous candidates are unchanged. Muir's provider clock remains misconfigured despite moving imagery. Provider availability can change.

## Files

Production files: `supabase/migrations/20260903200000_add_verified_catalog_gap_beaches.sql`, `lib/media/cam-embed.ts`, `app/api/image-proxy/route.ts`, `lib/utils/beach-url-utils.ts`.

Tests added/modified: `__tests__/api/beaches-sources-native-fields.test.ts`, `__tests__/lib/media/cam-embed.test.ts`, `__tests__/components/beach-detail/cams-section.test.tsx`, `__tests__/api/image-proxy.test.ts`, `__tests__/lib/utils/beach-url-utils.test.ts`, and the rollback-only local SQL verifier.

Documentation/evidence: `docs/BEACH_CATALOG_GAPS.md`, this batch's evidence directory, and the referenced `2026-09-03-webcam-expansion/full-review.{md,json,csv}`.
