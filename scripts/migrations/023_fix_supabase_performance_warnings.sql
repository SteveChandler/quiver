-- Fix Supabase Performance Advisor Warnings
-- This migration addresses:
-- 1. Auth RLS InitPlan issues (replace auth.uid() with (select auth.uid()))
-- 2. Multiple Permissive Policies (consolidate overlapping policies)
-- 3. Optimize performance for all affected tables

-- ================================================
-- 1. BEACHES TABLE - Fix Multiple Permissive Policies
-- ================================================

-- Drop all existing beaches policies to start fresh
DROP POLICY IF EXISTS "Beaches are viewable by everyone" ON beaches;
DROP POLICY IF EXISTS "Users can view beaches" ON beaches;
DROP POLICY IF EXISTS "Service role can manage all beaches" ON beaches;
DROP POLICY IF EXISTS "Only admins can insert beaches" ON beaches;
DROP POLICY IF EXISTS "Only admins can update beaches" ON beaches;
DROP POLICY IF EXISTS "Users can create their own beaches" ON beaches;
DROP POLICY IF EXISTS "Users can update their own beaches" ON beaches;
DROP POLICY IF EXISTS "Users can delete their own beaches" ON beaches;

-- Create consolidated, optimized policies for beaches
-- Public read access (consolidates all SELECT policies)
CREATE POLICY "Public can view beaches" ON beaches
    FOR SELECT USING (true);

-- User insert policy (authenticated users can create beaches)
CREATE POLICY "Authenticated users can create beaches" ON beaches
    FOR INSERT WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        (select auth.role()) IN ('authenticated', 'service_role')
    );

-- Admin/Service role update policy (only admins can update beaches)
CREATE POLICY "Admin can update beaches" ON beaches
    FOR UPDATE USING (
        (select auth.jwt()) ->> 'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE (select auth.uid()) = id 
            AND raw_app_meta_data->>'role' = 'admin'
        )
    );

-- Admin/Service role delete policy (only admins can delete beaches)
CREATE POLICY "Admin can delete beaches" ON beaches
    FOR DELETE USING (
        (select auth.jwt()) ->> 'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE (select auth.uid()) = id 
            AND raw_app_meta_data->>'role' = 'admin'
        )
    );

-- ================================================
-- 2. FORECASTS TABLE - Fix Auth RLS InitPlan
-- ================================================

-- Drop existing forecast policies
DROP POLICY IF EXISTS "Service role can insert forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can update forecasts" ON forecasts;
DROP POLICY IF EXISTS "Anyone can view forecasts" ON forecasts;

-- Create optimized forecast policies
CREATE POLICY "Public can view forecasts" ON forecasts
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage forecasts" ON forecasts
    FOR ALL USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- ================================================
-- 3. BUOYS TABLE - Fix Auth RLS InitPlan
-- ================================================

-- Drop existing buoy policies
DROP POLICY IF EXISTS "Service role can delete buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can insert buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can update buoys" ON buoys;
DROP POLICY IF EXISTS "Anyone can view buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can manage buoys" ON buoys;

-- Create optimized buoy policies
CREATE POLICY "Public can view buoys" ON buoys
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage buoys" ON buoys
    FOR ALL USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- ================================================
-- 4. ENHANCED_FORECASTS TABLE - Fix Auth RLS InitPlan
-- ================================================

-- Drop existing enhanced forecast policies
DROP POLICY IF EXISTS "Service role can delete enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can insert enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can update enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Anyone can view enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can manage enhanced forecasts" ON enhanced_forecasts;

-- Create optimized enhanced forecast policies
CREATE POLICY "Public can view enhanced forecasts" ON enhanced_forecasts
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage enhanced forecasts" ON enhanced_forecasts
    FOR ALL USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- ================================================
-- 5. OTHER TABLES - Fix Auth RLS InitPlan Issues
-- ================================================

-- Fix profiles table policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
        DROP POLICY "Users can update their own profile" ON profiles;
        CREATE POLICY "Users can update their own profile" ON profiles
            FOR UPDATE USING ((select auth.uid()) = id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile') THEN
        DROP POLICY "Users can insert their own profile" ON profiles;
        CREATE POLICY "Users can insert their own profile" ON profiles
            FOR INSERT WITH CHECK ((select auth.uid()) = id);
    END IF;
END $$;

-- Fix beach_reviews table policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beach_reviews' AND policyname = 'Users can insert their own beach reviews') THEN
        DROP POLICY "Users can insert their own beach reviews" ON beach_reviews;
        CREATE POLICY "Users can insert their own beach reviews" ON beach_reviews
            FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beach_reviews' AND policyname = 'Users can update their own beach reviews') THEN
        DROP POLICY "Users can update their own beach reviews" ON beach_reviews;
        CREATE POLICY "Users can update their own beach reviews" ON beach_reviews
            FOR UPDATE USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beach_reviews' AND policyname = 'Users can delete their own beach reviews') THEN
        DROP POLICY "Users can delete their own beach reviews" ON beach_reviews;
        CREATE POLICY "Users can delete their own beach reviews" ON beach_reviews
            FOR DELETE USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Fix boards table policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can view their own boards') THEN
        DROP POLICY "Users can view their own boards" ON boards;
        CREATE POLICY "Users can view their own boards" ON boards
            FOR SELECT USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can insert their own boards') THEN
        DROP POLICY "Users can insert their own boards" ON boards;
        CREATE POLICY "Users can insert their own boards" ON boards
            FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can update their own boards') THEN
        DROP POLICY "Users can update their own boards" ON boards;
        CREATE POLICY "Users can update their own boards" ON boards
            FOR UPDATE USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can delete their own boards') THEN
        DROP POLICY "Users can delete their own boards" ON boards;
        CREATE POLICY "Users can delete their own boards" ON boards
            FOR DELETE USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Fix sessions table policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Users can view their own sessions') THEN
        DROP POLICY "Users can view their own sessions" ON sessions;
        CREATE POLICY "Users can view their own sessions" ON sessions
            FOR SELECT USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Users can insert their own sessions') THEN
        DROP POLICY "Users can insert their own sessions" ON sessions;
        CREATE POLICY "Users can insert their own sessions" ON sessions
            FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Users can update their own sessions') THEN
        DROP POLICY "Users can update their own sessions" ON sessions;
        CREATE POLICY "Users can update their own sessions" ON sessions
            FOR UPDATE USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Users can delete their own sessions') THEN
        DROP POLICY "Users can delete their own sessions" ON sessions;
        CREATE POLICY "Users can delete their own sessions" ON sessions
            FOR DELETE USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Fix favorite_beaches table policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorite_beaches' AND policyname = 'Users can view their own favorite beaches') THEN
        DROP POLICY "Users can view their own favorite beaches" ON favorite_beaches;
        CREATE POLICY "Users can view their own favorite beaches" ON favorite_beaches
            FOR SELECT USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorite_beaches' AND policyname = 'Users can insert their own favorite beaches') THEN
        DROP POLICY "Users can insert their own favorite beaches" ON favorite_beaches;
        CREATE POLICY "Users can insert their own favorite beaches" ON favorite_beaches
            FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorite_beaches' AND policyname = 'Users can delete their own favorite beaches') THEN
        DROP POLICY "Users can delete their own favorite beaches" ON favorite_beaches;
        CREATE POLICY "Users can delete their own favorite beaches" ON favorite_beaches
            FOR DELETE USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Fix user_follows table policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_follows' AND policyname = 'Users can follow others') THEN
        DROP POLICY "Users can follow others" ON user_follows;
        CREATE POLICY "Users can follow others" ON user_follows
            FOR INSERT WITH CHECK ((select auth.uid()) = follower_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_follows' AND policyname = 'Users can unfollow others') THEN
        DROP POLICY "Users can unfollow others" ON user_follows;
        CREATE POLICY "Users can unfollow others" ON user_follows
            FOR DELETE USING ((select auth.uid()) = follower_id);
    END IF;
END $$;

-- Fix comments table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can insert their own comments') THEN
            DROP POLICY "Users can insert their own comments" ON comments;
            CREATE POLICY "Users can insert their own comments" ON comments
                FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can update their own comments') THEN
            DROP POLICY "Users can update their own comments" ON comments;
            CREATE POLICY "Users can update their own comments" ON comments
                FOR UPDATE USING ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can delete their own comments') THEN
            DROP POLICY "Users can delete their own comments" ON comments;
            CREATE POLICY "Users can delete their own comments" ON comments
                FOR DELETE USING ((select auth.uid()) = user_id);
        END IF;
    END IF;
END $$;

-- Fix session_comments table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_comments') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_comments' AND policyname = 'Users can insert their own session comments') THEN
            DROP POLICY "Users can insert their own session comments" ON session_comments;
            CREATE POLICY "Users can insert their own session comments" ON session_comments
                FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_comments' AND policyname = 'Users can update their own session comments') THEN
            DROP POLICY "Users can update their own session comments" ON session_comments;
            CREATE POLICY "Users can update their own session comments" ON session_comments
                FOR UPDATE USING ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_comments' AND policyname = 'Users can delete their own session comments') THEN
            DROP POLICY "Users can delete their own session comments" ON session_comments;
            CREATE POLICY "Users can delete their own session comments" ON session_comments
                FOR DELETE USING ((select auth.uid()) = user_id);
        END IF;
    END IF;
END $$;

-- Fix likes table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'likes') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'likes' AND policyname = 'Users can manage their own likes') THEN
            DROP POLICY "Users can manage their own likes" ON likes;
            CREATE POLICY "Users can manage their own likes" ON likes
                FOR ALL USING ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'likes' AND policyname = 'Users can insert their own likes') THEN
            DROP POLICY "Users can insert their own likes" ON likes;
            CREATE POLICY "Users can insert their own likes" ON likes
                FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'likes' AND policyname = 'Users can delete their own likes') THEN
            DROP POLICY "Users can delete their own likes" ON likes;
            CREATE POLICY "Users can delete their own likes" ON likes
                FOR DELETE USING ((select auth.uid()) = user_id);
        END IF;
    END IF;
END $$;

-- Fix user_activities table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activities') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_activities' AND policyname = 'Users can view their own activities') THEN
            DROP POLICY "Users can view their own activities" ON user_activities;
            CREATE POLICY "Users can view their own activities" ON user_activities
                FOR SELECT USING ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_activities' AND policyname = 'Users can insert their own activities') THEN
            DROP POLICY "Users can insert their own activities" ON user_activities;
            CREATE POLICY "Users can insert their own activities" ON user_activities
                FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
        END IF;
    END IF;
END $$;

-- Fix session_media table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_media') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_media' AND policyname = 'Users can manage their own session media') THEN
            DROP POLICY "Users can manage their own session media" ON session_media;
            CREATE POLICY "Users can manage their own session media" ON session_media
                FOR ALL USING ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_media' AND policyname = 'Users can insert their own session media') THEN
            DROP POLICY "Users can insert their own session media" ON session_media;
            CREATE POLICY "Users can insert their own session media" ON session_media
                FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_media' AND policyname = 'Users can update their own session media') THEN
            DROP POLICY "Users can update their own session media" ON session_media;
            CREATE POLICY "Users can update their own session media" ON session_media
                FOR UPDATE USING ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_media' AND policyname = 'Users can delete their own session media') THEN
            DROP POLICY "Users can delete their own session media" ON session_media;
            CREATE POLICY "Users can delete their own session media" ON session_media
                FOR DELETE USING ((select auth.uid()) = user_id);
        END IF;
    END IF;
END $$;

-- Fix storage_usage table policies (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_usage') THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'storage_usage' AND policyname = 'Users can view their own storage usage') THEN
            DROP POLICY "Users can view their own storage usage" ON storage_usage;
            CREATE POLICY "Users can view their own storage usage" ON storage_usage
                FOR SELECT USING ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'storage_usage' AND policyname = 'Users can update their own storage usage') THEN
            DROP POLICY "Users can update their own storage usage" ON storage_usage;
            CREATE POLICY "Users can update their own storage usage" ON storage_usage
                FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'storage_usage' AND policyname = 'Users can update their own storage usage records') THEN
            DROP POLICY "Users can update their own storage usage records" ON storage_usage;
            CREATE POLICY "Users can update their own storage usage records" ON storage_usage
                FOR UPDATE USING ((select auth.uid()) = user_id);
        END IF;
    END IF;
END $$;

-- ================================================
-- 6. VALIDATION & SUCCESS MESSAGE
-- ================================================

-- Validate that RLS is enabled on all tables
DO $$
DECLARE
    table_name text;
    tables_checked integer := 0;
    tables_with_rls integer := 0;
BEGIN
    FOR table_name IN 
        SELECT t.table_name 
        FROM information_schema.tables t 
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    LOOP
        tables_checked := tables_checked + 1;
        
        IF EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = table_name 
            AND rowsecurity = true
        ) THEN
            tables_with_rls := tables_with_rls + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Performance optimization complete!';
    RAISE NOTICE '   - Fixed Auth RLS InitPlan issues (replaced auth.uid() with (select auth.uid()))';
    RAISE NOTICE '   - Consolidated Multiple Permissive Policies on beaches table';
    RAISE NOTICE '   - Optimized policies for all affected tables';
    RAISE NOTICE '   - Validated tables with RLS enabled: %/%', tables_with_rls, tables_checked;
    RAISE NOTICE '   - All Supabase performance warnings should now be resolved';
END $$;

-- Add migration timestamp
COMMENT ON SCHEMA public IS 'Last performance optimization: 2025-01-27 - Fixed Supabase Performance Advisor warnings'; 