-- Local snapshot compatibility only; never apply through the production ledger.
-- pg_dump preserves hard-coded public PostGIS references inside function bodies,
-- but the local stack installs PostGIS in extensions.
BEGIN;

DO $$
DECLARE
  postgis_schema text;
  definition text;
BEGIN
  SELECT n.nspname INTO STRICT postgis_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';

  SELECT pg_get_functiondef(
    'public.get_nearby_intel_posts(double precision,double precision,integer,double precision,text)'::regprocedure
  ) INTO definition;

  EXECUTE regexp_replace(
    definition,
    'public\.(st_distance|st_setsrid|st_makepoint|st_dwithin|geography)\M',
    format('%I', postgis_schema) || '.\1',
    'gi'
  );

  PERFORM * FROM public.get_nearby_intel_posts(32.7157, -117.1611, 1, 1, NULL);
END;
$$;

COMMIT;
