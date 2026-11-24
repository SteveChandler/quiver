-- Saved daily Swell Outlook briefing editions.
--
-- The local worker fetches a server-built input snapshot, has a local model
-- choose copy, and uploads a complete artifact. The server keeps both halves:
-- the input so an upload can be revalidated against what was actually issued,
-- and the artifact so the native app can read a durable edition.
--
-- Additive only. Nothing here changes existing swell outlook behaviour, and
-- /api/swell/outlook keeps returning the same shape when no edition is saved.
--
-- Rollback:
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.publish_swell_briefing_edition(
--     text, uuid, text, date, text, timestamptz, timestamptz, text, text, jsonb, jsonb);
--   DROP TABLE IF EXISTS public.swell_briefing_editions;
--   DROP TABLE IF EXISTS public.swell_briefing_inputs;
-- COMMIT;

BEGIN;

-- The input snapshot the server issued, keyed by its own content hash.
CREATE TABLE public.swell_briefing_inputs (
  input_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  region text NOT NULL,
  edition_date date NOT NULL,
  source_published_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  -- The whole issued snapshot, including the briefing template and the bounded
  -- copy candidates. Revalidation compares an upload against this, so it has to
  -- be retained verbatim rather than rebuilt.
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_swell_briefing_inputs_lookup
  ON public.swell_briefing_inputs (user_id, region, edition_date DESC, created_at DESC);

-- A published edition. Revisions are retained; the newest valid one wins.
CREATE TABLE public.swell_briefing_editions (
  artifact_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  region text NOT NULL,
  edition_date date NOT NULL,
  input_hash text NOT NULL REFERENCES public.swell_briefing_inputs (input_hash),
  source_published_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  generation_version text NOT NULL,
  model text NOT NULL,
  -- The native SwellBriefing object, served as-is under /api/swell/outlook.
  briefing jsonb NOT NULL,
  -- Internal only. Never serialized to a native or public reader.
  provenance jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_swell_briefing_editions_latest
  ON public.swell_briefing_editions (user_id, region, edition_date DESC, source_published_at DESC, created_at DESC);

-- Both tables hold one pilot account's generated content and internal
-- provenance. Reads go through the service role in the API layer, which already
-- checks the account and the feature gate, so no anon/authenticated policy is
-- granted here: enabling RLS without policies denies every client role.
ALTER TABLE public.swell_briefing_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_briefing_editions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.swell_briefing_inputs FROM anon, authenticated;
REVOKE ALL ON public.swell_briefing_editions FROM anon, authenticated;

COMMENT ON TABLE public.swell_briefing_inputs IS
  'Server-issued briefing input snapshots; uploads are revalidated against these.';
COMMENT ON TABLE public.swell_briefing_editions IS
  'Published daily briefing artifacts. provenance is internal and never served.';

-- Save an edition atomically.
--
-- Idempotent by artifact id: re-uploading the same artifact returns the stored
-- row rather than failing, so a worker that loses the response can retry.
--
-- Monotonic by source: an edition built from an older source may never replace
-- one built from a newer source for the same day. The row lock serializes
-- concurrent jobs, so two workers racing cannot interleave the check and the
-- insert.
CREATE OR REPLACE FUNCTION public.publish_swell_briefing_edition(
  p_artifact_id text,
  p_user_id uuid,
  p_region text,
  p_edition_date date,
  p_input_hash text,
  p_source_published_at timestamptz,
  p_valid_until timestamptz,
  p_generation_version text,
  p_model text,
  p_briefing jsonb,
  p_provenance jsonb
)
RETURNS TABLE (artifact_id text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.swell_briefing_editions%ROWTYPE;
  v_newest_source timestamptz;
BEGIN
  -- Idempotent replay of an artifact already stored.
  SELECT * INTO v_existing
  FROM public.swell_briefing_editions e
  WHERE e.artifact_id = p_artifact_id;

  IF FOUND THEN
    IF v_existing.user_id <> p_user_id THEN
      RAISE EXCEPTION 'artifact_owner_mismatch' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT v_existing.artifact_id, false;
    RETURN;
  END IF;

  -- The input must be one this server issued, to this user, for this day.
  PERFORM 1
  FROM public.swell_briefing_inputs i
  WHERE i.input_hash = p_input_hash
    AND i.user_id = p_user_id
    AND i.region = p_region
    AND i.edition_date = p_edition_date
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_input_hash' USING ERRCODE = '22023';
  END IF;

  -- Lock the day's existing editions so a concurrent publish cannot pass the
  -- freshness check at the same time.
  SELECT max(e.source_published_at) INTO v_newest_source
  FROM public.swell_briefing_editions e
  WHERE e.user_id = p_user_id
    AND e.region = p_region
    AND e.edition_date = p_edition_date
  FOR UPDATE;

  IF v_newest_source IS NOT NULL AND p_source_published_at < v_newest_source THEN
    RAISE EXCEPTION 'stale_source' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.swell_briefing_editions (
    artifact_id, user_id, region, edition_date, input_hash,
    source_published_at, valid_until, generation_version, model,
    briefing, provenance
  )
  VALUES (
    p_artifact_id, p_user_id, p_region, p_edition_date, p_input_hash,
    p_source_published_at, p_valid_until, p_generation_version, p_model,
    p_briefing, p_provenance
  );

  RETURN QUERY SELECT p_artifact_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_swell_briefing_edition(
  text, uuid, text, date, text, timestamptz, timestamptz, text, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

COMMIT;
