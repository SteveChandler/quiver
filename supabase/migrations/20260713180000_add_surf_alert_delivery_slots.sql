-- One surf alert may win for a user, beach, and local alert date. The worker
-- claims this slot immediately before delivery, so separate cron ticks cannot
-- send condition, similarity, and home-call alerts for the same conditions.

BEGIN;

CREATE TABLE public.surf_alert_delivery_slots (
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL,
  alert_date date NOT NULL,
  winner_notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  priority smallint NOT NULL CHECK (priority BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_user_id, beach_id, alert_date)
);

CREATE INDEX surf_alert_delivery_slots_winner_idx
  ON public.surf_alert_delivery_slots (winner_notification_event_id);

ALTER TABLE public.surf_alert_delivery_slots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_surf_alert_slot(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_beach_id uuid,
  p_alert_date date,
  p_priority smallint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_event_id uuid;
  v_priority smallint;
  v_winner_status text;
  v_winner_type text;
  v_winner_payload jsonb;
BEGIN
  IF p_priority NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid surf alert priority: %', p_priority;
  END IF;

  INSERT INTO public.surf_alert_delivery_slots (
    recipient_user_id,
    beach_id,
    alert_date,
    winner_notification_event_id,
    priority
  ) VALUES (
    p_recipient_user_id,
    p_beach_id,
    p_alert_date,
    p_event_id,
    p_priority
  ) ON CONFLICT DO NOTHING;

  SELECT
    slot.winner_notification_event_id,
    slot.priority,
    event.status,
    event.type,
    event.payload
  INTO
    v_winner_event_id,
    v_priority,
    v_winner_status,
    v_winner_type,
    v_winner_payload
  FROM public.surf_alert_delivery_slots AS slot
  JOIN public.notification_events AS event
    ON event.id = slot.winner_notification_event_id
  WHERE slot.recipient_user_id = p_recipient_user_id
    AND slot.beach_id = p_beach_id
    AND slot.alert_date = p_alert_date
  FOR UPDATE OF slot, event;

  IF v_winner_event_id = p_event_id THEN
    RETURN true;
  END IF;

  -- Once dispatch has started (or completed), preserve the existing winner.
  -- The producer-side five-minute hold keeps lower-priority events pending
  -- while peer sources arrive, so this branch does not race an active push.
  IF v_winner_status IN ('processing', 'processed') THEN
    RETURN false;
  END IF;

  -- Failed/cancelled winners did not notify the user, so any later source may
  -- take the slot. A pending winner is only replaced by a higher priority.
  IF v_winner_status NOT IN ('pending') OR p_priority > v_priority THEN
    IF v_winner_status = 'pending' THEN
      INSERT INTO public.alert_delivery_attempts (
        queue_id,
        rule_id,
        user_id,
        channel,
        status,
        skip_reason
      )
      SELECT DISTINCT
        queue.id,
        rule.id,
        p_recipient_user_id,
        'push',
        'skipped_dedup_collision',
        'skipped_dedup'
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(v_winner_payload->'queue_items') = 'array'
            THEN v_winner_payload->'queue_items'
          ELSE '[]'::jsonb
        END
      ) AS queue_item
      JOIN public.alert_queue AS queue
        ON queue.id::text = queue_item->>'queue_id'
       AND queue.user_id = p_recipient_user_id
      JOIN public.alert_rules AS rule
        ON rule.id = queue.rule_id
       AND rule.id::text = queue_item->>'rule_id'
      WHERE v_winner_type IN ('forecast_alert', 'similarity_match')
        AND queue_item ? 'queue_id'
        AND queue_item ? 'rule_id';

      UPDATE public.notification_events
      SET
        status = 'cancelled',
        skip_reason = 'skipped_redundant',
        cancel_reason = 'skipped_redundant',
        processed_at = now(),
        claim_token = NULL,
        claimed_at = NULL
      WHERE id = v_winner_event_id
        AND status = 'pending';
    END IF;

    UPDATE public.surf_alert_delivery_slots
    SET
      winner_notification_event_id = p_event_id,
      priority = p_priority,
      updated_at = now()
    WHERE recipient_user_id = p_recipient_user_id
      AND beach_id = p_beach_id
      AND alert_date = p_alert_date;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint) IS
  'Atomically selects one surf notification winner per user, beach, and alert date across worker ticks.';

REVOKE ALL ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint) TO service_role;

COMMIT;
