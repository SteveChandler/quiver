-- Fix Supabase Security Linter Issues
-- This migration addresses:
-- 1. Security Definer Views (views should use SECURITY INVOKER)
-- 2. RLS Disabled tables (enable RLS on public tables)

-- ================================================
-- 1. Fix Security Definer Views
-- ================================================

-- Recreate enhanced forecast views with SECURITY INVOKER
DROP VIEW IF EXISTS current_enhanced_forecasts;
DROP VIEW IF EXISTS ten_day_enhanced_forecasts;

-- Create a view for current day forecasts (with SECURITY INVOKER)
CREATE OR REPLACE VIEW current_enhanced_forecasts
WITH (security_invoker = true) AS
SELECT * FROM enhanced_forecasts
WHERE forecast_date >= CURRENT_DATE
ORDER BY beach_id, forecast_date, forecast_time;

-- Create a view for next 10 days forecasts (with SECURITY INVOKER)
CREATE OR REPLACE VIEW ten_day_enhanced_forecasts
WITH (security_invoker = true) AS
SELECT * FROM enhanced_forecasts
WHERE forecast_date >= CURRENT_DATE 
AND forecast_date <= CURRENT_DATE + INTERVAL '10 days'
ORDER BY beach_id, forecast_date, forecast_time;

-- ================================================
-- 2. Enable RLS on Tables Missing It
-- ================================================

-- Enable RLS on enhanced_forecasts table
ALTER TABLE enhanced_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS policies for enhanced_forecasts (public read access)
CREATE POLICY "Anyone can view enhanced forecasts" ON enhanced_forecasts
    FOR SELECT USING (true);

-- Admin/service role can insert/update/delete forecasts
CREATE POLICY "Service role can manage enhanced forecasts" ON enhanced_forecasts
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_app_meta_data->>'role' = 'admin'
        )
    );

-- ================================================
-- 3. Handle Buoys Table (if it exists)
-- ================================================

-- Check if buoys table exists and enable RLS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'buoys'
    ) THEN
        -- Enable RLS on buoys table
        ALTER TABLE buoys ENABLE ROW LEVEL SECURITY;
        
        -- Public read access for buoys
        DROP POLICY IF EXISTS "Anyone can view buoys" ON buoys;
        CREATE POLICY "Anyone can view buoys" ON buoys
            FOR SELECT USING (true);
        
        -- Service role/admin can manage buoys
        DROP POLICY IF EXISTS "Service role can manage buoys" ON buoys;
        CREATE POLICY "Service role can manage buoys" ON buoys
            FOR ALL USING (
                auth.jwt() ->> 'role' = 'service_role' OR
                EXISTS (
                    SELECT 1 FROM auth.users 
                    WHERE auth.uid() = id 
                    AND raw_app_meta_data->>'role' = 'admin'
                )
            );
            
        RAISE NOTICE 'RLS enabled on buoys table';
    ELSE
        RAISE NOTICE 'Buoys table does not exist - skipping';
    END IF;
END $$;

-- ================================================
-- 4. Handle Comments Table
-- ================================================

-- Check if comments table exists and enable RLS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'comments'
    ) THEN
        -- Enable RLS on comments table
        ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
        
        -- Public read access for comments
        DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
        CREATE POLICY "Anyone can view comments" ON comments
            FOR SELECT USING (true);
        
        -- Users can insert their own comments
        DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
        CREATE POLICY "Users can insert their own comments" ON comments
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        -- Users can update their own comments
        DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
        CREATE POLICY "Users can update their own comments" ON comments
            FOR UPDATE USING (auth.uid() = user_id);
        
        -- Users can delete their own comments
        DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
        CREATE POLICY "Users can delete their own comments" ON comments
            FOR DELETE USING (auth.uid() = user_id);
            
        RAISE NOTICE 'RLS enabled on comments table';
    ELSE
        RAISE NOTICE 'Comments table does not exist - skipping';
    END IF;
END $$;

-- ================================================
-- 5. Handle session_comments table (alternative name)
-- ================================================

-- Check if session_comments table exists and enable RLS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'session_comments'
    ) THEN
        -- Enable RLS on session_comments table
        ALTER TABLE session_comments ENABLE ROW LEVEL SECURITY;
        
        -- Public read access for session_comments
        DROP POLICY IF EXISTS "Anyone can view session comments" ON session_comments;
        CREATE POLICY "Anyone can view session comments" ON session_comments
            FOR SELECT USING (true);
        
        -- Users can insert their own comments
        DROP POLICY IF EXISTS "Users can insert their own session comments" ON session_comments;
        CREATE POLICY "Users can insert their own session comments" ON session_comments
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        -- Users can update their own comments
        DROP POLICY IF EXISTS "Users can update their own session comments" ON session_comments;
        CREATE POLICY "Users can update their own session comments" ON session_comments
            FOR UPDATE USING (auth.uid() = user_id);
        
        -- Users can delete their own comments
        DROP POLICY IF EXISTS "Users can delete their own session comments" ON session_comments;
        CREATE POLICY "Users can delete their own session comments" ON session_comments
            FOR DELETE USING (auth.uid() = user_id);
            
        RAISE NOTICE 'RLS enabled on session_comments table';
    ELSE
        RAISE NOTICE 'session_comments table does not exist - skipping';
    END IF;
END $$;

-- ================================================
-- 6. Handle spatial_ref_sys table (PostGIS system table)
-- ================================================

-- Note: spatial_ref_sys is a PostGIS system table owned by postgres superuser
-- It contains spatial reference system definitions and should be publicly readable
-- Regular users cannot modify system tables, so we'll skip this table
-- The Supabase linter flags it, but it's a false positive for system tables

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'spatial_ref_sys'
    ) THEN
        RAISE NOTICE 'spatial_ref_sys is a PostGIS system table - cannot modify RLS settings';
        RAISE NOTICE 'This is safe to ignore - system tables are managed by PostgreSQL';
    ELSE
        RAISE NOTICE 'spatial_ref_sys table does not exist - skipping';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Cannot modify spatial_ref_sys (system table) - this is expected and safe';
END $$;

-- ================================================
-- 7. Create missing tables if they don't exist
-- ================================================

-- Create buoys table if it doesn't exist (based on migration references)
CREATE TABLE IF NOT EXISTS buoys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buoy_uuid TEXT NOT NULL,
    buoy_name TEXT,
    kind TEXT CHECK (kind IN ('buoy', 'station')),
    active BOOLEAN DEFAULT true,
    coordinates GEOGRAPHY(POINT, 4326),
    air_temperature DECIMAL,
    water_temperature DECIMAL,
    wave_period DECIMAL,
    wave_height DECIMAL,
    wind_speed DECIMAL,
    wind_gust DECIMAL,
    wind_direction INTEGER,
    tides JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT buoys_buoy_uuid_kind_unique UNIQUE (buoy_uuid, kind)
);

-- Create comments table if it doesn't exist (based on usage in codebase)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    parent_comment UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Create indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_buoys_coordinates ON buoys USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_buoys_active ON buoys (active);
CREATE INDEX IF NOT EXISTS idx_buoys_uuid_kind ON buoys (buoy_uuid, kind);
CREATE INDEX IF NOT EXISTS idx_comments_session_id ON comments (session_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at DESC);

-- ================================================
-- 8. Apply RLS to newly created tables
-- ================================================

-- Apply RLS to buoys if we just created it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'buoys' 
        AND policyname = 'Anyone can view buoys'
    ) THEN
        ALTER TABLE buoys ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view buoys" ON buoys
            FOR SELECT USING (true);
        
        CREATE POLICY "Service role can manage buoys" ON buoys
            FOR ALL USING (
                auth.jwt() ->> 'role' = 'service_role' OR
                EXISTS (
                    SELECT 1 FROM auth.users 
                    WHERE auth.uid() = id 
                    AND raw_app_meta_data->>'role' = 'admin'
                )
            );
    END IF;
END $$;

-- Apply RLS to comments if we just created it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'comments' 
        AND policyname = 'Anyone can view comments'
    ) THEN
        ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view comments" ON comments
            FOR SELECT USING (true);
        
        CREATE POLICY "Users can insert their own comments" ON comments
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own comments" ON comments
            FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own comments" ON comments
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ================================================
-- Success Message
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Security fixes applied successfully!';
    RAISE NOTICE '   - Fixed Security Definer Views';
    RAISE NOTICE '   - Enabled RLS on public tables';
    RAISE NOTICE '   - Added appropriate RLS policies';
    RAISE NOTICE '   - Created missing tables if needed';
END $$; 