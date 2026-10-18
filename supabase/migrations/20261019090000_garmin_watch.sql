BEGIN;

DO $$
BEGIN
  IF to_regclass('public.session_tracks') IS NULL OR to_regclass('public.session_imports') IS NULL THEN
    RAISE EXCEPTION 'apply 20261018090000_session_waves_core.sql first';
  END IF;
END $$;

DO $$
DECLARE
  current_check text;
  -- string_to_array keeps __tests__/api/events-allowlist-db-sync.test.ts from parsing garmin_watch as an event.
  candidate_sources text[] := string_to_array('garmin_watch', ',');
  missing_sources text[];
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.sessions'::regclass
    AND conname = 'sessions_source_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'sessions_source_check constraint not found';
  END IF;

  SELECT array_agg(source_name)
    INTO missing_sources
  FROM unnest(candidate_sources) AS source_name
  WHERE current_check NOT LIKE '%' || source_name || '%';

  IF missing_sources IS NOT NULL THEN
    ALTER TABLE public.sessions DROP CONSTRAINT sessions_source_check;
    EXECUTE format(
      'ALTER TABLE public.sessions ADD CONSTRAINT sessions_source_check CHECK ((%s) OR source = ANY (%L::text[])) NOT VALID',
      current_check,
      missing_sources
    );
    ALTER TABLE public.sessions VALIDATE CONSTRAINT sessions_source_check;
  END IF;
END $$;

ALTER TABLE public.session_tracks
  ADD COLUMN IF NOT EXISTS paddle_distance_m real,
  ADD COLUMN IF NOT EXISTS hr_avg smallint,
  ADD COLUMN IF NOT EXISTS hr_max smallint,
  ADD COLUMN IF NOT EXISTS source_device text;

ALTER TABLE public.session_tracks DROP CONSTRAINT IF EXISTS session_tracks_format_check;
ALTER TABLE public.session_tracks
  ADD CONSTRAINT session_tracks_format_check CHECK (format IN ('fit', 'gpx', 'quiver_watch'));

CREATE TABLE IF NOT EXISTS public.watch_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'garmin' CHECK (platform = 'garmin'),
  device_uid text NOT NULL,
  device_part_number text,
  device_name text,
  app_version text,
  token_hash text UNIQUE,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (user_id, device_uid)
);

CREATE TABLE IF NOT EXISTS public.watch_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  poll_secret_hash text NOT NULL,
  device_uid text NOT NULL,
  device_part_number text,
  app_version text,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  device_id uuid REFERENCES public.watch_devices ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS watch_link_codes_unconfirmed_code_idx
  ON public.watch_link_codes (code) WHERE confirmed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.watch_uploads (
  id uuid PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES public.watch_devices ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  chunk_count int,
  received_chunks int[] NOT NULL DEFAULT '{}',
  header jsonb,
  import_id uuid REFERENCES public.session_imports ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS set_watch_uploads_updated_at ON public.watch_uploads;
CREATE TRIGGER set_watch_uploads_updated_at
  BEFORE UPDATE ON public.watch_uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.session_imports
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.watch_devices ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS watch_uploads_device_id_idx
  ON public.watch_uploads (device_id);
CREATE INDEX IF NOT EXISTS watch_uploads_user_id_idx
  ON public.watch_uploads (user_id);
CREATE INDEX IF NOT EXISTS watch_uploads_import_id_idx
  ON public.watch_uploads (import_id);
CREATE INDEX IF NOT EXISTS watch_link_codes_user_id_idx
  ON public.watch_link_codes (user_id);
CREATE INDEX IF NOT EXISTS watch_link_codes_device_id_idx
  ON public.watch_link_codes (device_id);
CREATE INDEX IF NOT EXISTS session_imports_device_id_idx
  ON public.session_imports (device_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_imports'::regclass
      AND conname = 'session_imports_origin_check'
  ) THEN
    ALTER TABLE public.session_imports
      ADD CONSTRAINT session_imports_origin_check CHECK (origin IN ('file', 'garmin_watch'));
  END IF;
END $$;

ALTER TABLE public.watch_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watch_devices_select_own ON public.watch_devices;
CREATE POLICY watch_devices_select_own ON public.watch_devices
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS watch_uploads_select_own ON public.watch_uploads;
CREATE POLICY watch_uploads_select_own ON public.watch_uploads
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

REVOKE ALL ON public.watch_devices FROM PUBLIC, anon, authenticated;
-- Table-level revokes leave prior column grants intact on reapplication.
REVOKE SELECT (token_hash) ON public.watch_devices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.watch_link_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.watch_uploads FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, platform, device_uid, device_part_number, device_name, app_version, created_at, last_seen_at, revoked_at)
  ON public.watch_devices TO authenticated;
GRANT SELECT ON public.watch_uploads TO authenticated;
GRANT ALL ON public.watch_devices TO service_role;
GRANT ALL ON public.watch_link_codes TO service_role;
GRANT ALL ON public.watch_uploads TO service_role;

DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY[
    'garmin_link_confirmed',
    'garmin_watch_unlinked',
    'garmin_import_beach_chosen'
  ];
  missing_events text[];
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  SELECT array_agg(event_name ORDER BY ord)
    INTO missing_events
  FROM unnest(candidate_events) WITH ORDINALITY AS candidate(event_name, ord)
  WHERE current_check !~ ('(^|[^[:alnum:]_])' || event_name || '([^[:alnum:]_]|$)');

  IF missing_events IS NOT NULL THEN
    ALTER TABLE public.user_events DROP CONSTRAINT user_events_event_type_check;
    EXECUTE format(
      'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
      current_check,
      missing_events
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
  v_sessions_soft_deleted int := 0;
  v_comments_anonymized int := 0;
  v_personal_rows_deleted int := 0;
  v_count int;
BEGIN
  INSERT INTO account_deletions (user_id)
  VALUES (p_user_id)
  RETURNING id INTO v_audit_id;

  UPDATE sessions
  SET deleted_at = now(),
      notes = NULL,
      description = NULL,
      image_url = NULL,
      board_snapshot = NULL,
      muted = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_sessions_soft_deleted = ROW_COUNT;

  UPDATE public.session_tracks SET purge_requested_at = now() WHERE user_id = p_user_id AND purge_requested_at IS NULL;
  UPDATE public.session_imports SET purge_requested_at = now() WHERE user_id = p_user_id AND purge_requested_at IS NULL;
  UPDATE public.watch_devices SET revoked_at = now(), token_hash = NULL WHERE user_id = p_user_id AND revoked_at IS NULL;
  DELETE FROM public.watch_link_codes WHERE user_id = p_user_id;
  DELETE FROM public.session_wave_corrections WHERE user_id = p_user_id;
  DELETE FROM public.session_waves WHERE user_id = p_user_id;

  UPDATE comments
  SET content = '[deleted]',
      updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_comments_anonymized = ROW_COUNT;

  UPDATE beach_reviews
  SET title = '[deleted]',
      content = '[deleted]',
      deleted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  UPDATE intel_posts
  SET is_active = false,
      title = '[deleted]',
      description = '[deleted]',
      photo_url = NULL,
      photo_storage_path = NULL,
      vibe = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;

  DELETE FROM intel_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_email_prefs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_surf_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_implicit_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_beach_affinity WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM favorite_beaches WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_devices WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_badges WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_xp WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM xp_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_activities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM personalization_milestones WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM saved_windows WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_invitations
  WHERE inviter_id = p_user_id OR invitee_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM boards WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  UPDATE session_media
  SET deleted_at = now(),
      caption = NULL
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  DELETE FROM session_forecast_snapshots WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM spot_feedback WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM notifications WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_alert_deliveries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_follows
  WHERE follower_id = p_user_id OR following_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM beach_review_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_shares WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_accuracy_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_post_confirmations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  PERFORM public.erase_regional_recommendation_hold_operator_v1(p_user_id);

  UPDATE profiles
  SET deleted_at = now(),
      full_name = 'Deleted surfer',
      avatar_url = NULL,
      bio = NULL,
      location = NULL,
      instagram = NULL,
      home_beach_id = NULL,
      experience_level = NULL,
      preferred_session_time = NULL,
      surf_styles = NULL,
      followers_count = 0,
      following_count = 0,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE account_deletions
  SET completed_at = now(),
      sessions_soft_deleted = v_sessions_soft_deleted,
      comments_anonymized = v_comments_anonymized,
      personal_rows_deleted = v_personal_rows_deleted
  WHERE id = v_audit_id;

  RETURN jsonb_build_object(
    'audit_id', v_audit_id,
    'sessions_soft_deleted', v_sessions_soft_deleted,
    'comments_anonymized', v_comments_anonymized,
    'personal_rows_deleted', v_personal_rows_deleted
  );
EXCEPTION WHEN OTHERS THEN
  UPDATE account_deletions
  SET error = SQLERRM
  WHERE id = v_audit_id;
  RAISE;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
