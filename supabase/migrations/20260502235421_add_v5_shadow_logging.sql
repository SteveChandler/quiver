-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- v5 shadow logging columns + ml_calibration_versions
-- See seaside/reports/v5_shadow_walk_forward_2026-05-02.md for the audit
-- that locked the bootstrap calibration constants. v5 is NEVER served —
-- only logged so a displayed-vs-OM-vs-v5 comparator becomes available
-- once paired-with-observation rows accumulate.

-- =============================================================================
-- TABLE: ml_predictions_log (v5 shadow columns)
-- =============================================================================
ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS v5_shadow_height_m NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS v5_model_version TEXT,
  ADD COLUMN IF NOT EXISTS direction_bucket TEXT,
  ADD COLUMN IF NOT EXISTS om_bucket TEXT;

COMMENT ON COLUMN public.ml_predictions_log.v5_shadow_height_m IS
  'Shadow-only v5 candidate height in meters: f(wave_height_om) + g(direction_bucket), with the W × 0.5-1.0m guardrail (g skipped in that cell, raw OM passes through). NEVER read by user-facing serving paths. Populated only when wave_height_om and direction_bucket are both available at log time.';

COMMENT ON COLUMN public.ml_predictions_log.v5_model_version IS
  'Identifier of the ml_calibration_versions row that produced v5_shadow_height_m. Format: v5_c.YYYYMMDD_HHMM (matches the calibration_versions.version key).';

COMMENT ON COLUMN public.ml_predictions_log.direction_bucket IS
  'Direction bucket used for v5 g(dir) lookup. One of: S/SW (170-240), W (250-280), NW (280-340), OTHER (everything else, including null). Derived from NOAA primary swell direction (cardinalToDegrees(swell_1_direction)) at log time; falls back to wave_direction_om when NOAA is null.';

COMMENT ON COLUMN public.ml_predictions_log.om_bucket IS
  'OM-predicted-height bucket used for v5 f(om) lookup. One of: <0.5m, 0.5-1.0m, 1.0-1.5m, 1.5m+. Derived from wave_height_om at log time.';

CREATE INDEX IF NOT EXISTS idx_mpl_v5_shadow_comparator
  ON public.ml_predictions_log (predicted_at DESC, beach_id)
  WHERE
    observed_m IS NOT NULL
    AND wave_height_om IS NOT NULL
    AND v5_shadow_height_m IS NOT NULL
    AND offset_corrected_display_height_m IS NOT NULL;

-- =============================================================================
-- TABLE: ml_calibration_versions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ml_calibration_versions (
  version TEXT PRIMARY KEY,
  fitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  train_window_start TIMESTAMPTZ NOT NULL,
  train_window_end TIMESTAMPTZ NOT NULL,
  train_n INTEGER NOT NULL CHECK (train_n > 0),
  knots JSONB NOT NULL,
  g_dir JSONB NOT NULL,
  guardrails JSONB,
  is_active BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  CHECK (train_window_end > train_window_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calibration_versions_one_active
  ON public.ml_calibration_versions (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_calibration_versions_fitted_at
  ON public.ml_calibration_versions (fitted_at DESC);

ALTER TABLE public.ml_calibration_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calibration_versions_service_role ON public.ml_calibration_versions;
CREATE POLICY calibration_versions_service_role
  ON public.ml_calibration_versions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS calibration_versions_authenticated_read ON public.ml_calibration_versions;
CREATE POLICY calibration_versions_authenticated_read
  ON public.ml_calibration_versions FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

COMMENT ON TABLE public.ml_calibration_versions IS
  'v5 shadow calibration registry. Each row is a fitted (f(om), g(direction)) calibration. Written weekly by Seaside cron refit-calibration; read by Quiver web logDisplayPredictions to compute v5_shadow_height_m at issue time. Phase 2 of v5 shadow program — never serves user-facing values.';

COMMENT ON COLUMN public.ml_calibration_versions.knots IS
  'f(om) knot anchors per OM-predicted-height bucket. Each bucket maps to {om_anchor, obs, n}. Read-time interpolation uses (om_anchor, obs) pairs as a saturating piecewise-linear curve.';

COMMENT ON COLUMN public.ml_calibration_versions.g_dir IS
  'g(direction) residual constants per direction bucket. Fit as mean(observed_m - f(wave_height_om)) over train rows. Applied additively at inference: v5 = f(om) + g(dir).';

COMMENT ON COLUMN public.ml_calibration_versions.guardrails IS
  'Per-cell overrides that pass through raw OM instead of f+g. Locked v5 entry: W × 0.5-1.0m (the walk-forward FAIL cell). May expand if future audits flag more cells.';

-- =============================================================================
-- BOOTSTRAP ROW
-- =============================================================================
INSERT INTO public.ml_calibration_versions (
  version, fitted_at, train_window_start, train_window_end, train_n,
  knots, g_dir, guardrails, is_active, notes
) VALUES (
  'v5_c.20260502_bootstrap',
  '2026-05-02T20:00:00Z',
  '2026-04-02T00:00:00Z',
  '2026-05-02T00:00:00Z',
  26121,
  '{
    "<0.5m":     {"om_anchor": 0.40, "obs": 0.806, "n": 1092},
    "0.5-1.0m":  {"om_anchor": 0.77, "obs": 0.823, "n": 15320},
    "1.0-1.5m":  {"om_anchor": 1.19, "obs": 1.120, "n": 7318},
    "1.5m+":     {"om_anchor": 1.79, "obs": 1.669, "n": 2391}
  }'::jsonb,
  '{
    "S/SW":  {"g": -0.095, "n":  4815},
    "W":     {"g": -0.099, "n":  7881},
    "NW":    {"g":  0.277, "n":  2541},
    "OTHER": {"g":  0.014, "n": 10884}
  }'::jsonb,
  '{
    "passthrough_cells": [
      {"direction_bucket": "W", "om_bucket": "0.5-1.0m"}
    ]
  }'::jsonb,
  true,
  'Bootstrap from walk-forward audit 2026-05-02 (seaside/reports/v5_shadow_walk_forward_2026-05-02.md). Replaced by first Seaside refit-calibration cron run; preserved here only so v5_shadow_height_m starts logging on day 1 instead of waiting for the first Monday refit.'
)
ON CONFLICT (version) DO NOTHING;
