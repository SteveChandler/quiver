BEGIN;

-- Drop partial indexes first
DROP INDEX IF EXISTS idx_profiles_wave_size;
DROP INDEX IF EXISTS idx_profiles_break_type;
DROP INDEX IF EXISTS idx_profiles_crowd_preference;

-- Drop dependent view (it freezes profiles.* column list at creation time
-- and blocks the column drops below). Recreated after the drops.
DROP VIEW IF EXISTS public.profiles_with_home_beach;

-- Drop columns
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_wave_size;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_break_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS crowd_preference;

-- Recreate view to match prod shape (explicit columns, no preferred_*).
CREATE VIEW public.profiles_with_home_beach
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

-- Patch delete_user_account() to stop referencing the dropped columns.
-- Original function body (20260407030000) UPDATEs profiles with
-- preferred_wave_size/preferred_break_type/crowd_preference = NULL — those
-- column refs would crash the RPC on any account deletion against this
-- post-drop schema. Body is otherwise byte-identical to 20260407030000:87.
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id uuid)
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
  INSERT INTO account_deletions (user_id) VALUES (p_user_id) RETURNING id INTO v_audit_id;

  UPDATE sessions
  SET deleted_at = now(),
      notes = NULL,
      description = NULL,
      image_url = NULL,
      board_snapshot = NULL,
      muted = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_sessions_soft_deleted = ROW_COUNT;

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
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_email_prefs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_surf_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_implicit_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_beach_affinity WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM favorite_beaches WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_devices WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_badges WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_xp WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM xp_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_activities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM personalization_milestones WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM saved_windows WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_invitations WHERE inviter_id = p_user_id OR invitee_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM boards WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  UPDATE session_media
  SET deleted_at = now(),
      caption = NULL
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  DELETE FROM session_forecast_snapshots WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM spot_feedback WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM notifications WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_alert_deliveries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_follows WHERE follower_id = p_user_id OR following_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM beach_review_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_shares WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_accuracy_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_post_confirmations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- Soft-delete the profile + scrub PII.
  -- (Removed: preferred_wave_size, preferred_break_type, crowd_preference —
  -- those columns are dropped above in this same migration.)
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

COMMIT;
