BEGIN;

CREATE OR REPLACE FUNCTION public.get_nearby_beaches(
    input_lat DOUBLE PRECISION,
    input_lng DOUBLE PRECISION,
    max_distance_meters INTEGER DEFAULT 80467,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    location TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    is_private BOOLEAN,
    distance_meters DOUBLE PRECISION,
    slug TEXT,
    city TEXT,
    state TEXT,
    skill_level TEXT,
    break_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    target_lat DOUBLE PRECISION := input_lat;
    target_lng DOUBLE PRECISION := input_lng;
    -- Ceilings bound the scan without clipping any real caller. 160934 m is
    -- what native's use-nearest-beach and web's candidate-pool outer tier both
    -- already request; clamping to 50 mi would silently return nothing for
    -- users further than that from a break, in binaries already shipped.
    -- 100 rows clears discovery's CANDIDATE_POOL_LIMIT of 60.
    capped_distance INTEGER := LEAST(GREATEST(max_distance_meters, 0), 160934);
    capped_limit INTEGER := LEAST(GREATEST(limit_count, 1), 100);
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
        CASE
            WHEN b.city IS NOT NULL AND b.state IS NOT NULL
                THEN b.city || ', ' || b.state
            WHEN b.city IS NOT NULL THEN b.city
            WHEN b.state IS NOT NULL THEN b.state
            ELSE 'Unknown'
        END AS location,
        b.lat,
        b.lon,
        b.is_private,
        ST_Distance(
            b.geog,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters,
        b.slug,
        b.city,
        b.state,
        b.skill_level,
        b.break_type
    FROM public.beaches b
    WHERE b.lat IS NOT NULL
      AND b.lon IS NOT NULL
      AND COALESCE(b.is_private, false) = false
      AND b.deleted_at IS NULL
      AND ST_DWithin(
          b.geog,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          capped_distance
      )
    ORDER BY distance_meters ASC
    LIMIT capped_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS
'Returns at most 100 public, non-deleted beaches within at most 100 miles of the supplied coordinates. Defaults to 50 miles / 50 rows when the caller omits them.';

COMMIT;
