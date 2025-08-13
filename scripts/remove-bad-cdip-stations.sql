-- Remove bad CDIP stations and related data (guarded/idempotent)
-- Edit the list below to include any additional bad station IDs

BEGIN;

DO $$
DECLARE
  bad_stations text[] := ARRAY['67']; -- add more like '123','456' as needed
BEGIN
  -- 1) Delete CDIP-derived marine forecasts for beaches tied to bad stations
  IF to_regclass('public.marine_forecasts') IS NOT NULL
     AND to_regclass('public.beaches') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='beaches' AND column_name='cdip_station'
    ) THEN
      DELETE FROM public.marine_forecasts mf
      USING public.beaches b
      WHERE mf.beach_id = b.id
        AND mf.source = 'cdip'
        AND b.cdip_station = ANY(bad_stations);
    END IF;
  END IF;

  -- 2) Null out beach.cdip_station references
  IF to_regclass('public.beaches') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='beaches' AND column_name='cdip_station'
    ) THEN
      UPDATE public.beaches
      SET cdip_station = NULL
      WHERE cdip_station = ANY(bad_stations);
    END IF;
  END IF;

  -- 3) Remove buoys rows referencing those stations (if present)
  IF to_regclass('public.buoys') IS NOT NULL THEN
    DELETE FROM public.buoys
    WHERE buoy_uuid = ANY(bad_stations)
       OR (buoy_name IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(bad_stations) s
            WHERE lower(buoy_name) LIKE '%' || lower(s) || '%'
          ));
  END IF;
END $$;

COMMIT;


