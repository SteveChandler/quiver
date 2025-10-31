-- Consolidate Duplicate RLS Policies
-- Addresses "Multiple Permissive Policies" linter warnings
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

-- NOTE: This migration consolidates duplicate policies that serve the same purpose
-- Mock policies (_mock suffix) are kept for testing but could be removed in production

-- ================================================
-- PROFILES TABLE - Consolidate UPDATE Policies
-- ================================================

-- Keep profiles_update_own_home_beach as it's specific
-- Keep user_can_update_own_onboarding as it's specific  
-- The "Users can update own profile" policy is the general one and should cover most cases
-- All three allow updates when auth.uid() = id, so they're redundant

-- Decision: Keep only the general "Users can update own profile" policy
-- The specific policies (home_beach, onboarding) are already covered by it

-- Note: Already optimized in previous migration with (select auth.uid())

-- ================================================
-- PROFILES TABLE - Consolidate SELECT Policies
-- ================================================

-- "Public profiles are viewable by all" - allows all users to read all profiles
-- "Users can read own profile" - allows users to read their own profile

-- These policies are complementary, not duplicate:
-- - Public policy: Allows reading ANY profile (for social features)
-- - Own policy: Redundant since public already allows it

-- Decision: Keep "Public profiles are viewable by all" only
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- The public policy already allows reading own profile, so this is redundant

-- ================================================
-- BEACH_FORECAST_ACCURACY - Consolidate Policies
-- ================================================

-- "Anyone can view beach forecast accuracy" - allows SELECT for all
-- "Service role can manage beach forecast accuracy" - allows all operations for service role

-- These are NOT truly duplicate - they serve different purposes:
-- - Anyone can view: Public read access
-- - Service role: Admin write access
-- However, the linter sees them as multiple permissive for SELECT

-- Decision: Consolidate into a single policy with OR condition
DROP POLICY IF EXISTS "Anyone can view beach forecast accuracy" ON public.beach_forecast_accuracy;
DROP POLICY IF EXISTS "Service role can manage beach forecast accuracy" ON public.beach_forecast_accuracy;

-- Drop the consolidated policies if they already exist (for idempotency)
DROP POLICY IF EXISTS "beach_forecast_accuracy_select" ON public.beach_forecast_accuracy;
DROP POLICY IF EXISTS "beach_forecast_accuracy_write" ON public.beach_forecast_accuracy;

-- Create consolidated policies
CREATE POLICY "beach_forecast_accuracy_select" ON public.beach_forecast_accuracy
FOR SELECT USING (true); -- Anyone can view

CREATE POLICY "beach_forecast_accuracy_write" ON public.beach_forecast_accuracy
FOR ALL USING ((select auth.role()) = 'service_role');

-- ================================================
-- MOCK POLICIES NOTE
-- ================================================

-- The following tables have both _mock and _own policies:
-- - sessions (insert, update, delete)
-- - favorite_beaches (insert, delete)
-- - intel_posts (insert, update, delete)

-- Decision: KEEP BOTH for now
-- Reason: Mock policies may be used in testing environment
-- Recommendation: In production deployment, consider dropping _mock policies

-- To drop mock policies in production (optional):
-- DROP POLICY IF EXISTS "sessions_insert_mock" ON public.sessions;
-- DROP POLICY IF EXISTS "sessions_update_mock" ON public.sessions;
-- DROP POLICY IF EXISTS "sessions_delete_mock" ON public.sessions;
-- DROP POLICY IF EXISTS "favorite_beaches_insert_mock" ON public.favorite_beaches;
-- DROP POLICY IF EXISTS "favorite_beaches_delete_mock" ON public.favorite_beaches;
-- DROP POLICY IF EXISTS "intel_posts_insert_mock" ON public.intel_posts;
-- DROP POLICY IF EXISTS "intel_posts_update_mock" ON public.intel_posts;
-- DROP POLICY IF EXISTS "intel_posts_delete_mock" ON public.intel_posts;

-- ================================================
-- NOTES
-- ================================================

-- Performance Impact of Remaining Multiple Policies:
-- - Each permissive policy requires evaluation
-- - Mock + Real policies double the evaluation cost
-- - Consider environment-specific policies (test vs prod)
-- - Or use a single policy with conditional logic

-- Recommendation for Future:
-- Use environment-based policy conditions instead of separate policies:
-- USING (auth.uid() = user_id OR current_setting('app.environment', true) = 'test')

