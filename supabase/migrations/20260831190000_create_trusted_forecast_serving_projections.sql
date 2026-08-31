BEGIN;

CREATE TABLE public.trusted_forecast_serving_projections (
  beach_id uuid NOT NULL,
  forecast_at timestamptz NOT NULL,
  display_wave_height text NOT NULL CHECK (length(display_wave_height) BETWEEN 1 AND 32),
  baseline_max_face_ft numeric(8, 4) NOT NULL
    CHECK (baseline_max_face_ft BETWEEN 0 AND 60),
  refreshed_at timestamptz NOT NULL,
  PRIMARY KEY (beach_id, forecast_at),
  CONSTRAINT trusted_forecast_serving_projections_application_fkey
    FOREIGN KEY (beach_id, forecast_at)
    REFERENCES public.trusted_forecast_applications (beach_id, forecast_at)
    ON DELETE RESTRICT
);

ALTER TABLE public.trusted_forecast_serving_projections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trusted_forecast_serving_projections
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE
  ON public.trusted_forecast_serving_projections TO service_role;

COMMENT ON TABLE public.trusted_forecast_serving_projections IS
  'Mutable service-role-only serving state for the latest regenerated baseline. Immutable Phase 21 audit history remains in trusted_forecast_applications.';

COMMIT;

-- ROLLBACK
-- DROP TABLE IF EXISTS public.trusted_forecast_serving_projections;
