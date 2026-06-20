BEGIN;

DO $$
BEGIN
  IF current_setting('app.phase1_shoaling_apply_gap_approved', true)
    IS DISTINCT FROM '2026-06-18-phase1-shoaling-apply-gap-approved'
  THEN
    RAISE EXCEPTION
      'Phase 1 shoaling apply-gap migration requires explicit human approval. Set app.phase1_shoaling_apply_gap_approved=2026-06-18-phase1-shoaling-apply-gap-approved in the same database session after approval.';
  END IF;
END $$;

-- Phase 1 top-up: apply validated shoaling factors that were present in
-- seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json
-- but absent from production as of 2026-06-18.
--
-- This intentionally does not rewrite the historical 20260407134519 migration
-- and does not overwrite any existing beaches.shoaling_factors rows.
-- Read-only preflight before generating this file found:
--   active beaches: 318
--   validated factor rows: 117
--   active prod rows with shoaling_factors: 87
--   validated active rows still missing in prod: 30

DO $$
DECLARE
  missing_objects text[];
BEGIN
  SELECT array_agg(object_name ORDER BY object_name)
  INTO missing_objects
  FROM (
    SELECT
      'ml_predictions_log.forecast_horizon_bucket' AS object_name,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ml_predictions_log'
          AND column_name = 'forecast_horizon_bucket'
      ) AS exists_now
    UNION ALL
    SELECT
      'ml_predictions_log.display_wave_source',
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ml_predictions_log'
          AND column_name = 'display_wave_source'
      )
    UNION ALL
    SELECT
      'ml_predictions_log.display_raw_input_height_m',
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ml_predictions_log'
          AND column_name = 'display_raw_input_height_m'
      )
    UNION ALL
    SELECT
      'get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)',
      to_regprocedure(
        'public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)'
      ) IS NOT NULL
  ) checks
  WHERE NOT exists_now;

  IF COALESCE(array_length(missing_objects, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'Phase 1 shoaling apply gap requires Phase 0 forecast accuracy migration first. Missing: %',
      array_to_string(missing_objects, ', ');
  END IF;
END $$;

CREATE TEMP TABLE phase1_validated_gap_factors ON COMMIT DROP AS
SELECT *
FROM (
  VALUES
    ('1207215c-f61d-4fe1-bbaa-a3db7d4e7d53'::uuid, '52nd Street', '52nd-street-newport-beach-ca', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.02
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.12
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.06
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.03
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for 52nd Street"
  }
}'::jsonb),
    ('da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid, '54th Street', '54th-street-newport-beach-ca', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.89
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.01
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.98
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.87
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for 54th Street"
  }
}'::jsonb),
    ('12e0096c-9826-443f-9131-53aaa646f789'::uuid, 'Corona del Mar', 'corona-del-mar', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.81
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.86
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.94
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.02
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Corona del Mar"
  }
}'::jsonb),
    ('71bdbe5a-67f6-429c-b1e4-80ec390ec4a3'::uuid, 'County Line', 'county-line-malibu-ca', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.74
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.89
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.64
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.74
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 217",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for County Line"
  }
}'::jsonb),
    ('0e557ec4-355a-4176-8352-6ea50e379c13'::uuid, 'Crystal Cove', 'crystal-cove', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.75
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.77
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.79
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.83
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Crystal Cove"
  }
}'::jsonb),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid, 'El Porto (Manhattan)', 'el-porto-manhattan', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.68
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.69
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.66
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.68
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for El Porto (Manhattan)"
  }
}'::jsonb),
    ('be03bc6f-878a-4806-bff2-9cf870a9f241'::uuid, 'El Segundo Beach Jetty', 'el-segundo-beach-jetty-el-segundo-ca', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.68
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.69
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.66
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.68
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for El Segundo Beach Jetty"
  }
}'::jsonb),
    ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid, 'Goldenwest', 'goldenwest', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.23
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.48
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.4
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.35
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Goldenwest"
  }
}'::jsonb),
    ('d60dd5c8-d147-4042-a531-c2ec55c620af'::uuid, 'HB Cliffs', 'hb-cliffs', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.94
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.96
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.96
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for HB Cliffs"
  }
}'::jsonb),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid, 'Hermosa Pier', 'hermosa-pier', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.51
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.52
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.51
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.51
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Hermosa Pier"
  }
}'::jsonb),
    ('071db1df-b5ee-4af6-a022-ea8a09667cbe'::uuid, 'Huntington Beach Pier', 'huntington-beach-pier', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.24
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.47
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.45
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.4
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8705,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Huntington Beach Pier"
  }
}'::jsonb),
    ('72726bcb-bed0-4b76-8336-f90d7fb57159'::uuid, 'Huntington Beach Pier Northside', 'huntington-beach-pier-northside', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.24
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.47
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.45
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.4
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Huntington Beach Pier Northside"
  }
}'::jsonb),
    ('025cfc18-8357-49d6-994e-e0abf0a16f6d'::uuid, 'Huntington Beach Pier Southside', 'huntington-beach-pier-southside', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.37
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.64
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.65
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.61
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Huntington Beach Pier Southside"
  }
}'::jsonb),
    ('b57b32b9-0057-46f6-9fa9-cd35d5bd5319'::uuid, 'Huntington St.', 'huntington-st', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.58
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.89
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.9
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.85
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Huntington St."
  }
}'::jsonb),
    ('502bd50f-21c8-4cdc-ae96-1d53fcbc34de'::uuid, 'Huntington State Beach', 'huntington-state-beach', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.28
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.47
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.47
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.49
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Huntington State Beach"
  }
}'::jsonb),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid, 'Malibu First Point (Surfrider)', 'malibu-first-point-surfrider', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.71
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.72
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.6
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.71
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Malibu First Point (Surfrider)"
  }
}'::jsonb),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid, 'Manhattan Beach Pier', 'manhattan-beach-pier-manhattan-beach-ca', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.66
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.65
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.6
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.65
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Manhattan Beach Pier"
  }
}'::jsonb),
    ('53cc78d5-a759-4153-8a2e-b13cf1bb6b4e'::uuid, 'Newport 56th St', 'newport-56th-st', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.89
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.01
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.98
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.87
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Newport 56th St"
  }
}'::jsonb),
    ('bbe7f4eb-9807-4e65-8e69-e2cee28d6b24'::uuid, 'Newport Lower Jetties', 'newport-lower-jetties', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.02
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.12
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.06
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.03
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Newport Lower Jetties"
  }
}'::jsonb),
    ('11662c67-a1bb-43a0-b0f7-0e4071b1c3f2'::uuid, 'Newport Point', 'newport-point', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.89
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.01
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.98
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.87
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Newport Point"
  }
}'::jsonb),
    ('e64001e6-e2bd-4596-8f24-d8064e7f5186'::uuid, 'Newport Upper Jetties', 'newport-upper-jetties', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.13
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.25
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.29
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.29
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Newport Upper Jetties"
  }
}'::jsonb),
    ('d9524c9d-8315-4686-9d35-24ceb6db2a82'::uuid, 'Ocean Beach SF - Sloat', 'ocean-beach-sloat-san-francisco-ca', 'San Francisco', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.6
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.74
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.93
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.85
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8754,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 71",
    "notes": "Per-beach calibration for Ocean Beach SF - Sloat"
  }
}'::jsonb),
    ('13a91b0d-3e80-4140-b11e-2c1b12e00687'::uuid, 'Redondo Breakwall', 'redondo-breakwall-redondo-beach-ca', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.48
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.48
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.47
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.48
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Redondo Breakwall"
  }
}'::jsonb),
    ('a0e764f1-d0bb-4341-b397-7b21823cb93b'::uuid, 'River Jetties', 'river-jetties', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.14
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.32
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.34
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.36
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for River Jetties"
  }
}'::jsonb),
    ('79e8be90-df33-4b80-9d92-e79e26a67a69'::uuid, 'Rockpile', 'rockpile', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.73
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.79
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.82
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.86
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for Rockpile"
  }
}'::jsonb),
    ('c2c7cc01-4920-4fd9-941c-68df6b46ced0'::uuid, 'The Wedge', 'the-wedge', 'Orange County', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.99
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.2
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.49
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.65
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8712,
    "date_range": "2025-04-08 to 2026-04-08",
    "reference_buoy": "CDIP 215",
    "notes": "Per-beach calibration for The Wedge"
  }
}'::jsonb),
    ('101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid, 'Topanga', 'topanga-malibu-ca', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.57
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.58
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.49
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.57
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Topanga"
  }
}'::jsonb),
    ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid, 'Tourmaline Beach', 'tourmaline', 'San Diego', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 1.03
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 1.13
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 1.45
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 1.62
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 8757,
    "date_range": "2025-04-07 to 2026-04-07",
    "reference_buoy": "CDIP 201",
    "notes": "Per-beach calibration for Tourmaline Beach"
  }
}'::jsonb),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid, 'Venice Breakwater', 'venice-breakwater-los-angeles-ca', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.63
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.64
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.58
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.63
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Venice Breakwater"
  }
}'::jsonb),
    ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid, 'Zuma Beach', 'zuma-beach-malibu-ca', 'Los Angeles', '{
  "version": 1,
  "type": "period_lookup",
  "buckets": [
    {
      "tp_min_s": 0,
      "tp_max_s": 8,
      "factor": 0.71
    },
    {
      "tp_min_s": 8,
      "tp_max_s": 12,
      "factor": 0.72
    },
    {
      "tp_min_s": 12,
      "tp_max_s": 16,
      "factor": 0.6
    },
    {
      "tp_min_s": 16,
      "tp_max_s": 999,
      "factor": 0.71
    }
  ],
  "calibration": {
    "method": "surfline_lotus_vs_cdip_historical",
    "samples": 4869,
    "date_range": "2025-04-07 to 2025-10-27",
    "reference_buoy": "CDIP 198",
    "notes": "Calibration sources: beach_self_median_fallback,per_beach for Zuma Beach"
  }
}'::jsonb)
)
  AS validated_gap_factors (beach_id, beach_name, beach_slug, region, shoaling_factors);

DO $$
DECLARE
  measurement record;
  rows_updated integer;
BEGIN
  WITH
allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
short_horizon_coverage AS (
  SELECT
    v.beach_id,
    COUNT(*) FILTER (
      WHERE (
        CASE
          WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
          WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
          WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
          WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
          ELSE NULL
        END
      ) IN ('0-24h', '25-72h')
        AND p.forecast_horizon_bucket IN ('0-24h', '25-72h')
        AND p.display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = p.display_wave_source
        )
        AND p.display_raw_input_height_m IS NOT NULL
        AND p.display_raw_input_height_m >= 0
    ) AS approval_0_72h_rows,
    COUNT(*) FILTER (
      WHERE (
        CASE
          WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
          WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
          WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
          WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
          ELSE NULL
        END
      ) IN ('0-24h', '25-72h')
        AND (
          p.forecast_horizon_bucket NOT IN ('0-24h', '25-72h')
          OR p.forecast_horizon_bucket IS NULL
          OR p.display_wave_source IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM allowed_wave_sources AS s
            WHERE s.source_tag = p.display_wave_source
          )
          OR p.display_raw_input_height_m IS NULL
          OR p.display_raw_input_height_m < 0
        )
    ) AS observed_0_72h_rows_without_approval_provenance
  FROM phase1_validated_gap_factors AS v
  LEFT JOIN public.ml_predictions_log AS p
    ON p.beach_id = v.beach_id
   AND p.predicted_at >= now() - interval '30 days'
   AND p.display_source = 'face-Hs-transformer-v1'
   AND p.observed_m > 0
  GROUP BY v.beach_id
),
phase1_measurement_guard AS (
  SELECT
    to_regprocedure(
      'public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)'
    ) IS NOT NULL AS phase0_metric_rpc_exists,
    COALESCE(SUM(approval_0_72h_rows), 0) AS approval_0_72h_rows,
    COALESCE(SUM(observed_0_72h_rows_without_approval_provenance), 0)
      AS observed_0_72h_rows_without_approval_provenance,
    COUNT(*) FILTER (WHERE approval_0_72h_rows >= 25)
      AS targets_with_approval_0_72h_rows_at_least_25
  FROM short_horizon_coverage
)
SELECT *
INTO measurement
FROM phase1_measurement_guard;

  IF NOT (
    measurement.phase0_metric_rpc_exists
    AND measurement.approval_0_72h_rows >= 75
    AND measurement.observed_0_72h_rows_without_approval_provenance = 0
    AND measurement.targets_with_approval_0_72h_rows_at_least_25 = 30
  ) THEN
    RAISE EXCEPTION
      'Phase 1 shoaling apply gap approval-provenance guard failed. phase0_metric_rpc_exists=%, approval_0_72h_rows=%, observed_0_72h_rows_without_approval_provenance=%, targets_with_approval_0_72h_rows_at_least_25=%',
      measurement.phase0_metric_rpc_exists,
      measurement.approval_0_72h_rows,
      measurement.observed_0_72h_rows_without_approval_provenance,
      measurement.targets_with_approval_0_72h_rows_at_least_25;
  END IF;

  UPDATE public.beaches AS b
  SET shoaling_factors = v.shoaling_factors
  FROM phase1_validated_gap_factors AS v
  WHERE b.id = v.beach_id
    AND b.deleted_at IS NULL
    AND b.shoaling_factors IS NULL;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated <> 30 THEN
    RAISE EXCEPTION
      'Phase 1 shoaling apply gap expected phase1_expected_rows_updated=30, got %',
      rows_updated;
  END IF;

  RAISE NOTICE 'phase1_expected_rows_updated=%', rows_updated;
END $$;

COMMIT;
