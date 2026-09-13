# Hawaii search catalog preparation — 2026-09-03

Status: prepared and locally tested; not applied to production. Migration SHA-256: `f32ce2c78852344fc3f78f4c69ec4a710b6fdde6ca690c37d2c359ab90efa987`.

## Scope

Ten new searchable public catalog rows:

- Hawaiʻi Island: Maniniʻōwali / Kua Bay, Makalawena, Mahaiʻula.
- Windward Oʻahu: Kualoa Regional Park Beach, Kaʻaʻawa Beach Park, Kahana Bay Beach.
- West Oʻahu: Mākua Beach, Keawaʻula / Yokohama Bay.
- Kauaʻi: Hāʻena Beach Park, Kēʻē Beach.

Mākua/Tunnels on Kauaʻi is excluded from this migration: existing `71fa4843-1235-4f11-9184-fe1c87e8fbc5` is only 263 m from the reviewed reference point and is named Hanalei (Wainiha) — Colony Resort. That identity/metadata discrepancy needs a separate correction, not an unverified duplicate or rename. Existing Mākaha, Hanalei Bay, Pine Trees, and Hāpuna rows are preserved.

## Implementation and evidence

- Migration: [SQL](/Users/stevenchandler/Desktop/dev/quiver/supabase/migrations/20260903150000_add_hawaii_kua_search_beaches.sql).
- Focused check: [test](/Users/stevenchandler/Desktop/dev/quiver/__tests__/migrations/hawaii-kua-search-beaches.test.ts).
- Each row carries field-attributed sources, publisher, and retrieval date in `editorial_sources`.
- Native session search currently uses a name ILIKE query; common ASCII spellings are included in display names where needed. No native or web runtime code changed.
- Exact UUID/name/slug preflight and 150-meter spatial conflict scan passed with zero conflicts: [production preflight](/Users/stevenchandler/Desktop/dev/quiver/.planning/evidence/2026-09-03-hawaii-beaches/production-preflight.json).
- Independent read-only review required removal of an unsafe existing-row rename, non-idempotent source append, broad schema fallback, and unsupported hazard claims. Those findings are fixed. The reviewer’s final Kahana citation correction uses the direct DOH PDF, which explicitly states west longitude; the portal omitted its minus sign.

## Validation

Passed:

```sh
yarn test:unit --runTestsByPath __tests__/migrations/hawaii-kua-search-beaches.test.ts --runInBand
npx eslint --max-warnings=0 __tests__/migrations/hawaii-kua-search-beaches.test.ts
yarn db:local
psql "$local_db_url" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260903150000_add_hawaii_kua_search_beaches.sql
```

The final SQL was applied to local Supabase twice; the first inserts 10 beaches and 10 sources, the second inserts zero duplicates. End-of-transaction assertions require 10 catalog rows, 10 Open-Meteo sources, and zero promoted rows. Local bootstrap initially lacked `recommendation_eligible`; the first SQL attempt correctly failed. The local schema prerequisite was supplied for testing, while the final migration assumes the already-applied production prerequisite and contains no broad schema fallback.

Terrain dry runs used the local database, exact new UUIDs, `--missing-only --dry-run`, and `--output-json`. All ten computations completed, with finite 72-bin wind/swell arrays in [0,1]. Kahana was rerun at its corrected DOH coordinate; [Kahana artifact](/Users/stevenchandler/Desktop/dev/quiver/.planning/evidence/2026-09-03-hawaii-beaches/kahana-terrain-proposed.json) supersedes its coordinate in [first batch artifact](/Users/stevenchandler/Desktop/dev/quiver/.planning/evidence/2026-09-03-hawaii-beaches/terrain-proposed.json). Neither artifact is imported. DEM elevations include shoreline/land contamination; numerical success does not establish a usable surf fingerprint.

No E2E tests were added, modified, or run. No post-apply web/native visual pass is claimed. Reference satellite images from Esri World Imagery were inspected for regional coastline context only; they are not licensed hero assets or exact-pin product screenshots.

## Promotion and remaining gates

All ten records remain `recommendation_eligible=false` and `seo_indexable=false`. They can support name search/session selection after application, without presenting incomplete records as ready recommendations. Exact-spot surf suitability, tide/swell/wind inputs, live access, usable forecast output, and product media behavior still require review before promotion. No camera/photo assignments or empirical shoaling factors are fabricated. Terrain factors remain unpersisted and disabled; true bathymetry was not evaluated. Current park notices must be checked before travel; no static open-status claim is made.

## Production application

Target: configured Quiver production database via `POSTGRES_URL_NON_POOLING`, owner role `postgres`.
Objects: `public.beaches` (10 inserts) and `public.beach_sources` (10 inserts). No existing rows intentionally updated or deleted. Migration version is not tracked on production as of preflight.

Not yet committed or pushed: the user’s Git instructions prohibit committing without being asked. The beach-onboarding production protocol requires the reviewed migration committed before application. After commit authorization, capture and validate a fresh backup, refresh preflight, prepare the exact plan hash, and request `APPROVE: <plan-sha>` as required by `docs/MIGRATION_SAFETY.md`. No production writes or migration-ledger writes have occurred.

Rollback: a failed SQL transaction rolls back automatically. After a successful application, do not delete beaches that may have dependent user sessions. Keep recommendations and SEO disabled; use a separately reviewed corrective migration if necessary.
