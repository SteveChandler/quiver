# Surfline spot identity and calibration audit — 2026-10-27

## Evidence and limits

Surfline's `https://services.surfline.com/kbyg/mapview?south=32.70&west=-117.40&north=33.70&east=-117.00` returned HTTP 403 with a browser User-Agent. Gate E's forecast endpoint returned HTTP 403 or 404 for all six spots. Thus no live Surfline identity or height could be independently verified in this audit. No production database read or write was made. The spot identity evidence below is the local `seaside/scripts/shoaling_calibration_pipeline/workspace/spot_ids.json`, its `beaches.json` coordinates, `agents/cartographer.py`, the Quiver catalog snapshot, and the user-supplied mapview IDs and observed heights. Surfline API access should be restored before treating these as live verified mappings.

## Regression and parity IDs

The regression's six old IDs all differ from the saved calibration mapping. The Blacks old ID belongs to Pacific Beach (about 32.797° N), whereas Blacks is about 32.883° N on Surfline and 32.887° N in Quiver. The old HB Southside ID belongs to PB Point in the saved mapping. The other four old identities were not resolvable from saved local spot records; their exact names and coordinates remain unverified. The corrected IDs below match the saved calibration mapping and Quiver beach locations; live mapview confirmation remains outstanding.

| Quiver beach | Previous regression ID | Corrected Surfline ID | Saved match |
| --- | --- | --- | --- |
| Tourmaline Beach | `…8849` | `…88c4` | Old Man's at Tourmaline, 0.59 km |
| Blacks Beach | `…8841` | `…883b` | Blacks Beach, 32.883° N |
| Lower Trestles | `…88f9` | `…888a` | Lower Trestles, canonical |
| Swami's | `…884c` | `…88b4` | Swami's, canonical |
| HB Pier Southside | `…88c2` | `…88ed` | HB Pier Southside, 0.09 km |
| The Wedge | `…88a9` | `…882b` | The Wedge, 0.42 km |

The other active comparison map was `e2e/api/surfline-parity.spec.ts`. Blacks, HB Southside, and HB Northside were already correct. Windansea previously compared against Blacks as a similar beach; it now uses Windansea `…883c` (user-supplied 32.830° N) as an exact match. The Wedge had the same wrong `…88a9` ID and now uses `…882b`. HB Pier's comparison to the nearby HB Northside spot remains explicitly labeled similar. Other `5842041f` occurrences are historical import, camera, and test data rather than active Surfline comparison maps; they were not modified.

The before and after `yarn regression:shoaling --no-e2e` runs passed gates A, B, C, D, and F; E was skipped by the flag. No fixture face height or score moved, because the spot IDs only affect advisory live comparisons. An additional default run passed all blocking gates; Gate E attempted all six requests but could not obtain Surfline heights (403 or 404), so the new comparison deltas remain unknown.

## Calibration lineage and affected buckets

The producer is `seaside/scripts/shoaling_calibration_pipeline`: `cartographer.py` chooses Surfline spot IDs, `harvester.py` downloads hourly LOTUS reports, `joiner.py` joins each report to CDIP within 30 minutes and takes the median of `Surfline surf_max_ft / CDIP Hs_ft` by **CDIP peak period**, and `migration_author.py` emits `calibration.method = surfline_lotus_vs_cdip_historical`. Thin buckets may use a same-beach, same-buoy, or generic fallback. The historical migration is `supabase/migrations/20260407134519_add_shoaling_factors_to_beaches.sql`.

The saved `spot_ids.json` and `factors_validated.json` both use Blacks `…883b`, not the regression's `…8841`. They also agree on the corrected IDs for Tourmaline, Lower Trestles, Swami's, HB Southside, and The Wedge. Ocean Beach Pier uses `…883f`, the local Ocean Beach match 0.21 km from the Quiver point. **No calibrated beach is shown to have been fitted against any of the six wrong regression IDs.** Therefore the proposed corrected bucket table for ID-affected beaches is **empty**, and there is no ID-related database UPDATE to apply. This conclusion covers the saved calibration artifacts and migration, not an independently queried production row or a fresh Surfline mapview response.

## Ocean Beach Pier under-call

At 08:00 PDT, the reported Quiver 3.6 ft at 14 s was below Surfline's 4–5 ft. `ForecastBuilder.getWaveHeight` prioritizes the CDIP significant-wave-height source and forces empty components, so `toFaceHeightFeetDecomposedWithDebug` takes the scalar calibrated path. In `wave-height-transformer.ts`, 14 s selects the `12 ≤ Tp < 16` bucket. The catalog snapshot and saved validated factor show Ocean Beach Pier's table as `0.96, 1.00, 1.04, 1.00`; the 12–16 s value is a historical median of **1.038 from 5,296 pairs**, rounded to **1.04** in the snapshot. The long-period quarantine requires `Tp ≥ 15 s` **and** factor `< 0.8`, so it cannot act on this reading. The short-period cap applies only at `Tp ≤ 8 s`. `calibratedShadowFactor` is 1 inside the configured 292.5° ±72.5° window and can reduce the result outside it; the incident direction of this observation was unavailable. No deepwater decay is applied to CDIP. The **1.04 bucket is the demonstrated low multiplier**; shadowing could contribute if that reading's direction was outside the window. The actual CDIP Hs and direction were not independently recovered, so the precise contribution cannot be apportioned further.

### Provisional Ocean Beach Pier proposal

For a reference reading with shadow factor 1, moving a 3.6 ft output to the midpoint 4.5 ft requires `1.04 × 4.5 / 3.6 = 1.30`. This single-reading estimate conflicts with the 5,296-pair historical median and is **not** an approved recalibration. Recheck the same timestamp's CDIP Hs, direction, Surfline range, and recent matched samples before considering it.

| Beach | 0–8 s | 8–12 s | 12–16 s | 16–999 s | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Ocean Beach Pier (current) | 0.96 | 1.00 | 1.04 | 1.00 | Snapshot |
| Ocean Beach Pier (proposed) | 0.96 | 1.00 | **1.30** | 1.00 | Provisional; requires validation and Steven's approval |

The exact conditional UPDATE for that **provisional** change is below. It was **not run**. It changes only Ocean Beach Pier's 12–16 s bucket when the current bucket is still 1.04; zero updated rows would signal drift requiring a new review. There is no SQL for the regression ID corrections, which are code-only.

```sql
UPDATE public.beaches
SET shoaling_factors = jsonb_set(shoaling_factors, '{buckets,2,factor}', '1.30'::jsonb)
WHERE id = '65d177de-e75a-4ad8-aa0d-48a67c0851b0'
  AND slug = 'ocean-beach-pier'
  AND shoaling_factors->>'type' = 'period_lookup'
  AND shoaling_factors->'buckets'->2->>'factor' = '1.04'
RETURNING id, slug, shoaling_factors;
```

No database update should occur without Steven's separate approval and a fresh validation of the source data.
