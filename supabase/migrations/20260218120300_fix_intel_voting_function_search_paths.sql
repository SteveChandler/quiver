BEGIN;

-- Fix mutable search_path security warnings on intel voting functions.
-- SET search_path = '' forces fully-qualified references, preventing
-- search_path hijacking in SECURITY DEFINER functions.

-- 1. update_intel_vote_counts
CREATE OR REPLACE FUNCTION public.update_intel_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts
        SET
            helpful_count      = helpful_count   + CASE WHEN NEW.vote_type = 'helpful'   THEN 1 ELSE 0 END,
            off_count          = off_count       + CASE WHEN NEW.vote_type = 'off'        THEN 1 ELSE 0 END,
            confirmed_count    = confirmed_count + CASE WHEN NEW.vote_type = 'confirmed'  THEN 1 ELSE 0 END,
            confirmations_count = confirmations_count + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
            updated_at         = now()
        WHERE id = NEW.intel_post_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts
        SET
            helpful_count      = GREATEST(0, helpful_count   - CASE WHEN OLD.vote_type = 'helpful'   THEN 1 ELSE 0 END),
            off_count          = GREATEST(0, off_count       - CASE WHEN OLD.vote_type = 'off'        THEN 1 ELSE 0 END),
            confirmed_count    = GREATEST(0, confirmed_count - CASE WHEN OLD.vote_type = 'confirmed'  THEN 1 ELSE 0 END),
            confirmations_count = GREATEST(0, confirmations_count - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END),
            updated_at         = now()
        WHERE id = OLD.intel_post_id;

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.vote_type IS DISTINCT FROM NEW.vote_type THEN
            UPDATE public.intel_posts
            SET
                helpful_count   = GREATEST(0, helpful_count   - CASE WHEN OLD.vote_type = 'helpful'  THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'helpful'  THEN 1 ELSE 0 END,
                off_count       = GREATEST(0, off_count       - CASE WHEN OLD.vote_type = 'off'       THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'off'       THEN 1 ELSE 0 END,
                confirmed_count = GREATEST(0, confirmed_count - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END)
                                             + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
                confirmations_count = GREATEST(0, confirmations_count
                                        - CASE WHEN OLD.vote_type = 'confirmed' THEN 1 ELSE 0 END)
                                        + CASE WHEN NEW.vote_type = 'confirmed' THEN 1 ELSE 0 END,
                updated_at      = now()
            WHERE id = NEW.intel_post_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. update_intel_report_count
-- NOTE: superseded by 20260218120400_fix_report_trigger_race_condition.sql
-- which fixes a race condition where two concurrent report inserts could both
-- read the pre-increment count and fail the auto-hide threshold check.
-- This copy is kept in sync so supabase db reset produces a consistent state.
CREATE OR REPLACE FUNCTION public.update_intel_report_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_trust_score       NUMERIC(4,3);
    v_hide_threshold    INTEGER;
    v_new_report_count  INTEGER;
    v_post_user_id      UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Atomically increment and capture the post-increment count in one
        -- statement. RETURNING guarantees v_new_report_count reflects the value
        -- committed by *this* UPDATE, not a concurrent one.
        UPDATE public.intel_posts
        SET    report_count = report_count + 1,
               updated_at   = now()
        WHERE  id = NEW.intel_post_id
        RETURNING report_count, user_id
            INTO v_new_report_count, v_post_user_id;

        -- Only apply auto-hide logic on INSERT (new report added).
        SELECT COALESCE(p.trust_score, 0.400)
        INTO   v_trust_score
        FROM   public.profiles p
        WHERE  p.id = v_post_user_id;

        v_hide_threshold := CASE WHEN v_trust_score < 0.3 THEN 2 ELSE 3 END;

        -- Evaluate threshold against the RETURNING'd count (atomic with the
        -- increment above), not a second read a concurrent session could change.
        IF v_new_report_count >= v_hide_threshold THEN
            UPDATE public.intel_posts
            SET    is_active  = false,
                   updated_at = now()
            WHERE  id = NEW.intel_post_id
              AND  is_active = true;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts
        SET    report_count = GREATEST(0, report_count - 1),
               updated_at   = now()
        WHERE  id = OLD.intel_post_id;
    END IF;

    RETURN NULL;
END;
$$;

-- 3. get_nearby_intel_posts (fully-qualified PostGIS calls required with empty search_path)
CREATE OR REPLACE FUNCTION public.get_nearby_intel_posts(
    center_lat    DOUBLE PRECISION,
    center_lng    DOUBLE PRECISION,
    limit_count   INTEGER          DEFAULT 50,
    radius_miles  DOUBLE PRECISION DEFAULT 25.0,
    tag_filter    TEXT             DEFAULT NULL
)
RETURNS TABLE (
    id                  UUID,
    user_id             UUID,
    beach_id            UUID,
    latitude            DECIMAL(10, 8),
    longitude           DECIMAL(11, 8),
    tag                 public.intel_post_tag,
    title               TEXT,
    description         TEXT,
    photo_url           TEXT,
    confirmations_count INTEGER,
    is_active           BOOLEAN,
    surf_conditions     JSONB,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ,
    distance_miles      DOUBLE PRECISION,
    user_name           TEXT,
    beach_name          TEXT,
    helpful_count       INTEGER,
    off_count           INTEGER,
    confirmed_count     INTEGER,
    rank_score          DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ip.id,
        ip.user_id,
        ip.beach_id,
        ip.latitude,
        ip.longitude,
        ip.tag,
        ip.title,
        ip.description,
        ip.photo_url,
        ip.confirmations_count,
        ip.is_active,
        ip.surf_conditions,
        ip.expires_at,
        ip.created_at,
        ip.updated_at,
        (public.ST_Distance(
            public.ST_SetSRID(public.ST_MakePoint(ip.longitude, ip.latitude), 4326)::public.geography,
            public.ST_SetSRID(public.ST_MakePoint(center_lng, center_lat), 4326)::public.geography
        ) / 1609.34) AS distance_miles,
        p.full_name AS user_name,
        COALESCE(b.name, 'Unknown Beach') AS beach_name,
        ip.helpful_count,
        ip.off_count,
        ip.confirmed_count,
        (
            GREATEST(0, (ip.helpful_count - ip.off_count + ip.confirmed_count * 2)::DOUBLE PRECISION)
            * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600.0 / 8.0))
        ) AS rank_score
    FROM public.intel_posts ip
    LEFT JOIN public.profiles p ON p.id = ip.user_id
    LEFT JOIN public.beaches b ON b.id = ip.beach_id
    WHERE ip.is_active = true
      AND (ip.expires_at IS NULL OR ip.expires_at > NOW())
      AND public.ST_DWithin(
          public.ST_SetSRID(public.ST_MakePoint(ip.longitude, ip.latitude), 4326)::public.geography,
          public.ST_SetSRID(public.ST_MakePoint(center_lng, center_lat), 4326)::public.geography,
          radius_miles * 1609.34
      )
      AND (tag_filter IS NULL OR ip.tag::TEXT = tag_filter)
    ORDER BY
        rank_score DESC,
        ip.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_intel_posts(
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    INTEGER,
    DOUBLE PRECISION,
    TEXT
) TO authenticated, service_role, anon;

COMMIT;
