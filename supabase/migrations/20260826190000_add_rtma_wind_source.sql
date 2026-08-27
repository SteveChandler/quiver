BEGIN;

-- Current wind observations are hourly and must not share the three-hour
-- enhanced_forecasts keyspace. Keeping them separate also prevents forecast
-- refreshes from replacing an analyzed RTMA value with NWS/HRRR guidance.
CREATE TABLE public.beach_wind_observations (
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  wind_speed_mph numeric NOT NULL,
  wind_direction text,
  wind_direction_deg numeric,
  wind_gust_mph numeric,
  source text NOT NULL,
  domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (beach_id, observed_at, source),
  CONSTRAINT beach_wind_observations_speed_nonnegative
    CHECK (wind_speed_mph >= 0 AND wind_speed_mph <= 250),
  CONSTRAINT beach_wind_observations_gust_nonnegative
    CHECK (
      wind_gust_mph IS NULL
      OR (wind_gust_mph >= 0 AND wind_gust_mph <= 300)
    ),
  CONSTRAINT beach_wind_observations_direction_range
    CHECK (
      wind_direction_deg IS NULL
      OR (wind_direction_deg >= 0 AND wind_direction_deg <= 360)
    )
);

CREATE INDEX beach_wind_observations_latest_idx
  ON public.beach_wind_observations (beach_id, observed_at DESC);

ALTER TABLE public.beach_wind_observations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bulk_upsert_rtma_wind_observations(payload jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH values_to_apply AS (
    SELECT * FROM jsonb_to_recordset(payload) AS source_value(
      beach_id uuid,
      observed_at timestamptz,
      wind_speed_mph numeric,
      wind_direction text,
      wind_direction_deg numeric,
      wind_gust_mph numeric,
      domain text
    )
  ), upserted AS (
    INSERT INTO public.beach_wind_observations (
      beach_id,
      observed_at,
      wind_speed_mph,
      wind_direction,
      wind_direction_deg,
      wind_gust_mph,
      source,
      domain
    )
    SELECT
      source_value.beach_id,
      source_value.observed_at,
      source_value.wind_speed_mph,
      source_value.wind_direction,
      source_value.wind_direction_deg,
      source_value.wind_gust_mph,
      'RTMA',
      source_value.domain
    FROM values_to_apply AS source_value
    ON CONFLICT (beach_id, observed_at, source) DO UPDATE
    SET
      wind_speed_mph = EXCLUDED.wind_speed_mph,
      wind_direction = EXCLUDED.wind_direction,
      wind_direction_deg = EXCLUDED.wind_direction_deg,
      wind_gust_mph = EXCLUDED.wind_gust_mph,
      domain = EXCLUDED.domain,
      updated_at = now()
    RETURNING 1
  )
  SELECT count(*)::integer FROM upserted;
$$;

REVOKE ALL ON FUNCTION public.bulk_upsert_rtma_wind_observations(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_upsert_rtma_wind_observations(jsonb) TO service_role;

COMMENT ON FUNCTION public.bulk_upsert_rtma_wind_observations(jsonb) IS
  'Upserts hourly NOAA RTMA beach-wind observations. Returns rows written.';

CREATE OR REPLACE FUNCTION public.get_current_beach_wind(p_beach_id uuid)
RETURNS TABLE (
  observed_at timestamptz,
  wind_speed_mph numeric,
  wind_direction text,
  wind_direction_deg numeric,
  wind_gust_mph numeric,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    observation.observed_at,
    observation.wind_speed_mph,
    observation.wind_direction,
    observation.wind_direction_deg,
    observation.wind_gust_mph,
    observation.source
  FROM public.beach_wind_observations AS observation
  WHERE observation.beach_id = p_beach_id
    AND observation.observed_at >= now() - interval '2 hours'
    AND observation.observed_at <= now() + interval '15 minutes'
  ORDER BY observation.observed_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_current_beach_wind(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_beach_wind(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_current_beach_wind(uuid) IS
  'Returns the newest non-stale hourly beach-wind observation for Coast Pulse.';

COMMIT;
