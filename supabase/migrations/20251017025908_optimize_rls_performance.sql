-- Optimize RLS Performance - Fix Auth InitPlan Issues
-- Replace auth.uid() with (select auth.uid()) in RLS policies
-- This prevents PostgreSQL from re-evaluating auth.uid() for every row
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

-- ================================================
-- PROFILES TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own_home_beach" ON public.profiles;
CREATE POLICY "profiles_update_own_home_beach" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "user_can_update_own_onboarding" ON public.profiles;
CREATE POLICY "user_can_update_own_onboarding" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id);

-- ================================================
-- PUSH_DEVICES TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "push_devices_select_own" ON public.push_devices;
CREATE POLICY "push_devices_select_own" ON public.push_devices
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "push_devices_insert_own" ON public.push_devices;
CREATE POLICY "push_devices_insert_own" ON public.push_devices
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "push_devices_update_own" ON public.push_devices;
CREATE POLICY "push_devices_update_own" ON public.push_devices
FOR UPDATE USING ((select auth.uid()) = user_id);

-- ================================================
-- SESSIONS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "sessions_insert_mock" ON public.sessions;
CREATE POLICY "sessions_insert_mock" ON public.sessions
FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "sessions_update_mock" ON public.sessions;
CREATE POLICY "sessions_update_mock" ON public.sessions
FOR UPDATE USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "sessions_delete_mock" ON public.sessions;
CREATE POLICY "sessions_delete_mock" ON public.sessions
FOR DELETE USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
CREATE POLICY "sessions_insert_own" ON public.sessions
FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
CREATE POLICY "sessions_update_own" ON public.sessions
FOR UPDATE USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;
CREATE POLICY "sessions_delete_own" ON public.sessions
FOR DELETE USING ((select auth.uid()) = profile_id);

-- ================================================
-- USER_DEVICES TABLE POLICIES  
-- ================================================

DROP POLICY IF EXISTS "Users can insert their own devices" ON public.user_devices;
CREATE POLICY "Users can insert their own devices" ON public.user_devices
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_devices;
CREATE POLICY "Users can view their own devices" ON public.user_devices
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own devices" ON public.user_devices;
CREATE POLICY "Users can delete their own devices" ON public.user_devices
FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own devices" ON public.user_devices;
CREATE POLICY "Users can update their own devices" ON public.user_devices
FOR UPDATE USING ((select auth.uid()) = user_id);

-- ================================================
-- FAVORITE_BEACHES TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "favorite_beaches_insert_mock" ON public.favorite_beaches;
CREATE POLICY "favorite_beaches_insert_mock" ON public.favorite_beaches
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "favorite_beaches_delete_mock" ON public.favorite_beaches;
CREATE POLICY "favorite_beaches_delete_mock" ON public.favorite_beaches
FOR DELETE USING ((select auth.uid()) = user_id);

-- ================================================
-- NOTIFICATIONS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING ((select auth.uid()) = user_id);

-- ================================================
-- SPOT_FEEDBACK TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "spot_feedback_insert_own" ON public.spot_feedback;
CREATE POLICY "spot_feedback_insert_own" ON public.spot_feedback
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "spot_feedback_select_own" ON public.spot_feedback;
CREATE POLICY "spot_feedback_select_own" ON public.spot_feedback
FOR SELECT USING ((select auth.uid()) = user_id);

-- ================================================
-- INTEL_POSTS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "intel_posts_insert_mock" ON public.intel_posts;
CREATE POLICY "intel_posts_insert_mock" ON public.intel_posts
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "intel_posts_update_mock" ON public.intel_posts;
CREATE POLICY "intel_posts_update_mock" ON public.intel_posts
FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "intel_posts_delete_mock" ON public.intel_posts;
CREATE POLICY "intel_posts_delete_mock" ON public.intel_posts
FOR DELETE USING ((select auth.uid()) = user_id);

-- ================================================
-- USER_FOLLOWS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
CREATE POLICY "Users can follow others" ON public.user_follows
FOR INSERT WITH CHECK ((select auth.uid()) = follower_id);

DROP POLICY IF EXISTS "Users can unfollow others" ON public.user_follows;
CREATE POLICY "Users can unfollow others" ON public.user_follows
FOR DELETE USING ((select auth.uid()) = follower_id);

-- ================================================
-- SESSION_FORECAST_SNAPSHOTS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Users can view their own session forecast snapshots" ON public.session_forecast_snapshots;
CREATE POLICY "Users can view their own session forecast snapshots" ON public.session_forecast_snapshots
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own session forecast snapshots" ON public.session_forecast_snapshots;
CREATE POLICY "Users can insert their own session forecast snapshots" ON public.session_forecast_snapshots
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own session forecast snapshots" ON public.session_forecast_snapshots;
CREATE POLICY "Users can update their own session forecast snapshots" ON public.session_forecast_snapshots
FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own session forecast snapshots" ON public.session_forecast_snapshots;
CREATE POLICY "Users can delete their own session forecast snapshots" ON public.session_forecast_snapshots
FOR DELETE USING ((select auth.uid()) = user_id);

-- ================================================
-- BEACH_FORECAST_ACCURACY TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "Service role can manage beach forecast accuracy" ON public.beach_forecast_accuracy;
CREATE POLICY "Service role can manage beach forecast accuracy" ON public.beach_forecast_accuracy
FOR ALL USING ((select auth.role()) = 'service_role');

-- ================================================
-- USER_ACTIVITIES TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "user_activities_insert_own" ON public.user_activities;
CREATE POLICY "user_activities_insert_own" ON public.user_activities
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ================================================
-- COMMENTS TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own" ON public.comments
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
CREATE POLICY "comments_update_own" ON public.comments
FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own" ON public.comments
FOR DELETE USING ((select auth.uid()) = user_id);

-- ================================================
-- SESSION_LIKES TABLE POLICIES
-- ================================================

DROP POLICY IF EXISTS "session_likes_insert_own" ON public.session_likes;
CREATE POLICY "session_likes_insert_own" ON public.session_likes
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "session_likes_delete_own" ON public.session_likes;
CREATE POLICY "session_likes_delete_own" ON public.session_likes
FOR DELETE USING ((select auth.uid()) = user_id);

-- ================================================
-- PERFORMANCE FIX: Remove Duplicate Index
-- ================================================

-- Drop the duplicate index on enhanced_forecasts
-- Keep idx_enhanced_forecasts_beach_date_time_optimized (newer, better name)
DROP INDEX IF EXISTS public.idx_enhanced_forecasts_beach_date_time;

-- Notes:
-- - Wrapped all auth.uid() calls with (select auth.uid())
-- - This causes PostgreSQL to evaluate auth.uid() once per query instead of once per row
-- - Significant performance improvement for tables with many rows
-- - No functional changes, purely performance optimization
-- - Removed duplicate index to reduce database overhead

