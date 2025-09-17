-- Adjust intel ranking to prioritize recency over confirmations
-- Replaces ORDER BY in get_nearby_intel_posts to: created_at DESC, confirmations_count DESC

BEGIN;

CREATE OR REPLACE FUNCTION get_nearby_intel_posts(
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    limit_count INTEGER DEFAULT 20,
    radius_miles DOUBLE PRECISION DEFAULT 25.0,
    tag_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    beach_id UUID,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    tag intel_post_tag,
    title TEXT,
    description TEXT,
    photo_url TEXT,
    confirmations_count INTEGER,
    is_active BOOLEAN,
    surf_conditions JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    distance_miles DOUBLE PRECISION,
    user_name TEXT,
    beach_name TEXT
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
        ) / 1609.34) AS distance_miles, -- Convert meters to miles
        p.full_name AS user_name,
        COALESCE(b.name, 'Unknown Beach') AS beach_name
    FROM public.intel_posts ip
    LEFT JOIN public.profiles p ON p.id = ip.user_id
    LEFT JOIN public.beaches b ON b.id = ip.beach_id
    WHERE ip.is_active = true
      AND (ip.expires_at IS NULL OR ip.expires_at > NOW())
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(ip.longitude, ip.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
          radius_miles * 1609.34 -- Convert miles to meters
      )
      AND (tag_filter IS NULL OR ip.tag::TEXT = tag_filter)
    ORDER BY 
        ip.created_at DESC,
        ip.confirmations_count DESC,
        ip.id DESC
    LIMIT limit_count;
END;
$$;

COMMIT;


