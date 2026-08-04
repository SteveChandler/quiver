BEGIN;

CREATE TABLE IF NOT EXISTS public.trusted_external_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('wavecast', 'nws')),
  source_scope text NOT NULL CHECK (source_scope IN ('spot', 'regional')),
  source_key text NOT NULL,
  target_key text NOT NULL,
  beach_id uuid REFERENCES public.beaches(id) ON DELETE RESTRICT,
  region text NOT NULL,
  exposure text NOT NULL,
  issued_at timestamptz NOT NULL,
  valid_start timestamptz NOT NULL,
  valid_end timestamptz NOT NULL,
  min_face_ft numeric(5,2) NOT NULL CHECK (min_face_ft >= 0),
  max_face_ft numeric(5,2) NOT NULL CHECK (max_face_ft >= min_face_ft),
  period_s numeric(5,2) CHECK (period_s IS NULL OR period_s BETWEEN 1 AND 30),
  direction_deg numeric(6,2)
    CHECK (direction_deg IS NULL OR direction_deg BETWEEN 0 AND 360),
  parser_version text NOT NULL CHECK (length(trim(parser_version)) > 0),
  source_hash text NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_end > valid_start),
  CHECK (max_face_ft <= 50),
  CHECK (source_scope = 'regional' OR beach_id IS NOT NULL),
  UNIQUE (
    provider,
    source_key,
    target_key,
    issued_at,
    valid_start,
    exposure,
    source_hash
  )
);

CREATE INDEX IF NOT EXISTS idx_trusted_external_forecasts_beach_window
  ON public.trusted_external_forecasts
  (beach_id, issued_at DESC, valid_start, valid_end);

CREATE TABLE IF NOT EXISTS public.trusted_forecast_adjustments (
  decision_key text PRIMARY KEY,
  trusted_external_forecast_id uuid NOT NULL
    REFERENCES public.trusted_external_forecasts(id) ON DELETE RESTRICT,
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE RESTRICT,
  status text NOT NULL
    CHECK (status IN ('applied', 'noop', 'conflict', 'stale', 'invalid')),
  valid_start timestamptz NOT NULL,
  valid_end timestamptz NOT NULL,
  baseline_max_ft numeric(6,2) NOT NULL CHECK (baseline_max_ft >= 0),
  trusted_min_face_ft numeric(5,2) NOT NULL CHECK (trusted_min_face_ft >= 0),
  trusted_max_face_ft numeric(5,2) NOT NULL
    CHECK (trusted_max_face_ft >= trusted_min_face_ft),
  signed_distance_ft numeric(6,2) NOT NULL,
  offset_ft numeric(4,2) NOT NULL
    CHECK (offset_ft IN (-0.50, -0.25, 0, 0.25, 0.50)),
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_end > valid_start)
);

CREATE INDEX IF NOT EXISTS idx_trusted_forecast_adjustments_beach_window
  ON public.trusted_forecast_adjustments
  (beach_id, valid_start, valid_end, computed_at DESC);

ALTER TABLE public.trusted_external_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_forecast_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trusted_external_forecasts
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trusted_forecast_adjustments
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT
  ON TABLE public.trusted_external_forecasts TO service_role;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.trusted_forecast_adjustments TO service_role;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS trusted_forecast_adjustment_key text,
  ADD COLUMN IF NOT EXISTS trusted_forecast_baseline_height_m numeric(7,3),
  ADD COLUMN IF NOT EXISTS trusted_forecast_offset_ft numeric(4,2),
  ADD COLUMN IF NOT EXISTS trusted_forecast_adjustment_applied boolean
    NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ml_predictions_log_trusted_forecast_adjustment_fkey'
  ) THEN
    ALTER TABLE public.ml_predictions_log
      ADD CONSTRAINT ml_predictions_log_trusted_forecast_adjustment_fkey
      FOREIGN KEY (trusted_forecast_adjustment_key)
      REFERENCES public.trusted_forecast_adjustments(decision_key)
      ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public.ml_predictions_log
  DROP CONSTRAINT IF EXISTS ml_predictions_log_trusted_forecast_offset_check;
ALTER TABLE public.ml_predictions_log
  ADD CONSTRAINT ml_predictions_log_trusted_forecast_offset_check
  CHECK (
    trusted_forecast_offset_ft IS NULL
    OR trusted_forecast_offset_ft IN (-0.50, -0.25, 0, 0.25, 0.50)
  );

COMMENT ON TABLE public.trusted_external_forecasts IS
  'Service-role-only normalized forecast issues authorized for internal Quiver adjustment decisions.';
COMMENT ON TABLE public.trusted_forecast_adjustments IS
  'Auditable source-window decisions computed from pre-adjustment Quiver display heights.';
COMMENT ON COLUMN public.ml_predictions_log.trusted_forecast_baseline_height_m IS
  'Display height immediately before the trusted-source adjustment; prevents correction feedback loops.';

COMMIT;
