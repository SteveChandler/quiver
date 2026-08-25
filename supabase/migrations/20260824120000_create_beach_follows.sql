BEGIN;

-- Beach follows intentionally do not extend favorite_beaches. The free-tier
-- favorites cap of three would make anonymous merge lossy and entitlement-
-- changing, while favorite_beaches also feeds alert rules and cron/email
-- audiences that a general coastal follow must not enter.
CREATE TABLE public.beach_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  topics text[] NOT NULL,
  -- JSONB keeps the single-row account contract while preserving causal time
  -- independently for every topic key (for example, {"surf": "...Z"}).
  topic_added_at jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beach_follows_user_beach_unique UNIQUE (user_id, beach_id),
  CONSTRAINT beach_follows_topics_bounded CHECK (
    cardinality(topics) BETWEEN 1 AND 6
    AND topics <@ ARRAY[
      'surf',
      'water_temp',
      'tide',
      'water_quality',
      'wind',
      'general'
    ]::text[]
    AND cardinality(array_positions(topics, 'surf')) <= 1
    AND cardinality(array_positions(topics, 'water_temp')) <= 1
    AND cardinality(array_positions(topics, 'tide')) <= 1
    AND cardinality(array_positions(topics, 'water_quality')) <= 1
    AND cardinality(array_positions(topics, 'wind')) <= 1
    AND cardinality(array_positions(topics, 'general')) <= 1
  ),
  CONSTRAINT beach_follows_topic_added_at_matches_topics CHECK (
    jsonb_typeof(topic_added_at) = 'object'
    AND jsonb_object_length(topic_added_at) = cardinality(topics)
    AND topic_added_at ?& topics
    AND NOT jsonb_path_exists(
      topic_added_at,
      '$.* ? (@.type() != "string")'
    )
  )
);

CREATE INDEX beach_follows_beach_id_idx
  ON public.beach_follows (beach_id);

ALTER TABLE public.beach_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY beach_follows_select_own
  ON public.beach_follows
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY beach_follows_insert_own
  ON public.beach_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY beach_follows_update_own
  ON public.beach_follows
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY beach_follows_delete_own
  ON public.beach_follows
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.touch_beach_follows_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER beach_follows_touch_updated_at
  BEFORE UPDATE ON public.beach_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_beach_follows_updated_at();

-- Rollback (manual, only before consumers depend on this additive table):
-- DROP TABLE public.beach_follows;
-- DROP FUNCTION public.touch_beach_follows_updated_at();

COMMIT;
