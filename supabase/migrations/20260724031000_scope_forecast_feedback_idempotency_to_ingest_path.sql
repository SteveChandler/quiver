BEGIN;

LOCK TABLE public.forecast_feedback_contexts IN SHARE ROW EXCLUSIVE MODE;

-- Do not rewrite historical feedback to make the replacement index fit. If
-- duplicates exist within an ingest path, abort transactionally so operators
-- can review the audit result and approve a separate remediation plan.
DO $$
DECLARE
  duplicate_group_count bigint;
BEGIN
  SELECT count(*)
  INTO duplicate_group_count
  FROM (
    SELECT user_id, request_id, ingest_path
    FROM public.forecast_feedback_contexts
    WHERE user_id IS NOT NULL AND request_id IS NOT NULL
    GROUP BY user_id, request_id, ingest_path
    HAVING count(*) > 1
  ) AS duplicate_groups;

  IF duplicate_group_count > 0 THEN
    RAISE EXCEPTION
      'Cannot scope forecast feedback idempotency: % duplicate authenticated request group(s) require an approved remediation plan',
      duplicate_group_count
      USING ERRCODE = '23505';
  END IF;
END
$$;

DROP INDEX IF EXISTS public.uq_forecast_feedback_contexts_user_request;

CREATE UNIQUE INDEX uq_forecast_feedback_contexts_user_request
  ON public.forecast_feedback_contexts (user_id, request_id, ingest_path)
  WHERE user_id IS NOT NULL AND request_id IS NOT NULL;

COMMENT ON INDEX public.uq_forecast_feedback_contexts_user_request IS
  'Makes authenticated forecast-feedback retries idempotent per ingest path without collapsing independent producers.';

COMMIT;
