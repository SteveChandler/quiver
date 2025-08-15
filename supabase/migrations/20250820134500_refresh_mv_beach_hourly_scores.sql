-- Optional helper to (re)populate MV rapidly
CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_beach_hourly_scores;
END;
$$;

COMMENT ON FUNCTION public.refresh_mv_beach_hourly_scores() IS 'Concurrent refresh for mv_beach_hourly_scores';

