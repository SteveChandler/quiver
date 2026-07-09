BEGIN;

-- Earlier calibration data was keyed by production UUIDs, which leaves local
-- reset fixtures uncalibrated when their beach IDs differ. Keep this scoped to
-- the E2E calibration anchors and only fill rows that are still missing factors.
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
WHERE slug = 'blacks'
  AND shoaling_factors IS NULL;

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
WHERE slug = 'la-jolla-shores'
  AND shoaling_factors IS NULL;

COMMIT;
