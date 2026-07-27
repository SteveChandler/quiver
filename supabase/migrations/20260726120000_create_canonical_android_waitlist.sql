-- Canonical Android waitlist identity and evidence contract.
-- Existing lead, profile-intent, and tester-roster sources remain intact and
-- link to one deduplicated operational entry without fuzzy identity matching.

BEGIN;

CREATE TABLE public.android_waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  normalized_email_sha256 text UNIQUE CHECK (
    normalized_email_sha256 IS NULL
    OR normalized_email_sha256 ~ '^[a-f0-9]{64}$'
  ),
  first_joined_at timestamptz NOT NULL,
  last_joined_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (last_joined_at >= first_joined_at)
);

CREATE TABLE public.android_waitlist_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL
    REFERENCES public.android_waitlist_entries(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (
    source_kind IN ('anonymous_lead', 'profile_intent', 'roster_evidence')
  ),
  source_id uuid NOT NULL,
  roster_entry_id uuid
    REFERENCES public.android_tester_roster_entries(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 120),
  surface text NOT NULL CHECK (char_length(surface) BETWEEN 1 AND 80),
  placement text NOT NULL CHECK (char_length(placement) BETWEEN 1 AND 80),
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id),
  CHECK (
    source_kind = 'roster_evidence'
    OR roster_entry_id IS NULL
  ),
  CHECK (last_observed_at >= first_observed_at)
);

CREATE UNIQUE INDEX android_waitlist_source_links_roster_entry_uidx
  ON public.android_waitlist_source_links(roster_entry_id)
  WHERE roster_entry_id IS NOT NULL;

CREATE INDEX android_waitlist_source_links_entry_idx
  ON public.android_waitlist_source_links(entry_id);

CREATE TABLE public.android_waitlist_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL
    REFERENCES public.android_waitlist_entries(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type = 'android_waitlist_joined'),
  source_kind text NOT NULL CHECK (
    source_kind IN ('anonymous_lead', 'profile_intent', 'roster_evidence')
  ),
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, event_type)
);

ALTER TABLE public.android_waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_waitlist_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_waitlist_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.android_waitlist_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_waitlist_source_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_waitlist_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.android_waitlist_entries TO service_role;
GRANT ALL ON TABLE public.android_waitlist_source_links TO service_role;
GRANT ALL ON TABLE public.android_waitlist_events TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_android_waitlist_entry(
  p_user_id uuid,
  p_normalized_email_sha256 text,
  p_roster_entry_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_source text,
  p_surface text,
  p_placement text,
  p_observed_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_entry_id uuid;
  v_email_entry_id uuid;
  v_roster_entry_id uuid;
  v_source_entry_id uuid;
  v_entry_id uuid;
  v_merge_entry_id uuid;
  v_existing_user_id uuid;
  v_existing_email_sha256 text;
  v_merge_user_id uuid;
  v_merge_email_sha256 text;
  v_merge_first_joined_at timestamptz;
  v_merge_last_joined_at timestamptz;
  v_link_entry_id uuid;
BEGIN
  IF p_source_kind NOT IN (
      'anonymous_lead',
      'profile_intent',
      'roster_evidence'
    )
    OR p_source_id IS NULL
    OR p_observed_at IS NULL
    OR char_length(COALESCE(p_source, '')) NOT BETWEEN 1 AND 120
    OR char_length(COALESCE(p_surface, '')) NOT BETWEEN 1 AND 80
    OR char_length(COALESCE(p_placement, '')) NOT BETWEEN 1 AND 80
    OR (
      p_normalized_email_sha256 IS NOT NULL
      AND p_normalized_email_sha256 !~ '^[a-f0-9]{64}$'
    )
    OR (
      p_source_kind = 'roster_evidence'
      AND p_roster_entry_id IS NULL
    )
    OR (
      p_source_kind <> 'roster_evidence'
      AND p_roster_entry_id IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Invalid canonical Android waitlist source';
  END IF;

  -- Low-volume global serialization makes precedence deterministic under
  -- concurrent exact lead/profile/roster observations.
  PERFORM pg_catalog.pg_advisory_xact_lock(20560726);

  IF p_user_id IS NOT NULL THEN
    SELECT entry.id
    INTO v_user_entry_id
    FROM public.android_waitlist_entries AS entry
    WHERE entry.user_id = p_user_id;
  END IF;

  IF p_normalized_email_sha256 IS NOT NULL THEN
    SELECT entry.id
    INTO v_email_entry_id
    FROM public.android_waitlist_entries AS entry
    WHERE entry.normalized_email_sha256 = p_normalized_email_sha256;
  END IF;

  IF p_roster_entry_id IS NOT NULL THEN
    SELECT link.entry_id
    INTO v_roster_entry_id
    FROM public.android_waitlist_source_links AS link
    WHERE link.roster_entry_id = p_roster_entry_id;
  END IF;

  SELECT link.entry_id
  INTO v_source_entry_id
  FROM public.android_waitlist_source_links AS link
  WHERE link.source_kind = p_source_kind
    AND link.source_id = p_source_id;

  v_entry_id := COALESCE(
    v_user_entry_id,
    v_email_entry_id,
    v_roster_entry_id,
    v_source_entry_id
  );

  IF v_entry_id IS NULL THEN
    INSERT INTO public.android_waitlist_entries (
      user_id,
      normalized_email_sha256,
      first_joined_at,
      last_joined_at
    )
    SELECT
      p_user_id,
      p_normalized_email_sha256,
      p_observed_at,
      p_observed_at
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.android_waitlist_entries AS entry
      WHERE (p_user_id IS NOT NULL AND entry.user_id = p_user_id)
        OR (
          p_normalized_email_sha256 IS NOT NULL
          AND entry.normalized_email_sha256 = p_normalized_email_sha256
        )
    )
    RETURNING id INTO v_entry_id;
  END IF;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Canonical Android waitlist identity changed concurrently';
  END IF;

  FOR v_merge_entry_id IN
    SELECT DISTINCT candidate.entry_id
    FROM unnest(ARRAY[
      v_user_entry_id,
      v_email_entry_id,
      v_roster_entry_id,
      v_source_entry_id
    ]) AS candidate(entry_id)
    WHERE candidate.entry_id IS NOT NULL
      AND candidate.entry_id <> v_entry_id
  LOOP
    SELECT entry.user_id, entry.normalized_email_sha256
    INTO v_existing_user_id, v_existing_email_sha256
    FROM public.android_waitlist_entries AS entry
    WHERE entry.id = v_entry_id
    FOR UPDATE;

    SELECT
      merge_entry.user_id,
      merge_entry.normalized_email_sha256,
      merge_entry.first_joined_at,
      merge_entry.last_joined_at
    INTO
      v_merge_user_id,
      v_merge_email_sha256,
      v_merge_first_joined_at,
      v_merge_last_joined_at
    FROM public.android_waitlist_entries AS merge_entry
    WHERE merge_entry.id = v_merge_entry_id
    FOR UPDATE;

    IF (
      v_existing_user_id IS NOT NULL
      AND v_merge_user_id IS NOT NULL
      AND v_merge_user_id <> v_existing_user_id
    ) OR (
      v_existing_email_sha256 IS NOT NULL
      AND v_merge_email_sha256 IS NOT NULL
      AND v_merge_email_sha256 <> v_existing_email_sha256
    ) THEN
      RAISE EXCEPTION 'Conflicting exact Android waitlist identities';
    END IF;

    UPDATE public.android_waitlist_entries
    SET
      user_id = NULL,
      normalized_email_sha256 = NULL
    WHERE id = v_merge_entry_id;

    UPDATE public.android_waitlist_entries
    SET
      user_id = COALESCE(user_id, v_merge_user_id),
      normalized_email_sha256 = COALESCE(
        normalized_email_sha256,
        v_merge_email_sha256
      ),
      first_joined_at = LEAST(
        first_joined_at,
        v_merge_first_joined_at
      ),
      last_joined_at = GREATEST(
        last_joined_at,
        v_merge_last_joined_at
      ),
      updated_at = now()
    WHERE id = v_entry_id;

    UPDATE public.android_waitlist_source_links
    SET entry_id = v_entry_id, updated_at = now()
    WHERE entry_id = v_merge_entry_id;

    IF EXISTS (
      SELECT 1
      FROM public.android_waitlist_events
      WHERE entry_id = v_entry_id
        AND event_type = 'android_waitlist_joined'
    ) THEN
      DELETE FROM public.android_waitlist_events
      WHERE entry_id = v_merge_entry_id
        AND event_type = 'android_waitlist_joined';
    ELSE
      UPDATE public.android_waitlist_events
      SET entry_id = v_entry_id
      WHERE entry_id = v_merge_entry_id
        AND event_type = 'android_waitlist_joined';
    END IF;

    DELETE FROM public.android_waitlist_entries
    WHERE id = v_merge_entry_id;
  END LOOP;

  SELECT entry.user_id, entry.normalized_email_sha256
  INTO v_existing_user_id, v_existing_email_sha256
  FROM public.android_waitlist_entries AS entry
  WHERE entry.id = v_entry_id
  FOR UPDATE;

  IF (v_existing_user_id IS NOT NULL
      AND p_user_id IS NOT NULL
      AND v_existing_user_id <> p_user_id)
    OR (
      v_existing_email_sha256 IS NOT NULL
      AND p_normalized_email_sha256 IS NOT NULL
      AND v_existing_email_sha256 <> p_normalized_email_sha256
    ) THEN
    RAISE EXCEPTION 'Conflicting exact Android waitlist identity';
  END IF;

  UPDATE public.android_waitlist_entries
  SET
    user_id = COALESCE(user_id, p_user_id),
    normalized_email_sha256 = COALESCE(
      normalized_email_sha256,
      p_normalized_email_sha256
    ),
    first_joined_at = LEAST(first_joined_at, p_observed_at),
    last_joined_at = GREATEST(last_joined_at, p_observed_at),
    updated_at = now()
  WHERE id = v_entry_id;

  INSERT INTO public.android_waitlist_source_links (
    entry_id,
    source_kind,
    source_id,
    roster_entry_id,
    source,
    surface,
    placement,
    first_observed_at,
    last_observed_at
  )
  SELECT
    v_entry_id,
    p_source_kind,
    p_source_id,
    p_roster_entry_id,
    p_source,
    p_surface,
    p_placement,
    p_observed_at,
    p_observed_at
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.android_waitlist_source_links AS link
    WHERE link.source_kind = p_source_kind
      AND link.source_id = p_source_id
  );

  UPDATE public.android_waitlist_source_links
  SET
    roster_entry_id = COALESCE(roster_entry_id, p_roster_entry_id),
    last_observed_at = GREATEST(last_observed_at, p_observed_at),
    updated_at = now()
  WHERE source_kind = p_source_kind
    AND source_id = p_source_id
  RETURNING entry_id INTO v_link_entry_id;

  IF v_link_entry_id <> v_entry_id THEN
    RAISE EXCEPTION 'Canonical Android waitlist source conflict';
  END IF;

  INSERT INTO public.android_waitlist_events (
    entry_id,
    event_type,
    source_kind,
    observed_at
  )
  SELECT
    v_entry_id,
    'android_waitlist_joined',
    p_source_kind,
    p_observed_at
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.android_waitlist_events AS event
    WHERE event.entry_id = v_entry_id
      AND event.event_type = 'android_waitlist_joined'
  );

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_android_waitlist_entries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile record;
  v_lead record;
  v_roster record;
BEGIN
  FOR v_profile IN
    SELECT
      p.id,
      p.android_waitlist_joined_at,
      p.android_waitlist_source,
      p.android_waitlist_surface,
      p.android_waitlist_placement,
      auth_user.email
    FROM public.profiles AS p
    JOIN auth.users AS auth_user ON auth_user.id = p.id
    WHERE p.wants_android_access
      AND p.android_waitlist_joined_at IS NOT NULL
    ORDER BY p.android_waitlist_joined_at, p.id
  LOOP
    PERFORM public.resolve_android_waitlist_entry(
      v_profile.id,
      CASE WHEN NULLIF(btrim(lower(v_profile.email)), '') IS NULL THEN NULL
        ELSE encode(
          extensions.digest(
            convert_to(btrim(lower(v_profile.email)), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      END,
      NULL,
      'profile_intent',
      v_profile.id,
      COALESCE(NULLIF(v_profile.android_waitlist_source, ''), 'legacy_profile'),
      COALESCE(NULLIF(v_profile.android_waitlist_surface, ''), 'profile'),
      COALESCE(NULLIF(v_profile.android_waitlist_placement, ''), 'unknown'),
      v_profile.android_waitlist_joined_at
    );
  END LOOP;

  FOR v_lead IN
    SELECT
      l.id,
      l.email,
      l.source,
      l.surface,
      l.placement,
      l.created_at
    FROM public.android_beta_leads AS l
    ORDER BY l.created_at, l.id
  LOOP
    PERFORM public.resolve_android_waitlist_entry(
      NULL,
      encode(
        extensions.digest(
          convert_to(btrim(lower(v_lead.email)), 'UTF8'),
          'sha256'
        ),
        'hex'
      ),
      NULL,
      'anonymous_lead',
      v_lead.id,
      v_lead.source,
      v_lead.surface,
      v_lead.placement,
      v_lead.created_at
    );
  END LOOP;

  FOR v_roster IN
    SELECT
      r.id,
      r.user_id,
      r.eligibility_observed_at,
      auth_user.email
    FROM public.android_tester_roster_entries AS r
    LEFT JOIN auth.users AS auth_user ON auth_user.id = r.user_id
    ORDER BY r.eligibility_observed_at, r.id
  LOOP
    PERFORM public.resolve_android_waitlist_entry(
      v_roster.user_id,
      CASE WHEN NULLIF(btrim(lower(v_roster.email)), '') IS NULL THEN NULL
        ELSE encode(
          extensions.digest(
            convert_to(btrim(lower(v_roster.email)), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      END,
      v_roster.id,
      'roster_evidence',
      v_roster.id,
      'google_directory',
      'android_tester_roster',
      'direct_group_membership',
      v_roster.eligibility_observed_at
    );
  END LOOP;

  RETURN jsonb_build_object(
    'entries', (SELECT count(*) FROM public.android_waitlist_entries),
    'sourceLinks', (
      SELECT count(*) FROM public.android_waitlist_source_links
    ),
    'joinedEvents', (
      SELECT count(*) FROM public.android_waitlist_events
      WHERE event_type = 'android_waitlist_joined'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_android_waitlist_operator_projection()
RETURNS TABLE (
  entry_id uuid,
  first_joined_at timestamptz,
  last_joined_at timestamptz,
  authenticated_account_linked boolean,
  source_kinds text[],
  source_count bigint,
  group_membership_status text,
  group_membership_observed_at timestamptz,
  play_opt_in_status text,
  play_opt_in_observed_at timestamptz,
  install_status text,
  install_observed_at timestamptz,
  first_open_status text,
  first_open_observed_at timestamptz,
  account_join_status text,
  account_join_observed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH source_rollup AS (
    SELECT
      link.entry_id,
      array_agg(DISTINCT link.source_kind ORDER BY link.source_kind)
        AS source_kinds,
      count(*) AS source_count
    FROM public.android_waitlist_source_links AS link
    GROUP BY link.entry_id
  ),
  latest_stage AS (
    SELECT DISTINCT ON (link.entry_id, stage.stage)
      link.entry_id,
      stage.stage,
      stage.status,
      stage.observed_at
    FROM public.android_waitlist_source_links AS link
    JOIN public.android_tester_roster_stages AS stage
      ON stage.entry_id = link.roster_entry_id
    WHERE link.source_kind = 'roster_evidence'
      AND stage.stage IN (
        'group_eligibility',
        'play_opt_in',
        'install',
        'first_open',
        'account_join'
      )
    ORDER BY
      link.entry_id,
      stage.stage,
      stage.observed_at DESC,
      stage.id DESC
  )
  SELECT
    entry.id,
    entry.first_joined_at,
    entry.last_joined_at,
    entry.user_id IS NOT NULL,
    source.source_kinds,
    source.source_count,
    max(stage.status) FILTER (
      WHERE stage.stage = 'group_eligibility'
    ),
    max(stage.observed_at) FILTER (
      WHERE stage.stage = 'group_eligibility'
    ),
    max(stage.status) FILTER (WHERE stage.stage = 'play_opt_in'),
    max(stage.observed_at) FILTER (WHERE stage.stage = 'play_opt_in'),
    max(stage.status) FILTER (WHERE stage.stage = 'install'),
    max(stage.observed_at) FILTER (WHERE stage.stage = 'install'),
    max(stage.status) FILTER (WHERE stage.stage = 'first_open'),
    max(stage.observed_at) FILTER (WHERE stage.stage = 'first_open'),
    max(stage.status) FILTER (WHERE stage.stage = 'account_join'),
    max(stage.observed_at) FILTER (WHERE stage.stage = 'account_join')
  FROM public.android_waitlist_entries AS entry
  JOIN source_rollup AS source ON source.entry_id = entry.id
  LEFT JOIN latest_stage AS stage ON stage.entry_id = entry.id
  GROUP BY
    entry.id,
    entry.first_joined_at,
    entry.last_joined_at,
    entry.user_id,
    source.source_kinds,
    source.source_count
  ORDER BY entry.first_joined_at, entry.id;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_android_waitlist_for_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.android_waitlist_source_links
  WHERE source_kind = 'profile_intent'
    AND source_id = NEW.id;

  UPDATE public.android_waitlist_entries
  SET user_id = NULL, normalized_email_sha256 = NULL, updated_at = now()
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anonymize_android_waitlist_for_account
  ON public.profiles;
CREATE TRIGGER trg_anonymize_android_waitlist_for_account
  AFTER UPDATE OF deleted_at ON public.profiles
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION public.anonymize_android_waitlist_for_account();

REVOKE ALL ON FUNCTION public.resolve_android_waitlist_entry(uuid, text, uuid, text, uuid, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_android_waitlist_entry(uuid, text, uuid, text, uuid, text, text, text, timestamptz)
  TO service_role;
REVOKE ALL ON FUNCTION public.backfill_android_waitlist_entries()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_android_waitlist_entries()
  TO service_role;
REVOKE ALL ON FUNCTION public.get_android_waitlist_operator_projection()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_android_waitlist_operator_projection()
  TO service_role;
REVOKE ALL ON FUNCTION public.anonymize_android_waitlist_for_account()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.android_waitlist_entries IS
  'Canonical deduplicated Android waitlist identities. Stores no plaintext contact identity.';
COMMENT ON TABLE public.android_waitlist_source_links IS
  'Exact immutable links to anonymous lead, authenticated profile-intent, and tester-roster evidence.';
COMMENT ON TABLE public.android_waitlist_events IS
  'Exactly one idempotent android_waitlist_joined event per canonical waitlist entry.';
COMMENT ON FUNCTION public.resolve_android_waitlist_entry(uuid, text, uuid, text, uuid, text, text, text, timestamptz) IS
  'Resolves exact identity precedence: user ID, normalized contact SHA-256, roster identity link, source tuple, then new entry.';
COMMENT ON FUNCTION public.get_android_waitlist_operator_projection() IS
  'Deduplicated non-PII operator projection preserving independent Group, Play, install, first-open, and account-join evidence.';

SELECT public.backfill_android_waitlist_entries();

NOTIFY pgrst, 'reload schema';

COMMIT;
