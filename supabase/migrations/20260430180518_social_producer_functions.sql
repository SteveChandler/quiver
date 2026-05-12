-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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
  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'actor_id mismatch: must match auth.uid()';
  END IF;

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
