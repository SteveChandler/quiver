-- Fix Supabase Performance Warnings
-- This migration addresses:
-- 1. Auth RLS InitPlan issues (optimize auth function calls)
-- 2. Multiple Permissive Policies (consolidate duplicate policies)
-- 3. Duplicate Index cleanup

-- ================================================
-- 1. Fix Auth RLS InitPlan Issues
-- Replace auth.uid() with (select auth.uid()) for better performance
-- ================================================

-- Enhanced Forecasts Table (will be fixed later in the migration with separate policies)
-- Buoys Table (will be fixed later in the migration with separate policies)

-- Comments Table
DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
CREATE POLICY "Users can insert their own comments" ON comments
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING ((select auth.uid()) = user_id);

-- Fix existing tables with performance issues
-- Beaches Table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beaches' AND policyname = 'Only admins can insert beaches') THEN
        DROP POLICY "Only admins can insert beaches" ON beaches;
        CREATE POLICY "Only admins can insert beaches" ON beaches
            FOR INSERT WITH CHECK (
                auth.jwt() ->> 'role' = 'service_role' OR
                EXISTS (
                    SELECT 1 FROM auth.users 
                    WHERE (select auth.uid()) = id 
                    AND raw_app_meta_data->>'role' = 'admin'
                )
            );
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beaches' AND policyname = 'Only admins can update beaches') THEN
        DROP POLICY "Only admins can update beaches" ON beaches;
        CREATE POLICY "Only admins can update beaches" ON beaches
            FOR UPDATE USING (
                auth.jwt() ->> 'role' = 'service_role' OR
                EXISTS (
                    SELECT 1 FROM auth.users 
                    WHERE (select auth.uid()) = id 
                    AND raw_app_meta_data->>'role' = 'admin'
                )
            );
    END IF;
END $$;

-- User Follows Table
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

-- Forecasts Table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forecasts' AND policyname = 'Only admins can insert forecasts') THEN
        DROP POLICY "Only admins can insert forecasts" ON forecasts;
        CREATE POLICY "Service role can insert forecasts" ON forecasts
            FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forecasts' AND policyname = 'Only admins can update forecasts') THEN
        DROP POLICY "Only admins can update forecasts" ON forecasts;
        CREATE POLICY "Service role can update forecasts" ON forecasts
            FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- Favorite Beaches Table
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

-- Boards Table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Boards are viewable by their owner') THEN
        DROP POLICY "Boards are viewable by their owner" ON boards;
        CREATE POLICY "Boards are viewable by their owner" ON boards
            FOR SELECT USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Boards are updatable by their owner') THEN
        DROP POLICY "Boards are updatable by their owner" ON boards;
        CREATE POLICY "Boards are updatable by their owner" ON boards
            FOR UPDATE USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Boards are deletable by their owner') THEN
        DROP POLICY "Boards are deletable by their owner" ON boards;
        CREATE POLICY "Boards are deletable by their owner" ON boards
            FOR DELETE USING ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Boards are insertable by their owner') THEN
        DROP POLICY "Boards are insertable by their owner" ON boards;
        CREATE POLICY "Boards are insertable by their owner" ON boards
            FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Session Likes Table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_likes' AND policyname = 'Users can like sessions') THEN
        DROP POLICY "Users can like sessions" ON session_likes;
        CREATE POLICY "Users can like sessions" ON session_likes
            FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_likes' AND policyname = 'Users can unlike sessions') THEN
        DROP POLICY "Users can unlike sessions" ON session_likes;
        CREATE POLICY "Users can unlike sessions" ON session_likes
            FOR DELETE USING ((select auth.uid()) = user_id);
    END IF;
END $$;

-- Session Media Table
DO $$
BEGIN
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
END $$;

-- Storage Usage Table
DO $$
BEGIN
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
END $$;

-- Beach Reviews Table
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

-- Profiles Table
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

-- User Activities Table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_activities' AND policyname = 'Users can insert their own activities') THEN
        DROP POLICY "Users can insert their own activities" ON user_activities;
        CREATE POLICY "Users can insert their own activities" ON user_activities
            FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    END IF;
END $$;

-- ================================================
-- 2. Fix Multiple Permissive Policies
-- Consolidate duplicate policies for better performance
-- ================================================

-- Buoys Table: Create separate policies to avoid duplicate SELECT policies
-- Keep only the public read policy for SELECT, separate policies for modifications
DROP POLICY IF EXISTS "Service role can manage buoys" ON buoys;

CREATE POLICY "Service role can insert buoys" ON buoys
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update buoys" ON buoys
    FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete buoys" ON buoys
    FOR DELETE USING (auth.jwt() ->> 'role' = 'service_role');

-- Enhanced Forecasts Table: Create separate policies to avoid duplicate SELECT policies  
DROP POLICY IF EXISTS "Service role can manage enhanced forecasts" ON enhanced_forecasts;

CREATE POLICY "Service role can insert enhanced forecasts" ON enhanced_forecasts
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update enhanced forecasts" ON enhanced_forecasts
    FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete enhanced forecasts" ON enhanced_forecasts
    FOR DELETE USING (auth.jwt() ->> 'role' = 'service_role');

-- Profiles Table: Consolidate duplicate SELECT policies
DO $$
BEGIN
    -- Remove the duplicate policy if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone') THEN
        DROP POLICY "Public profiles are viewable by everyone" ON profiles;
    END IF;
    
    -- Keep only "Users can view all profiles" for SELECT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view all profiles') THEN
        CREATE POLICY "Users can view all profiles" ON profiles
            FOR SELECT USING (true);
    END IF;
END $$;

-- ================================================
-- 3. Remove Duplicate Indexes
-- ================================================

-- Remove duplicate buoy indexes (keep the more specific one)
DROP INDEX IF EXISTS idx_buoys_uuid; -- Remove this one
-- Keep idx_buoys_buoy_uuid as it's more explicit

-- ================================================
-- 4. Success Message
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Performance optimizations applied successfully!';
    RAISE NOTICE '   - Fixed Auth RLS InitPlan issues (optimized auth function calls)';
    RAISE NOTICE '   - Consolidated multiple permissive policies';
    RAISE NOTICE '   - Removed duplicate indexes';
    RAISE NOTICE '   - All policies now use (select auth.uid()) for better performance';
END $$; 