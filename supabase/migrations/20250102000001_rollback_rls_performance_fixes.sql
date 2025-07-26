-- ROLLBACK Migration for RLS performance fixes
-- This can be used to revert the changes made in 20250102000000_fix_rls_performance_issues.sql
-- Only use this if there are issues with the performance optimizations

-- ================================================
-- ROLLBACK: Restore Original Intel Posts Policies
-- ================================================

-- Restore original intel_posts policies (without select wrapper)
DROP POLICY IF EXISTS "Users can insert their own intel posts" ON intel_posts;
DROP POLICY IF EXISTS "Users can update their own intel posts" ON intel_posts;
DROP POLICY IF EXISTS "Users can delete their own intel posts" ON intel_posts;

CREATE POLICY "Users can insert their own intel posts" ON intel_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intel posts" ON intel_posts
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own intel posts" ON intel_posts
    FOR DELETE USING (auth.uid() = user_id);

-- Restore original intel_post_confirmations policies (without select wrapper)
DROP POLICY IF EXISTS "Users can insert their own confirmations" ON intel_post_confirmations;
DROP POLICY IF EXISTS "Users can delete their own confirmations" ON intel_post_confirmations;

CREATE POLICY "Users can insert their own confirmations" ON intel_post_confirmations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own confirmations" ON intel_post_confirmations
    FOR DELETE USING (auth.uid() = user_id);

-- ================================================
-- ROLLBACK: Restore Original Multiple Policies
-- ================================================

-- Restore enhanced_forecasts multiple policies
DROP POLICY IF EXISTS "Public can view enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Anyone can view enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can manage enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can insert enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can update enhanced forecasts" ON enhanced_forecasts;
DROP POLICY IF EXISTS "Service role can delete enhanced forecasts" ON enhanced_forecasts;

CREATE POLICY "Anyone can view enhanced forecasts" ON enhanced_forecasts
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage enhanced forecasts" ON enhanced_forecasts
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND raw_app_meta_data->>'role' = 'admin'
        )
    );

-- Restore buoys multiple policies
DROP POLICY IF EXISTS "Public can view buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can manage buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can insert buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can update buoys" ON buoys;
DROP POLICY IF EXISTS "Service role can delete buoys" ON buoys;

CREATE POLICY "Service role can manage buoys" ON buoys
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Restore forecasts multiple policies
DROP POLICY IF EXISTS "Public can view forecasts" ON forecasts;
DROP POLICY IF EXISTS "Forecasts are viewable by everyone" ON forecasts;
DROP POLICY IF EXISTS "Anyone can view forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can manage forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can insert forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can update forecasts" ON forecasts;
DROP POLICY IF EXISTS "Service role can delete forecasts" ON forecasts;

CREATE POLICY "Forecasts are viewable by everyone" ON forecasts
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage forecasts" ON forecasts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ================================================
-- ROLLBACK: Remove Comments
-- ================================================

COMMENT ON TABLE intel_posts IS 'Community-generated surf intelligence and reports';
COMMENT ON TABLE intel_post_confirmations IS 'User confirmations of intel post accuracy';

-- Add rollback notification
DO $$
BEGIN
    RAISE NOTICE 'RLS Performance Optimization ROLLBACK Complete:';
    RAISE NOTICE '  ⚠️ Restored original auth function calls (may cause performance issues)';
    RAISE NOTICE '  ⚠️ Restored multiple permissive policies (may cause performance overhead)';
    RAISE NOTICE '  ⚠️ You may see Supabase linter warnings again';
END $$; 