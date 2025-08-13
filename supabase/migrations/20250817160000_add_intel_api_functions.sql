-- Add functions for intel and review APIs
-- Enables the frontend to query community-generated content

BEGIN;

-- Function to get nearby intel posts
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
        ip.confirmations_count DESC,
        ip.created_at DESC
    LIMIT limit_count;
END;
$$;

-- Function to get beach reviews with pagination
CREATE OR REPLACE FUNCTION get_beach_reviews(
    target_beach_id UUID,
    offset_count INTEGER DEFAULT 0,
    limit_count INTEGER DEFAULT 10,
    min_rating INTEGER DEFAULT 1
)
RETURNS TABLE(
    id UUID,
    beach_id UUID,
    user_id UUID,
    overall_rating INTEGER,
    wave_quality_rating INTEGER,
    crowd_density_rating INTEGER,
    parking_rating INTEGER,
    accessibility_rating INTEGER,
    title VARCHAR(255),
    content TEXT,
    visit_date DATE,
    helpful_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    user_name TEXT,
    beach_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.id,
        br.beach_id,
        br.user_id,
        br.overall_rating,
        br.wave_quality_rating,
        br.crowd_density_rating,
        br.parking_rating,
        br.accessibility_rating,
        br.title,
        br.content,
        br.visit_date,
        br.helpful_count,
        br.created_at,
        br.updated_at,
        p.full_name AS user_name,
        b.name AS beach_name
    FROM public.beach_reviews br
    LEFT JOIN public.profiles p ON p.id = br.user_id
    LEFT JOIN public.beaches b ON b.id = br.beach_id
    WHERE (target_beach_id IS NULL OR br.beach_id = target_beach_id)
      AND br.overall_rating >= min_rating
    ORDER BY 
        br.helpful_count DESC,
        br.created_at DESC
    OFFSET offset_count
    LIMIT limit_count;
END;
$$;

-- Function to get beach review summary statistics
CREATE OR REPLACE FUNCTION get_beach_review_stats(target_beach_id UUID)
RETURNS TABLE(
    beach_id UUID,
    total_reviews INTEGER,
    average_overall_rating DECIMAL(3,2),
    average_wave_quality DECIMAL(3,2),
    average_crowd_density DECIMAL(3,2),
    average_parking DECIMAL(3,2),
    average_accessibility DECIMAL(3,2),
    rating_distribution JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        target_beach_id,
        COUNT(*)::INTEGER AS total_reviews,
        ROUND(AVG(br.overall_rating)::DECIMAL, 2) AS average_overall_rating,
        ROUND(AVG(br.wave_quality_rating)::DECIMAL, 2) AS average_wave_quality,
        ROUND(AVG(br.crowd_density_rating)::DECIMAL, 2) AS average_crowd_density,
        ROUND(AVG(br.parking_rating)::DECIMAL, 2) AS average_parking,
        ROUND(AVG(br.accessibility_rating)::DECIMAL, 2) AS average_accessibility,
        jsonb_build_object(
            '5_star', COUNT(*) FILTER (WHERE br.overall_rating = 5),
            '4_star', COUNT(*) FILTER (WHERE br.overall_rating = 4),
            '3_star', COUNT(*) FILTER (WHERE br.overall_rating = 3),
            '2_star', COUNT(*) FILTER (WHERE br.overall_rating = 2),
            '1_star', COUNT(*) FILTER (WHERE br.overall_rating = 1)
        ) AS rating_distribution
    FROM public.beach_reviews br
    WHERE br.beach_id = target_beach_id;
END;
$$;

-- Function to get intel post confirmations
CREATE OR REPLACE FUNCTION get_intel_confirmations(target_post_id UUID)
RETURNS TABLE(
    id UUID,
    intel_post_id UUID,
    user_id UUID,
    user_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ipc.id,
        ipc.intel_post_id,
        ipc.user_id,
        p.full_name AS user_name,
        ipc.created_at
    FROM public.intel_post_confirmations ipc
    LEFT JOIN public.profiles p ON p.id = ipc.user_id
    WHERE ipc.intel_post_id = target_post_id
    ORDER BY ipc.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_nearby_intel_posts(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, DOUBLE PRECISION, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_intel_posts(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, DOUBLE PRECISION, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_beach_reviews(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_beach_reviews(UUID, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_beach_review_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_beach_review_stats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_intel_confirmations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_intel_confirmations(UUID) TO service_role;

COMMIT;