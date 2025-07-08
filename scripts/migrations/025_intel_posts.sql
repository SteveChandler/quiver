-- Intel Posts Migration
-- Adds support for Local Intel Club feature

-- Create intel post tag enum
CREATE TYPE intel_post_tag AS ENUM ('parking', 'hazard', 'crowd', 'conditions', 'access', 'other');

-- Create intel_posts table
CREATE TABLE intel_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    tag intel_post_tag NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    photo_storage_path TEXT,
    confirmations_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intel_post_confirmations table
CREATE TABLE intel_post_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_post_id UUID NOT NULL REFERENCES intel_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(intel_post_id, user_id)
);

-- Create spatial index for geo-queries
CREATE INDEX intel_posts_location_idx ON intel_posts USING GIST (
    ST_Point(longitude, latitude)
);

-- Create other indexes for performance
CREATE INDEX intel_posts_user_id_idx ON intel_posts(user_id);
CREATE INDEX intel_posts_tag_idx ON intel_posts(tag);
CREATE INDEX intel_posts_created_at_idx ON intel_posts(created_at DESC);
CREATE INDEX intel_posts_is_active_idx ON intel_posts(is_active);
CREATE INDEX intel_post_confirmations_post_id_idx ON intel_post_confirmations(intel_post_id);
CREATE INDEX intel_post_confirmations_user_id_idx ON intel_post_confirmations(user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_intel_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intel_posts_updated_at_trigger
    BEFORE UPDATE ON intel_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_intel_posts_updated_at();

-- Create trigger to update confirmations count
CREATE OR REPLACE FUNCTION update_intel_post_confirmations_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE intel_posts 
        SET confirmations_count = confirmations_count + 1 
        WHERE id = NEW.intel_post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE intel_posts 
        SET confirmations_count = confirmations_count - 1 
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intel_post_confirmations_count_trigger
    AFTER INSERT OR DELETE ON intel_post_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION update_intel_post_confirmations_count();

-- Row Level Security
ALTER TABLE intel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_post_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for intel_posts
CREATE POLICY "Anyone can view active intel posts" ON intel_posts
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can insert their own intel posts" ON intel_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intel posts" ON intel_posts
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own intel posts" ON intel_posts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for intel_post_confirmations
CREATE POLICY "Anyone can view intel post confirmations" ON intel_post_confirmations
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own confirmations" ON intel_post_confirmations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own confirmations" ON intel_post_confirmations
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to get nearby intel posts
CREATE OR REPLACE FUNCTION get_nearby_intel_posts(
    center_lat DECIMAL,
    center_lng DECIMAL,
    radius_miles DECIMAL DEFAULT 5,
    tag_filter intel_post_tag DEFAULT NULL,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    latitude DECIMAL,
    longitude DECIMAL,
    tag intel_post_tag,
    title TEXT,
    description TEXT,
    photo_url TEXT,
    photo_storage_path TEXT,
    confirmations_count INTEGER,
    is_active BOOLEAN,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    distance_miles DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.latitude,
        p.longitude,
        p.tag,
        p.title,
        p.description,
        p.photo_url,
        p.photo_storage_path,
        p.confirmations_count,
        p.is_active,
        p.expires_at,
        p.created_at,
        p.updated_at,
        ROUND(
            (ST_Distance(
                ST_Point(center_lng, center_lat)::geography,
                ST_Point(p.longitude, p.latitude)::geography
            ) / 1609.344)::DECIMAL, 2
        ) AS distance_miles
    FROM intel_posts p
    WHERE 
        p.is_active = true
        AND (p.expires_at IS NULL OR p.expires_at > now())
        AND (tag_filter IS NULL OR p.tag = tag_filter)
        AND ST_DWithin(
            ST_Point(center_lng, center_lat)::geography,
            ST_Point(p.longitude, p.latitude)::geography,
            radius_miles * 1609.344
        )
    ORDER BY distance_miles ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_nearby_intel_posts TO authenticated;

COMMENT ON TABLE intel_posts IS 'Local Intel Club posts for surf conditions, hazards, parking, and crowd information';
COMMENT ON TABLE intel_post_confirmations IS 'User confirmations for intel posts to track accuracy';
COMMENT ON FUNCTION get_nearby_intel_posts IS 'Returns intel posts within a specified radius of a location'; 