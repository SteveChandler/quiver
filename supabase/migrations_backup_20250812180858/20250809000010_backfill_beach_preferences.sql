-- One-time backfill for beach preference metadata using PostGIS + defaults
-- Idempotent: uses COALESCE to preserve non-null values and inserts only if missing

-- Ensure coordinates column exists (requires PostGIS; earlier migration enables it)
do $$ begin
  if to_regclass('public.beaches') is not null then
    begin
      alter table public.beaches add column if not exists coordinates geography(Point,4326);
    exception when undefined_object then
      raise notice 'PostGIS not available; skipping coordinates column addition';
    end;
  end if;
end $$;

BEGIN;

-- Ensure coordinates are populated from lat/lon when missing
-- Populate coordinates from lat/lon when available
UPDATE public.beaches b
SET coordinates = ST_Point(b.longitude, b.latitude)::geography
WHERE coordinates IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

-- Helper: normalize degrees into [0,360)
CREATE OR REPLACE FUNCTION public._norm_deg(val double precision)
RETURNS double precision AS $$
BEGIN
  -- Normalize degrees into [0, 360) using numeric modulo to avoid type issues
  RETURN (((val::numeric % 360) + 360) % 360)::double precision;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Compute aspect (from coastline if available), offshore wind, swell window, tide and skill defaults
WITH computed AS (
  SELECT
    b.id,
    -- Break type: keep existing, else infer from name
    COALESCE(
      NULLIF(b.break_type, ''),
      CASE
        WHEN b.name ILIKE '%Reef%' THEN 'reef'
        WHEN b.name ILIKE '%Point%' THEN 'point'
        WHEN b.name ILIKE '%Jetty%' OR b.name ILIKE '%Jetti%' OR b.name ILIKE '%Pier%' OR b.name ILIKE '%Harbor%' THEN 'jetty'
        ELSE 'beach'
      END
    ) AS break_type_new,

    -- Aspect heuristic (SoCal) based on name/location text; no dependency on a region column
    CASE
      WHEN (COALESCE(b.location,'') ILIKE '%Baja%' OR b.name ILIKE '%Baja%') THEN 310
      WHEN (b.name ILIKE '%Trestles%' OR b.name ILIKE '%San Onofre%' OR COALESCE(b.location,'') ILIKE '%San Clemente%') THEN 340
      WHEN (
        COALESCE(b.location,'') ILIKE '%Huntington Beach%'
        OR COALESCE(b.location,'') ILIKE '%Newport%'
        OR COALESCE(b.location,'') ILIKE '%Laguna%'
        OR COALESCE(b.location,'') ILIKE '%Dana Point%'
        OR b.name ILIKE '%Huntington%'
        OR b.name ILIKE '%Newport%'
        OR b.name ILIKE '%Laguna%'
        OR b.name ILIKE '%Dana Point%'
      ) THEN 330
      ELSE 320
    END AS shoreline_aspect_deg_new,

    -- Offshore wind computed later from aspect + 180

    -- Half width for swell window based on break type
    CASE
      WHEN COALESCE(
             NULLIF(b.break_type, ''),
             CASE
               WHEN b.name ILIKE '%Reef%' THEN 'reef'
               WHEN b.name ILIKE '%Point%' THEN 'point'
               WHEN b.name ILIKE '%Jetty%' OR b.name ILIKE '%Jetti%' OR b.name ILIKE '%Pier%' OR b.name ILIKE '%Harbor%' THEN 'jetty'
               ELSE 'beach'
             END
           ) = 'beach' THEN 70
      WHEN COALESCE(
             NULLIF(b.break_type, ''),
             CASE
               WHEN b.name ILIKE '%Reef%' THEN 'reef'
               WHEN b.name ILIKE '%Point%' THEN 'point'
               WHEN b.name ILIKE '%Jetty%' OR b.name ILIKE '%Jetti%' OR b.name ILIKE '%Pier%' OR b.name ILIKE '%Harbor%' THEN 'jetty'
               ELSE 'beach'
             END
           ) = 'reef' THEN 60
      WHEN COALESCE(
             NULLIF(b.break_type, ''),
             CASE
               WHEN b.name ILIKE '%Reef%' THEN 'reef'
               WHEN b.name ILIKE '%Point%' THEN 'point'
               WHEN b.name ILIKE '%Jetty%' OR b.name ILIKE '%Jetti%' OR b.name ILIKE '%Pier%' OR b.name ILIKE '%Harbor%' THEN 'jetty'
               ELSE 'beach'
             END
           ) = 'point' THEN 50
      ELSE 60
    END AS swell_half_width,

    -- Tide range defaults
    CASE
      WHEN COALESCE(NULLIF(b.break_type,''), 'beach') = 'beach' THEN 0.7
      WHEN COALESCE(NULLIF(b.break_type,''), 'beach') IN ('point','reef') THEN 1.5
      ELSE 1.5
    END AS tide_min_ft,
    CASE
      WHEN COALESCE(NULLIF(b.break_type,''), 'beach') = 'beach' THEN 3.0
      WHEN COALESCE(NULLIF(b.break_type,''), 'beach') IN ('point','reef') THEN 4.5
      ELSE 4.5
    END AS tide_max_ft,

    -- Skill mapping (numeric-as-text per requirement)
    CASE
      WHEN COALESCE(NULLIF(b.break_type,''), 'beach') = 'beach' THEN '1'
      WHEN COALESCE(NULLIF(b.break_type,''), 'beach') IN ('point','reef') THEN '2'
      ELSE '2'
    END AS skill_level_new

  FROM public.beaches b
)
UPDATE public.beaches b
SET
  break_type = COALESCE(break_type, c.break_type_new),
  shoreline_aspect_deg = COALESCE(shoreline_aspect_deg, CAST(_norm_deg(c.shoreline_aspect_deg_new) AS SMALLINT)),
  wind_offshore_deg = COALESCE(wind_offshore_deg, CAST(_norm_deg(c.shoreline_aspect_deg_new + 180) AS SMALLINT)),
  wind_offshore_tol_deg = COALESCE(wind_offshore_tol_deg, 30),
  wind_cross_shore_ok_kt = COALESCE(wind_cross_shore_ok_kt, 10),
  wind_onshore_bad_kt = COALESCE(wind_onshore_bad_kt, 8),
  swell_window_min_deg = COALESCE(swell_window_min_deg, CAST(_norm_deg(c.shoreline_aspect_deg_new - c.swell_half_width) AS SMALLINT)),
  swell_window_max_deg = COALESCE(swell_window_max_deg, CAST(_norm_deg(c.shoreline_aspect_deg_new + c.swell_half_width) AS SMALLINT)),
  preferred_tide_ft_min = COALESCE(preferred_tide_ft_min, c.tide_min_ft),
  preferred_tide_ft_max = COALESCE(preferred_tide_ft_max, c.tide_max_ft),
  skill_level = COALESCE(skill_level, c.skill_level_new),
  preference_model = COALESCE(
    preference_model,
    jsonb_build_object(
      'version', 1,
      'source', 'noaa_seed',
      'seeded_at', (now() at time zone 'utc'),
      'notes', 'Seeded from shoreline aspect + defaults'
    )
  )
FROM computed c
WHERE b.id = c.id;

-- Seed calibration table if missing
INSERT INTO public.beach_recommendation_calibration (
  beach_id, window_start, window_end, samples_count,
  best_swell_dir_deg_min, best_swell_dir_deg_max,
  best_wind_offshore_deg, best_wind_tol_deg,
  best_tide_ft_min, best_tide_ft_max,
  skill_level_inferred, method, metrics
)
SELECT
  b.id,
  CURRENT_DATE, CURRENT_DATE, 0,
  b.swell_window_min_deg, b.swell_window_max_deg,
  b.wind_offshore_deg, b.wind_offshore_tol_deg,
  b.preferred_tide_ft_min, b.preferred_tide_ft_max,
  b.skill_level, 'default_seed', jsonb_build_object('metric','seed','key','noaa_default','value',1)
FROM public.beaches b
WHERE NOT EXISTS (
  SELECT 1 FROM public.beach_recommendation_calibration x
  WHERE x.beach_id = b.id AND x.method = 'default_seed'
);

-- Validation notices (counts of remaining NULLs)
DO $$
DECLARE
  nulls_remaining int;
BEGIN
  SELECT COUNT(*) INTO nulls_remaining
  FROM public.beaches
  WHERE break_type IS NULL
     OR shoreline_aspect_deg IS NULL
     OR wind_offshore_deg IS NULL
     OR wind_offshore_tol_deg IS NULL
     OR swell_window_min_deg IS NULL
     OR swell_window_max_deg IS NULL
     OR wind_cross_shore_ok_kt IS NULL
     OR wind_onshore_bad_kt IS NULL
     OR preferred_tide_ft_min IS NULL
     OR preferred_tide_ft_max IS NULL
     OR skill_level IS NULL
     OR preference_model IS NULL;

  RAISE NOTICE 'Remaining NULL preference fields across beaches: %', nulls_remaining;
END $$;

COMMIT;

-- Preview query for manual verification (run separately in SQL console)
-- select b.name, b.break_type, b.shoreline_aspect_deg as aspect,
--        b.wind_offshore_deg as offshore_wind_deg,
--        b.swell_window_min_deg as swell_min,
--        b.swell_window_max_deg as swell_max,
--        b.preferred_tide_ft_min as tide_min_ft,
--        b.preferred_tide_ft_max as tide_max_ft,
--        b.skill_level
-- from public.beaches b
-- order by random()
-- limit 20;


