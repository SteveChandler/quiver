-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ccc_access_locations (
    id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    ccc_id          INTEGER          UNIQUE NOT NULL,
    name            TEXT             NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    geog            geography(Point, 4326)
                        GENERATED ALWAYS AS (
                            ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
                        ) STORED,
    county          TEXT,
    has_parking          BOOLEAN NOT NULL DEFAULT FALSE,
    has_fee              BOOLEAN NOT NULL DEFAULT FALSE,
    has_restrooms        BOOLEAN NOT NULL DEFAULT FALSE,
    has_ada_access       BOOLEAN NOT NULL DEFAULT FALSE,
    has_dog_friendly     BOOLEAN NOT NULL DEFAULT FALSE,
    has_stroller_friendly BOOLEAN NOT NULL DEFAULT FALSE,
    has_campground       BOOLEAN NOT NULL DEFAULT FALSE,
    has_boating          BOOLEAN NOT NULL DEFAULT FALSE,
    has_fishing          BOOLEAN NOT NULL DEFAULT FALSE,
    has_picnic_area      BOOLEAN NOT NULL DEFAULT FALSE,
    has_volleyball       BOOLEAN NOT NULL DEFAULT FALSE,
    has_bike_path        BOOLEAN NOT NULL DEFAULT FALSE,
    has_tidepools        BOOLEAN NOT NULL DEFAULT FALSE,
    has_sandy_beach      BOOLEAN NOT NULL DEFAULT FALSE,
    has_rocky_shore      BOOLEAN NOT NULL DEFAULT FALSE,
    has_bluff_trail      BOOLEAN NOT NULL DEFAULT FALSE,
    has_wildlife_viewing BOOLEAN NOT NULL DEFAULT FALSE,
    has_visitor_center   BOOLEAN NOT NULL DEFAULT FALSE,
    raw_data        JSONB,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ccc_access_locations_geog_gist
    ON public.ccc_access_locations USING GIST (geog);

ALTER TABLE public.ccc_access_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccc_access_locations_select_public" ON public.ccc_access_locations;
CREATE POLICY "ccc_access_locations_select_public"
    ON public.ccc_access_locations
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "ccc_access_locations_insert_service_role" ON public.ccc_access_locations;
CREATE POLICY "ccc_access_locations_insert_service_role"
    ON public.ccc_access_locations
    FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "ccc_access_locations_update_service_role" ON public.ccc_access_locations;
CREATE POLICY "ccc_access_locations_update_service_role"
    ON public.ccc_access_locations
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "ccc_access_locations_delete_service_role" ON public.ccc_access_locations;
CREATE POLICY "ccc_access_locations_delete_service_role"
    ON public.ccc_access_locations
    FOR DELETE
    TO service_role
    USING (true);

GRANT SELECT ON public.ccc_access_locations TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.ccc_access_locations TO service_role;

COMMENT ON TABLE public.ccc_access_locations IS
    'Raw California Coastal Commission public access location data synced from the CCC API. Written by the server-side sync service; readable by all roles.';

CREATE TABLE IF NOT EXISTS public.beach_amenity_sources (
    id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    beach_id         UUID             NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
    ccc_location_id  UUID             NOT NULL REFERENCES public.ccc_access_locations(id) ON DELETE CASCADE,
    distance_m       DOUBLE PRECISION NOT NULL,
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    UNIQUE (beach_id, ccc_location_id)
);

CREATE INDEX IF NOT EXISTS beach_amenity_sources_beach_id_idx
    ON public.beach_amenity_sources (beach_id);

CREATE INDEX IF NOT EXISTS beach_amenity_sources_ccc_location_id_idx
    ON public.beach_amenity_sources (ccc_location_id);

ALTER TABLE public.beach_amenity_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beach_amenity_sources_select_public" ON public.beach_amenity_sources;
CREATE POLICY "beach_amenity_sources_select_public"
    ON public.beach_amenity_sources
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "beach_amenity_sources_insert_service_role" ON public.beach_amenity_sources;
CREATE POLICY "beach_amenity_sources_insert_service_role"
    ON public.beach_amenity_sources
    FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "beach_amenity_sources_update_service_role" ON public.beach_amenity_sources;
CREATE POLICY "beach_amenity_sources_update_service_role"
    ON public.beach_amenity_sources
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "beach_amenity_sources_delete_service_role" ON public.beach_amenity_sources;
CREATE POLICY "beach_amenity_sources_delete_service_role"
    ON public.beach_amenity_sources
    FOR DELETE
    TO service_role
    USING (true);

GRANT SELECT ON public.beach_amenity_sources TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.beach_amenity_sources TO service_role;

COMMENT ON TABLE public.beach_amenity_sources IS
    'Beach-to-CCC access location linkage created by spatial proximity matching. A single beach may link to multiple nearby CCC access points; distance_m records the centroid-to-centroid distance in metres.';

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_beach_amenities AS
SELECT
    bas.beach_id,
    BOOL_OR(cal.has_parking)           AS has_parking,
    BOOL_OR(cal.has_fee)               AS has_fee,
    BOOL_OR(cal.has_restrooms)         AS has_restrooms,
    BOOL_OR(cal.has_ada_access)        AS has_ada_access,
    BOOL_OR(cal.has_dog_friendly)      AS has_dog_friendly,
    BOOL_OR(cal.has_stroller_friendly) AS has_stroller_friendly,
    BOOL_OR(cal.has_campground)        AS has_campground,
    BOOL_OR(cal.has_boating)           AS has_boating,
    BOOL_OR(cal.has_fishing)           AS has_fishing,
    BOOL_OR(cal.has_picnic_area)       AS has_picnic_area,
    BOOL_OR(cal.has_volleyball)        AS has_volleyball,
    BOOL_OR(cal.has_bike_path)         AS has_bike_path,
    BOOL_OR(cal.has_tidepools)         AS has_tidepools,
    BOOL_OR(cal.has_sandy_beach)       AS has_sandy_beach,
    BOOL_OR(cal.has_rocky_shore)       AS has_rocky_shore,
    BOOL_OR(cal.has_bluff_trail)       AS has_bluff_trail,
    BOOL_OR(cal.has_wildlife_viewing)  AS has_wildlife_viewing,
    BOOL_OR(cal.has_visitor_center)    AS has_visitor_center,
    COUNT(*)::INTEGER                  AS source_count,
    MIN(bas.distance_m)                AS nearest_source_m
FROM public.beach_amenity_sources bas
JOIN public.ccc_access_locations cal
    ON cal.id = bas.ccc_location_id
GROUP BY bas.beach_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_beach_amenities_beach_id_uidx
    ON public.mv_beach_amenities (beach_id);

COMMENT ON MATERIALIZED VIEW public.mv_beach_amenities IS
    'Aggregated CCC amenity flags per beach. One row per beach_id. Amenity flags are the logical OR of all linked CCC access locations. Refreshed via refresh_mv_beach_amenities() on each CCC sync cycle.';

CREATE OR REPLACE FUNCTION public.refresh_mv_beach_amenities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_beach_amenities;
END;
$$;

ALTER FUNCTION public.refresh_mv_beach_amenities() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.refresh_mv_beach_amenities() TO service_role;

COMMENT ON FUNCTION public.refresh_mv_beach_amenities() IS
    'Performs a non-blocking REFRESH MATERIALIZED VIEW CONCURRENTLY on mv_beach_amenities. Called by the CCC sync service after each upsert cycle.';

COMMIT;
