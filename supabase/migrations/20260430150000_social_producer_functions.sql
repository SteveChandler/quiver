-- Phase 5f: Producer atomicity for social notifications.
--
-- Postgres functions that insert the social row AND the notification_events
-- row in a single transaction. If either insert fails (other than a caught
-- duplicate-dedupe), the entire operation rolls back — there are no orphan
-- notification events from a failed mutation, and no orphan mutations from a
-- failed enqueue.
--
-- The functions are SECURITY DEFINER so they can write to notification_events
-- (which has service-role-only insert RLS). The social table inserts (session_likes,
-- user_follows) still go through their own RLS — the function's caller must have
-- INSERT permission on those tables. The function checks p_actor_id matches
-- auth.uid() to guard against impersonation.
--
-- Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 5f).

BEGIN;

-- ─── like_session_with_notification ─────────────────────────────────────────
--
-- Atomically inserts a session_likes row and (when the session has an owner
-- different from the actor) a notification_events row. Returns:
--   { liked: bool, was_existing: bool, event_id: uuid | null,
--     notification_dedup_collision: bool }
-- Caller is expected to have already verified auth; we re-check that
-- p_actor_id = auth.uid() defensively.

CREATE OR REPLACE FUNCTION public.like_session_with_notification(
  p_session_id uuid,
  p_actor_id uuid,
  p_dedupe_key text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_owner_id uuid;
  v_beach_name text;
  v_event_id uuid;
  v_dedup_collision boolean := false;
  v_existing_id uuid;
BEGIN
  -- Defensive: actor must match the authenticated user. SECURITY DEFINER lets
  -- us bypass RLS on notification_events; we don't want to also bypass auth.
  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_id mismatch: must match auth.uid()';
  END IF;

  -- Idempotent: if the like already exists, return early without re-enqueueing.
  SELECT id INTO v_existing_id
    FROM session_likes
    WHERE session_id = p_session_id AND user_id = p_actor_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object(
      'liked', true,
      'was_existing', true,
      'event_id', null,
      'notification_dedup_collision', false
    );
  END IF;

  INSERT INTO session_likes (session_id, user_id)
    VALUES (p_session_id, p_actor_id);

  SELECT user_id, beach_name INTO v_session_owner_id, v_beach_name
    FROM sessions
    WHERE id = p_session_id;

  -- No notification when self-like or session has no owner.
  IF v_session_owner_id IS NULL OR v_session_owner_id = p_actor_id THEN
    RETURN json_build_object(
      'liked', true,
      'was_existing', false,
      'event_id', null,
      'notification_dedup_collision', false
    );
  END IF;

  BEGIN
    INSERT INTO notification_events (
      recipient_user_id, actor_user_id, type,
      entity_type, entity_id, payload, dedupe_key
    ) VALUES (
      v_session_owner_id, p_actor_id, 'like',
      'session', p_session_id,
      jsonb_build_object(
        'session_id', p_session_id::text,
        'beach_name', v_beach_name
      ),
      p_dedupe_key
    )
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    v_dedup_collision := true;
    v_event_id := null;
  END;

  RETURN json_build_object(
    'liked', true,
    'was_existing', false,
    'event_id', v_event_id,
    'notification_dedup_collision', v_dedup_collision
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_session_with_notification(uuid, uuid, text)
  TO authenticated, service_role;


-- ─── follow_user_with_notification ──────────────────────────────────────────
--
-- Atomically inserts a user_follows row and a notification_events row. Returns
-- the same shape as like_session_with_notification.

CREATE OR REPLACE FUNCTION public.follow_user_with_notification(
  p_target_user_id uuid,
  p_actor_id uuid,
  p_dedupe_key text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_dedup_collision boolean := false;
  v_existing_id uuid;
BEGIN
  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_id mismatch: must match auth.uid()';
  END IF;

  IF p_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'cannot follow yourself';
  END IF;

  SELECT id INTO v_existing_id
    FROM user_follows
    WHERE follower_id = p_actor_id AND following_id = p_target_user_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object(
      'followed', true,
      'was_existing', true,
      'event_id', null,
      'notification_dedup_collision', false
    );
  END IF;

  INSERT INTO user_follows (follower_id, following_id)
    VALUES (p_actor_id, p_target_user_id);

  BEGIN
    INSERT INTO notification_events (
      recipient_user_id, actor_user_id, type,
      entity_type, entity_id, payload, dedupe_key
    ) VALUES (
      p_target_user_id, p_actor_id, 'follow',
      'user', p_target_user_id,
      '{}'::jsonb,
      p_dedupe_key
    )
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    v_dedup_collision := true;
    v_event_id := null;
  END;

  RETURN json_build_object(
    'followed', true,
    'was_existing', false,
    'event_id', v_event_id,
    'notification_dedup_collision', v_dedup_collision
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.follow_user_with_notification(uuid, uuid, text)
  TO authenticated, service_role;

COMMIT;
