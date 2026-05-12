-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Per-beach display-height offset correction.
-- Plan: ~/.claude/plans/you-are-working-on-precious-papert.md
-- Critical invariants:
-- 1. Sign convention: offset_m = display_forecast_m - observed_m.
--    To apply: corrected = display_forecast_m - offset_m.
-- 2. raw_display_height_m must be captured PRE-correction by the writer.
--    Never re-derive from enhanced_forecasts.wave_height (telemetry feedback loop).
-- 3. source='display' is the positive marker that distinguishes display-layer
--    offsets from any future ML-correction-layer offsets.

CREATE TABLE IF NOT EXISTS public.beach_height_offsets (
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'display',
  offset_m NUMERIC(5,3) NOT NULL,
  sample_count INTEGER NOT NULL,
  mae_before_m NUMERIC(5,3),
  mae_after_m NUMERIC(5,3),
  window_days INTEGER NOT NULL DEFAULT 30,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (beach_id, source)
);

CREATE INDEX IF NOT EXISTS idx_beach_height_offsets_source_computed_at
  ON public.beach_height_offsets (source, computed_at DESC);

ALTER TABLE public.beach_height_offsets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beach_height_offsets_service_role ON public.beach_height_offsets;
CREATE POLICY beach_height_offsets_service_role
  ON public.beach_height_offsets FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.beach_height_offsets IS
  'Rolling per-beach residual offset applied to user-facing display forecasts. Written by Seaside cron compute-beach-height-offsets; read by quiver forecast-builder when beaches.height_offset_enabled = true.';

COMMENT ON COLUMN public.beach_height_offsets.source IS
  'Positive marker identifying the layer this offset applies to. ''display'' = post-face-Hs-transformer user-facing value. Future sources (e.g. ''om-baseline'') must use distinct values.';

COMMENT ON COLUMN public.beach_height_offsets.offset_m IS
  'Median residual in meters: median(display_forecast_m - observed_m) over window_days. Applied as: corrected = display_forecast_m - offset_m.';

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS height_offset_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS height_offset_min_sample_count INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS height_offset_max_age_days INTEGER NOT NULL DEFAULT 14;

COMMENT ON COLUMN public.beaches.height_offset_enabled IS
  'When true, forecast-builder applies the matching beach_height_offsets row (source=display) to display wave heights for forecasts with horizon >= 24h.';

COMMENT ON COLUMN public.beaches.height_offset_min_sample_count IS
  'Minimum matched (raw_display_height_m, observed_m) samples required in the rolling window before applying offset. Default 30.';

COMMENT ON COLUMN public.beaches.height_offset_max_age_days IS
  'Offset is ignored if computed_at is older than this many days. Default 14.';

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS raw_display_height_m NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS offset_corrected_display_height_m NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS height_offset_m NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS height_offset_sample_count INTEGER,
  ADD COLUMN IF NOT EXISTS display_source TEXT;

COMMENT ON COLUMN public.ml_predictions_log.raw_display_height_m IS
  'User-facing display wave height (face-Hs transformer output) BEFORE the per-beach offset correction is applied. Captured at issue time inside forecast-builder; never re-derived from enhanced_forecasts.wave_height.';

COMMENT ON COLUMN public.ml_predictions_log.offset_corrected_display_height_m IS
  'User-facing display wave height AFTER the per-beach offset correction. Equal to raw_display_height_m when no offset applied.';

COMMENT ON COLUMN public.ml_predictions_log.display_source IS
  'Identifier for the display-path version that produced raw_display_height_m. Examples: face-Hs-transformer-v1, backfill-from-ef-v1.';

CREATE INDEX IF NOT EXISTS idx_mpl_offset_window
  ON public.ml_predictions_log (beach_id, predicted_at DESC)
  WHERE observed_m IS NOT NULL AND raw_display_height_m IS NOT NULL;
