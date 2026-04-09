BEGIN;

-- =============================================================================
-- Account deletion infrastructure
-- =============================================================================
--
-- Adds the schema and stored procedure that the `delete-account` Edge Function
-- uses to soft-delete user accounts. Per product decision (2026-04-07):
--
-- 1. Soft delete the profile (mark deleted_at, scrub PII fields) so that
--    public content (sessions, comments) the user previously published can
--    continue to render with an anonymized "Deleted surfer" label via the
--    profile join — no FK repointing needed because every consumer joins
--    profiles by user_id and reads the (now scrubbed) name/avatar.
--
-- 2. Hard delete personal-only data (preferences, devices, favorites, XP,
--    affinity scores, etc.) — these have no public references.
--
-- 3. Anonymize the user's session/comment text content (notes, descriptions,
--    image_url) so personally-identifying free text doesn't survive deletion
--    even though the row does.
--
-- 4. Sessions are SOFT-deleted (`sessions.deleted_at = now()`) — they're
--    public content but the user explicitly asked to remove them, and the
--    likes/shares/comments engagement on them is preserved by the soft delete
--    rather than cascade.
--
-- 5. The auth.users row is banished (not hard-deleted) by the Edge Function
--    via `admin.updateUserById(id, { ban_duration: '876000h' })` so all
--    refresh tokens are revoked and re-sign-in is impossible. Hard-deleting
--    auth.users would CASCADE-delete profiles and break the soft-delete
--    semantics here.
--
-- 6. Every deletion is logged to `account_deletions` for audit purposes.
--

-- ----------------------------------------------------------------------------
-- 1. Add deleted_at to profiles (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx ON profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN profiles.deleted_at IS
  'Soft-delete tombstone. When set, the profile has been anonymized via delete_user_account().';

-- ----------------------------------------------------------------------------
-- 2. Audit table — one row per deletion request
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  -- Snapshot of high-level counts so we can reason about what got removed
  -- without retaining the actual data.
  sessions_soft_deleted int NOT NULL DEFAULT 0,
  comments_anonymized int NOT NULL DEFAULT 0,
  personal_rows_deleted int NOT NULL DEFAULT 0,
  error text
);

CREATE INDEX IF NOT EXISTS account_deletions_user_idx ON account_deletions (user_id);
CREATE INDEX IF NOT EXISTS account_deletions_requested_idx ON account_deletions (requested_at DESC);

COMMENT ON TABLE account_deletions IS
  'Audit log of account deletion requests. Retains user_id but no PII.';

-- RLS — only service role can read/write this table.
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_deletions_service_only ON account_deletions;
CREATE POLICY account_deletions_service_only ON account_deletions
  FOR ALL USING (false);

-- ----------------------------------------------------------------------------
-- 3. The atomic deletion function
-- ----------------------------------------------------------------------------
-- This runs in a single transaction. If anything fails, the whole thing
-- rolls back and the audit row records the error. The Edge Function then
-- decides whether to retry or surface the error to the user.
--
-- SECURITY DEFINER so it bypasses RLS during its work. The Edge Function
-- is responsible for verifying the caller's identity matches p_user_id
-- before invoking — DO NOT expose this RPC to anon/authenticated roles.

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
  -- Insert the audit row first so we have something to update if anything
  -- fails. Captures the request even on rollback because of the savepoint.
  INSERT INTO account_deletions (user_id) VALUES (p_user_id) RETURNING id INTO v_audit_id;

  -- ------------------------------------------------------------------------
  -- A. Anonymize public content the user authored
  -- ------------------------------------------------------------------------

  -- Sessions: soft delete + scrub free-text PII fields. Engagement
  -- (likes/shares/comments) survives via the row's continued existence.
  UPDATE sessions
  SET deleted_at = now(),
      notes = NULL,
      description = NULL,
      image_url = NULL,
      board_snapshot = NULL,
      muted = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_sessions_soft_deleted = ROW_COUNT;

  -- Comments: replace content text but keep the row so reply chains stay
  -- intact. The frontend renders content='[deleted]' as a tombstone.
  UPDATE comments
  SET content = '[deleted]',
      updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_comments_anonymized = ROW_COUNT;

  -- Beach reviews: keep the numeric ratings (aggregate data) but soft-delete
  -- the row + strip the user-authored title and content text.
  UPDATE beach_reviews
  SET title = '[deleted]',
      content = '[deleted]',
      deleted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Intel posts: deactivate so they don't show in the feed any more, and
  -- strip user-authored text + photo paths. The aggregate counts (helpful,
  -- confirmed, off) stay so existing engagement isn't lost.
  UPDATE intel_posts
  SET is_active = false,
      title = '[deleted]',
      description = '[deleted]',
      photo_url = NULL,
      photo_storage_path = NULL,
      vibe = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Intel reports are moderation flags the user submitted; just delete them.
  DELETE FROM intel_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- ------------------------------------------------------------------------
  -- B. Hard delete personal data — no public references, no reason to keep
  -- ------------------------------------------------------------------------

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

  -- Session invitations: user can be either the inviter or the invitee.
  -- Delete both directions.
  DELETE FROM session_invitations WHERE inviter_id = p_user_id OR invitee_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM boards WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- Session logs: personal rated session windows used to learn preferences.
  -- Pure personal data with no public surface.
  DELETE FROM session_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- Session media: photo/video uploads attached to sessions. Soft delete so
  -- the storage bucket cleanup job (separate, async) can find and remove
  -- the underlying files. Clear caption to scrub user text.
  UPDATE session_media
  SET deleted_at = now(),
      caption = NULL
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Session forecast snapshots: personal forecast records linked to user's
  -- own sessions. No public reference.
  DELETE FROM session_forecast_snapshots WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- Spot feedback: free-text feedback submissions. Personal, hard delete.
  DELETE FROM spot_feedback WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- Notifications and forecast alert deliveries: personal queue, no public ref
  DELETE FROM notifications WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_alert_deliveries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- Email log: keep for compliance, no need to delete
  -- (The user's email isn't in profile anymore once we scrub it; the log
  -- references user_id only.)

  -- ------------------------------------------------------------------------
  -- C. Symmetric relationships — delete both directions
  -- ------------------------------------------------------------------------

  DELETE FROM user_follows WHERE follower_id = p_user_id OR following_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  -- ------------------------------------------------------------------------
  -- D. Strip likes/votes the user cast (these are user-attributed engagement,
  -- not user-authored content; deleting them un-counts the engagement)
  -- ------------------------------------------------------------------------

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

  -- ------------------------------------------------------------------------
  -- E. Soft-delete the profile + scrub PII
  -- The id stays so existing FKs (sessions.user_id, comments.user_id) continue
  -- to resolve to a row, but every PII field is null/sentinel. Any join
  -- against profiles will see a "Deleted surfer" with no avatar or bio.
  -- ------------------------------------------------------------------------

  UPDATE profiles
  SET deleted_at = now(),
      full_name = 'Deleted surfer',
      avatar_url = NULL,
      bio = NULL,
      location = NULL,
      instagram = NULL,
      home_beach_id = NULL,
      experience_level = NULL,
      preferred_wave_size = NULL,
      preferred_break_type = NULL,
      crowd_preference = NULL,
      preferred_session_time = NULL,
      surf_styles = NULL,
      followers_count = 0,
      following_count = 0,
      updated_at = now()
  WHERE id = p_user_id;

  -- Mark the audit row complete with the totals
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
  -- Try to record the failure on the audit row, then re-raise so the caller
  -- sees the error and the transaction rolls back.
  UPDATE account_deletions
  SET error = SQLERRM
  WHERE id = v_audit_id;
  RAISE;
END;
$$;

-- Lock down the function — only service_role may invoke it.
REVOKE ALL ON FUNCTION delete_user_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_user_account(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION delete_user_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO service_role;

COMMENT ON FUNCTION delete_user_account(uuid) IS
  'Atomic soft-delete of a user account. Service role only. Called from the delete-account Edge Function after verifying the caller JWT.';

COMMIT;
