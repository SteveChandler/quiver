-- Nearby beaches RPC using pure SQL Haversine over latitude/longitude

CREATE OR REPLACE FUNCTION public.get_beaches_near(
  _lat double precision,
  _lon double precision,
  _radius_km double precision DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  name text,
  lat double precision,
  lon double precision,
  break_type text,
  aspect_deg int,
  offshore_deg int,
  swell_window_center_deg int,
  swell_window_halfwidth_deg int,
  tide_min_ft numeric,
  tide_max_ft numeric,
  wind_cross_ok_kts int,
  wind_onshore_bad_kts int,
  dist_km double precision
)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT
      b.id,
      b.name,
      b.latitude AS lat,
      b.longitude AS lon,
      b.break_type,
      b.aspect_deg,
      b.offshore_deg,
      b.swell_window_center_deg,
      b.swell_window_halfwidth_deg,
      b.tide_min_ft,
      b.tide_max_ft,
      b.wind_cross_ok_kts,
      b.wind_onshore_bad_kts,
      -- Haversine (spherical law of cosines) with clamped argument
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(_lon))
          + sin(radians(_lat)) * sin(radians(b.latitude))
        ))
      ) AS dist_km
    FROM public.beaches b
    WHERE b.latitude IS NOT NULL AND b.longitude IS NOT NULL
  )
  SELECT *
  FROM base
  WHERE dist_km <= _radius_km
  ORDER BY dist_km
  LIMIT 12;
$$;

GRANT EXECUTE ON FUNCTION public.get_beaches_near(double precision, double precision, double precision)
  TO anon, authenticated, service_role;


