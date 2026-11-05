-- Reference terrain for beaches that anchor a custom spot but have no terrain
-- of their own. The custom-spot worker fills it so a spot's forecast can be
-- scaled against its anchor like-for-like (see
-- lib/services/custom-spot-analysis/forecast-overlay.ts). It never changes the
-- beach row, so the anchor beach's own forecast and scoring are untouched.
--
-- Service role only: nothing a user can write reaches it.
--
-- Rollback: supabase/rollbacks/20261105090000_custom_spot_anchor_terrain_rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.custom_spot_anchor_terrain (
  beach_id uuid PRIMARY KEY REFERENCES public.beaches (id) ON DELETE CASCADE,
  swell_access_factors real[] NOT NULL,
  wind_exposure_factors real[] NOT NULL,
  model_version text NOT NULL,
  terrain_params_hash text NOT NULL,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_spot_anchor_terrain_swell_valid
    CHECK (public.is_valid_directional_factor_array(swell_access_factors)),
  CONSTRAINT custom_spot_anchor_terrain_wind_valid
    CHECK (public.is_valid_directional_factor_array(wind_exposure_factors))
);

ALTER TABLE public.custom_spot_anchor_terrain ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.custom_spot_anchor_terrain FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.custom_spot_anchor_terrain TO service_role;

COMMIT;
