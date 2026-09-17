-- Daily call + swell alert schema (spec: docs/superpowers/specs/2026-09-17-daily-call-and-swell-alert-design.md)
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_call_time text NOT NULL DEFAULT '06:00';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_daily_call_time_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_daily_call_time_check
  CHECK (daily_call_time IN ('05:00','05:30','06:00','06:30','07:00','07:30','08:00','sunrise'));
COMMENT ON COLUMN public.profiles.daily_call_time IS 'Local send time for the daily call push, or ''sunrise''. Spec 2026-09-17 D5.';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_swell_alerts boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.profiles.notif_swell_alerts IS 'Per-type pref for swell_watch pushes. Default true; free for all users.';

ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS short_name text;
COMMENT ON COLUMN public.beaches.short_name IS 'Approved short display name for push titles. NULL = use name.';

CREATE TABLE IF NOT EXISTS public.swell_event_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  peak_date date NOT NULL,
  lead_beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  notification_event_id uuid NULL REFERENCES public.notification_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  UNIQUE (user_id, event_key)
);
CREATE INDEX IF NOT EXISTS swell_event_alerts_user_created_idx ON public.swell_event_alerts (user_id, created_at DESC);
ALTER TABLE public.swell_event_alerts ENABLE ROW LEVEL SECURITY;

-- One surf push per user per local date, regardless of beach.
ALTER TABLE public.surf_alert_delivery_slots DROP CONSTRAINT IF EXISTS surf_alert_delivery_slots_pkey;
ALTER TABLE public.surf_alert_delivery_slots ALTER COLUMN beach_id DROP NOT NULL;
ALTER TABLE public.surf_alert_delivery_slots ADD PRIMARY KEY (recipient_user_id, alert_date);

DROP FUNCTION IF EXISTS public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint);
CREATE OR REPLACE FUNCTION public.claim_surf_alert_slot(
  p_event_id uuid,
  p_recipient_user_id uuid,
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
    alert_date,
    winner_notification_event_id,
    priority
  ) VALUES (
    p_recipient_user_id,
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
      AND alert_date = p_alert_date;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, date, smallint) IS
  'Atomically selects one surf notification winner per user and alert date across worker ticks.';

REVOKE ALL ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, date, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, date, smallint)
  TO service_role;

-- Similarity retires. Rows stay for history; Alert Center stops rendering them.
UPDATE public.alert_rules SET enabled = false WHERE preset_type = 'similarity_match';

COMMIT;
