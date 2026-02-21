BEGIN;

-- ============================================================
-- Drop the old function first because the return type is changing
-- (adding helpful_count, off_count, confirmed_count, rank_score).
-- The signature must match exactly what was previously deployed.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_nearby_intel_posts(
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    INTEGER,
    DOUBLE PRECISION,
    TEXT
);

-- ============================================================
-- Recreate get_nearby_intel_posts() with:
--   - All existing return columns preserved
--   - Three new vote-count columns: helpful_count, off_count, confirmed_count
--   - rank_score: time-decayed engagement signal
--   - ORDER BY rank_score DESC, created_at DESC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_nearby_intel_posts(
    center_lat    DOUBLE PRECISION,
    center_lng    DOUBLE PRECISION,
    limit_count   INTEGER          DEFAULT 50,
    radius_miles  DOUBLE PRECISION DEFAULT 25.0,
    tag_filter    TEXT             DEFAULT NULL
)
RETURNS TABLE (
    id                  UUID,
    user_id             UUID,
    beach_id            UUID,
    latitude            DECIMAL(10, 8),
    longitude           DECIMAL(11, 8),
    tag                 intel_post_tag,
    title               TEXT,
    description         TEXT,
    photo_url           TEXT,
    confirmations_count INTEGER,
    is_active           BOOLEAN,
    surf_conditions     JSONB,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ,
    distance_miles      DOUBLE PRECISION,
    user_name           TEXT,
    beach_name          TEXT,
    helpful_count       INTEGER,
    off_count           INTEGER,
    confirmed_count     INTEGER,
    rank_score          DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ip.id,
        ip.user_id,
        ip.beach_id,
        ip.latitude,
        ip.longitude,
        ip.tag,
        ip.title,
        ip.description,
        ip.photo_url,
        ip.confirmations_count,
        ip.is_active,
        ip.surf_conditions,
        ip.expires_at,
        ip.created_at,
        ip.updated_at,
        (ST_Distance(
            ST_SetSRID(ST_MakePoint(ip.longitude, ip.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ) / 1609.34) AS distance_miles,
        p.full_name AS user_name,
        COALESCE(b.name, 'Unknown Beach') AS beach_name,
        ip.helpful_count,
        ip.off_count,
        ip.confirmed_count,
        -- Rank formula: engagement score with 8-hour time decay.
        -- confirmed votes count double (signal real conditions).
        -- off votes subtract signal (spam / inaccurate content).
        -- Clamped to >= 0 so heavily-downvoted posts do not sort below
        -- fresh zero-engagement posts in confusing ways.
        (
            GREATEST(0, (ip.helpful_count - ip.off_count + ip.confirmed_count * 2)::DOUBLE PRECISION)
            * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600.0 / 8.0))
        ) AS rank_score
    FROM public.intel_posts ip
    LEFT JOIN public.profiles p ON p.id = ip.user_id
    LEFT JOIN public.beaches b ON b.id = ip.beach_id
    WHERE ip.is_active = true
      AND (ip.expires_at IS NULL OR ip.expires_at > NOW())
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ip.longitude, ip.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
          radius_miles * 1609.34
      )
      AND (tag_filter IS NULL OR ip.tag::TEXT = tag_filter)
    ORDER BY
        rank_score DESC,
        ip.created_at DESC
    LIMIT limit_count;
END;
$$;

-- ============================================================
-- Re-grant EXECUTE (grants do not survive DROP FUNCTION)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_nearby_intel_posts(
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    INTEGER,
    DOUBLE PRECISION,
    TEXT
) TO authenticated, service_role, anon;

COMMIT;
