# East Coast precision review — September 27, 2026

Status: independently reviewed and ready for import approval. The draft exception has been removed. No commit, push, deployment or production writes.

## Blocker resolutions

71 supplied names resolve to 61 new records, nine aliases and one hazard label rather than a separate spot. This batch also includes Maine, Massachusetts, Maryland and Oregon.

| Area | Verified result | Retained limitation |
| --- | --- | --- |
| Pins/orientation | 61 satellite assessments; 11 dry-beach pins moved to water; Short Sands cove-mouth aspect corrected | Representative surf-zone pins, not surveyed takeoffs; bearings rounded to 10° |
| Terrain | 61 complete AWS Terrarium runs, 72 swell/wind factors each; 195 HTTP-200 tile requests; no missing cells or mocks | Above-water blocking, not seabed/refraction; actual resolution stored per spot |
| Swell windows | Replaced ideal-direction ±45° defaults with shoreline/landmask exposure estimates | Approximate reachability, not measured cutoffs; explicit wrap/bay exceptions at Long Sands, Short Sands and Old Orchard |
| Bathymetry | 427 NOAA samples; 59 CUDEM-covered spots and two coarse ETOPO-only Oregon spots | Sparse profiles, unknown sounding dates, no calibrated shoaling multiplier |
| NOAA | 61 seaward points return wave-bearing grids; all 6 km samples have negative model elevation | Availability is not accuracy; individual swell partitions can remain absent |
| Runtime | Enhanced forecasts consume explicitly reviewed, coordinate-matched NOAA anchors | Other beaches retain existing behavior; Open-Meteo still receives beach coordinates |
| Tide | 15 qualitative stages; six guide-supported rising preferences; 55 unsupported flood/ebb preferences cleared | All numerical MLLW-height optima remain null |
| Skill | Conservative editorial assessments for 55; named-guide/local-instruction corroboration for six | Condition-dependent guidance, not empirical safety certification |
| Heroes | Eight attributed Wikimedia photos; six disclosed regional AI assets cover the other 53 records | AI assets use `ai_generated`, not `user`; illustrations do not depict exact breaks |
| Cameras | Seven Surfline mappings staged at six locations, including both Cherry Grove sides | User-attested permission; direct/proxy playlist, segment and still HTTP checks pass. Native device and staged detail UI unverified; recheck at apply |
| Eligibility | Only Southern Duck retains its access-based SEO/recommendation gate | Unknown calibration and optional cameras do not independently block publication |

## Editorial evidence

- [Indialantic guide](https://www.surfline.com/surf-report/indialantic/5842041f4e65fad6a7708873/spot-guide): lower-water preference; conditional beginner suitability.
- [Juno](https://www.surfline.com/surf-report/juno-pier/5842041f4e65fad6a7708b78/spot-guide), [Lake Worth](https://cloudflare.surfline.com/surf-report/lake-worth-pier/5842041f4e65fad6a7708b72/spot-guide), [Jennette's local interview](https://www.surfline.com/surf-news/spot-check-jennettes-pier/28357), and [Liquid Dreams at Long Sands](https://shop.liquiddreamssurf.com/pages/long-sands-beach-surf-report) support the six incoming preferences. A shared pier guide is not independent calibration of each side.
- [Frisco](https://www.surfline.com/surf-report/frisco/5842041f4e65fad6a7708a3b/spot-guide): S–SSW preference and lower-to-middle water. Billy Mitchell uses explicitly adjacent-shoreline evidence. [Bogue Inlet](https://www.surfline.com/surf-report/bogue-inlet-pier/584204204e65fad6a770997f/spot-guide): S–SE preference and lower-to-middle water. Ideal swell directions are not used as narrow exposure limits.
- [Black Pelican](https://www.surfline.com/surf-report/black-pelican/5c8c13f0635df600015e2785/spot-guide) identifies Old Station/Laundromats and lower-to-middle tide context. [Cherry Grove](https://www.surfline.com/surf-report/cherry-grove-pier/5842041f4e65fad6a7708a67/spot-guide) supports middle-to-higher water.
- [Washout guide](https://www.surfline.com/travel/zones/southeast/surf-guide/washout/5842041f4e65fad6a7708a85): mid-to-high water, E/SE/S swell, rock/debris/current hazards; both segments use conservative skill guidance.
- [Crescent](https://www.surfline.com/surf-report/crescent-beach/5842041f4e65fad6a7708a81/spot-guide) and [Delray](https://www.surfline.com/travel/united-states/florida/palm-beach/delray-beach-surfing-and-beaches/4153132) do not justify universal high-tide preferences. [Corners Surf](https://cornerssurf.com/) corroborates instruction at Old Orchard, not all-condition beginner safety.

Original secondary claims remain in `precision_review.original_secondary_claims` for traceability, not active scoring. Some Surfline guide text was available through indexed results while direct report pages rejected retrieval; this is not represented as a playback check.

The tide station IDs in the seed are editorial references, not runtime overrides or calibrated local heights. Cached tides use the existing nearest-prediction-station resolver; live fallback retains operational mappings. Both are documented separately in the evidence. Oregon Rockaway's live fallback formerly matched New York's `rockaway`; an exact Oregon mapping now uses NOAA-verified Garibaldi 9437540 (48 hourly predictions returned). Other regional reference/fallback differences are not silently presented as agreement.

## Bathymetry boundary

The [NOAA NCEI mosaic](https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_all/ImageServer) returned the visible source dataset for every sampled coordinate. Saved evidence includes dataset name, angular resolution, datum, metadata URL and available completion timestamp. Product year/completion is not the date of each underlying sounding; some legacy metadata links are unavailable.

Samples at 0/100/250/500/1,000/2,000 m form a sparse seaward profile; the 6,000 m point checks the forecast direction. CUDEM's approximately 1/9-arc-second coverage is much finer than Oregon's 15-arc-second ETOPO fallback. Neither establishes current sandbars, safe depth, refraction or surf-height accuracy. Model elevations use their recorded datum, not present water depth or MLLW tide height. Shoaling factors stay unset; neutral decay is not described as calibrated.

## Optional cameras

The [tide/camera follow-up](east-coast-tides-cameras-2026-09-27.md) adds Bethune and Oceanana stage preferences, records variable-tide evidence for Avon/Eckner/Venice North Jetty, and stages seven direct Surfline HLS mappings at six locations. User permission is recorded separately from HTTP/FOV verification. Both Cherry Grove sides have distinct named cameras; Bogue uses Surfline, not EBM, and the tourism Ozolio camera remains unused. No new player or resolver is needed. Follow-up validation is recorded separately from the original batch below; no production write has occurred.

## Evidence and verification

Canonical data: `east-coast-beach-expansion-2026-09-26.json`. Raw terrain, bathymetry and NOAA results: `east-coast-precision-evidence-2026-09-27.json`. Per-spot Esri export URLs are saved; local reviewed imagery is in `/tmp/east-coast-imagery-20260926/` and `/tmp/reviewed-<slug>.png`.

Read-only production preflight found no migration version or UUID/global case-insensitive name/slug conflicts (including deleted rows), and resolved all eight existing alias targets. Production accepts `ai_generated`.

Disposable database `east_coast_precision_review_20260927` (localhost:54322) uses exact target-table DDL/checks/unique constraints from the September 26 production export plus eight alias fixtures. It excludes unrelated triggers, RLS/auth and foreign keys; it is not a full production clone. First apply inserted 61 beaches, 61 sources, 61 photos and nine aliases. Repeat apply left all three tables byte-equivalent by ordered row-content hashes. Negative tests proved coordinate and swell-center drift are rejected with no partial writes; the fixture was restored exactly. The final repository migration was also applied after draft-guard removal.

Independent read-only review accepted the data, SQL, runtime changes and tests with no remaining correctness blockers. It prompted stronger replay checks, circular-window assertions, more precise provenance wording and separate pin/orientation counts. The proposed geography-scoped name guard was rejected because production enforces a global case-insensitive name index. Calibration limitations above remain explicit.

Commands run in the expansion worktree, using existing checkout dependencies:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 node /Users/stevenchandler/Desktop/dev/quiver/node_modules/jest/bin/jest.js __tests__/migrations/east-coast-competitive-gap-beaches.test.ts __tests__/lib/services/noaa-wavewatch __tests__/lib/services/noaa-coops __tests__/lib/enhanced-forecast-service.unit.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/enhanced-forecast-service.test.ts --runInBand
node /Users/stevenchandler/Desktop/dev/quiver/node_modules/typescript/bin/tsc --noEmit --pretty false
NODE_OPTIONS=--max-old-space-size=8192 node /Users/stevenchandler/Desktop/dev/quiver/node_modules/eslint/bin/eslint.js --max-warnings=0 lib/services/enhanced-forecast-service.ts lib/services/noaa-wavewatch/api-client.ts lib/services/noaa-wavewatch/grid-utils.ts lib/services/noaa-wavewatch/noaa-wavewatch-service.ts lib/services/noaa-coops/constants/station-mappings.ts __tests__/lib/services/noaa-coops/noaa-coops-service.test.ts __tests__/lib/services/noaa-wavewatch/api-client.test.ts __tests__/lib/services/noaa-wavewatch/grid-utils.test.ts __tests__/lib/services/noaa-wavewatch/merge-preserves-om.test.ts __tests__/lib/enhanced-forecast-service.unit.test.ts __tests__/migrations/east-coast-competitive-gap-beaches.test.ts
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d east_coast_precision_review_20260927 -v ON_ERROR_STOP=1 -f supabase/migrations/20260926190000_add_east_coast_competitive_gap_beaches.sql
cmp /tmp/east-coast-before-repeat.txt /tmp/east-coast-final-repeat.txt
node /tmp/check-east-coast-sql-guards.cjs
git diff --check
```

212 tests/20 suites, TypeScript, scoped ESLint, SQL applications, idempotency, negative rollback guards and whitespace checks passed. Full unit suite, build, browser E2E and native UI were not run; no UI was changed and the records are not deployed. Production requires explicit commit/push authorization, a fresh backup and exact plan-hash approval under `docs/MIGRATION_SAFETY.md`.
