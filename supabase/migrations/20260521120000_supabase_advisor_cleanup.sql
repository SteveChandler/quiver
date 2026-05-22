BEGIN;

-- Supabase Advisor cleanup.
--
-- This migration is intentionally transaction-safe so it can be rehearsed with
-- BEGIN -> body -> assertions -> ROLLBACK before the production COMMIT path.
--
-- Platform-only advisor items are not SQL-resolvable here:
-- - Auth leaked password protection must be enabled in Supabase Auth settings.
-- - Postgres version warnings must be resolved by a Supabase infrastructure upgrade.
-- - Extension relocation is split into scripts/db/extension-relocation-*.sql.
--   PostGIS 2.3+ is not normally relocatable with ALTER EXTENSION SET SCHEMA,
--   so it must be handled as a separate backup-backed platform step.

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- profiles_with_home_beach must respect the querying user's RLS context.
CREATE OR REPLACE VIEW public.profiles_with_home_beach
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.full_name,
  p.created_at,
  p.email_session_invites,
  p.inapp_session_invites,
  p.digest_session_invites,
  p.followers_count,
  p.following_count,
  p.is_mock,
  p.avatar_url,
  p.email,
  p.phone_number,
  p.bio,
  p.location,
  p.experience_level,
  p.instagram,
  p.updated_at,
  p.home_beach_id,
  p.onboarding_completed_at,
  b.name AS home_beach_name
FROM public.profiles p
LEFT JOIN public.beaches b ON b.id = p.home_beach_id;

GRANT SELECT ON public.profiles_with_home_beach TO authenticated, service_role;
REVOKE ALL ON public.profiles_with_home_beach FROM anon;

-- PostGIS may keep spatial_ref_sys in public if ALTER EXTENSION could not move it.
DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_select_all ON public.spatial_ref_sys';
    EXECUTE 'CREATE POLICY spatial_ref_sys_select_all ON public.spatial_ref_sys FOR SELECT USING (true)';
    EXECUTE 'GRANT SELECT ON public.spatial_ref_sys TO anon, authenticated, service_role';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not alter public.spatial_ref_sys privileges/RLS; verify extension owner before production apply';
END $$;

-- beach_dioramas is public video metadata used by web/native. Keep reads public,
-- but require RLS and avoid accidental client writes.
DO $$
BEGIN
  IF to_regclass('public.beach_dioramas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.beach_dioramas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.beach_dioramas FORCE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.beach_dioramas FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.beach_dioramas TO anon, authenticated, service_role';
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.beach_dioramas TO service_role';
    EXECUTE 'DROP POLICY IF EXISTS beach_dioramas_public_read ON public.beach_dioramas';
    EXECUTE 'DROP POLICY IF EXISTS beach_dioramas_service_role_all ON public.beach_dioramas';
    EXECUTE 'CREATE POLICY beach_dioramas_public_read ON public.beach_dioramas FOR SELECT USING (true)';
    EXECUTE $policy$
      CREATE POLICY beach_dioramas_service_role_all
      ON public.beach_dioramas
      FOR ALL
      USING ((select auth.jwt() ->> 'role') = 'service_role')
      WITH CHECK ((select auth.jwt() ->> 'role') = 'service_role')
    $policy$;
  END IF;
END $$;

-- Dev forensic audit data is retained but removed from client API visibility.
DO $$
BEGIN
  IF to_regclass('public.dev_session_mutation_audit') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.dev_session_mutation_audit ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.dev_session_mutation_audit FORCE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.dev_session_mutation_audit FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.dev_session_mutation_audit TO service_role';
    EXECUTE 'DROP POLICY IF EXISTS dev_session_mutation_audit_service_role_all ON public.dev_session_mutation_audit';
    EXECUTE $policy$
      CREATE POLICY dev_session_mutation_audit_service_role_all
      ON public.dev_session_mutation_audit
      FOR ALL
      USING ((select auth.jwt() ->> 'role') = 'service_role')
      WITH CHECK ((select auth.jwt() ->> 'role') = 'service_role')
    $policy$;
  END IF;
END $$;

-- Remove broad object-listing policies from public buckets. Direct public object
-- URLs continue to work because these buckets are public.
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Beach photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for diorama videos" ON storage.objects;
DROP POLICY IF EXISTS "Intel photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public can read ML artifacts" ON storage.objects;
DROP POLICY IF EXISTS "Session media are publicly readable" ON storage.objects;

-- Materialized views are hidden from PostgREST roles. Server code that still
-- needs them must use the service role client.
DO $$
DECLARE
  matview_name text;
BEGIN
  FOREACH matview_name IN ARRAY ARRAY[
    'observable_beaches',
    'beach_ml_performance_baseline',
    'mv_beach_amenities'
  ] LOOP
    IF to_regclass(format('public.%I', matview_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, authenticator',
        matview_name
      );
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', matview_name);
    END IF;
  END LOOP;
END $$;

-- Tighten the admin audit insert policy so it is not an unrestricted WITH CHECK.
DO $$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_log';
    EXECUTE $policy$
      CREATE POLICY "Service role can insert audit logs"
      ON public.admin_audit_log
      FOR INSERT
      WITH CHECK ((select auth.jwt() ->> 'role') = 'service_role')
    $policy$;
  END IF;
END $$;

-- Make the admin helper invoker-safe so public policies can call it without
-- exposing a SECURITY DEFINER RPC to anon.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (select auth.uid())
      AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

-- Fix mutable search_path on all public functions. This is intentionally broad:
-- the advisor warning is about role-mutable resolution, not only SECURITY DEFINER.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions, pg_temp',
      fn.nspname,
      fn.proname,
      fn.args
    );
  END LOOP;
END $$;

-- RPC grant model:
-- 1. Public-read RPCs are changed to SECURITY INVOKER and explicitly granted to
--    anon/authenticated, avoiding anon-executable SECURITY DEFINER warnings.
-- 2. Signed-in client RPCs keep authenticated execution only where current app
--    and native code call them directly.
-- 3. All remaining SECURITY DEFINER functions are service-role only.
CREATE TEMP TABLE quiver_advisor_public_rpc (name text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO quiver_advisor_public_rpc (name)
VALUES
  ('find_cities_by_pattern'),
  ('get_all_beach_locations'),
  ('get_beach_ml_performance'),
  ('get_beach_observation_station'),
  ('get_beach_review_stats'),
  ('get_beach_reviews'),
  ('get_beaches_by_location_with_scores'),
  ('get_cities_with_beach_skills'),
  ('get_city_editorial'),
  ('get_coach_picks'),
  ('get_current_production_model'),
  ('get_forecast_accuracy_stats'),
  ('get_intel_confirmations'),
  ('get_location_stats'),
  ('get_nearby_beaches'),
  ('get_nearby_buoys'),
  ('get_nearby_intel_posts'),
  ('get_nearest_buoy_with_conditions'),
  ('get_nowcast_anchors'),
  ('get_popular_beaches'),
  ('get_recent_check_ins'),
  ('get_yesterday_accuracy');

CREATE TEMP TABLE quiver_advisor_authenticated_rpc (name text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO quiver_advisor_authenticated_rpc (name)
VALUES
  ('compute_user_match_score'),
  ('compute_user_match_score_batch'),
  ('create_activity'),
  ('create_custom_spot_guarded'),
  ('finalize_anon_alert_capture'),
  ('follow_user_with_notification'),
  ('generate_referral_code'),
  ('get_most_visited_beach'),
  ('get_profile_stats'),
  ('get_referral_leaderboard'),
  ('get_user_activity_feed'),
  ('get_user_board_deck_stats'),
  ('get_user_match_candidates'),
  ('get_user_referral_stats'),
  ('get_user_session_match_comparison'),
  ('get_user_storage_stats'),
  ('like_session_with_notification'),
  ('notify_session_invite'),
  ('toggle_favorite_beach_guarded'),
  ('toggle_favorite_spot_guarded'),
  ('update_custom_spot_fingerprint');

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN quiver_advisor_public_rpc a ON a.name = p.proname
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SECURITY INVOKER', fn.nspname, fn.proname, fn.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon, authenticated, service_role', fn.nspname, fn.proname, fn.args);
  END LOOP;

  FOR fn IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', fn.nspname, fn.proname, fn.args);
  END LOOP;

  FOR fn IN
    SELECT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN quiver_advisor_authenticated_rpc a ON a.name = p.proname
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role', fn.nspname, fn.proname, fn.args);
  END LOOP;
END $$;

-- Remove service-role RLS policies where service_role bypasses RLS anyway, and
-- recreate user policies with InitPlan-safe auth wrappers.
DROP POLICY IF EXISTS "Service role has full access to email prefs" ON public.user_email_prefs;
DROP POLICY IF EXISTS "Users can view their own email prefs" ON public.user_email_prefs;
DROP POLICY IF EXISTS "Users can update their own email prefs" ON public.user_email_prefs;
DROP POLICY IF EXISTS "Users can insert their own email prefs" ON public.user_email_prefs;

CREATE POLICY "Users can view their own email prefs"
  ON public.user_email_prefs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own email prefs"
  ON public.user_email_prefs
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own email prefs"
  ON public.user_email_prefs
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role has full access to events" ON public.user_events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.user_events;
DROP POLICY IF EXISTS "Users can view their own events" ON public.user_events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.user_events;

CREATE POLICY "Users can insert their own events"
  ON public.user_events
  FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND allow_implicit_tracking = true
    )
  );

CREATE POLICY "Users can view their own events"
  ON public.user_events
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own events"
  ON public.user_events
  FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role has full access to preferences" ON public.user_implicit_preferences;
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_implicit_preferences;

CREATE POLICY "Users can view their own preferences"
  ON public.user_implicit_preferences
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage all preferences" ON public.user_surf_preferences;
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_surf_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_surf_preferences;

CREATE POLICY "Users can view their own preferences"
  ON public.user_surf_preferences
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.user_surf_preferences
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Consolidate duplicate sessions policies while preserving public sessions,
-- owner access, and admin access without SECURITY DEFINER helper calls.
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins can update any session" ON public.sessions;
DROP POLICY IF EXISTS "Admins can delete any session" ON public.sessions;
DROP POLICY IF EXISTS sessions_select_all ON public.sessions;
DROP POLICY IF EXISTS sessions_select_own ON public.sessions;
DROP POLICY IF EXISTS sessions_insert_own ON public.sessions;
DROP POLICY IF EXISTS sessions_update_own ON public.sessions;
DROP POLICY IF EXISTS sessions_delete_own ON public.sessions;
DROP POLICY IF EXISTS sessions_select_owner_public_or_admin ON public.sessions;
DROP POLICY IF EXISTS sessions_insert_owner_or_admin ON public.sessions;
DROP POLICY IF EXISTS sessions_update_owner_or_admin ON public.sessions;
DROP POLICY IF EXISTS sessions_delete_owner_or_admin ON public.sessions;

CREATE POLICY sessions_select_owner_public_or_admin
  ON public.sessions
  FOR SELECT
  USING (
    COALESCE(is_public, false)
    OR user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

CREATE POLICY sessions_insert_owner_or_admin
  ON public.sessions
  FOR INSERT
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

CREATE POLICY sessions_update_owner_or_admin
  ON public.sessions
  FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

CREATE POLICY sessions_delete_owner_or_admin
  ON public.sessions
  FOR DELETE
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

-- Consolidate duplicate session_media policies.
DROP POLICY IF EXISTS "Public can view media from public sessions" ON public.session_media;
DROP POLICY IF EXISTS "Users can view own media" ON public.session_media;
DROP POLICY IF EXISTS "Users can insert own media" ON public.session_media;
DROP POLICY IF EXISTS "Users can update own media" ON public.session_media;
DROP POLICY IF EXISTS "Users can delete own media" ON public.session_media;
DROP POLICY IF EXISTS "Admins can view all session media" ON public.session_media;
DROP POLICY IF EXISTS "Admins can update any session media" ON public.session_media;
DROP POLICY IF EXISTS "Admins can delete any session media" ON public.session_media;
DROP POLICY IF EXISTS media_cud_optimized ON public.session_media;
DROP POLICY IF EXISTS session_media_select_public_owner_or_admin ON public.session_media;
DROP POLICY IF EXISTS session_media_insert_owner ON public.session_media;
DROP POLICY IF EXISTS session_media_update_owner_or_admin ON public.session_media;
DROP POLICY IF EXISTS session_media_delete_owner_or_admin ON public.session_media;

CREATE POLICY session_media_select_public_owner_or_admin
  ON public.session_media
  FOR SELECT
  USING (
    (
      deleted_at IS NULL
      AND (
        session_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.sessions
          WHERE id = session_media.session_id
            AND COALESCE(is_public, false)
            AND deleted_at IS NULL
        )
      )
    )
    OR user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

CREATE POLICY session_media_insert_owner
  ON public.session_media
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY session_media_update_owner_or_admin
  ON public.session_media
  FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

CREATE POLICY session_media_delete_owner_or_admin
  ON public.session_media
  FOR DELETE
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
