/*
 * W-ASSIGN durable experiment-assignment ledger (plan 063 §5).
 *
 * This is a trigger ON auth.users INSERT, which is the established repository
 * pattern. It does not alter auth-managed tables or columns. The trigger's
 * exception handler always returns NEW because signup availability is more
 * important than assignment completeness.
 *
 * ON DELETE CASCADE follows account-deletion hygiene. Deleted users leave the
 * cohort denominators; cohort queries report row counts per run. This accepted
 * tradeoff mirrors the rest of the schema's user-row handling.
 *
 * ROLLBACK (operator-owned; drop the signup trigger first):
 * DROP TRIGGER IF EXISTS on_auth_user_created_assign_experiments ON auth.users;
 * DROP TRIGGER IF EXISTS trg_experiment_assignments_write_once ON public.experiment_assignments;
 * DROP FUNCTION IF EXISTS public.assign_signup_experiments();
 * DROP FUNCTION IF EXISTS public.enforce_experiment_assignment_write_once();
 * DROP FUNCTION IF EXISTS public.allocate_experiment_batch(text, uuid[], timestamptz);
 * DROP FUNCTION IF EXISTS public.link_experiment_eligibility(uuid, text, text);
 * DROP FUNCTION IF EXISTS public.assign_experiment(uuid, text, timestamptz);
 * DROP FUNCTION IF EXISTS public.experiment_arm(uuid, text);
 * DROP TABLE IF EXISTS public.experiment_assignments;
 *
 * If assignments have already been written in production, prefer disabling
 * only the signup trigger. Dropping analysis ledger data requires its own
 * operator approval.
 */

BEGIN;

CREATE TABLE IF NOT EXISTS public.experiment_assignments (
  experiment_key text NOT NULL
    CONSTRAINT experiment_assignments_key_check CHECK (
      experiment_key IN ('t3-quicklog-v1', 't10-freegrowth-v1', 't2a-swellwatch-v1')
    ),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arm smallint NOT NULL
    CONSTRAINT experiment_assignments_arm_check CHECK (arm IN (0, 1)),
  index_at timestamptz NOT NULL DEFAULT now(),
  assignment_version text NOT NULL DEFAULT 'v1',
  build text NULL,
  source text NULL
    CONSTRAINT experiment_assignments_source_check CHECK (
      source IN ('native_app', 'web_oauth')
    ),
  linked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_key, user_id),
  CONSTRAINT experiment_assignments_linkage_pair_check CHECK (
    (build IS NULL) = (source IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_key_index_at
  ON public.experiment_assignments (experiment_key, index_at);

COMMENT ON TABLE public.experiment_assignments IS
  'W-ASSIGN ledger of record (plan 063 §5). Service-role only. arm 0=control 1=treatment. Rows are immutable except a single write-once (build, source) linkage.';
COMMENT ON COLUMN public.experiment_assignments.index_at IS
  'Analysis anchor: auth.users.created_at for signup-hook rows (t3/t10); allocation time for batch-allocated rows (t2a). Frozen — 7-day-return windows are computed from this.';
COMMENT ON COLUMN public.experiment_assignments.build IS
  'Write-once eligibility linkage; NULL = eligibility_unknown (reported as its own bucket, never defaulted).';
COMMENT ON COLUMN public.experiment_assignments.source IS
  'Write-once eligibility linkage; NULL = eligibility_unknown (reported as its own bucket, never defaulted).';

ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.experiment_assignments FROM PUBLIC;
REVOKE ALL ON TABLE public.experiment_assignments FROM anon;
REVOKE ALL ON TABLE public.experiment_assignments FROM authenticated;
GRANT ALL ON TABLE public.experiment_assignments TO service_role;

CREATE OR REPLACE FUNCTION public.experiment_arm(p_user_id uuid, p_experiment_key text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public, extensions
AS $$
  SELECT (get_byte(
    digest(convert_to(p_user_id::text || ':' || p_experiment_key, 'UTF8'), 'sha256'),
    0
  ) % 2)::smallint;
$$;

CREATE OR REPLACE FUNCTION public.assign_experiment(
  p_user_id uuid,
  p_experiment_key text,
  p_index_at timestamptz DEFAULT now()
)
RETURNS public.experiment_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.experiment_assignments;
BEGIN
  INSERT INTO public.experiment_assignments
    (experiment_key, user_id, arm, index_at, assignment_version)
  VALUES
    (p_experiment_key, p_user_id,
     public.experiment_arm(p_user_id, p_experiment_key),
     p_index_at, 'v1')
  ON CONFLICT (experiment_key, user_id) DO NOTHING;

  SELECT * INTO STRICT v_row
  FROM public.experiment_assignments
  WHERE experiment_key = p_experiment_key AND user_id = p_user_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_experiment_assignment_write_once()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.experiment_key IS DISTINCT FROM OLD.experiment_key
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.arm IS DISTINCT FROM OLD.arm
     OR NEW.index_at IS DISTINCT FROM OLD.index_at
     OR NEW.assignment_version IS DISTINCT FROM OLD.assignment_version
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'experiment_assignments core columns are immutable';
  END IF;
  IF OLD.build IS NOT NULL AND NEW.build IS DISTINCT FROM OLD.build THEN
    RAISE EXCEPTION 'experiment_assignments.build is write-once';
  END IF;
  IF OLD.source IS NOT NULL AND NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'experiment_assignments.source is write-once';
  END IF;
  IF OLD.linked_at IS NOT NULL AND NEW.linked_at IS DISTINCT FROM OLD.linked_at THEN
    RAISE EXCEPTION 'experiment_assignments.linked_at is write-once';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_experiment_assignments_write_once ON public.experiment_assignments;
CREATE TRIGGER trg_experiment_assignments_write_once
  BEFORE UPDATE ON public.experiment_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_experiment_assignment_write_once();

CREATE OR REPLACE FUNCTION public.link_experiment_eligibility(
  p_user_id uuid,
  p_build text,
  p_source text
)
RETURNS TABLE (rows_linked integer, already_linked boolean, existing_build text, existing_source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_build text;
  v_source text;
BEGIN
  IF p_source NOT IN ('native_app', 'web_oauth') THEN
    RAISE EXCEPTION 'invalid source %', p_source;
  END IF;

  UPDATE public.experiment_assignments
  SET build = p_build, source = p_source, linked_at = now()
  WHERE user_id = p_user_id AND build IS NULL AND source IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT ea.build, ea.source INTO v_build, v_source
  FROM public.experiment_assignments ea
  WHERE ea.user_id = p_user_id
  LIMIT 1;

  RETURN QUERY SELECT v_count, (v_count = 0 AND v_build IS NOT NULL), v_build, v_source;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_signup_experiments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.assign_experiment(NEW.id, 't3-quicklog-v1', NEW.created_at);
  PERFORM public.assign_experiment(NEW.id, 't10-freegrowth-v1', NEW.created_at);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- The exception savepoint rolls back both inserts, so this is both-or-neither.
    -- The deterministic hash makes any gap repairable from auth.users.created_at.
    RAISE WARNING 'assign_signup_experiments failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_experiments ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_experiments
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_signup_experiments();

CREATE OR REPLACE FUNCTION public.allocate_experiment_batch(
  p_experiment_key text,
  p_user_ids uuid[],
  p_index_at timestamptz DEFAULT now()
)
RETURNS SETOF public.experiment_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.experiment_assignments
    (experiment_key, user_id, arm, index_at, assignment_version)
  SELECT p_experiment_key, u, public.experiment_arm(u, p_experiment_key), p_index_at, 'v1'
  FROM unnest(p_user_ids) AS u
  ON CONFLICT (experiment_key, user_id) DO NOTHING;

  RETURN QUERY
  SELECT * FROM public.experiment_assignments
  WHERE experiment_key = p_experiment_key AND user_id = ANY(p_user_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.experiment_arm(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.experiment_arm(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.experiment_arm(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.experiment_arm(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.assign_experiment(uuid, text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_experiment(uuid, text, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_experiment(uuid, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_experiment(uuid, text, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.link_experiment_eligibility(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_experiment_eligibility(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_experiment_eligibility(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_experiment_eligibility(uuid, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.allocate_experiment_batch(text, uuid[], timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.allocate_experiment_batch(text, uuid[], timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.allocate_experiment_batch(text, uuid[], timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_experiment_batch(text, uuid[], timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.assign_signup_experiments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_signup_experiments() FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_signup_experiments() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_signup_experiments() TO service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_experiment_assignment_write_once() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_experiment_assignment_write_once() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_experiment_assignment_write_once() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_experiment_assignment_write_once() TO service_role;

DO $$
BEGIN
  ASSERT public.experiment_arm('00000000-0000-0000-0000-000000000001', 't3-quicklog-v1') = 1;
  ASSERT public.experiment_arm('00000000-0000-0000-0000-000000000001', 't10-freegrowth-v1') = 0;
  ASSERT public.experiment_arm('11111111-2222-3333-4444-555555555555', 't3-quicklog-v1') = 1;
  ASSERT public.experiment_arm('11111111-2222-3333-4444-555555555555', 't2a-swellwatch-v1') = 1;
  ASSERT public.experiment_arm('a3f1c9d2-7b64-4e0a-9c58-2d1b6f8e4a70', 't10-freegrowth-v1') = 1;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
