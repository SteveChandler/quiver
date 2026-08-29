-- Custom spot creation has been failing for every user with
-- `type "geography" does not exist`.
--
-- public.create_custom_spot_guarded casts to the PostGIS geography type:
--   ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
-- but was defined with `SET search_path TO 'public'`. PostGIS is installed in
-- the `extensions` schema, so the type cannot be resolved and the call aborts
-- before any row is written.
--
-- It is the only function in `public` using PostGIS types or functions whose
-- search_path omits `extensions`; every sibling (get_nearby_beaches,
-- find_nearest_beach_id, get_weekend_scout_candidates, …) already carries it.
-- This aligns the outlier rather than changing any behaviour.
--
-- Scope: search_path only. The function body, signature, ownership, and
-- SECURITY attributes are untouched, so this is reversible by resetting the
-- setting back to 'public'.

BEGIN;

ALTER FUNCTION public.create_custom_spot_guarded(
  text,
  double precision,
  double precision,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) SET search_path TO 'public', 'extensions', 'pg_temp';

COMMIT;
