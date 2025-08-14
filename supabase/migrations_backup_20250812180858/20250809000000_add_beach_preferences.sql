-- Beach preference schema: formalize spot metadata and calibration rollups
-- Safe to run multiple times (IF NOT EXISTS / add column if not exists)

BEGIN;

-- Extend beaches table with normalized, machine-usable fields
ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS break_type TEXT,
  ADD COLUMN IF NOT EXISTS shoreline_aspect_deg SMALLINT CHECK (shoreline_aspect_deg >= 0 AND shoreline_aspect_deg < 360),
  ADD COLUMN IF NOT EXISTS swell_window_min_deg SMALLINT CHECK (swell_window_min_deg >= 0 AND swell_window_min_deg < 360),
  ADD COLUMN IF NOT EXISTS swell_window_max_deg SMALLINT CHECK (swell_window_max_deg >= 0 AND swell_window_max_deg < 360),
  ADD COLUMN IF NOT EXISTS wind_offshore_deg SMALLINT CHECK (wind_offshore_deg >= 0 AND wind_offshore_deg < 360),
  ADD COLUMN IF NOT EXISTS wind_offshore_tol_deg SMALLINT CHECK (wind_offshore_tol_deg >= 0 AND wind_offshore_tol_deg <= 90),
  ADD COLUMN IF NOT EXISTS wind_cross_shore_ok_kt SMALLINT CHECK (wind_cross_shore_ok_kt >= 0),
  ADD COLUMN IF NOT EXISTS wind_onshore_bad_kt SMALLINT CHECK (wind_onshore_bad_kt >= 0),
  ADD COLUMN IF NOT EXISTS preferred_tide_ft_min NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS preferred_tide_ft_max NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS skill_level TEXT,
  ADD COLUMN IF NOT EXISTS best_swell_cardinals TEXT[],
  ADD COLUMN IF NOT EXISTS best_wind_cardinals TEXT[],
  ADD COLUMN IF NOT EXISTS preference_model JSONB;

COMMENT ON COLUMN public.beaches.break_type IS 'General break type: beach, reef, point, jetty';
COMMENT ON COLUMN public.beaches.shoreline_aspect_deg IS 'Coastline aspect (0-359 degrees, 0=N)';
COMMENT ON COLUMN public.beaches.swell_window_min_deg IS 'Lower bound of favorable swell directions (deg)';
COMMENT ON COLUMN public.beaches.swell_window_max_deg IS 'Upper bound of favorable swell directions (deg)';
COMMENT ON COLUMN public.beaches.wind_offshore_deg IS 'Offshore wind direction (deg)';
COMMENT ON COLUMN public.beaches.wind_offshore_tol_deg IS 'Tolerance window around offshore (deg)';
COMMENT ON COLUMN public.beaches.wind_cross_shore_ok_kt IS 'Max wind speed that is acceptable for cross-shore (kt)';
COMMENT ON COLUMN public.beaches.wind_onshore_bad_kt IS 'Onshore wind speed threshold that degrades surf (kt)';
COMMENT ON COLUMN public.beaches.preferred_tide_ft_min IS 'Preferred minimum tide height (ft)';
COMMENT ON COLUMN public.beaches.preferred_tide_ft_max IS 'Preferred maximum tide height (ft)';
COMMENT ON COLUMN public.beaches.skill_level IS 'Skill suitability: beginner, intermediate, advanced (or ranges)';
COMMENT ON COLUMN public.beaches.best_swell_cardinals IS 'Derived cardinal labels for best swell directions';
COMMENT ON COLUMN public.beaches.best_wind_cardinals IS 'Derived cardinal labels for best wind directions (offshore)';
COMMENT ON COLUMN public.beaches.preference_model IS 'JSON model and versioned parameters for recommendation calibration';

-- Calibration rollups for ongoing learning
CREATE TABLE IF NOT EXISTS public.beach_recommendation_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  samples_count INT NOT NULL DEFAULT 0,
  best_swell_dir_deg_min SMALLINT,
  best_swell_dir_deg_max SMALLINT,
  best_wind_offshore_deg SMALLINT,
  best_wind_tol_deg SMALLINT,
  best_tide_ft_min NUMERIC(4,1),
  best_tide_ft_max NUMERIC(4,1),
  skill_level_inferred TEXT,
  method TEXT NOT NULL DEFAULT 'default_seed',
  metrics JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_beach_reco_cal_beach_id ON public.beach_recommendation_calibration(beach_id);
CREATE INDEX IF NOT EXISTS idx_beach_reco_cal_window ON public.beach_recommendation_calibration(window_start, window_end);

COMMIT;


