BEGIN;

-- Migration: Calibrate 18 former station-111 beaches against CDIP 215
--
-- Context:
-- The 18 HB/Newport/Laguna beaches were originally assigned cdip_station='111'
-- during the initial seed. CDIP station 111 does not exist in the wave_agg
-- ERDDAP dataset (verified empty response), so these beaches were silently
-- excluded from the Phase 1.4 batch calibration that shipped yesterday (see
-- 20260407134519_add_shoaling_factors_to_beaches.sql).
--
-- This migration:
--   1. Remaps cdip_station '111' -> '215' (San Pedro South, 33.700N, -118.201W).
--      Distances range 14.4 km (HB Cliffs) to 41.7 km (Rockpile). Station 215
--      has ~17,417 samples/12 mo and sits inside the same Catalina/Palos Verdes
--      wave shadow as these beaches.
--   2. Seeds shoaling_factors with the empirically calibrated per-beach period
--      lookup tables from the Phase 1.4 pipeline subset run (same methodology
--      as the 99 beaches already in production).
--
-- All 18 UPDATEs happen atomically inside a single BEGIN/COMMIT. If any one
-- fails, none are applied. No schema changes -- the shoaling_factors JSONB
-- column was already added by the prior migration.
--
-- Rollback:
--   UPDATE public.beaches SET cdip_station='111', shoaling_factors=NULL
--   WHERE id IN (
--     '1207215c-f61d-4fe1-bbaa-a3db7d4e7d53',
--     'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f',
--     '12e0096c-9826-443f-9131-53aaa646f789',
--     '0e557ec4-355a-4176-8352-6ea50e379c13',
--     'd60dd5c8-d147-4042-a531-c2ec55c620af',
--     '071db1df-b5ee-4af6-a022-ea8a09667cbe',
--     '72726bcb-bed0-4b76-8336-f90d7fb57159',
--     '025cfc18-8357-49d6-994e-e0abf0a16f6d',
--     'b57b32b9-0057-46f6-9fa9-cd35d5bd5319',
--     '502bd50f-21c8-4cdc-ae96-1d53fcbc34de',
--     '53cc78d5-a759-4153-8a2e-b13cf1bb6b4e',
--     'bbe7f4eb-9807-4e65-8e69-e2cee28d6b24',
--     '11662c67-a1bb-43a0-b0f7-0e4071b1c3f2',
--     'e64001e6-e2bd-4596-8f24-d8064e7f5186',
--     '66ef3c08-a8a2-4cf1-9361-273489bac45b',
--     'a0e764f1-d0bb-4341-b397-7b21823cb93b',
--     '79e8be90-df33-4b80-9d92-e79e26a67a69',
--     'c2c7cc01-4920-4fd9-941c-68df6b46ced0'
--   );

-- 52nd Street (CDIP 215, n=8712, 26.4 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.02},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.12},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.06},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.03}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '1207215c-f61d-4fe1-bbaa-a3db7d4e7d53';

-- 54th Street (CDIP 215, n=8712, 26.7 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.89},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.01},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.98},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.87}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = 'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f';

-- Corona del Mar (CDIP 215, n=8712, 32.6 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.81},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.86},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.94},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.02}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '12e0096c-9826-443f-9131-53aaa646f789';

-- Crystal Cove (CDIP 215, n=8712, 37.6 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.75},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.77},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.79},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.83}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '0e557ec4-355a-4176-8352-6ea50e379c13';

-- HB Cliffs (CDIP 215, n=8712, 14.4 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.94},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.0},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.96},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.96}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = 'd60dd5c8-d147-4042-a531-c2ec55c620af';

-- Huntington Beach Pier (CDIP 215, n=8705, 19.0 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.24},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.47},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.45},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.4}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8705,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '071db1df-b5ee-4af6-a022-ea8a09667cbe';

-- Huntington Beach Pier Northside (CDIP 215, n=8712, 19.0 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.24},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.47},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.45},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.4}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '72726bcb-bed0-4b76-8336-f90d7fb57159';

-- Huntington Beach Pier Southside (CDIP 215, n=8712, 19.1 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.37},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.64},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.65},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.61}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '025cfc18-8357-49d6-994e-e0abf0a16f6d';

-- Huntington St. (CDIP 215, n=8712, 18.8 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.58},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.89},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.9},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.85}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = 'b57b32b9-0057-46f6-9fa9-cd35d5bd5319';

-- Huntington State Beach (CDIP 215, n=8712, 22.0 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.28},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.47},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.47},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.49}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '502bd50f-21c8-4cdc-ae96-1d53fcbc34de';

-- Newport 56th St (CDIP 215, n=8712, 26.9 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.89},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.01},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.98},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.87}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '53cc78d5-a759-4153-8a2e-b13cf1bb6b4e';

-- Newport Lower Jetties (CDIP 215, n=8712, 30.1 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.02},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.12},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.06},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.03}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = 'bbe7f4eb-9807-4e65-8e69-e2cee28d6b24';

-- Newport Point (CDIP 215, n=8712, 30.2 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.89},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.01},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.98},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.87}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '11662c67-a1bb-43a0-b0f7-0e4071b1c3f2';

-- Newport Upper Jetties (CDIP 215, n=8712, 27.1 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.13},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.25},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.29},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.29}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = 'e64001e6-e2bd-4596-8f24-d8064e7f5186';

-- North HB Streets (CDIP 215, n=8712, 17.7 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.23},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.48},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.4},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.35}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '66ef3c08-a8a2-4cf1-9361-273489bac45b';

-- River Jetties (CDIP 215, n=8712, 24.3 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 1.14},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.32},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.34},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.36}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = 'a0e764f1-d0bb-4341-b397-7b21823cb93b';

-- Rockpile (CDIP 215, n=8712, 41.7 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.73},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 0.79},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 0.82},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 0.86}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = '79e8be90-df33-4b80-9d92-e79e26a67a69';

-- The Wedge (CDIP 215, n=8712, 32.2 km from buoy)
UPDATE public.beaches
SET
  cdip_station = '215',
  shoaling_factors = '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {"tp_min_s": 0, "tp_max_s": 8, "factor": 0.99},
    {"tp_min_s": 8, "tp_max_s": 12, "factor": 1.2},
    {"tp_min_s": 12, "tp_max_s": 16, "factor": 1.49},
    {"tp_min_s": 16, "tp_max_s": 999, "factor": 1.65}
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Phase 1.4 subset recalibration: former cdip_station=111 remapped to CDIP 215"
  }
}'::jsonb
WHERE id = 'c2c7cc01-4920-4fd9-941c-68df6b46ced0';

COMMIT;
