BEGIN;

LOCK TABLE public.forecast_feedback_contexts IN SHARE ROW EXCLUSIVE MODE;

-- Preserve every historical feedback row while making any pre-existing
-- duplicate key unique. The oldest row keeps the original request ID so a
-- retry still resolves to the first accepted delivery.
WITH ranked_requests AS (
  SELECT
    id,
    request_id,
    row_number() OVER (
      PARTITION BY user_id, request_id
      ORDER BY created_at ASC, id ASC
    ) AS delivery_rank
  FROM public.forecast_feedback_contexts
  WHERE user_id IS NOT NULL AND request_id IS NOT NULL
)
UPDATE public.forecast_feedback_contexts AS feedback
SET
  request_id = feedback.request_id || ':legacy-duplicate:' || feedback.id::text,
  updated_at = now()
FROM ranked_requests AS ranked
WHERE feedback.id = ranked.id
  AND ranked.delivery_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_forecast_feedback_contexts_user_request
  ON public.forecast_feedback_contexts (user_id, request_id)
  WHERE user_id IS NOT NULL AND request_id IS NOT NULL;

COMMENT ON INDEX public.uq_forecast_feedback_contexts_user_request IS
  'Makes authenticated forecast-feedback retries idempotent by stable client request ID.';

COMMIT;
