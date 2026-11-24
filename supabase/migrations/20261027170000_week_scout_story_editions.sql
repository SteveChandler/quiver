BEGIN;

CREATE TABLE public.week_scout_story_inputs (
  input_hash text PRIMARY KEY,
  region text NOT NULL,
  edition_date date NOT NULL,
  source_published_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version = 3),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX week_scout_story_inputs_lookup ON public.week_scout_story_inputs
  (region, edition_date DESC, created_at DESC);

CREATE TABLE public.week_scout_story_editions (
  artifact_id text PRIMARY KEY,
  region text NOT NULL,
  edition_date date NOT NULL,
  input_hash text NOT NULL REFERENCES public.week_scout_story_inputs(input_hash) ON DELETE RESTRICT,
  source_published_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version = 3),
  generation_version text NOT NULL,
  model text NOT NULL,
  briefing jsonb NOT NULL,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region, edition_date, input_hash, generation_version, model)
);
CREATE INDEX week_scout_story_editions_latest ON public.week_scout_story_editions
  (region, edition_date DESC, source_published_at DESC, created_at DESC);

CREATE TABLE public.week_scout_story_jobs (
  region text NOT NULL,
  edition_date date NOT NULL,
  input_hash text NOT NULL REFERENCES public.week_scout_story_inputs(input_hash) ON DELETE RESTRICT,
  generation_version text NOT NULL,
  model text NOT NULL,
  lease_owner text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'published', 'failed')),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region, edition_date, input_hash, generation_version, model)
);

ALTER TABLE public.week_scout_story_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_scout_story_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_scout_story_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.week_scout_story_inputs, public.week_scout_story_editions, public.week_scout_story_jobs FROM anon, authenticated;
REVOKE ALL ON public.week_scout_story_inputs, public.week_scout_story_editions, public.week_scout_story_jobs FROM service_role;
GRANT SELECT, INSERT ON public.week_scout_story_inputs TO service_role;
GRANT SELECT ON public.week_scout_story_editions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.week_scout_story_jobs TO service_role;

-- One region list for every worker run. Activity is a real event in the last 30 days;
-- a profile without a home beach contributes no region.
CREATE FUNCTION public.week_scout_story_active_regions()
RETURNS TABLE (region text, timezone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT b.region, (array_agg(b.timezone ORDER BY b.id))[1]
  FROM public.beaches b
  JOIN public.profiles p ON p.home_beach_id = b.id
  WHERE b.region IS NOT NULL AND b.deleted_at IS NULL
    AND p.is_mock IS NOT TRUE AND p.is_system_account IS NOT TRUE AND (
    EXISTS (
      SELECT 1 FROM public.user_events e
      WHERE e.user_id = p.id AND e.created_at >= now() - interval '30 days'
        AND e.bot_flagged IS NOT TRUE
    ) OR EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = p.id
        AND u.last_sign_in_at >= now() - interval '30 days'
    )
  )
  GROUP BY b.region
$$;
REVOKE ALL ON FUNCTION public.week_scout_story_active_regions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.week_scout_story_active_regions() TO service_role;

CREATE FUNCTION public.publish_week_scout_story_edition(
  p_artifact_id text, p_region text, p_edition_date date, p_input_hash text,
  p_source_published_at timestamptz, p_valid_until timestamptz,
  p_generation_version text, p_model text, p_briefing jsonb, p_provenance jsonb
)
RETURNS TABLE (artifact_id text, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.week_scout_story_editions%ROWTYPE;
  v_input public.week_scout_story_inputs%ROWTYPE;
  v_latest timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_region || ':' || p_edition_date::text, 0));
  SELECT * INTO v_existing FROM public.week_scout_story_editions e WHERE e.artifact_id = p_artifact_id;
  IF FOUND THEN
    IF v_existing.region <> p_region OR v_existing.edition_date <> p_edition_date
       OR v_existing.input_hash <> p_input_hash OR v_existing.briefing <> p_briefing
       OR v_existing.source_published_at <> p_source_published_at
       OR v_existing.valid_until <> p_valid_until
       OR v_existing.generation_version <> p_generation_version OR v_existing.model <> p_model
       OR v_existing.provenance <> p_provenance THEN
      RAISE EXCEPTION 'artifact_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_existing.artifact_id, false;
    RETURN;
  END IF;
  SELECT * INTO v_input FROM public.week_scout_story_inputs i WHERE i.input_hash = p_input_hash;
  IF NOT FOUND OR v_input.region <> p_region OR v_input.edition_date <> p_edition_date
     OR v_input.source_published_at <> p_source_published_at OR v_input.valid_until <> p_valid_until THEN
    RAISE EXCEPTION 'unknown_input_hash' USING ERRCODE = '22023';
  END IF;
  SELECT max(e.source_published_at) INTO v_latest
    FROM public.week_scout_story_editions e WHERE e.region = p_region AND e.edition_date = p_edition_date;
  IF v_latest IS NOT NULL AND p_source_published_at < v_latest THEN
    RAISE EXCEPTION 'stale_source' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.week_scout_story_editions e
    WHERE e.region = p_region AND e.edition_date = p_edition_date AND e.input_hash = p_input_hash
      AND e.generation_version = p_generation_version AND e.model = p_model
  ) THEN
    RAISE EXCEPTION 'revision_conflict' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.week_scout_story_editions
    (artifact_id, region, edition_date, input_hash, source_published_at, valid_until,
     schema_version, generation_version, model, briefing, provenance)
  VALUES (p_artifact_id, p_region, p_edition_date, p_input_hash, p_source_published_at, p_valid_until,
          3, p_generation_version, p_model, p_briefing, p_provenance);
  RETURN QUERY SELECT p_artifact_id, true;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_week_scout_story_edition(
  text, text, date, text, timestamptz, timestamptz, text, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_week_scout_story_edition(
  text, text, date, text, timestamptz, timestamptz, text, text, jsonb, jsonb
) TO service_role;

COMMIT;

-- Rollback (review before use): BEGIN; DROP FUNCTION public.publish_week_scout_story_edition(
-- text,text,date,text,timestamptz,timestamptz,text,text,jsonb,jsonb);
-- DROP FUNCTION public.week_scout_story_active_regions();
-- DROP TABLE public.week_scout_story_jobs; DROP TABLE public.week_scout_story_editions;
-- DROP TABLE public.week_scout_story_inputs; COMMIT;
