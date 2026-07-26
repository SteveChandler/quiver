-- Canonical community spot-photo model for curated beaches and custom spots.
-- This is intentionally additive: legacy beach_photo_submissions remains frozen.
BEGIN;

-- Freeze legacy client writes while preserving read access for rollback.
DO $$
BEGIN
  IF to_regclass('public.beach_photo_submissions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS bps_insert_own ON public.beach_photo_submissions';
    EXECUTE 'DROP POLICY IF EXISTS bps_update_own ON public.beach_photo_submissions';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.beach_photo_submissions FROM anon, authenticated';
  END IF;
  IF to_regclass('public.beach_photo_submission_votes') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS bpsv_insert_own ON public.beach_photo_submission_votes';
    EXECUTE 'DROP POLICY IF EXISTS bpsv_delete_own ON public.beach_photo_submission_votes';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.beach_photo_submission_votes FROM anon, authenticated';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.community_photo_feature_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  read_enabled boolean NOT NULL DEFAULT false,
  writes_enabled boolean NOT NULL DEFAULT false,
  terms_version text NOT NULL DEFAULT '2026-07-25',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.community_photo_feature_config (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.community_spot_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('beach', 'custom_spot')),
  beach_id uuid REFERENCES public.beaches(id) ON DELETE CASCADE,
  custom_spot_id uuid REFERENCES public.custom_spots(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL DEFAULT 'image/webp' CHECK (content_type = 'image/webp'),
  width integer CHECK (width IS NULL OR width BETWEEN 1 AND 2400),
  height integer CHECK (height IS NULL OR height BETWEEN 1 AND 2400),
  processing_status text NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing', 'ready', 'cleanup')),
  moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden')),
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'removed', 'purging')),
  hidden_reason text,
  removed_at timestamptz,
  recoverable_until timestamptz,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_photo_exactly_one_target CHECK (
    (target_type = 'beach' AND beach_id IS NOT NULL AND custom_spot_id IS NULL)
    OR
    (target_type = 'custom_spot' AND beach_id IS NULL AND custom_spot_id IS NOT NULL)
  ),
  CONSTRAINT community_photo_private_custom_only CHECK (
    visibility = 'public' OR target_type = 'custom_spot'
  ),
  CONSTRAINT community_photo_removal_window CHECK (
    (lifecycle_status = 'active' AND removed_at IS NULL AND recoverable_until IS NULL)
    OR
    (
      lifecycle_status IN ('removed', 'purging')
      AND removed_at IS NOT NULL
      AND recoverable_until = removed_at + interval '30 days'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS community_spot_photos_idempotency_idx
  ON public.community_spot_photos (uploader_id, idempotency_key)
  WHERE uploader_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_spot_photos_beach_idx
  ON public.community_spot_photos (beach_id)
  WHERE lifecycle_status = 'active';
CREATE INDEX IF NOT EXISTS community_spot_photos_custom_spot_idx
  ON public.community_spot_photos (custom_spot_id)
  WHERE lifecycle_status = 'active';
CREATE INDEX IF NOT EXISTS community_spot_photos_retention_idx
  ON public.community_spot_photos (recoverable_until)
  WHERE lifecycle_status = 'removed';

CREATE TABLE IF NOT EXISTS public.community_photo_consents (
  photo_id uuid PRIMARY KEY REFERENCES public.community_spot_photos(id) ON DELETE CASCADE,
  contributor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  terms_version text NOT NULL CHECK (terms_version = '2026-07-25'),
  rights_confirmed boolean NOT NULL CHECK (rights_confirmed),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_photo_votes (
  photo_id uuid NOT NULL REFERENCES public.community_spot_photos(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, voter_id)
);

CREATE TABLE IF NOT EXISTS public.community_photo_reports (
  photo_id uuid NOT NULL REFERENCES public.community_spot_photos(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (
    reason IN ('explicit', 'privacy', 'safety', 'wrong_spot', 'stale')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS public.community_photo_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid REFERENCES public.community_spot_photos(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN (
      'auto_hide', 'admin_hide', 'admin_restore', 'admin_pin', 'admin_unpin',
      'admin_recover', 'admin_hold', 'admin_release_hold',
      'admin_restrict_contributor', 'admin_unrestrict_contributor',
      'admin_view_hidden'
    )
  ),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 280),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.community_photo_feature_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.community_spot_photos(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('beach', 'custom_spot')),
  beach_id uuid REFERENCES public.beaches(id) ON DELETE CASCADE,
  custom_spot_id uuid REFERENCES public.custom_spots(id) ON DELETE CASCADE,
  pinned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT community_photo_pin_exactly_one_target CHECK (
    (target_type = 'beach' AND beach_id IS NOT NULL AND custom_spot_id IS NULL)
    OR
    (target_type = 'custom_spot' AND beach_id IS NULL AND custom_spot_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS community_photo_one_active_pin_beach_idx
  ON public.community_photo_feature_pins (beach_id)
  WHERE revoked_at IS NULL AND beach_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS community_photo_one_active_pin_custom_spot_idx
  ON public.community_photo_feature_pins (custom_spot_id)
  WHERE revoked_at IS NULL AND custom_spot_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.community_photo_investigation_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.community_spot_photos(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 280),
  placed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  placed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS community_photo_one_active_hold_idx
  ON public.community_photo_investigation_holds (photo_id)
  WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS public.community_photo_contributor_restrictions (
  contributor_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restricted_until timestamptz,
  reason_code text NOT NULL CHECK (char_length(reason_code) BETWEEN 1 AND 64),
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.community_photo_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN ('upload_reserved', 'upload_ready', 'upload_failed', 'vote', 'report', 'remove', 'recover', 'purge')
  ),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected', 'failed')),
  reason_code text NOT NULL CHECK (char_length(reason_code) BETWEEN 1 AND 64),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, action, idempotency_key)
);

CREATE OR REPLACE FUNCTION public.anonymize_community_photos_before_account_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.community_photo_consents
  SET contributor_id = NULL
  WHERE contributor_id = OLD.id;
  UPDATE public.community_spot_photos
  SET uploader_id = NULL, updated_at = now()
  WHERE uploader_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS anonymize_community_photos_before_account_delete
ON auth.users;
CREATE TRIGGER anonymize_community_photos_before_account_delete
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.anonymize_community_photos_before_account_delete();

REVOKE ALL ON FUNCTION public.anonymize_community_photos_before_account_delete()
FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.community_spot_photos IS
  'Canonical private-bucket community photos. A ready row is published immediately unless hidden or removed.';
COMMENT ON TABLE public.community_photo_votes IS
  'Private mutable up/down votes. Raw voter identity is never granted to client roles.';
COMMENT ON TABLE public.community_photo_reports IS
  'Private one-current-reason-per-reporter moderation signals.';
COMMENT ON TABLE public.community_photo_action_events IS
  'Non-public abuse and operational event ledger. Enforces 5 rolling uploads per 24 hours.';
COMMENT ON COLUMN public.community_spot_photos.idempotency_key IS
  'Upload idempotency; reserve RPC enforces 3 active photos per contributor and target.';

ALTER TABLE public.community_photo_feature_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_spot_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_feature_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_investigation_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_contributor_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photo_action_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.community_photo_feature_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_spot_photos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_consents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_votes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_moderation_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_feature_pins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_investigation_holds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_contributor_restrictions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.community_photo_action_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.community_photo_feature_config TO service_role;
GRANT ALL ON TABLE public.community_spot_photos TO service_role;
GRANT ALL ON TABLE public.community_photo_consents TO service_role;
GRANT ALL ON TABLE public.community_photo_votes TO service_role;
GRANT ALL ON TABLE public.community_photo_reports TO service_role;
GRANT ALL ON TABLE public.community_photo_moderation_events TO service_role;
GRANT ALL ON TABLE public.community_photo_feature_pins TO service_role;
GRANT ALL ON TABLE public.community_photo_investigation_holds TO service_role;
GRANT ALL ON TABLE public.community_photo_contributor_restrictions TO service_role;
GRANT ALL ON TABLE public.community_photo_action_events TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-spot-photos',
  'community-spot-photos',
  false,
  15728640,
  ARRAY['image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS community_photo_storage_service_role ON storage.objects;
CREATE POLICY community_photo_storage_service_role
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'community-spot-photos')
WITH CHECK (bucket_id = 'community-spot-photos');

CREATE OR REPLACE FUNCTION public.community_photo_wilson_lower_bound(
  p_upvotes integer,
  p_downvotes integer
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (p_upvotes + p_downvotes) < 5 THEN 0::double precision
    ELSE (
      (
        p_upvotes::double precision / (p_upvotes + p_downvotes)
        + (1.959963984540054 * 1.959963984540054) / (2 * (p_upvotes + p_downvotes))
        - 1.959963984540054 * sqrt(
          (
            (p_upvotes::double precision / (p_upvotes + p_downvotes))
            * (1 - p_upvotes::double precision / (p_upvotes + p_downvotes))
            + (1.959963984540054 * 1.959963984540054) / (4 * (p_upvotes + p_downvotes))
          ) / (p_upvotes + p_downvotes)
        )
      )
      / (1 + (1.959963984540054 * 1.959963984540054) / (p_upvotes + p_downvotes))
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.preflight_community_spot_photo_upload_v1(
  p_uploader_id uuid,
  p_idempotency_key uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_photo_feature_config
    WHERE singleton AND read_enabled AND writes_enabled
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_photo_contributor_restrictions r
    WHERE r.contributor_id = p_uploader_id
      AND r.lifted_at IS NULL
      AND (r.restricted_until IS NULL OR r.restricted_until > now())
  ) THEN
    RAISE EXCEPTION 'contributor_restricted';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.community_photo_action_events e
    WHERE e.actor_id = p_uploader_id
      AND e.action = 'upload_failed'
      AND e.outcome = 'failed'
      AND e.idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'upload_attempt_failed';
  END IF;
  IF (
      SELECT count(*)
      FROM public.community_photo_action_events e
      WHERE e.actor_id = p_uploader_id
        AND e.action = 'upload_reserved'
        AND e.outcome = 'accepted'
        AND e.created_at > now() - interval '24 hours'
    ) >= 5
    AND NOT EXISTS (
      SELECT 1
      FROM public.community_photo_action_events e
      WHERE e.actor_id = p_uploader_id
        AND e.action = 'upload_reserved'
        AND e.outcome = 'accepted'
        AND e.idempotency_key = p_idempotency_key
    )
  THEN
    RAISE EXCEPTION 'rolling_upload_limit';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_community_spot_photo_v1(
  p_photo_id uuid,
  p_uploader_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_visibility text,
  p_storage_path text,
  p_terms_version text,
  p_rights_confirmed boolean,
  p_idempotency_key uuid
)
RETURNS TABLE(
  photo_id uuid,
  storage_path text,
  replay boolean,
  processing_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_id uuid;
  existing_storage_path text;
  existing_status text;
  active_count integer;
  rolling_count integer;
  custom_owner uuid;
  custom_visibility text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_uploader_id::text, 35));

  SELECT p.id, p.storage_path, p.processing_status
    INTO existing_id, existing_storage_path, existing_status
  FROM public.community_spot_photos p
  WHERE p.uploader_id = p_uploader_id
    AND p.idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF existing_id IS NOT NULL THEN
    RETURN QUERY SELECT
      existing_id,
      existing_storage_path,
      true,
      existing_status;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.community_photo_action_events e
    WHERE e.actor_id = p_uploader_id
      AND e.action = 'upload_failed'
      AND e.outcome = 'failed'
      AND e.idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'upload_attempt_failed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.community_photo_action_events e
    WHERE e.actor_id = p_uploader_id
      AND e.action = 'upload_reserved'
      AND e.outcome = 'accepted'
      AND e.idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'idempotency_conflict';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.community_photo_feature_config
    WHERE singleton AND read_enabled AND writes_enabled
      AND terms_version = p_terms_version
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;
  IF p_terms_version <> '2026-07-25' OR NOT p_rights_confirmed THEN
    RAISE EXCEPTION 'consent_required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_photo_contributor_restrictions r
    WHERE r.contributor_id = p_uploader_id
      AND r.lifted_at IS NULL
      AND (r.restricted_until IS NULL OR r.restricted_until > now())
  ) THEN
    RAISE EXCEPTION 'contributor_restricted';
  END IF;

  IF p_target_type = 'beach' THEN
    IF p_visibility <> 'public' OR NOT EXISTS (
      SELECT 1 FROM public.beaches b
      WHERE b.id = p_target_id AND COALESCE(b.is_private, false) = false
    ) THEN
      RAISE EXCEPTION 'invalid_target';
    END IF;
  ELSIF p_target_type = 'custom_spot' THEN
    SELECT c.user_id, c.visibility
      INTO custom_owner, custom_visibility
    FROM public.custom_spots c
    WHERE c.id = p_target_id AND c.deleted_at IS NULL;
    IF custom_owner IS NULL THEN
      RAISE EXCEPTION 'invalid_target';
    END IF;
    IF p_visibility = 'private' AND custom_owner <> p_uploader_id THEN
      RAISE EXCEPTION 'private_target_forbidden';
    END IF;
    IF p_visibility = 'public' AND custom_visibility <> 'public' THEN
      RAISE EXCEPTION 'private_target_forbidden';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_target';
  END IF;

  SELECT count(*) INTO active_count
  FROM public.community_spot_photos p
  WHERE p.uploader_id = p_uploader_id
    AND p.lifecycle_status = 'active'
    AND (
      (p_target_type = 'beach' AND p.beach_id = p_target_id)
      OR (p_target_type = 'custom_spot' AND p.custom_spot_id = p_target_id)
    );
  -- 3 active photos per contributor and target.
  IF active_count >= 3 THEN
    RAISE EXCEPTION 'target_active_limit';
  END IF;

  SELECT count(*) INTO rolling_count
  FROM public.community_photo_action_events e
  WHERE e.actor_id = p_uploader_id
    AND e.action = 'upload_reserved'
    AND e.outcome = 'accepted'
    AND e.created_at > now() - interval '24 hours';
  -- 5 rolling uploads per 24 hours across all targets.
  IF rolling_count >= 5 THEN
    RAISE EXCEPTION 'rolling_upload_limit';
  END IF;

  INSERT INTO public.community_spot_photos (
    id, uploader_id, target_type, beach_id, custom_spot_id, visibility,
    storage_path, idempotency_key
  )
  VALUES (
    p_photo_id,
    p_uploader_id,
    p_target_type,
    CASE WHEN p_target_type = 'beach' THEN p_target_id END,
    CASE WHEN p_target_type = 'custom_spot' THEN p_target_id END,
    p_visibility,
    p_storage_path,
    p_idempotency_key
  );
  INSERT INTO public.community_photo_consents (
    photo_id, contributor_id, terms_version, rights_confirmed
  ) VALUES (p_photo_id, p_uploader_id, p_terms_version, p_rights_confirmed);
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  ) VALUES (
    p_photo_id, p_uploader_id, 'upload_reserved', 'accepted', 'reserved',
    p_idempotency_key
  );
  RETURN QUERY SELECT p_photo_id, p_storage_path, false, 'processing';
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_community_spot_photo_v1(
  p_photo_id uuid,
  p_uploader_id uuid,
  p_width integer,
  p_height integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.community_spot_photos
  SET processing_status = 'ready',
      moderation_status = 'visible',
      width = p_width,
      height = p_height,
      updated_at = now()
  WHERE id = p_photo_id
    AND uploader_id = p_uploader_id
    AND processing_status = 'processing'
    AND lifecycle_status = 'active';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 1 AND NOT EXISTS (
    SELECT 1 FROM public.community_photo_action_events
    WHERE photo_id = p_photo_id AND action = 'upload_ready'
  ) THEN
    INSERT INTO public.community_photo_action_events (
      photo_id, actor_id, action, outcome, reason_code, idempotency_key
    )
    SELECT id, uploader_id, 'upload_ready', 'accepted', 'published', idempotency_key
    FROM public.community_spot_photos WHERE id = p_photo_id;
  END IF;
  RETURN changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_community_spot_photo_upload_v1(
  p_photo_id uuid,
  p_uploader_id uuid,
  p_reason_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  upload_key uuid;
BEGIN
  SELECT idempotency_key INTO upload_key
  FROM public.community_spot_photos
  WHERE id = p_photo_id AND uploader_id = p_uploader_id
  FOR UPDATE;
  IF upload_key IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  ) VALUES (
    p_photo_id, p_uploader_id, 'upload_failed', 'failed',
    left(p_reason_code, 64), upload_key
  )
  ON CONFLICT (actor_id, action, idempotency_key) DO UPDATE
  SET photo_id = EXCLUDED.photo_id,
      outcome = EXCLUDED.outcome,
      reason_code = EXCLUDED.reason_code;
  DELETE FROM public.community_spot_photos
  WHERE id = p_photo_id AND uploader_id = p_uploader_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_community_spot_photos_v1(
  p_target_type text,
  p_target_id uuid,
  p_viewer_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  photo_id uuid,
  target_type text,
  target_id uuid,
  visibility text,
  width integer,
  height integer,
  uploader_id uuid,
  display_name text,
  upvotes integer,
  downvotes integer,
  viewer_vote text,
  wilson_score double precision,
  is_pinned boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT
      p.id AS photo_id,
      p.target_type,
      COALESCE(p.beach_id, p.custom_spot_id) AS target_id,
      p.visibility,
      p.width,
      p.height,
      p.uploader_id,
      NULLIF(btrim(pr.display_name), '') AS display_name,
      count(*) FILTER (WHERE v.vote = 'up')::integer AS upvotes,
      count(*) FILTER (WHERE v.vote = 'down')::integer AS downvotes,
      max(v.vote) FILTER (WHERE v.voter_id = p_viewer_id) AS viewer_vote,
      EXISTS (
        SELECT 1 FROM public.community_photo_feature_pins pin
        WHERE pin.photo_id = p.id AND pin.revoked_at IS NULL
      ) AS is_pinned,
      p.created_at
    FROM public.community_spot_photos p
    LEFT JOIN public.profiles pr ON pr.id = p.uploader_id
    LEFT JOIN public.community_photo_votes v ON v.photo_id = p.id
    WHERE p.processing_status = 'ready'
      AND p.moderation_status = 'visible'
      AND p.lifecycle_status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.community_photo_feature_config config
        WHERE config.singleton AND config.read_enabled
      )
      AND p.target_type = p_target_type
      AND COALESCE(p.beach_id, p.custom_spot_id) = p_target_id
      AND (
        (
          p.target_type = 'beach'
          AND p.visibility = 'public'
          AND EXISTS (
            SELECT 1 FROM public.beaches b
            WHERE b.id = p.beach_id AND COALESCE(b.is_private, false) = false
          )
        )
        OR
        (
          p.target_type = 'custom_spot'
          AND EXISTS (
            SELECT 1 FROM public.custom_spots cs
            WHERE cs.id = p.custom_spot_id
              AND cs.deleted_at IS NULL
              AND (
                (p.visibility = 'public' AND cs.visibility = 'public')
                OR
                (
                  p.visibility = 'private'
                  AND cs.user_id = p_viewer_id
                  AND p.uploader_id = p_viewer_id
                )
              )
          )
        )
      )
    GROUP BY p.id, pr.display_name
  )
  SELECT
    c.photo_id, c.target_type, c.target_id, c.visibility, c.width, c.height,
    c.uploader_id, c.display_name, c.upvotes, c.downvotes, c.viewer_vote,
    public.community_photo_wilson_lower_bound(c.upvotes, c.downvotes) AS wilson_score,
    c.is_pinned, c.created_at
  FROM candidates c
  ORDER BY
    c.is_pinned DESC,
    wilson_score DESC,
    (c.upvotes + c.downvotes) DESC,
    c.photo_id ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
$$;

CREATE OR REPLACE FUNCTION public.resolve_community_spot_photo_by_id_v1(
  p_photo_id uuid,
  p_viewer_id uuid
)
RETURNS TABLE (
  photo_id uuid,
  target_type text,
  target_id uuid,
  visibility text,
  width integer,
  height integer,
  uploader_id uuid,
  display_name text,
  upvotes integer,
  downvotes integer,
  viewer_vote text,
  wilson_score double precision,
  is_pinned boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.target_type,
    COALESCE(p.beach_id, p.custom_spot_id),
    p.visibility,
    p.width,
    p.height,
    p.uploader_id,
    NULLIF(btrim(pr.display_name), ''),
    counts.upvotes,
    counts.downvotes,
    (
      SELECT v.vote
      FROM public.community_photo_votes v
      WHERE v.photo_id = p.id AND v.voter_id = p_viewer_id
    ),
    public.community_photo_wilson_lower_bound(
      counts.upvotes,
      counts.downvotes
    ),
    EXISTS (
      SELECT 1 FROM public.community_photo_feature_pins pin
      WHERE pin.photo_id = p.id AND pin.revoked_at IS NULL
    ),
    p.created_at
  FROM public.community_spot_photos p
  LEFT JOIN public.profiles pr ON pr.id = p.uploader_id
  CROSS JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE v.vote = 'up')::integer AS upvotes,
      count(*) FILTER (WHERE v.vote = 'down')::integer AS downvotes
    FROM public.community_photo_votes v
    WHERE v.photo_id = p.id
  ) counts
  WHERE p.id = p_photo_id
    AND p.processing_status = 'ready'
    AND p.moderation_status = 'visible'
    AND p.lifecycle_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.community_photo_feature_config config
      WHERE config.singleton AND config.read_enabled
    )
    AND (
      (
        p.target_type = 'beach'
        AND p.visibility = 'public'
        AND EXISTS (
          SELECT 1 FROM public.beaches b
          WHERE b.id = p.beach_id AND COALESCE(b.is_private, false) = false
        )
      )
      OR
      (
        p.target_type = 'custom_spot'
        AND EXISTS (
          SELECT 1 FROM public.custom_spots cs
          WHERE cs.id = p.custom_spot_id
            AND cs.deleted_at IS NULL
            AND (
              (p.visibility = 'public' AND cs.visibility = 'public')
              OR (
                p.visibility = 'private'
                AND cs.user_id = p_viewer_id
                AND p.uploader_id = p_viewer_id
              )
            )
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.resolve_community_spot_photo_batch_v1(
  p_targets jsonb,
  p_viewer_id uuid DEFAULT NULL,
  p_limit_per_target integer DEFAULT 6
)
RETURNS TABLE (
  photo_id uuid,
  target_type text,
  target_id uuid,
  visibility text,
  width integer,
  height integer,
  uploader_id uuid,
  display_name text,
  upvotes integer,
  downvotes integer,
  viewer_vote text,
  wilson_score double precision,
  is_pinned boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT resolved.*
  FROM jsonb_to_recordset(p_targets) AS target(target_type text, target_id uuid)
  CROSS JOIN LATERAL public.resolve_community_spot_photos_v1(
    target.target_type,
    target.target_id,
    p_viewer_id,
    LEAST(GREATEST(p_limit_per_target, 1), 20)
  ) resolved
$$;

CREATE OR REPLACE FUNCTION public.vote_community_spot_photo_v1(
  p_photo_id uuid,
  p_voter_id uuid,
  p_vote text,
  p_idempotency_key uuid
)
RETURNS TABLE(photo_id uuid, vote text, upvotes integer, downvotes integer, vote_score double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  photo_visibility text;
  ups integer;
  downs integer;
  previous_reason text;
  current_vote text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_photo_feature_config
    WHERE singleton AND read_enabled AND writes_enabled
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;
  SELECT e.reason_code INTO previous_reason
  FROM public.community_photo_action_events e
  WHERE e.actor_id = p_voter_id
    AND e.action = 'vote'
    AND e.idempotency_key = p_idempotency_key;
  IF previous_reason IS NOT NULL THEN
    IF previous_reason <> COALESCE(p_vote, 'cleared') THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    SELECT v.vote INTO current_vote
    FROM public.community_photo_votes v
    WHERE v.photo_id = p_photo_id AND v.voter_id = p_voter_id;
    SELECT
      count(*) FILTER (WHERE v.vote = 'up')::integer,
      count(*) FILTER (WHERE v.vote = 'down')::integer
    INTO ups, downs
    FROM public.community_photo_votes v WHERE v.photo_id = p_photo_id;
    RETURN QUERY SELECT
      p_photo_id, current_vote, ups, downs,
      public.community_photo_wilson_lower_bound(ups, downs);
    RETURN;
  END IF;
  SELECT uploader_id, visibility INTO owner_id, photo_visibility
  FROM public.community_spot_photos
  WHERE id = p_photo_id AND processing_status = 'ready'
    AND moderation_status = 'visible' AND lifecycle_status = 'active'
  FOR UPDATE;
  IF photo_visibility IS NULL OR photo_visibility <> 'public' THEN
    RAISE EXCEPTION 'photo_not_found';
  END IF;
  IF owner_id IS NOT NULL AND owner_id = p_voter_id THEN
    RAISE EXCEPTION 'photo_owner_cannot_vote';
  END IF;
  IF p_vote IS NULL THEN
    DELETE FROM public.community_photo_votes
    WHERE community_photo_votes.photo_id = p_photo_id
      AND voter_id = p_voter_id;
  ELSIF p_vote IN ('up', 'down') THEN
    INSERT INTO public.community_photo_votes (photo_id, voter_id, vote)
    VALUES (p_photo_id, p_voter_id, p_vote)
    ON CONFLICT ON CONSTRAINT community_photo_votes_pkey DO UPDATE
    SET vote = EXCLUDED.vote, updated_at = now();
  ELSE
    RAISE EXCEPTION 'invalid_vote';
  END IF;
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  ) VALUES (
    p_photo_id, p_voter_id, 'vote', 'accepted', COALESCE(p_vote, 'cleared'),
    p_idempotency_key
  )
  ON CONFLICT (actor_id, action, idempotency_key) DO NOTHING;
  SELECT
    count(*) FILTER (WHERE v.vote = 'up')::integer,
    count(*) FILTER (WHERE v.vote = 'down')::integer
  INTO ups, downs
  FROM public.community_photo_votes v WHERE v.photo_id = p_photo_id;
  RETURN QUERY SELECT
    p_photo_id, p_vote, ups, downs,
    public.community_photo_wilson_lower_bound(ups, downs);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_community_spot_photo_v1(
  p_photo_id uuid,
  p_reporter_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS TABLE(photo_id uuid, status text, report_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  photo_visibility text;
  quality_reports integer;
  all_reports integer;
  should_hide boolean;
  previous_reason text;
  current_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_photo_feature_config
    WHERE singleton AND read_enabled AND writes_enabled
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;
  IF p_reason NOT IN ('explicit', 'privacy', 'safety', 'wrong_spot', 'stale') THEN
    RAISE EXCEPTION 'invalid_report';
  END IF;
  SELECT e.reason_code INTO previous_reason
  FROM public.community_photo_action_events e
  WHERE e.actor_id = p_reporter_id
    AND e.action = 'report'
    AND e.idempotency_key = p_idempotency_key;
  IF previous_reason IS NOT NULL THEN
    IF previous_reason <> p_reason THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    SELECT
      CASE WHEN p.moderation_status = 'hidden' THEN 'hidden' ELSE 'visible' END
    INTO current_status
    FROM public.community_spot_photos p WHERE p.id = p_photo_id;
    IF current_status IS NULL THEN RAISE EXCEPTION 'photo_not_found'; END IF;
    SELECT count(*)::integer INTO all_reports
    FROM public.community_photo_reports reports
    WHERE reports.photo_id = p_photo_id;
    RETURN QUERY SELECT p_photo_id, current_status, all_reports;
    RETURN;
  END IF;
  SELECT uploader_id, visibility INTO owner_id, photo_visibility
  FROM public.community_spot_photos
  WHERE id = p_photo_id AND visibility = 'public'
    AND processing_status = 'ready'
    AND moderation_status = 'visible'
    AND lifecycle_status = 'active'
  FOR UPDATE;
  IF photo_visibility IS NULL THEN
    RAISE EXCEPTION 'photo_not_found';
  END IF;
  IF owner_id IS NOT NULL AND owner_id = p_reporter_id THEN
    RAISE EXCEPTION 'photo_owner_cannot_report';
  END IF;
  INSERT INTO public.community_photo_reports (photo_id, reporter_id, reason)
  VALUES (p_photo_id, p_reporter_id, p_reason)
  ON CONFLICT ON CONSTRAINT community_photo_reports_pkey DO UPDATE
  SET reason = EXCLUDED.reason, updated_at = now();
  SELECT
    count(*) FILTER (WHERE reports.reason IN ('wrong_spot', 'stale'))::integer,
    count(*)::integer
  INTO quality_reports, all_reports
  FROM public.community_photo_reports reports
  WHERE reports.photo_id = p_photo_id;
  should_hide := p_reason IN ('explicit', 'privacy', 'safety') OR quality_reports >= 3;
  IF should_hide THEN
    UPDATE public.community_spot_photos
    SET moderation_status = 'hidden',
        hidden_reason = CASE
          WHEN p_reason IN ('explicit', 'privacy', 'safety') THEN p_reason
          ELSE 'quality_reports'
        END,
        updated_at = now()
    WHERE id = p_photo_id;
    INSERT INTO public.community_photo_moderation_events (
      photo_id, actor_id, action, reason, idempotency_key
    ) VALUES (
      p_photo_id, NULL, 'auto_hide',
      CASE WHEN p_reason IN ('explicit', 'privacy', 'safety')
        THEN p_reason ELSE 'three_unique_quality_reporters' END,
      p_idempotency_key
    )
    ON CONFLICT (actor_id, idempotency_key) DO NOTHING;
  END IF;
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  ) VALUES (
    p_photo_id, p_reporter_id, 'report', 'accepted', p_reason, p_idempotency_key
  )
  ON CONFLICT (actor_id, action, idempotency_key) DO NOTHING;
  RETURN QUERY SELECT p_photo_id, CASE WHEN should_hide THEN 'hidden' ELSE 'visible' END, all_reports;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_community_spot_photo_v1(
  p_photo_id uuid,
  p_uploader_id uuid,
  p_idempotency_key uuid
)
RETURNS TABLE(photo_id uuid, status text, recoverable_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recovery_at timestamptz;
  previous_event boolean;
BEGIN
  SELECT true INTO previous_event
  FROM public.community_photo_action_events e
  WHERE e.actor_id = p_uploader_id
    AND e.action = 'remove'
    AND e.idempotency_key = p_idempotency_key;
  IF previous_event THEN
    SELECT p.recoverable_until INTO recovery_at
    FROM public.community_spot_photos p
    WHERE p.id = p_photo_id AND p.uploader_id = p_uploader_id;
    IF recovery_at IS NULL THEN RAISE EXCEPTION 'photo_not_found'; END IF;
    RETURN QUERY SELECT p_photo_id, 'removed'::text, recovery_at;
    RETURN;
  END IF;
  UPDATE public.community_spot_photos
  SET lifecycle_status = 'removed',
      removed_at = now(),
      recoverable_until = now() + interval '30 days',
      updated_at = now()
  WHERE id = p_photo_id AND uploader_id = p_uploader_id
    AND lifecycle_status = 'active'
  RETURNING community_spot_photos.recoverable_until INTO recovery_at;
  IF recovery_at IS NULL THEN
    RAISE EXCEPTION 'photo_not_found';
  END IF;
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  ) VALUES (
    p_photo_id, p_uploader_id, 'remove', 'accepted', 'contributor_removed',
    p_idempotency_key
  )
  ON CONFLICT (actor_id, action, idempotency_key) DO NOTHING;
  RETURN QUERY SELECT p_photo_id, 'removed'::text, recovery_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_owned_removed_community_spot_photos_v1(
  p_uploader_id uuid
)
RETURNS TABLE (
  photo_id uuid,
  target_type text,
  target_id uuid,
  recoverable_until timestamptz,
  moderation_status text,
  has_active_hold boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.target_type,
    COALESCE(p.beach_id, p.custom_spot_id),
    p.recoverable_until,
    p.moderation_status,
    EXISTS (
      SELECT 1 FROM public.community_photo_investigation_holds h
      WHERE h.photo_id = p.id AND h.released_at IS NULL
    )
  FROM public.community_spot_photos p
  WHERE p.uploader_id = p_uploader_id
    AND p.lifecycle_status = 'removed'
    AND p.processing_status = 'ready'
    AND p.recoverable_until > now()
    AND EXISTS (
      SELECT 1 FROM public.community_photo_feature_config config
      WHERE config.singleton AND config.read_enabled
    )
  ORDER BY p.recoverable_until ASC, p.id ASC
  LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.recover_owned_community_spot_photo_v1(
  p_photo_id uuid,
  p_uploader_id uuid,
  p_idempotency_key uuid
)
RETURNS TABLE(photo_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_photo_id uuid;
  locked_photo_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_photo_feature_config
    WHERE singleton AND read_enabled AND writes_enabled
  ) THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;
  SELECT e.photo_id INTO previous_photo_id
  FROM public.community_photo_action_events e
  WHERE e.actor_id = p_uploader_id
    AND e.action = 'recover'
    AND e.idempotency_key = p_idempotency_key;
  IF previous_photo_id IS NOT NULL THEN
    IF previous_photo_id <> p_photo_id THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN QUERY SELECT p_photo_id, 'active'::text;
    RETURN;
  END IF;

  SELECT p.id INTO locked_photo_id
  FROM public.community_spot_photos p
  WHERE p.id = p_photo_id
    AND p.uploader_id = p_uploader_id
    AND p.lifecycle_status = 'removed'
    AND p.processing_status = 'ready'
    AND p.moderation_status = 'visible'
    AND p.recoverable_until > now()
    AND (
      (
        p.target_type = 'beach'
        AND p.visibility = 'public'
        AND EXISTS (
          SELECT 1 FROM public.beaches b
          WHERE b.id = p.beach_id AND COALESCE(b.is_private, false) = false
        )
      )
      OR (
        p.target_type = 'custom_spot'
        AND EXISTS (
          SELECT 1 FROM public.custom_spots cs
          WHERE cs.id = p.custom_spot_id
            AND cs.deleted_at IS NULL
            AND (
              (p.visibility = 'public' AND cs.visibility = 'public')
              OR (
                p.visibility = 'private'
                AND cs.user_id = p_uploader_id
              )
            )
        )
      )
    )
  FOR UPDATE;
  IF locked_photo_id IS NULL OR EXISTS (
    SELECT 1 FROM public.community_photo_investigation_holds h
    WHERE h.photo_id = p_photo_id AND h.released_at IS NULL
  ) THEN
    RAISE EXCEPTION 'photo_not_recoverable';
  END IF;

  UPDATE public.community_spot_photos
  SET lifecycle_status = 'active',
      removed_at = NULL,
      recoverable_until = NULL,
      updated_at = now()
  WHERE id = locked_photo_id;
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  ) VALUES (
    p_photo_id, p_uploader_id, 'recover', 'accepted', 'owner_recovered',
    p_idempotency_key
  );
  RETURN QUERY SELECT p_photo_id, 'active'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_community_spot_photo_v1(
  p_photo_id uuid,
  p_actor_id uuid,
  p_action text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_status text;
  changed integer;
  previous_action text;
BEGIN
  IF p_action = 'hide' THEN
    new_status := 'hidden';
  ELSIF p_action = 'restore' THEN
    new_status := 'visible';
  ELSE
    RAISE EXCEPTION 'invalid_moderation_action';
  END IF;
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> (
      CASE WHEN p_action = 'hide' THEN 'admin_hide' ELSE 'admin_restore' END
    ) THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN new_status;
  END IF;
  UPDATE public.community_spot_photos
  SET moderation_status = new_status,
      hidden_reason = CASE WHEN new_status = 'hidden' THEN left(p_reason, 280) END,
      updated_at = now()
  WHERE id = p_photo_id AND lifecycle_status = 'active'
    AND processing_status = 'ready';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'photo_not_found'; END IF;
  INSERT INTO public.community_photo_moderation_events (
    photo_id, actor_id, action, reason, idempotency_key
  ) VALUES (
    p_photo_id, p_actor_id,
    CASE WHEN p_action = 'hide' THEN 'admin_hide' ELSE 'admin_restore' END,
    left(p_reason, 280), p_idempotency_key
  );
  RETURN new_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_community_spot_photo_v1(
  p_photo_id uuid,
  p_actor_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_idempotency_key uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_action text;
BEGIN
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> 'admin_pin' THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN true;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_spot_photos p
    WHERE p.id = p_photo_id
      AND p.processing_status = 'ready'
      AND p.moderation_status = 'visible'
      AND p.lifecycle_status = 'active'
      AND p.visibility = 'public'
      AND p.target_type = p_target_type
      AND COALESCE(p.beach_id, p.custom_spot_id) = p_target_id
      AND (
        p.target_type = 'beach'
        OR EXISTS (
          SELECT 1 FROM public.custom_spots cs
          WHERE cs.id = p.custom_spot_id
            AND cs.deleted_at IS NULL
            AND cs.visibility = 'public'
        )
      )
  ) THEN
    RAISE EXCEPTION 'photo_not_found';
  END IF;
  UPDATE public.community_photo_feature_pins
  SET revoked_at = now(), revoked_by = p_actor_id
  WHERE revoked_at IS NULL AND (
    (p_target_type = 'beach' AND beach_id = p_target_id)
    OR (p_target_type = 'custom_spot' AND custom_spot_id = p_target_id)
  );
  INSERT INTO public.community_photo_feature_pins (
    photo_id, target_type, beach_id, custom_spot_id, pinned_by
  ) VALUES (
    p_photo_id, p_target_type,
    CASE WHEN p_target_type = 'beach' THEN p_target_id END,
    CASE WHEN p_target_type = 'custom_spot' THEN p_target_id END,
    p_actor_id
  );
  INSERT INTO public.community_photo_moderation_events (
    photo_id, actor_id, action, reason, idempotency_key
  ) VALUES (p_photo_id, p_actor_id, 'admin_pin', 'manual_feature', p_idempotency_key);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpin_community_spot_photo_v1(
  p_photo_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
  previous_action text;
BEGIN
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> 'admin_unpin' THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN true;
  END IF;
  UPDATE public.community_photo_feature_pins
  SET revoked_at = now(), revoked_by = p_actor_id
  WHERE photo_id = p_photo_id AND revoked_at IS NULL;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN RAISE EXCEPTION 'pin_not_found'; END IF;
  INSERT INTO public.community_photo_moderation_events (
    photo_id, actor_id, action, reason, idempotency_key
  ) VALUES (p_photo_id, p_actor_id, 'admin_unpin', 'manual_unfeature', p_idempotency_key);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_community_spot_photo_v1(
  p_photo_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
  previous_action text;
BEGIN
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> 'admin_recover' THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN true;
  END IF;
  UPDATE public.community_spot_photos p
  SET lifecycle_status = 'active', removed_at = NULL, recoverable_until = NULL,
      updated_at = now()
  WHERE p.id = p_photo_id
    AND p.lifecycle_status = 'removed'
    AND p.recoverable_until > now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'photo_not_recoverable'; END IF;
  INSERT INTO public.community_photo_moderation_events (
    photo_id, actor_id, action, reason, idempotency_key
  ) VALUES (p_photo_id, p_actor_id, 'admin_recover', 'manual_recovery', p_idempotency_key);
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  ) VALUES (p_photo_id, p_actor_id, 'recover', 'accepted', 'admin_recovered', p_idempotency_key);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.hold_community_spot_photo_v1(
  p_photo_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS TABLE(hold_id uuid, reason text, placed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_hold_id uuid;
  new_placed_at timestamptz;
  previous_action text;
  photo_lifecycle text;
BEGIN
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> 'admin_hold' THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN QUERY
    SELECT h.id, h.reason, h.placed_at
    FROM public.community_photo_investigation_holds h
    WHERE h.photo_id = p_photo_id AND h.released_at IS NULL;
    RETURN;
  END IF;
  IF char_length(p_reason) NOT BETWEEN 1 AND 280 THEN
    RAISE EXCEPTION 'invalid_request';
  END IF;
  SELECT p.lifecycle_status INTO photo_lifecycle
  FROM public.community_spot_photos p
  WHERE p.id = p_photo_id AND p.processing_status = 'ready'
  FOR UPDATE;
  IF photo_lifecycle IS NULL OR photo_lifecycle NOT IN ('active', 'removed') THEN
    RAISE EXCEPTION 'photo_not_found';
  END IF;
  INSERT INTO public.community_photo_investigation_holds (
    photo_id, reason, placed_by
  ) VALUES (p_photo_id, p_reason, p_actor_id)
  ON CONFLICT (photo_id) WHERE released_at IS NULL DO UPDATE
  SET reason = EXCLUDED.reason, placed_by = EXCLUDED.placed_by, placed_at = now()
  RETURNING id, community_photo_investigation_holds.placed_at
  INTO new_hold_id, new_placed_at;
  INSERT INTO public.community_photo_moderation_events (
    photo_id, actor_id, action, reason, idempotency_key
  ) VALUES (
    p_photo_id, p_actor_id, 'admin_hold', p_reason, p_idempotency_key
  );
  RETURN QUERY SELECT new_hold_id, p_reason, new_placed_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_community_spot_photo_hold_v1(
  p_photo_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
  previous_action text;
BEGIN
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> 'admin_release_hold' THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN true;
  END IF;
  UPDATE public.community_photo_investigation_holds
  SET released_at = now(), released_by = p_actor_id
  WHERE photo_id = p_photo_id AND released_at IS NULL;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN RAISE EXCEPTION 'hold_not_found'; END IF;
  INSERT INTO public.community_photo_moderation_events (
    photo_id, actor_id, action, reason, idempotency_key
  ) VALUES (
    p_photo_id, p_actor_id, 'admin_release_hold', 'manual_release',
    p_idempotency_key
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restrict_community_photo_contributor_v1(
  p_contributor_id uuid,
  p_actor_id uuid,
  p_reason_code text,
  p_restricted_until timestamptz,
  p_idempotency_key uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_action text;
BEGIN
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> 'admin_restrict_contributor' THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN true;
  END IF;
  IF char_length(p_reason_code) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid_request';
  END IF;
  INSERT INTO public.community_photo_contributor_restrictions (
    contributor_id, restricted_until, reason_code, applied_by,
    applied_at, lifted_at, lifted_by
  ) VALUES (
    p_contributor_id, p_restricted_until, p_reason_code, p_actor_id,
    now(), NULL, NULL
  )
  ON CONFLICT (contributor_id) DO UPDATE SET
    restricted_until = EXCLUDED.restricted_until,
    reason_code = EXCLUDED.reason_code,
    applied_by = EXCLUDED.applied_by,
    applied_at = now(),
    lifted_at = NULL,
    lifted_by = NULL;
  INSERT INTO public.community_photo_moderation_events (
    subject_user_id, actor_id, action, reason, idempotency_key
  ) VALUES (
    p_contributor_id, p_actor_id, 'admin_restrict_contributor',
    p_reason_code, p_idempotency_key
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unrestrict_community_photo_contributor_v1(
  p_contributor_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
  previous_action text;
BEGIN
  SELECT e.action INTO previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_idempotency_key;
  IF previous_action IS NOT NULL THEN
    IF previous_action <> 'admin_unrestrict_contributor' THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN true;
  END IF;
  UPDATE public.community_photo_contributor_restrictions
  SET lifted_at = now(), lifted_by = p_actor_id
  WHERE contributor_id = p_contributor_id AND lifted_at IS NULL;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN RAISE EXCEPTION 'restriction_not_found'; END IF;
  INSERT INTO public.community_photo_moderation_events (
    subject_user_id, actor_id, action, reason, idempotency_key
  ) VALUES (
    p_contributor_id, p_actor_id, 'admin_unrestrict_contributor',
    'manual_release', p_idempotency_key
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_community_spot_photos_v1(
  p_status text DEFAULT 'all',
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_before timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH page AS (
    SELECT
      p.*,
      NULLIF(btrim(pr.display_name), '') AS display_name,
      count(DISTINCT v.voter_id) FILTER (WHERE v.vote = 'up')::integer AS upvotes,
      count(DISTINCT v.voter_id) FILTER (WHERE v.vote = 'down')::integer AS downvotes,
      count(DISTINCT r.reporter_id) FILTER (
        WHERE r.reason IN ('explicit', 'privacy', 'safety')
      )::integer AS severe_reports,
      count(DISTINCT r.reporter_id) FILTER (
        WHERE r.reason IN ('wrong_spot', 'stale')
      )::integer AS quality_reports,
      count(DISTINCT r.reporter_id)::integer AS total_reports,
      EXISTS (
        SELECT 1 FROM public.community_photo_feature_pins pin
        WHERE pin.photo_id = p.id AND pin.revoked_at IS NULL
      ) AS is_pinned,
      (
        SELECT jsonb_build_object(
          'id', h.id, 'reason', h.reason, 'placedAt', h.placed_at
        )
        FROM public.community_photo_investigation_holds h
        WHERE h.photo_id = p.id AND h.released_at IS NULL
      ) AS hold,
      (
        SELECT jsonb_build_object(
          'reasonCode', cr.reason_code, 'restrictedUntil', cr.restricted_until
        )
        FROM public.community_photo_contributor_restrictions cr
        WHERE cr.contributor_id = p.uploader_id AND cr.lifted_at IS NULL
          AND (cr.restricted_until IS NULL OR cr.restricted_until > now())
      ) AS contributor_restriction
    FROM public.community_spot_photos p
    LEFT JOIN public.profiles pr ON pr.id = p.uploader_id
    LEFT JOIN public.community_photo_votes v ON v.photo_id = p.id
    LEFT JOIN public.community_photo_reports r ON r.photo_id = p.id
    WHERE (p_status = 'all'
      OR (p_status = 'visible' AND p.moderation_status = 'visible' AND p.lifecycle_status = 'active')
      OR (p_status = 'hidden' AND p.moderation_status = 'hidden' AND p.lifecycle_status = 'active')
      OR (p_status = 'removed' AND p.lifecycle_status = 'removed'))
      AND (p_target_type IS NULL OR p.target_type = p_target_type)
      AND (p_target_id IS NULL OR COALESCE(p.beach_id, p.custom_spot_id) = p_target_id)
      AND (p_before IS NULL OR p.created_at < p_before)
    GROUP BY p.id, pr.display_name
    ORDER BY p.created_at DESC, p.id ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT jsonb_build_object(
    'photos',
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'targetType', target_type,
      'targetId', COALESCE(beach_id, custom_spot_id),
      'imageUrl', '/api/community-photos/' || id || '/image',
      'visibility', visibility,
      'processingStatus', processing_status,
      'moderationStatus', moderation_status,
      'lifecycleStatus', lifecycle_status,
          'attribution', jsonb_build_object(
            'kind', CASE
              WHEN uploader_id IS NOT NULL AND display_name IS NOT NULL
                THEN 'profile'
              ELSE 'community'
            END,
            'displayName', COALESCE(display_name, 'Quiver community'),
            'profileId', CASE
              WHEN display_name IS NOT NULL THEN uploader_id
              ELSE NULL
            END
          ),
      'upvotes', upvotes,
      'downvotes', downvotes,
      'reportCounts', jsonb_build_object(
        'severe', severe_reports, 'quality', quality_reports, 'total', total_reports
      ),
      'isPinned', is_pinned,
      'hold', hold,
      'contributorRestriction', contributor_restriction,
      'createdAt', created_at,
      'removedAt', removed_at,
      'recoverableUntil', recoverable_until
    ) ORDER BY created_at DESC, id ASC), '[]'::jsonb),
    'nextCursor',
    CASE WHEN count(*) = LEAST(GREATEST(p_limit, 1), 100)
      THEN min(created_at)::text ELSE NULL END
  )
  FROM page
$$;

CREATE OR REPLACE FUNCTION public.get_community_photo_monitoring_v1(
  p_since timestamptz DEFAULT now() - interval '24 hours'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'since', p_since,
    'uploadsReserved', count(*) FILTER (
      WHERE e.action = 'upload_reserved' AND e.outcome = 'accepted'
    ),
    'uploadsReady', count(*) FILTER (
      WHERE e.action = 'upload_ready' AND e.outcome = 'accepted'
    ),
    'uploadsFailed', count(*) FILTER (
      WHERE e.action = 'upload_failed'
    ),
    'reportsAccepted', count(*) FILTER (
      WHERE e.action = 'report' AND e.outcome = 'accepted'
    ),
    'purgesCompleted', count(*) FILTER (
      WHERE e.action = 'purge' AND e.outcome = 'accepted'
    ),
    'processingStuck', (
      SELECT count(*) FROM public.community_spot_photos p
      WHERE p.processing_status = 'processing'
        AND p.updated_at < now() - interval '15 minutes'
    ),
    'processingCleanup', (
      SELECT count(*) FROM public.community_spot_photos p
      WHERE p.processing_status = 'cleanup'
    ),
    'orphanObjects', (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'community-spot-photos'
        AND o.created_at < now() - interval '15 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM public.community_spot_photos p
          WHERE p.storage_path = o.name
        )
    ),
    'hiddenActive', (
      SELECT count(*) FROM public.community_spot_photos p
      WHERE p.lifecycle_status = 'active' AND p.moderation_status = 'hidden'
    ),
    'expiredRemovalBacklog', (
      SELECT count(*) FROM public.community_spot_photos p
      WHERE p.lifecycle_status = 'removed' AND p.recoverable_until <= now()
        AND NOT EXISTS (
          SELECT 1 FROM public.community_photo_investigation_holds h
          WHERE h.photo_id = p.id AND h.released_at IS NULL
        )
    ),
    'activeHolds', (
      SELECT count(*) FROM public.community_photo_investigation_holds h
      WHERE h.released_at IS NULL
    )
  )
  FROM public.community_photo_action_events e
  WHERE e.created_at >= p_since
$$;

CREATE OR REPLACE FUNCTION public.get_community_spot_photo_image_v1(
  p_photo_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS TABLE(storage_path text, content_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.storage_path, p.content_type
  FROM public.community_spot_photos p
  WHERE p.id = p_photo_id
    AND p.processing_status = 'ready'
    AND EXISTS (
      SELECT 1 FROM public.community_photo_feature_config config
      WHERE config.singleton AND config.read_enabled
    )
    AND (
      (
        p.lifecycle_status = 'active'
        AND p.moderation_status = 'visible'
        AND p.target_type = 'beach'
        AND p.visibility = 'public'
        AND EXISTS (
          SELECT 1 FROM public.beaches b
          WHERE b.id = p.beach_id
            AND COALESCE(b.is_private, false) = false
        )
      )
      OR (
        p.lifecycle_status = 'active'
        AND p.moderation_status = 'visible'
        AND p.target_type = 'custom_spot'
        AND EXISTS (
          SELECT 1 FROM public.custom_spots cs
          WHERE cs.id = p.custom_spot_id
            AND cs.deleted_at IS NULL
            AND (
              (p.visibility = 'public' AND cs.visibility = 'public')
              OR (
                p.visibility = 'private'
                AND cs.user_id = p_viewer_id
                AND p.uploader_id = p_viewer_id
              )
            )
        )
      )
      OR (
        p.lifecycle_status = 'removed'
        AND p.recoverable_until > now()
        AND p.uploader_id IS NOT NULL
        AND p.uploader_id = p_viewer_id
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.get_admin_community_spot_photo_image_v1(
  p_photo_id uuid,
  p_actor_id uuid,
  p_audit_id uuid
)
RETURNS TABLE(storage_path text, content_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_storage_path text;
  resolved_content_type text;
  previous_photo_id uuid;
  previous_action text;
BEGIN
  SELECT e.photo_id, e.action INTO previous_photo_id, previous_action
  FROM public.community_photo_moderation_events e
  WHERE e.actor_id = p_actor_id AND e.idempotency_key = p_audit_id;
  IF previous_action IS NOT NULL AND (
    previous_action <> 'admin_view_hidden' OR previous_photo_id <> p_photo_id
  ) THEN
    RAISE EXCEPTION 'idempotency_conflict';
  END IF;

  SELECT p.storage_path, p.content_type
    INTO resolved_storage_path, resolved_content_type
  FROM public.community_spot_photos p
  WHERE p.id = p_photo_id
    AND p.processing_status = 'ready'
    AND p.moderation_status = 'hidden'
    AND p.lifecycle_status IN ('active', 'removed')
  FOR SHARE;
  IF resolved_storage_path IS NULL THEN
    RAISE EXCEPTION 'photo_not_found';
  END IF;

  IF previous_action IS NULL THEN
    INSERT INTO public.community_photo_moderation_events (
      photo_id, actor_id, action, reason, idempotency_key
    ) VALUES (
      p_photo_id, p_actor_id, 'admin_view_hidden', 'hidden_media_view',
      p_audit_id
    );
  END IF;
  RETURN QUERY SELECT resolved_storage_path, resolved_content_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_stuck_community_spot_photo_uploads_v1(
  p_now timestamptz DEFAULT now(),
  p_limit integer DEFAULT 100
)
RETURNS TABLE(photo_id uuid, storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT p.id
    FROM public.community_spot_photos p
    WHERE p.processing_status = 'processing'
      AND p.lifecycle_status = 'active'
      AND p.updated_at <= p_now - interval '15 minutes'
    ORDER BY p.updated_at ASC, p.id ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.community_spot_photos p
  SET processing_status = 'cleanup', updated_at = now()
  FROM candidates c
  WHERE p.id = c.id AND p.processing_status = 'processing'
  RETURNING p.id, p.storage_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_stuck_community_spot_photo_uploads_v1(
  p_photo_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  )
  SELECT
    p.id, p.uploader_id, 'upload_failed', 'failed', 'stuck_processing',
    p.idempotency_key
  FROM public.community_spot_photos p
  WHERE p.id = ANY(p_photo_ids) AND p.processing_status = 'cleanup'
  ON CONFLICT (actor_id, action, idempotency_key) DO NOTHING;
  DELETE FROM public.community_spot_photos p
  WHERE p.id = ANY(p_photo_ids) AND p.processing_status = 'cleanup';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stuck_community_spot_photo_uploads_v1(
  p_photo_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.community_spot_photos
  SET processing_status = 'processing', updated_at = now()
  WHERE id = ANY(p_photo_ids) AND processing_status = 'cleanup';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_orphan_community_photo_objects_v1(
  p_now timestamptz DEFAULT now(),
  p_limit integer DEFAULT 100
)
RETURNS TABLE(storage_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'community-spot-photos'
    AND o.created_at <= p_now - interval '15 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.community_spot_photos p
      WHERE p.storage_path = o.name
    )
  ORDER BY o.created_at ASC, o.name ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 500)
$$;

CREATE OR REPLACE FUNCTION public.purge_removed_community_spot_photos_v1(
  p_now timestamptz DEFAULT now(),
  p_limit integer DEFAULT 100
)
RETURNS TABLE(photo_id uuid, storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT p.id, p.storage_path
    FROM public.community_spot_photos p
    WHERE (
        (p.lifecycle_status = 'removed' AND p.recoverable_until <= p_now)
        OR
        (
          p.lifecycle_status = 'purging'
          AND p.updated_at <= p_now - interval '15 minutes'
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.community_photo_investigation_holds h
        WHERE h.photo_id = p.id AND h.released_at IS NULL
      )
    ORDER BY p.recoverable_until ASC, p.id ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.community_spot_photos p
    SET lifecycle_status = 'purging', updated_at = now()
    FROM candidates c
    WHERE p.id = c.id
      AND NOT EXISTS (
        SELECT 1 FROM public.community_photo_investigation_holds h
        WHERE h.photo_id = p.id AND h.released_at IS NULL
      )
    RETURNING p.id, p.storage_path
  )
  SELECT c.id, c.storage_path FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_purged_community_spot_photos_v1(
  p_photo_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  INSERT INTO public.community_photo_action_events (
    photo_id, actor_id, action, outcome, reason_code, idempotency_key
  )
  SELECT p.id, NULL, 'purge', 'accepted', 'retention_expired', gen_random_uuid()
  FROM public.community_spot_photos p
  WHERE p.id = ANY(p_photo_ids)
    AND p.lifecycle_status = 'purging'
    AND NOT EXISTS (
      SELECT 1 FROM public.community_photo_investigation_holds h
      WHERE h.photo_id = p.id AND h.released_at IS NULL
    );
  DELETE FROM public.community_spot_photos p
  WHERE p.id = ANY(p_photo_ids)
    AND p.lifecycle_status = 'purging'
    AND NOT EXISTS (
      SELECT 1 FROM public.community_photo_investigation_holds h
      WHERE h.photo_id = p.id AND h.released_at IS NULL
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_community_spot_photo_purge_v1(
  p_photo_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.community_spot_photos
  SET lifecycle_status = 'removed', updated_at = now()
  WHERE id = ANY(p_photo_ids) AND lifecycle_status = 'purging';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

DO $$
DECLARE
  signature regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.community_photo_wilson_lower_bound(integer,integer)'::regprocedure,
    'public.preflight_community_spot_photo_upload_v1(uuid,uuid)'::regprocedure,
    'public.reserve_community_spot_photo_v1(uuid,uuid,text,uuid,text,text,text,boolean,uuid)'::regprocedure,
    'public.finalize_community_spot_photo_v1(uuid,uuid,integer,integer)'::regprocedure,
    'public.fail_community_spot_photo_upload_v1(uuid,uuid,text)'::regprocedure,
    'public.resolve_community_spot_photos_v1(text,uuid,uuid,integer)'::regprocedure,
    'public.resolve_community_spot_photo_by_id_v1(uuid,uuid)'::regprocedure,
    'public.resolve_community_spot_photo_batch_v1(jsonb,uuid,integer)'::regprocedure,
    'public.vote_community_spot_photo_v1(uuid,uuid,text,uuid)'::regprocedure,
    'public.report_community_spot_photo_v1(uuid,uuid,text,uuid)'::regprocedure,
    'public.remove_community_spot_photo_v1(uuid,uuid,uuid)'::regprocedure,
    'public.list_owned_removed_community_spot_photos_v1(uuid)'::regprocedure,
    'public.recover_owned_community_spot_photo_v1(uuid,uuid,uuid)'::regprocedure,
    'public.moderate_community_spot_photo_v1(uuid,uuid,text,text,uuid)'::regprocedure,
    'public.pin_community_spot_photo_v1(uuid,uuid,text,uuid,uuid)'::regprocedure,
    'public.unpin_community_spot_photo_v1(uuid,uuid,uuid)'::regprocedure,
    'public.recover_community_spot_photo_v1(uuid,uuid,uuid)'::regprocedure,
    'public.hold_community_spot_photo_v1(uuid,uuid,text,uuid)'::regprocedure,
    'public.release_community_spot_photo_hold_v1(uuid,uuid,uuid)'::regprocedure,
    'public.restrict_community_photo_contributor_v1(uuid,uuid,text,timestamptz,uuid)'::regprocedure,
    'public.unrestrict_community_photo_contributor_v1(uuid,uuid,uuid)'::regprocedure,
    'public.admin_list_community_spot_photos_v1(text,text,uuid,integer,timestamptz)'::regprocedure,
    'public.get_community_photo_monitoring_v1(timestamptz)'::regprocedure,
    'public.get_community_spot_photo_image_v1(uuid,uuid)'::regprocedure,
    'public.get_admin_community_spot_photo_image_v1(uuid,uuid,uuid)'::regprocedure,
    'public.claim_stuck_community_spot_photo_uploads_v1(timestamptz,integer)'::regprocedure,
    'public.finalize_stuck_community_spot_photo_uploads_v1(uuid[])'::regprocedure,
    'public.release_stuck_community_spot_photo_uploads_v1(uuid[])'::regprocedure,
    'public.list_orphan_community_photo_objects_v1(timestamptz,integer)'::regprocedure,
    'public.purge_removed_community_spot_photos_v1(timestamptz,integer)'::regprocedure,
    'public.finalize_purged_community_spot_photos_v1(uuid[])'::regprocedure,
    'public.release_community_spot_photo_purge_v1(uuid[])'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
  END LOOP;
END $$;

COMMIT;
