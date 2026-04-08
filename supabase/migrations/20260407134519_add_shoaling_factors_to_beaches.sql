BEGIN;

-- Adds a per-beach `shoaling_factors` JSONB column for empirically calibrated
-- period-keyed wave-height shoaling transforms.
--
-- Why this exists:
-- Quiver displays raw CDIP buoy significant wave height (Hs) at beaches with a
-- `cdip_station` override. At shallow breaks this produces displayed heights that
-- are far below the actual face height surfers see (a 1.7 ft buoy reading can
-- correspond to 3-5 ft surf on long-period groundswells at Blacks). The existing
-- transformer's period cap (1.2x) is correct for NOAA forecast inputs but far
-- too low for raw CDIP Hs, where empirically measured face/Hs ratios range
-- 0.2-2.4x across the 12 CDIP stations covered by Quiver beaches.
--
-- Calibration methodology:
-- For every calibrated beach, join 1 year of hourly Surfline LOTUS face heights
-- to the assigned CDIP station's significant-height + peak-period records, group
-- by buoy peak period (<8s, 8-12s, 12-16s, >=16s buckets), compute the median
-- factor = surfline_face_ft / cdip_hs_ft per bucket. The resulting 4-entry
-- lookup replaces the generic base*period*direction transform when present.
-- Full pipeline code at seaside/scripts/shoaling_calibration_pipeline/.
-- Reference artifacts at /Users/stevenchandler/Desktop/dev/.shoaling_research/.
--
-- Two physical regimes emerge empirically:
--   - Nearshore buoys (CDIP 201 Scripps Nearshore) -> factors > 1 (shoaling
--     amplification dominates). Blacks: [1.6, 1.7, 2.1, 2.4].
--   - Distant buoys (CDIP 179 Harvest Platform, ~40 mi offshore Point
--     Conception) -> factors < 1 (path loss + sheltering dominate shoaling).
--     Rincon: [0.24, 0.22, 0.29, 0.36].
-- Both are valid display multipliers. The forecast transformer gates the
-- short-circuit on source == 'cdip_sig' so model-derived heights never get
-- multiplied by a CDIP-denominated factor (see
-- lib/utils/wave-height-transformer.ts).
--
-- Calibration coverage:
--   99 of 117 CDIP-override beaches are calibrated by this migration.
--   Remaining beaches stay NULL (no transform change, legacy pipeline applies).
--   Beaches on CDIP station 111 are excluded because that station does not
--   exist in CDIP's wave_agg dataset; see separate follow-up to remap them.

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS shoaling_factors JSONB NULL;

COMMENT ON COLUMN public.beaches.shoaling_factors IS
'Optional empirically calibrated period-keyed shoaling factor lookup.
Shape: {version: 1, type: "period_lookup", buckets: [{tp_min_s, tp_max_s, factor}], calibration: {...}}.
When set AND the upstream input source is CDIP significant height, the
wave-height transformer bypasses its generic base*period*direction pipeline
and multiplies raw Hs by the matching bucket factor directly. See migration
20260407134519 for the research methodology.';


-- 204s (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.90},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.02},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.10},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.12}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for 204s"
  }
}'::jsonb
WHERE id = '047e61b4-b4a8-4042-a290-f2189b5a70ca';

-- Agate Street (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.63},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.68},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.78},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.86}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Agate Street"
  }
}'::jsonb
WHERE id = '0f0dcd5a-be9d-4c0d-a7ba-d6f932f9b769';

-- Alfonsos (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.92},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.93},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.18},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.53}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Alfonsos"
  }
}'::jsonb
WHERE id = '6e083f22-4c11-46c5-9110-ac7500f6cba5';

-- Andrew Molera State Beach (river mouth) (CDIP 157, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.66},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.67},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.91},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.06}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 157",
    "notes": "Per-beach calibration for Andrew Molera State Beach (river mouth)"
  }
}'::jsonb
WHERE id = '3b2d3a98-7c91-4d8a-81a4-6e0d5d2b9a04';

-- Avalanche (CDIP 220, n=8686)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.96},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.00},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.04},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.00}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8686,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 220",
    "notes": "Per-beach calibration for Avalanche"
  }
}'::jsonb
WHERE id = '63af8c07-1aed-44bd-b03b-9b20abdff56c';

-- Beacons (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.96},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.01},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.09},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.02}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Beacons"
  }
}'::jsonb
WHERE id = '22536002-c7d2-48ab-a676-9b489fd79874';

-- Big Jetty (CDIP 220, n=8686)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.96},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.00},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.04},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.00}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8686,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 220",
    "notes": "Per-beach calibration for Big Jetty"
  }
}'::jsonb
WHERE id = 'ec73bb77-4be5-4126-8986-348929c1e7e9';

-- Big Rock (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.23},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.39},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.83},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.01}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Big Rock"
  }
}'::jsonb
WHERE id = 'dbbafa09-3143-4f73-82e8-90a69a4121f5';

-- Birdrock (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.23},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.39},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.83},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.01}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Birdrock"
  }
}'::jsonb
WHERE id = 'ca2b1d6f-2428-4273-ab02-7555eeec4323';

-- Blacks Beach (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.57},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.70},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 2.13},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.40}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Blacks Beach"
  }
}'::jsonb
WHERE id = '01330afc-00d3-461b-88f3-b173774766f4';

-- Brooks Street (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.63},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.68},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.78},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.86}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Brooks Street"
  }
}'::jsonb
WHERE id = '1f8660f2-891d-4f79-8f16-cad8ebd59c79';

-- C Street / Ventura Point (CDIP 179, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.56},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.48},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.52},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.77}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 179",
    "notes": "Per-beach calibration for C Street / Ventura Point"
  }
}'::jsonb
WHERE id = '486dc095-4b21-4edb-838c-97f68b40d1df';

-- Cardiff Reef (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.10},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.19},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.29},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.17}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Cardiff Reef"
  }
}'::jsonb
WHERE id = '80efa1c0-37a2-4879-819b-647ae3c3d749';

-- Carlsbad State Beach (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.25},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.40},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.38},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.34}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Carlsbad State Beach"
  }
}'::jsonb
WHERE id = 'c0977bcd-5475-4745-b4b8-0ca1e16a7faf';

-- Church (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.08},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.18},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.45},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.56}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Church"
  }
}'::jsonb
WHERE id = 'a0332432-4877-48c5-855d-b30fd097ba38';

-- Coronado North Jetty (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.73},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.79},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.95},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.33}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Coronado North Jetty"
  }
}'::jsonb
WHERE id = 'b29821f9-c91a-486f-981b-7085c6d86b68';

-- Cottons (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.07},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.22},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.44},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.55}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Cottons"
  }
}'::jsonb
WHERE id = '2c1d7948-72c1-4787-93e8-f33ac9567db0';

-- County Line (CDIP 217, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.74},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.89},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.64},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.74}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 217",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for County Line"
  }
}'::jsonb
WHERE id = '71bdbe5a-67f6-429c-b1e4-80ec390ec4a3';

-- Crystal Pier (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.31},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.44},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.83},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.03}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Crystal Pier"
  }
}'::jsonb
WHERE id = 'cc7c0837-257c-42c3-9d98-634911e73a6a';

-- D Street (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.03},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.08},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.20},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.14}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for D Street"
  }
}'::jsonb
WHERE id = '902a215b-2a3d-40af-9391-16b0afed7dee';

-- Del Mar (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.14},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.17},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.28},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.22}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Del Mar"
  }
}'::jsonb
WHERE id = '5e72b79d-a12d-4cd3-8da4-b7b92069efbf';

-- Del Mar Rivermouth (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.08},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.12},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.23},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.16}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Del Mar Rivermouth"
  }
}'::jsonb
WHERE id = '7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c';

-- Doheny Beach (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.49},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.58},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.71},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.73}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Doheny Beach"
  }
}'::jsonb
WHERE id = 'a57ae4c8-7a27-4d3f-91d5-6229350fb888';

-- Doheny State Beach (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.49},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.58},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.71},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.73}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Doheny State Beach"
  }
}'::jsonb
WHERE id = 'a4575b12-2bc3-44d4-ba53-4415707f3851';

-- El Morro Point (K37.5) (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.01},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.08},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.17},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.24}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for El Morro Point (K37.5)"
  }
}'::jsonb
WHERE id = '6cbb1b4f-d25e-40a3-a78a-b138ebdf9e96';

-- El Porto (Manhattan) (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.68},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.69},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.66},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.68}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for El Porto (Manhattan)"
  }
}'::jsonb
WHERE id = '52879e4f-fc7f-4c02-a5e3-ea40b992ea80';

-- El Segundo Beach Jetty (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.68},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.69},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.66},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.68}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for El Segundo Beach Jetty"
  }
}'::jsonb
WHERE id = 'be03bc6f-878a-4806-bff2-9cf870a9f241';

-- Emma Wood (CDIP 179, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.40},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.34},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.36},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.55}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 179",
    "notes": "Per-beach calibration for Emma Wood"
  }
}'::jsonb
WHERE id = '21eae8b9-387c-438c-b144-55796bab5caa';

-- Forster St. Oceanside (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.94},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.03},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.25},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.42}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Forster St. Oceanside"
  }
}'::jsonb
WHERE id = 'e5fee219-672c-4113-a0bb-a86a5d97700f';

-- George's (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.17},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.12},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.14},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.03}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for George''s"
  }
}'::jsonb
WHERE id = '7dca6429-25ee-4161-a2c2-800555ed8a6a';

-- Grandview Beach (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.95},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.02},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.10},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.03}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Grandview Beach"
  }
}'::jsonb
WHERE id = 'f29ddb0a-6d46-4589-a4a4-da406ddd3d5c';

-- Hermosa Pier (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.51},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.52},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.51},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.51}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Hermosa Pier"
  }
}'::jsonb
WHERE id = '37ffa92a-d811-4791-afbb-b90a86dcdf49';

-- Horseshoe (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.42},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.53},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.97},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.14}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Horseshoe"
  }
}'::jsonb
WHERE id = '30e68b00-c27d-4d22-ba57-2d92156964c6';

-- Hotel Del Coronado (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.73},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.79},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.95},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.33}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Hotel Del Coronado"
  }
}'::jsonb
WHERE id = '84d3468b-c1ec-46ad-8621-d8507e5f167a';

-- Imperial Beach (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.09},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.12},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.31},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.33}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Imperial Beach"
  }
}'::jsonb
WHERE id = '9e94759c-d531-4e5c-9bc2-d022acea9dcd';

-- Imperial Beach Pier (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.09},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.12},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.31},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.33}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Imperial Beach Pier"
  }
}'::jsonb
WHERE id = 'd9f93c82-7f4b-440a-865a-55cdbb821f74';

-- Jalama Beach (CDIP 71, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.48},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.49},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.59},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.63}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 71",
    "notes": "Per-beach calibration for Jalama Beach"
  }
}'::jsonb
WHERE id = '1ec3682e-d993-4c60-a650-f630e1ea3b06';

-- K-38 (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.92},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.93},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.18},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.53}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for K-38"
  }
}'::jsonb
WHERE id = '77d286c5-87e9-4678-82d3-81d0125285fa';

-- K-40 (Puerto Nuevo) (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.92},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.93},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.18},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.53}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for K-40 (Puerto Nuevo)"
  }
}'::jsonb
WHERE id = 'de6575ce-4ee1-4c6b-a2cf-7009ba171c3b';

-- La Jolla Shores (CDIP 201, n=3840)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.18},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.19},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.42},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.46}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 3840,
    "date_range": "2025-04-07 to 2025-09-14",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for La Jolla Shores"
  }
}'::jsonb
WHERE id = 'd291411d-d331-4bf1-ad1a-302da3c69de0';

-- Las Gaviotas (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.01},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.08},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.17},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.24}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Las Gaviotas"
  }
}'::jsonb
WHERE id = '965196e2-81c3-4c1a-8c2f-e5c9c0f8e3fd';

-- Lower Trestles (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.07},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.22},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.50},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.62}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Lower Trestles"
  }
}'::jsonb
WHERE id = '193a3f9a-66d0-4362-bf55-d25bb831dae4';

-- Malibu First Point (Surfrider) (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.72},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.60},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.71}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Malibu First Point (Surfrider)"
  }
}'::jsonb
WHERE id = '9841bdd0-e70f-4c10-bc54-135575006298';

-- Manhattan Beach Pier (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.66},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.65},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.60},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.65}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Manhattan Beach Pier"
  }
}'::jsonb
WHERE id = '7a093b7e-2230-4bf1-abeb-9b31faa794d5';

-- Marine Street Beach (CDIP 201, n=8756)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.48},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.59},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 2.03},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.26}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8756,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Marine Street Beach"
  }
}'::jsonb
WHERE id = '9b292a48-7a88-4d79-926f-16601515d7a0';

-- Middles (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.99},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.09},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.32},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.43}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Middles"
  }
}'::jsonb
WHERE id = 'b5bcd27f-3399-4a0a-b5d5-da8147e43b9a';

-- Mission Beach (CDIP 220, n=8686)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.85},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.90},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.93},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.92}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8686,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 220",
    "notes": "Per-beach calibration for Mission Beach"
  }
}'::jsonb
WHERE id = 'c02b4ede-69d9-440e-b8de-22ea4bde10ef';

-- Mission Beach (Central) (CDIP 220, n=8686)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.85},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.90},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.93},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.92}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8686,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 220",
    "notes": "Per-beach calibration for Mission Beach (Central)"
  }
}'::jsonb
WHERE id = 'cdcf733b-a704-45ef-affc-d8152ffde1e4';

-- Mondos Beach (CDIP 179, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.26},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.22},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.24},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.36}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 179",
    "notes": "Per-beach calibration for Mondos Beach"
  }
}'::jsonb
WHERE id = '9a64d63a-0c0c-40b7-bc97-d3d931204bba';

-- Moonlight State Beach (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.98},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.03},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.12},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.07}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Moonlight State Beach"
  }
}'::jsonb
WHERE id = 'deea2ae1-849d-47a1-9c27-b7bd505dbc07';

-- New Break (Nubes) (CDIP 191, n=8682)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.78},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.80},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.79}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8682,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 191",
    "notes": "Per-beach calibration for New Break (Nubes)"
  }
}'::jsonb
WHERE id = 'd920e1b9-9e23-4ba8-9f8e-776571435f6f';

-- Ocean Beach (CDIP 220, n=8686)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.96},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.00},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.04},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.00}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8686,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 220",
    "notes": "Per-beach calibration for Ocean Beach"
  }
}'::jsonb
WHERE id = '15c7337e-5258-4339-9dc3-c435c666926b';

-- Ocean Beach Pier (CDIP 220, n=8686)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.96},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.00},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.04},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.00}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8686,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 220",
    "notes": "Per-beach calibration for Ocean Beach Pier"
  }
}'::jsonb
WHERE id = '65d177de-e75a-4ad8-aa0d-48a67c0851b0';

-- Ocean Beach SF – Sloat (CDIP 71, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.60},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.74},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.93},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.85}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 71",
    "notes": "Per-beach calibration for Ocean Beach SF – Sloat"
  }
}'::jsonb
WHERE id = 'd9524c9d-8315-4686-9d35-24ceb6db2a82';

-- Oceanside Harbor (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.23},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.36},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.37},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.34}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Oceanside Harbor"
  }
}'::jsonb
WHERE id = 'a30b9870-aace-48ef-a3e6-e275ad9c28c1';

-- Oceanside Pier (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.99},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.10},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.18},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.14}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Oceanside Pier"
  }
}'::jsonb
WHERE id = 'cceecad1-7668-4ad8-88ff-ade893c605cd';

-- Old Man's (SanO) (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.08},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.18},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.45},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.56}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Old Man''s (SanO)"
  }
}'::jsonb
WHERE id = 'a956de46-b204-448e-a541-db427be7e85f';

-- Osprey Point (CDIP 191, n=8682)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.78},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.80},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.79}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8682,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 191",
    "notes": "Per-beach calibration for Osprey Point"
  }
}'::jsonb
WHERE id = 'c3b42f85-e650-445f-89b1-1debe661652e';

-- Pacific Beach (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.31},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.44},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.83},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.03}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Pacific Beach"
  }
}'::jsonb
WHERE id = '65809772-20bc-4009-b9b2-89c8ef3c4127';

-- PB Point (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.22},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.36},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.74},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.86}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for PB Point"
  }
}'::jsonb
WHERE id = '13ef0aa1-c857-4d82-a40d-a83612110943';

-- Pipes (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.79},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.90},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.99},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.97}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Pipes"
  }
}'::jsonb
WHERE id = '2380adaa-a07c-44f4-9444-656ef51fa998';

-- Poche Beach (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.91},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.04},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.12},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.14}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Poche Beach"
  }
}'::jsonb
WHERE id = 'b9c4a949-4562-47db-ae7d-b2131e20d7a7';

-- Ponto (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.09},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.13},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.33},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.24}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Ponto"
  }
}'::jsonb
WHERE id = 'badd7986-4609-421a-ab3d-81fcd8409a5b';

-- Redondo Breakwall (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.48},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.48},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.47},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.48}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Redondo Breakwall"
  }
}'::jsonb
WHERE id = '13a91b0d-3e80-4140-b11e-2c1b12e00687';

-- Renes (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.01},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.08},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.17},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.24}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Renes"
  }
}'::jsonb
WHERE id = '294712f3-3c06-44bd-9bc6-17275675fe9a';

-- Rincon (CDIP 179, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.24},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.22},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.28},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.36}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 179",
    "notes": "Per-beach calibration for Rincon"
  }
}'::jsonb
WHERE id = 'bec2d595-ed20-4c2b-93c7-4b880406332f';

-- Rosarito Beach (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.01},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.04},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.26},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.51}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Rosarito Beach"
  }
}'::jsonb
WHERE id = 'f0ddfc6a-7392-40c5-9211-836c05e449f1';

-- Salt Creek (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.05},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.18},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.25},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.29}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Salt Creek"
  }
}'::jsonb
WHERE id = '73bb4a48-3d53-42ba-bbd0-d89a7cf95711';

-- San Clemente Pier, Northside (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.95},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.10},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.19},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.22}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for San Clemente Pier, Northside"
  }
}'::jsonb
WHERE id = 'e99552bf-45bd-46a8-a716-4cdfff2061f2';

-- San Clemente State Beach (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.81},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.92},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.00},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.04}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for San Clemente State Beach"
  }
}'::jsonb
WHERE id = '02dfc45e-f7f8-4fdc-8008-6ce14e2839f5';

-- San Elijo State Beach (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.84},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.85},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.90},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.87}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for San Elijo State Beach"
  }
}'::jsonb
WHERE id = '09affcd2-1eca-4f7d-852e-413972ea4154';

-- San Onofre State Beach (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.81},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.94},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.03},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.04}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for San Onofre State Beach"
  }
}'::jsonb
WHERE id = '8a47b323-0874-45d9-aa17-ced468f70f2d';

-- Scripps (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.25},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.30},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.52},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.61}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Scripps"
  }
}'::jsonb
WHERE id = '4b0cf129-c706-4e24-8210-2219defc5ea7';

-- Seaside Reef (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.15},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.23},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.34},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.23}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Seaside Reef"
  }
}'::jsonb
WHERE id = '5a34b2ac-01b9-4b83-8c05-c47b1b55d923';

-- Shipwrecks (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.73},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.79},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.95},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.33}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Shipwrecks"
  }
}'::jsonb
WHERE id = '5e8d07ff-786c-4b7e-ab19-53d2b3774e23';

-- Silver Strand State Beach (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.73},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.79},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.95},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.33}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Silver Strand State Beach"
  }
}'::jsonb
WHERE id = '94f1010b-c71f-4025-bda1-c26ed9467c85';

-- Solana Beach (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.92},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.93},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.00},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.98}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Solana Beach"
  }
}'::jsonb
WHERE id = '65d3a4de-1f4b-4a1d-8ce0-b5b67288ee08';

-- Solimar Reef (CDIP 179, n=8754)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.33},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.27},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.24},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.43}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 179",
    "notes": "Per-beach calibration for Solimar Reef"
  }
}'::jsonb
WHERE id = '411b3825-c047-4628-997d-08712117ad56';

-- Strands (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.02},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.13},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.20},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.24}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Strands"
  }
}'::jsonb
WHERE id = '80e4aada-7d4a-4df1-b11b-841a97603979';

-- Sunset Cliffs North (Garbage) (CDIP 191, n=8682)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.78},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.80},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.79}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8682,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 191",
    "notes": "Per-beach calibration for Sunset Cliffs North (Garbage)"
  }
}'::jsonb
WHERE id = 'd305ba0d-47cd-4494-b790-f924dac7bf1f';

-- Sunset Cliffs – Garbage (CDIP 191, n=8682)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.78},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.80},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.79}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8682,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 191",
    "notes": "Per-beach calibration for Sunset Cliffs – Garbage"
  }
}'::jsonb
WHERE id = 'b939f928-2653-494a-831d-6394cb548190';

-- Sunset Cliffs – Luscombs (CDIP 191, n=8682)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.78},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.80},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.79}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8682,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 191",
    "notes": "Per-beach calibration for Sunset Cliffs – Luscombs"
  }
}'::jsonb
WHERE id = '34af0af5-b61c-4b86-9d9d-bf328f538a12';

-- Swami's (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.01},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.06},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.21},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.12}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Swami''s"
  }
}'::jsonb
WHERE id = 'b24c6fa9-9f82-4a1e-afcd-0d1fb0ce69d0';

-- T-Street (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.96},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.10},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.20},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.22}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for T-Street"
  }
}'::jsonb
WHERE id = 'dfeecc16-6395-4600-89e6-baf8456e3d69';

-- Tamarack (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.86},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.98},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.13}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Tamarack"
  }
}'::jsonb
WHERE id = 'b1b49703-2376-407d-b1fb-9df06130ac1d';

-- Teresa's (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.92},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.93},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.18},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.53}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Teresa''s"
  }
}'::jsonb
WHERE id = 'ec7b1ab4-5f43-4af3-b45f-325d29b8d5e6';

-- Terramar Point (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.79},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.82},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.89},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.82}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Terramar Point"
  }
}'::jsonb
WHERE id = '1fe4bf73-c425-48a5-899d-a7e8ee2d67e3';

-- Thalia Street (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.63},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.66},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.73},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.79}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Thalia Street"
  }
}'::jsonb
WHERE id = '2a2195ef-27d1-4b35-a006-b7177b34dad2';

-- The Rock, Oceanside (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.16},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.27},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.38},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.33}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for The Rock, Oceanside"
  }
}'::jsonb
WHERE id = '762fcfa2-8fd8-40ea-8955-b9cc6945a422';

-- Tijuana Sloughs (CDIP 155, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.86},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.85},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.93},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.98}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 155",
    "notes": "Per-beach calibration for Tijuana Sloughs"
  }
}'::jsonb
WHERE id = '929caa5e-c79f-4b60-8fe0-bec75c2df2d6';

-- Topanga (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.57},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.58},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.49},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.57}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Topanga"
  }
}'::jsonb
WHERE id = '101bd2f7-e1dc-4940-b4e3-3a820d5940dd';

-- Torrey Pines State Beach (CDIP 153, n=8752)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.41},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.48},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.66},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.56}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8752,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 153",
    "notes": "Per-beach calibration for Torrey Pines State Beach"
  }
}'::jsonb
WHERE id = '4bdbff9e-2c1f-4918-84a6-aed42fb6e42c';

-- Tourmaline Beach (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.03},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.13},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.45},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.62}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Tourmaline Beach"
  }
}'::jsonb
WHERE id = '17628f35-9ed1-4257-aad6-070c4bd73bb8';

-- Tourmaline Surf Park (CDIP 201, n=8757)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.03},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.13},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.45},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.62}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Tourmaline Surf Park"
  }
}'::jsonb
WHERE id = '91df193c-f2c8-4e6c-984e-b859bd741061';

-- Trails (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.88},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.03},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.15},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.16}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Trails"
  }
}'::jsonb
WHERE id = '2f3e2136-b094-49d7-b90f-948160cbb854';

-- Upper Trestles (CDIP 45, n=8753)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.02},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.19},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.37},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.46}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8753,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 45",
    "notes": "Per-beach calibration for Upper Trestles"
  }
}'::jsonb
WHERE id = 'f924aa96-395f-41e0-b966-502b37def7ac';

-- Venice Breakwater (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.63},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.64},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.58},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.63}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Venice Breakwater"
  }
}'::jsonb
WHERE id = '96fd7011-b894-4776-a68d-ff16fb1985d8';

-- Windansea (CDIP 201, n=8756)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.48},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.59},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 2.03},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 2.26}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8756,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Windansea"
  }
}'::jsonb
WHERE id = '6f42d47d-215b-47cb-ac14-b83bf8c2a797';

-- Zuma Beach (CDIP 198, n=4869)
UPDATE public.beaches
SET shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.71},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.72},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.60},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.71}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Zuma Beach"
  }
}'::jsonb
WHERE id = '836f218a-9471-46c9-b201-24da1dfe0f3a';

-- Calibrated 99/117 CDIP-override beaches via Phase 1.4 batch.

COMMIT;
