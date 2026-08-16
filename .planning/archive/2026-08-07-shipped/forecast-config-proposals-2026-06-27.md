# Forecast Config Proposals - 2026-06-27

PROPOSALS ONLY. Nothing in this document was applied. No production `UPDATE`, `INSERT`, `DELETE`, migration, deploy, push, or merge was performed in this phase.

Production access used for this phase was SELECT-only. Users are anonymized; no raw user IDs or emails are included. Custom spots are labeled `custom_NNN`; SQL selectors include only `custom_spots.id` values needed for review.

## Method

- Read Quiver production beach/custom-spot config through read-only transactions.
- Read Seaside calibration artifacts from `seaside/scripts/shoaling_calibration_pipeline/workspace`.
- Checked `factors_validated.json` and `beaches.json` from the calibration workspace: 117 validated factor rows, 117 beach rows.
- Matched requested C1 slugs against the calibration workspace: 0 direct target matches.
- Did not run the coordinator end-to-end because `migration_author` writes a migration path in the primary Quiver checkout. No local pipeline stage was run against production with write-capable outputs.

## C1 - Shoaling Factors

No direct `shoaling_factors` UPDATE is proposed for this batch. The requested beaches currently have `shoaling_factors = NULL`, and none has a direct validated row in the Seaside calibration artifact set. The production `beaches.cdip_station` field is also empty for all eight requested beaches, so the direct pipeline input lacks the configured reference station needed to compute per-beach factors without inventing a reference.

| Beach | Current value | Proposed value | Sample count | Reference source | Confidence | Users helped | SQL |
| --- | --- | --- | ---: | --- | --- | ---: | --- |
| `malibu-third-point-malibu-ca` | `shoaling_factors = NULL`, `cdip_eligible = false`, no `cdip_station` | Skip. No direct calibration artifact. | 0 | none | none | 4 | none |
| `ponce-inlet-ponce-inlet-fl` | `shoaling_factors = NULL`, `cdip_eligible = false`, no `cdip_station` | Skip. No direct calibration artifact. | 0 | none | none | 3 | none |
| `jacksonville-beach-pier-jacksonville-beach-fl` | `shoaling_factors = NULL`, `cdip_eligible = false`, no `cdip_station` | Skip. No direct calibration artifact. | 0 | none | none | 2 | none |
| `linda-mar-pacifica-ca` | `shoaling_factors = NULL`, `cdip_eligible = false`, no `cdip_station` | Skip. No direct calibration artifact. | 0 | none | none | 2 | none |
| `isle-of-palms-isle-of-palms-sc` | `shoaling_factors = NULL`, `cdip_eligible = false`, no `cdip_station` | Skip. No direct calibration artifact. | 0 | none | none | 2 | none |
| `garrapata-southern-coves-carmel-ca` | `shoaling_factors = NULL`, `cdip_eligible = true`, no `cdip_station` | Skip direct factors. Nearby station-157 artifacts exist, but not for this beach. | 0 direct | none for target | none | 1 | none |
| `steamer-lane-santa-cruz-ca` | `shoaling_factors = NULL`, `cdip_eligible = true`, no `cdip_station` | Skip direct factors. Forecast traces reference external buoy data, not a direct pipeline target artifact. | 0 direct | none for target | none | 1 | none |
| `carmel-river-state-beach-carmel-ca` | `shoaling_factors = NULL`, `cdip_eligible = true`, no `cdip_station` | Skip direct factors. Forecast traces reference external buoy data, not a direct pipeline target artifact. | 0 direct | none for target | none | 1 | none |

Review note: analog transfer could be researched separately, but it is not proposed here as C1 because the requested phase explicitly says to skip when reference data is missing and not fabricate factors.

## C2 - Inert Swell Windows

The three proposed window changes reduce halfwidths below the inert threshold while preserving existing `terrain_enabled = true` and existing `swell_access_factors`. Current access arrays are non-uniform, so the terrain access layer is active and should not be replaced by this proposal.

| Beach | Current value | Proposed value | Rationale | Confidence | Users helped |
| --- | --- | --- | --- | --- | ---: |
| `ponce-inlet-ponce-inlet-fl` | center `50`, halfwidth `140`, min `270`, max `190`, terrain on | center `55`, halfwidth `95`, min `320`, max `150`, terrain on | Matches the nearest narrower Florida analog pattern at Flagler Beach and keeps NE-E-SE Atlantic swell while removing west/land-side directions. | medium | 3 |
| `jacksonville-beach-pier-jacksonville-beach-fl` | center `45`, halfwidth `145`, min `260`, max `190`, terrain on | center `55`, halfwidth `95`, min `320`, max `150`, terrain on | Uses the same NE Florida Atlantic window as Flagler/Ponce rather than the current near-all-direction window. | medium-low | 2 |
| `steamer-lane-santa-cruz-ca` | center `153`, halfwidth `138`, min `15`, max `290`, terrain on | center `153`, halfwidth `88`, min `65`, max `241`, terrain on | Uses the local Santa Cruz/Capitola narrower point-break analog as a conservative first-pass review candidate. Validate before applying because Steamer's WNW exposure may be underrepresented. | low | 1 |

Review-ready SQL:

```sql
-- PROPOSAL ONLY - not applied.
UPDATE public.beaches
SET swell_window_center_deg = 55,
    swell_window_halfwidth_deg = 95,
    swell_window_min_deg = 320,
    swell_window_max_deg = 150,
    terrain_enabled = true
WHERE slug = 'ponce-inlet-ponce-inlet-fl';

UPDATE public.beaches
SET swell_window_center_deg = 55,
    swell_window_halfwidth_deg = 95,
    swell_window_min_deg = 320,
    swell_window_max_deg = 150,
    terrain_enabled = true
WHERE slug = 'jacksonville-beach-pier-jacksonville-beach-fl';

UPDATE public.beaches
SET swell_window_center_deg = 153,
    swell_window_halfwidth_deg = 88,
    swell_window_min_deg = 65,
    swell_window_max_deg = 241,
    terrain_enabled = true
WHERE slug = 'steamer-lane-santa-cruz-ca';
```

## C3 - Custom Spots

Current read-only sweep found 19 flagged non-mock custom spots across 10 users:

- 19 spots have missing fingerprint fields.
- 4 spots have `nearest_beach_distance_mi > 15`.
- 1 far fallback can be re-resolved from `la-pared` at 26.51 mi to `el-cocal-yabucoa-pr` at 0.08 mi.
- 3 far fallbacks still resolve to `isle-of-palms-isle-of-palms-sc` at 55.36-57.59 mi; no catalog beach within 25 mi was found, so no nearest-beach UPDATE is proposed for those rows.

The update proposal only fills null fingerprint fields using the nearest catalog beach, preserves existing user-set values via `COALESCE`, and marks modeled fingerprints as `fingerprint_confidence = 'modeled'` unless the current row is already `user_set`. Catalog break labels are normalized to the custom spot constraint set: `reef`, `point`, `beach`, `rivermouth`, or `jetty`.

| Custom spot | Current value | Proposed value | Confidence |
| --- | --- | --- | --- |
| `custom_001` | nearest `ponto`, 2.09 mi; fingerprint incomplete | Fill missing fields from `ponto`; retain current non-null break type. | medium |
| `custom_002` | nearest `san-clemente-state-beach`, 0.42 mi; fingerprint incomplete | Re-resolve to `riviera`, 0.17 mi; fill missing fields from `riviera`. | medium |
| `custom_003` | nearest `del-mar-rivermouth`, 0.47 mi; fingerprint incomplete | Fill missing fields from `del-mar-rivermouth`. | medium |
| `custom_004` | nearest `cottons`, 0.55 mi; fingerprint incomplete | Re-resolve to `riviera`, 0.33 mi; fill missing fields from `riviera`. | medium |
| `custom_005` | nearest `san-clemente-pier-northside`, 0.45 mi; fingerprint incomplete | Fill missing fields from `san-clemente-pier-northside`; retain current non-null break type. | medium |
| `custom_006` | nearest `san-clemente-pier-northside`, 0.14 mi; fingerprint incomplete | Fill missing fields from `san-clemente-pier-northside`; retain current non-null break type. | medium |
| `custom_007` | nearest `t-street`, 0.43 mi; fingerprint incomplete | Fill missing fields from `t-street`; retain current non-null break type. | medium |
| `custom_008` | nearest `hb-cliffs`, 0.67 mi; fingerprint incomplete | Fill missing fields from `hb-cliffs`. | medium |
| `custom_010` | nearest `12th-street-jetty-sea-isle-city-nj`, 2.97 mi; fingerprint incomplete | Fill missing fields from nearest catalog beach; retain current non-null break type. | low |
| `custom_011` | nearest `36th-42nd-street-sea-isle-city-nj`, 2.60 mi; fingerprint incomplete | Fill missing fields from nearest catalog beach. | low |
| `custom_012` | nearest `hb-cliffs`, 0.00 mi; fingerprint incomplete | Fill missing fields from `hb-cliffs`. | medium |
| `custom_013` | nearest `isle-of-palms-isle-of-palms-sc`, 55.32 mi; fingerprint incomplete | No UPDATE proposed. Add product disclaimer for >25 mi catalog gap. | none |
| `custom_014` | nearest `isle-of-palms-isle-of-palms-sc`, 55.34 mi; fingerprint incomplete | No UPDATE proposed. Add product disclaimer for >25 mi catalog gap. | none |
| `custom_015` | nearest `isle-of-palms-isle-of-palms-sc`, 57.55 mi; fingerprint incomplete | No UPDATE proposed. Add product disclaimer for >25 mi catalog gap. | none |
| `custom_016` | nearest `pine-trees-kohanaiki`, 0.00 mi; fingerprint incomplete | Fill missing fields from `pine-trees-kohanaiki`. | medium |
| `custom_017` | nearest `sunset-beach`, 8.10 mi; fingerprint incomplete | Fill missing fields from `sunset-beach`; keep nearest beach but treat borrowed forecast distance as a visible caveat. | low |
| `custom_018` | nearest `del-mar`, 0.38 mi; fingerprint partially user-set | Fill only missing fields from `del-mar`; preserve current `user_set` fingerprint values. | medium |
| `custom_019` | nearest `la-pared`, 26.51 mi; fingerprint incomplete | Re-resolve to `el-cocal-yabucoa-pr`, 0.08 mi; fill missing fields from `el-cocal-yabucoa-pr`. | medium |
| `custom_020` | nearest `hb-cliffs`, 0.61 mi; fingerprint incomplete | Fill missing fields from `hb-cliffs`. | medium |

Review-ready SQL:

```sql
-- PROPOSAL ONLY - not applied.
-- Rows intentionally omitted from this UPDATE: custom_013, custom_014, custom_015.
-- Those remain >55 mi from catalog coverage and need a user-facing coverage disclaimer.
WITH proposed (
  custom_label,
  id,
  nearest_beach_id,
  nearest_beach_distance_mi,
  break_type,
  facing_direction_deg,
  swell_window_min_deg,
  swell_window_max_deg,
  offshore_direction_deg,
  exposure_level
) AS (
  VALUES
    ('custom_001', 'bd4e2d64-13b9-48d7-a613-969f3f47d0ce'::uuid, 'badd7986-4609-421a-ab3d-81fcd8409a5b'::uuid, 2.09::numeric, 'beach', 270::numeric, 160::numeric, 10::numeric, 45::numeric, 'mixed'),
    ('custom_002', 'c2041cb9-5682-4a4d-ab03-edb7c10dfeb5'::uuid, '1a854513-1c65-458e-abb6-384ba4090b0b'::uuid, 0.17::numeric, 'beach', 205::numeric, 160::numeric, 250::numeric, 45::numeric, 'sheltered'),
    ('custom_003', '16afbb4a-a6ec-4b9b-a8a9-fb00e0bd5351'::uuid, '7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c'::uuid, 0.47::numeric, 'beach', 270::numeric, 135::numeric, 25::numeric, 90::numeric, 'mixed'),
    ('custom_004', '87688b87-5da9-4906-ac9f-3256346288ae'::uuid, '1a854513-1c65-458e-abb6-384ba4090b0b'::uuid, 0.33::numeric, 'beach', 205::numeric, 160::numeric, 250::numeric, 45::numeric, 'sheltered'),
    ('custom_005', '649d7735-dacf-41f1-a4f5-f37373a649c8'::uuid, 'e99552bf-45bd-46a8-a716-4cdfff2061f2'::uuid, 0.45::numeric, 'jetty', 200::numeric, 115::numeric, 285::numeric, 45::numeric, 'mixed'),
    ('custom_006', '0f32ac92-b993-4bb4-a823-1faaa779f4df'::uuid, 'e99552bf-45bd-46a8-a716-4cdfff2061f2'::uuid, 0.14::numeric, 'jetty', 200::numeric, 115::numeric, 285::numeric, 45::numeric, 'mixed'),
    ('custom_007', '462bfa40-4831-4687-bdd0-363f5aa1893f'::uuid, 'dfeecc16-6395-4600-89e6-baf8456e3d69'::uuid, 0.43::numeric, 'beach', 205::numeric, 160::numeric, 300::numeric, 45::numeric, 'mixed'),
    ('custom_008', '39ff5044-0046-4e2f-8d4b-aebb0095bd95'::uuid, 'd60dd5c8-d147-4042-a531-c2ec55c620af'::uuid, 0.67::numeric, 'beach', 230::numeric, 125::numeric, 335::numeric, 45::numeric, 'mixed'),
    ('custom_010', '527c3fcd-0b8d-495a-bbac-9e05dab27bda'::uuid, '86f9f0cd-e095-4416-af44-b2dd1cfecbe6'::uuid, 2.97::numeric, 'jetty', 110::numeric, 60::numeric, 180::numeric, 280::numeric, 'sheltered'),
    ('custom_011', '99c2772b-0b4b-45d7-907c-838684034d56'::uuid, '08c3baad-9404-43d3-ab42-d4230dfdfbf4'::uuid, 2.60::numeric, 'jetty', 100::numeric, 40::numeric, 170::numeric, 280::numeric, 'sheltered'),
    ('custom_012', '4cb3f304-6e29-4d02-96c1-020e096745ee'::uuid, 'd60dd5c8-d147-4042-a531-c2ec55c620af'::uuid, 0.00::numeric, 'beach', 230::numeric, 125::numeric, 335::numeric, 45::numeric, 'mixed'),
    ('custom_016', '36ebe5bf-a188-4ced-b35b-a6a7a1db5f45'::uuid, 'fbe805b3-b9f5-40e0-afbb-3c5a8d45f67b'::uuid, 0.00::numeric, 'reef', 255::numeric, 120::numeric, 10::numeric, 90::numeric, 'mixed'),
    ('custom_017', '3adc8677-a4e7-44b2-a8ae-ca6fb487c2b9'::uuid, 'f52f2c49-342a-4694-b04a-d66503446736'::uuid, 8.09::numeric, 'reef', 320::numeric, 185::numeric, 80::numeric, 180::numeric, 'mixed'),
    ('custom_018', 'dec1271f-ecef-465e-82b5-aba79f280fc4'::uuid, '5e72b79d-a12d-4cd3-8da4-b7b92069efbf'::uuid, 0.38::numeric, 'reef', 265::numeric, 190::numeric, 340::numeric, 90::numeric, 'mixed'),
    ('custom_019', '7e444c83-a45d-43cb-bfbb-13792d03d619'::uuid, 'bf11355b-3072-49ce-9682-783349d5a17d'::uuid, 0.08::numeric, 'beach', 135::numeric, 130::numeric, 180::numeric, 315::numeric, 'sheltered'),
    ('custom_020', '0a123a9f-a74b-42c0-ba30-644e35443141'::uuid, 'd60dd5c8-d147-4042-a531-c2ec55c620af'::uuid, 0.61::numeric, 'beach', 230::numeric, 125::numeric, 335::numeric, 45::numeric, 'mixed')
)
UPDATE public.custom_spots AS cs
SET nearest_beach_id = proposed.nearest_beach_id,
    nearest_beach_distance_mi = proposed.nearest_beach_distance_mi,
    break_type = COALESCE(cs.break_type, proposed.break_type),
    facing_direction_deg = COALESCE(cs.facing_direction_deg, proposed.facing_direction_deg),
    swell_window_min_deg = COALESCE(cs.swell_window_min_deg, proposed.swell_window_min_deg),
    swell_window_max_deg = COALESCE(cs.swell_window_max_deg, proposed.swell_window_max_deg),
    offshore_direction_deg = COALESCE(cs.offshore_direction_deg, proposed.offshore_direction_deg),
    exposure_level = COALESCE(cs.exposure_level, proposed.exposure_level),
    fingerprint_confidence = CASE
      WHEN cs.fingerprint_confidence = 'user_set' THEN cs.fingerprint_confidence
      ELSE 'modeled'
    END,
    fingerprint_updated_at = now(),
    updated_at = now()
FROM proposed
WHERE cs.id = proposed.id
  AND cs.deleted_at IS NULL;
```

## Review Gates Before Applying

- Run a review query that confirms these SQL statements affect only the listed rows.
- For C2, replay alert/scoring behavior for the three edited beach windows before any production write.
- For C3, add a UI or API disclaimer for custom spots whose nearest catalog beach remains >25 mi away.
- Do not apply any `shoaling_factors` from analog transfer until a separate offline validation scores the proposal against observed/session truth.
