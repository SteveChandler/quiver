-- Migration to fix RLS performance issues identified by Supabase database linter
-- This addresses:
-- 1. Auth RLS InitPlan issues (replace auth.uid() with (select auth.uid()))
-- 2. Multiple permissive policies (consolidate redundant policies)

-- ================================================
-- 1. Fix Auth RLS InitPlan Issues
-- ================================================

-- INTEL_POSTS TABLE - Fix auth.uid() calls
DROP POLICY IF EXISTS "Users can insert their own intel posts" ON intel_posts;
DROP POLICY IF EXISTS "Users can update their own intel posts" ON intel_posts;
DROP POLICY IF EXISTS "Users can delete their own intel posts" ON intel_posts;

CREATE POLICY "Users can insert their own intel posts" ON intel_posts
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own intel posts" ON intel_posts
    FOR UPDATE USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own intel posts" ON intel_posts
    FOR DELETE USING ((select auth.uid()) = user_id);

-- INTEL_POST_CONFIRMATIONS TABLE - Fix auth.uid() calls
DROP POLICY IF EXISTS "Users can insert their own confirmations" ON intel_post_confirmations;
DROP POLICY IF EXISTS "Users can delete their own confirmations" ON intel_post_confirmations;

CREATE POLICY "Users can insert their own confirmations" ON intel_post_confirmations
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own confirmations" ON intel_post_confirmations
    FOR DELETE USING ((select auth.uid()) = user_id);

-- ENHANCED_FORECASTS TABLE - Ensure service role policy uses select wrapper
DROP POLICY IF EXISTS "Service role can manage enhanced forecasts" ON enhanced_forecasts;

CREATE POLICY "Service role can manage enhanced forecasts" ON enhanced_forecasts
    FOR ALL USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- ================================================
-- 2. Fix Multiple Permissive Policies
-- ================================================

-- BUOYS TABLE - Consolidate multiple SELECT policies
-- Remove redundant policies, keep only the essential ones
DROP POLICY IF EXISTS "Service role can manage buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can insert buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can update buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can delete buoys" ON buoys;

-- Keep the public read policy, create separate policies for service role operations
CREATE POLICY "Service role can insert buoys" ON buoys
    FOR INSERT WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "Service role can update buoys" ON buoys
    FOR UPDATE USING ((select auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete buoys" ON buoys
    FOR DELETE USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- ENHANCED_FORECASTS TABLE - Consolidate multiple SELECT policies
-- Remove redundant policies
DROP POLICY IF EXISTS "Anyone can view enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can insert enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can update enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can delete enhanced forecasts" ON enhanced_forecasts;

-- Keep single public read policy and separate service role policies
-- "Public can view enhanced forecasts" should remain as the single SELECT policy

CREATE POLICY "Service role can insert enhanced forecasts" ON enhanced_forecasts
    FOR INSERT WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "Service role can update enhanced forecasts" ON enhanced_forecasts
    FOR UPDATE USING ((select auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete enhanced forecasts" ON enhanced_forecasts
    FOR DELETE USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- FORECASTS TABLE - Consolidate multiple SELECT policies
-- Remove redundant policies
DROP POLICY IF EXISTS "Forecasts are viewable by everyone" ON forecasts;
DROP POLICY IF EXISTS "Anyone can view forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can insert forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can update forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can delete forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can manage forecasts" ON forecasts;

-- Keep single public read policy and separate service role policies
-- "Public can view forecasts" should remain as the single SELECT policy
CREATE POLICY "Service role can insert forecasts" ON forecasts
    FOR INSERT WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "Service role can update forecasts" ON forecasts
    FOR UPDATE USING ((select auth.jwt()) ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete forecasts" ON forecasts
    FOR DELETE USING ((select auth.jwt()) ->> 'role' = 'service_role');

-- ================================================
-- 3. Add Comments for Transparency
-- ================================================

COMMENT ON TABLE intel_posts IS 'Intel posts with optimized RLS policies for performance';
COMMENT ON TABLE intel_post_confirmations IS 'Intel post confirmations with optimized RLS policies for performance';

-- Add success notification
DO $$
BEGIN
    RAISE NOTICE 'RLS Performance Optimization Complete:';
    RAISE NOTICE '  ✓ Fixed Auth RLS InitPlan issues (wrapped auth functions with select)';
    RAISE NOTICE '  ✓ Consolidated multiple permissive policies for better performance';
    RAISE NOTICE '  ✓ Affected tables: intel_posts, intel_post_confirmations, enhanced_forecasts, buoys, forecasts';
END $$; 