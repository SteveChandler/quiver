BEGIN;

REVOKE ALL ON public.trusted_forecast_serving_projections FROM service_role;
GRANT SELECT, INSERT, UPDATE
  ON public.trusted_forecast_serving_projections TO service_role;

COMMIT;

-- ROLLBACK
-- GRANT ALL ON public.trusted_forecast_serving_projections TO service_role;
