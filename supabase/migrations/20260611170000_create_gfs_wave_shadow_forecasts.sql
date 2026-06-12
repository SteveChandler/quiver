-- GFS-Wave issue-time shadow capture for Phase 9 source evaluation.
-- Report-only: no serving, formula, enhanced_forecasts, or ml_predictions_log changes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gfs_wave_shadow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  predicted_at TIMESTAMPTZ NOT NULL,
  forecast_horizon_hours INTEGER NOT NULL
    CHECK (forecast_horizon_hours BETWEEN 0 AND 168),
  source TEXT NOT NULL DEFAULT 'open_meteo'
    CHECK (source = 'open_meteo'),
  source_model TEXT NOT NULL DEFAULT 'ncep_gfswave016',
  capture_status TEXT NOT NULL DEFAULT 'ok'
    CHECK (capture_status IN ('ok', 'all_zero_wave_height', 'missing_wave_height')),
  wave_height_m NUMERIC(6,3),
  wave_period_s NUMERIC(6,2),
  wave_direction_deg NUMERIC(6,2),
  wave_peak_period_s NUMERIC(6,2),
  swell_height_m NUMERIC(6,3),
  swell_period_s NUMERIC(6,2),
  swell_direction_deg NUMERIC(6,2),
  swell_wave_peak_period_s NUMERIC(6,2),
  wind_wave_height_m NUMERIC(6,3),
  wind_wave_period_s NUMERIC(6,2),
  wind_wave_direction_deg NUMERIC(6,2),
  wind_wave_peak_period_s NUMERIC(6,2),
  secondary_swell_height_m NUMERIC(6,3),
  secondary_swell_period_s NUMERIC(6,2),
  secondary_swell_direction_deg NUMERIC(6,2),
  tertiary_swell_height_m NUMERIC(6,3),
  tertiary_swell_period_s NUMERIC(6,2),
  tertiary_swell_direction_deg NUMERIC(6,2),
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (beach_id, predicted_at, source_model)
);

CREATE INDEX IF NOT EXISTS idx_gfs_wave_shadow_predicted_at
  ON public.gfs_wave_shadow_forecasts (predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_gfs_wave_shadow_beach_predicted_at
  ON public.gfs_wave_shadow_forecasts (beach_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_gfs_wave_shadow_status_window
  ON public.gfs_wave_shadow_forecasts (capture_status, predicted_at DESC);

ALTER TABLE public.gfs_wave_shadow_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gfs_wave_shadow_forecasts_service_role
  ON public.gfs_wave_shadow_forecasts;
CREATE POLICY gfs_wave_shadow_forecasts_service_role
  ON public.gfs_wave_shadow_forecasts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.gfs_wave_shadow_forecasts IS
  'Issue-time GFS-Wave source shadow rows for Phase 9 mixed-swell evaluation. Written by Quiver forecast-builder when GFS_WAVE_SHADOW_CAPTURE_ENABLED=true; read by Seaside diagnostics only.';

COMMENT ON COLUMN public.gfs_wave_shadow_forecasts.capture_status IS
  'ok = numeric GFS-Wave values captured; all_zero_wave_height = Open-Meteo/GFS coastal land-cell zero-mode treated as missing; missing_wave_height = no usable wave_height for the slot.';

COMMENT ON COLUMN public.gfs_wave_shadow_forecasts.source_model IS
  'Open-Meteo marine API models parameter. Phase 9 Tier 1 uses ncep_gfswave016.';

COMMIT;
