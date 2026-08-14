-- UNAPPLIED FORWARD MIGRATION (2026-08-13)
-- the production migration protocol before enabling system-card publishing.

BEGIN;

CREATE OR REPLACE FUNCTION public.try_insert_system_feed_post(
  p_user_id uuid,
  p_beach_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_tag text,
  p_title text,
  p_description text,
  p_is_active boolean,
  p_dedupe_hash text,
  p_surf_conditions jsonb,
  p_expires_at timestamptz,
  p_created_at timestamptz,
  p_daily_cap integer DEFAULT 12,
  p_beach_daily_cap integer DEFAULT 2,
  p_beach_weekly_cap integer DEFAULT 7
)
RETURNS TABLE(post_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  day_start timestamptz;
  day_end timestamptz;
  existing_post_id uuid;
  daily_count integer;
  beach_daily_count integer;
  beach_weekly_count integer;
  inserted_post_id uuid;
BEGIN
  day_start := date_trunc('day', p_created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  day_end := day_start + interval '1 day';

  -- All system producers share one lock for the UTC day. The lock is held
  -- through the count checks and insert, so retries cannot reserve the same
  -- capacity concurrently.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('quiver:system-feed:' || day_start::text, 0)
  );

  IF p_dedupe_hash IS NOT NULL THEN
    SELECT ip.id
    INTO existing_post_id
    FROM public.intel_posts ip
    JOIN public.profiles p ON p.id = ip.user_id
    WHERE p.is_system_account IS TRUE
      AND ip.dedupe_hash = p_dedupe_hash
      AND ip.created_at >= day_start
      AND ip.created_at < day_end
    LIMIT 1;

    IF existing_post_id IS NOT NULL THEN
      RETURN QUERY SELECT existing_post_id, 'duplicate'::text;
      RETURN;
    END IF;
  END IF;

  SELECT count(*)
  INTO daily_count
  FROM public.intel_posts ip
  JOIN public.profiles p ON p.id = ip.user_id
  WHERE p.is_system_account IS TRUE
    AND ip.created_at >= day_start
    AND ip.created_at < day_end;

  IF daily_count >= p_daily_cap THEN
    RETURN QUERY SELECT NULL::uuid, 'daily_cap'::text;
    RETURN;
  END IF;

  SELECT count(*)
  INTO beach_daily_count
  FROM public.intel_posts ip
  JOIN public.profiles p ON p.id = ip.user_id
  WHERE p.is_system_account IS TRUE
    AND ip.beach_id = p_beach_id
    AND ip.created_at >= day_start
    AND ip.created_at < day_end;

  IF beach_daily_count >= p_beach_daily_cap THEN
    RETURN QUERY SELECT NULL::uuid, 'beach_daily_cap'::text;
    RETURN;
  END IF;

  SELECT count(*)
  INTO beach_weekly_count
  FROM public.intel_posts ip
  JOIN public.profiles p ON p.id = ip.user_id
  WHERE p.is_system_account IS TRUE
    AND ip.beach_id = p_beach_id
    AND ip.created_at >= p_created_at - interval '7 days'
    AND ip.created_at <= p_created_at;

  IF beach_weekly_count >= p_beach_weekly_cap THEN
    RETURN QUERY SELECT NULL::uuid, 'beach_weekly_cap'::text;
    RETURN;
  END IF;

  INSERT INTO public.intel_posts (
    user_id,
    beach_id,
    latitude,
    longitude,
    tag,
    title,
    description,
    is_active,
    dedupe_hash,
    surf_conditions,
    expires_at,
    created_at
  ) VALUES (
    p_user_id,
    p_beach_id,
    p_latitude,
    p_longitude,
    p_tag::public.intel_post_tag,
    p_title,
    p_description,
    p_is_active,
    p_dedupe_hash,
    p_surf_conditions,
    p_expires_at,
    p_created_at
  )
  RETURNING id INTO inserted_post_id;

  RETURN QUERY SELECT inserted_post_id, 'inserted'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.try_insert_system_feed_post(
  uuid, uuid, numeric, numeric, text, text, text, boolean, text, jsonb,
  timestamptz, timestamptz, integer, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.try_insert_system_feed_post(
  uuid, uuid, numeric, numeric, text, text, text, boolean, text, jsonb,
  timestamptz, timestamptz, integer, integer, integer
) TO service_role;

COMMIT;
