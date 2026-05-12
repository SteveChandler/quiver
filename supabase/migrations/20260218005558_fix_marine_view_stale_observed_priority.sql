-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- New index for the fallback query (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_beach_created_desc
  ON public.marine_forecasts (beach_id, created_at DESC);

DROP VIEW IF EXISTS public.v_marine_forecast_latest;

CREATE VIEW public.v_marine_forecast_latest
WITH (security_invoker = true) AS
SELECT
  b.id AS beach_id,
  mf.created_at,
  mf.ts,
  mf.source,
  mf.is_observed
FROM beaches b
CROSS JOIN LATERAL (
  -- First: try fresh observed data (buoy reading < 6h old)
  -- Uses idx_marine_forecasts_beach_observed_created_desc
  (SELECT m.created_at, m.ts, m.source, m.is_observed
   FROM marine_forecasts m
   WHERE m.beach_id = b.id
     AND m.is_observed = true
     AND m.created_at > NOW() - INTERVAL '6 hours'
   ORDER BY m.created_at DESC
   LIMIT 1)

  UNION ALL

  -- Fallback: newest row regardless of type
  -- Uses idx_marine_forecasts_beach_created_desc
  (SELECT m.created_at, m.ts, m.source, m.is_observed
   FROM marine_forecasts m
   WHERE m.beach_id = b.id
   ORDER BY m.created_at DESC
   LIMIT 1)

  LIMIT 1
) mf;

GRANT SELECT ON public.v_marine_forecast_latest TO service_role;
