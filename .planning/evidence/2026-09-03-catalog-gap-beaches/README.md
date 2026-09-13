# Catalog gap beach additions — 2026-09-03

Released **28 new searchable beach records, 12 verified camera links and 5 licensed photographs** to production. [Release receipt, exact commands, verification and follow-up fixes](release-receipt.md). These are catalog entries, with SEO/recommendation and terrain enablement off until scoring inputs and live forecast behavior are reviewed. The lack of empirical shoaling calibration alone is not a blocker; no synthetic calibration was written.

## Released rows

| Beach | State | Camera | Licensed photo |
|---|---|---|
| Kamakahonu Beach | HI | None verified | Existing fallback |
| Turtle Bay West | HI | None verified | Existing fallback |
| Lawai Beach | HI | [Provider](https://www.youtube.com/watch?v=3ATYHKN2hIg) | Existing fallback |
| Kaanapali Beach | HI | None verified | Yes |
| Pohaku Park (S-Turns) | HI | None verified | Existing fallback |
| Kaunaoa Beach | HI | [Provider](https://marriott.ozolio.com/mauna-kea-beach-hotel/) | Existing fallback |
| Napili Bay Beach | HI | [Provider](https://www.napilisunset.com/live-webcam/) | Yes |
| Kamaole Beach Park II | HI | None verified | Yes |
| Wailea Beach | HI | None verified | Existing fallback |
| Kihei Cove | HI | None verified | Existing fallback |
| Sharp Park Beach | CA | [Provider](https://www.youtube.com/watch?v=QYRIc4LcvqQ) | Existing fallback |
| Santa Cruz Main Beach | CA | None verified | Existing fallback |
| Roads End Beach | OR | None verified | Existing fallback |
| Muir Beach | CA | [Provider](https://www.sigward.com/) | Existing fallback |
| Cowell Beach | CA | None verified | Yes |
| Dillon Beach | CA | None verified | Existing fallback |
| North Salmon Creek Beach | CA | None verified | Existing fallback |
| Kalaloch Beach | WA | None verified | Existing fallback |
| Virginia Beach Oceanfront | VA | [Provider](https://vbbound.com/webcams/courtyard-virginia-beach-boardwalk-webcam/) | Existing fallback |
| Jenkinson’s Beach | NJ | [Provider](https://video.nest.com/live/JKTTcsayyN) | Existing fallback |
| TOBAY Beach | NY | [Provider](https://www.youtube.com/watch?v=Qzcvhq34p6w) | Existing fallback |
| Atlantic City Beach | NJ | [Provider](https://www.youtube.com/watch?v=vVyBOU9Huvo) | Existing fallback |
| Main Beach (East Hampton) | NY | [Provider](https://www.youtube.com/watch?v=E8fp7TDgQUk) | Existing fallback |
| Rehoboth Beach | DE | [Provider](https://www.youtube.com/watch?v=lq15dNFXISw) | Existing fallback |
| St. Augustine Beach Pier | FL | None verified | Existing fallback |
| Ocean City Beach (Maryland) | MD | [Provider](https://www.youtube.com/watch?v=zCEiot7sEWY) | Yes |
| East Beach (St. Simons Island) | GA | None verified | Existing fallback |
| Cherie Down Park Beach | FL | None verified | Existing fallback |

## Exclusions and merges

These are explicit outcomes, not unfinished imports. Restricted or ambiguous locations remain documented for follow-up.

- **Ala Moana Courts:** Exact surf-zone position or camera-to-beach mapping is not established.
- **PKs / Whalers Cove:** PKs and the Whalers Cove frontage are not proven to be one break; Lawai Beach is added separately.
- **Maui Eldorado beachfront:** Exact surf-zone position or camera-to-beach mapping is not established.
- **Hale Mahina beachfront:** Public access remains unresolved; source evidence describes pending access stairs and shoreline construction hazards.
- **Point Reyes / Drakes Estero:** HOLD: broad seashore and wilderness estuary are not one canonical surf beach. Drakes Estero is seasonally closed for harbor seal pupping; wildlife camera does not establish a surf takeoff. Do not silently substitute Drakes Beach, which is a different location.
- **Horseshoe Cove (Bodega Marine Reserve):** HOLD: reserve research areas have restricted access; Friday laboratory tours do not establish recreational access to Horseshoe Cove. Do not import a public surf row merely because its wildlife webcam is live.
- **Sag Harbor / Windmill Bay:** Sheltered Sag Harbor waterfront camera does not establish an exact public ocean surf beach. No town-centroid surrogate.
- **North Vilano / South Ponte Vedra:** North Vilano and South Ponte Vedra are distinct coastal sections. Camera identity insufficient to choose an exact park. Official North Beach Oceanfront Park beach-access listing currently states closed until further notice; South Ponte Vedra recreation area is separate. A later batch may add these separately after resolving exact source.
- **Merged research entry:** Virginia Beach at 5th Street: Same continuous broad Virginia Beach Oceanfront; do not create hotel-named duplicate or overwrite distinct First Street Jetty.
- **Merged research entry:** Ocean City hotel-camera locations: Multiple hotel/boardwalk camera viewpoints on one broad Ocean City Maryland beach; preserve actual camera identity when verified.

## Verification and remaining limits

- Current production preflight: 467 total beaches, no deleted rows or alias table. No proposed UUID/name/slug conflicts. Shared search aliases and pending migrations reviewed.
- Nearest-existing check: Turtle Bay West is 525 m from the current Velzyland pin. Independent sources distinguish the beaches; the existing Velzyland coordinate appears incorrect and is untouched. See nearest-existing.json and Hawaii evidence.
- Coordinates were checked against georeferenced satellite imagery. Where a monitoring point lay on sand or inland, the proposed nearshore adjustment and original source are retained in regional evidence.
- Terrain computation completed for 28 exact coordinate snapshots; every wind/swell array has 72 finite values in [0,1]. Ocean City Maryland showed exposure in all 72 swell bins and needs directional review. All terrain is provisional evidence only; no arrays or terrain flags are imported. No bathymetry-derived shoaling values were created.
- Open-Meteo source mappings are created; forecasts have not been generated or checked for these new IDs in production. Offshore wind, swell windows, tide scoring and suitability remain incomplete.
- All 12 selected camera links showed moving imagery in browser review. External provider pages are link-outs; YouTube uses the existing click-out renderer. No rebroadcast permission is claimed. Muir’s on-camera clock is misconfigured.
- Five photos were visually inspected and checked against original Commons metadata for location, creator and commercial-use license. Displayed attribution includes source and license URLs. Other rows use the existing fallback.
- Independent review passed after fixing exact photo-count scope and displayed attribution.
- Public access is described with restrictions, not promised unrestricted: TOBAY residency rules, paid/limited parking, pier status and Kamaole II restoration barricades are recorded.
- Native receives shared catalog/source data but its existing hero lacks provider-page link controls. Native UI and on-device appearance were not changed or verified.

## Changed files

- supabase/migrations/20260903200000_add_verified_catalog_gap_beaches.sql
- lib/media/cam-embed.ts
- __tests__/lib/media/cam-embed.test.ts
- __tests__/components/beach-detail/cams-section.test.tsx
- docs/BEACH_CATALOG_GAPS.md
- This evidence directory: regional research, coordinate imagery, media metadata, proposed rows, terrain proposal, backup/approval artifacts and local SQL verifier.

## Checks

- PASS `python3 .planning/evidence/2026-09-03-catalog-gap-beaches/verify-migration.py`: actual SQL, 28 exact rows, source/camera mappings, 5 licensed photos, repeat run with an unrelated sixth photo, preservation of existing data, and rejection of a conflicting coordinate; all test writes rolled back.
- PASS `yarn jest --runInBand __tests__/api/beaches-sources-native-fields.test.ts __tests__/lib/media/cam-embed.test.ts __tests__/components/beach-detail/cams-section.test.tsx __tests__/migrations/hawaii-kua-search-beaches.test.ts`: 75 tests in 4 suites.
- PASS `yarn typecheck`.
- PASS `npx eslint --max-warnings=0 lib/media/cam-embed.ts __tests__/lib/media/cam-embed.test.ts __tests__/api/beaches-sources-native-fields.test.ts __tests__/components/beach-detail/cams-section.test.tsx`.
- PASS `git diff --check`.
- PASS `VERCEL_ENV=preview yarn build > /tmp/catalog-gap-build.log 2>&1`: completed in 213.84 seconds.
- PASS `yarn tsx /tmp/catalog-terrain.ts`: reused exported terrain analyzer in dry-run mode with real DEM, 28 successful computations. No database writes. Input snapshot and proposed output retained here.
- E2E reviewed: e2e/guest-cam-funnel-analytics.spec.ts; not modified or run. Existing renderer changes were checked through component/API tests and provider browser playback; no local-app E2E or screenshot pass is claimed.

The approved migration is committed, applied, and tracked exactly. Production release and browser verification passed; see release-receipt.md.
