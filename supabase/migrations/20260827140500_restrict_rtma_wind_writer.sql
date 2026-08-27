BEGIN;

-- Supabase grants new functions to API roles by default. This SECURITY DEFINER
-- writer must remain callable only by the ingestion service.
REVOKE ALL ON FUNCTION public.bulk_upsert_rtma_wind_observations(jsonb)
  FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_rtma_wind_observations(jsonb)
  TO service_role;

COMMIT;
