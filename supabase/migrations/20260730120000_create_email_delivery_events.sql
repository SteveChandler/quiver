BEGIN;

CREATE TABLE IF NOT EXISTS public.email_delivery_events (
  id bigserial PRIMARY KEY,
  email_send_log_id bigint NULL REFERENCES public.email_send_log(id) ON DELETE CASCADE,
  resend_message_id text NOT NULL,
  webhook_message_id text NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_delivery_events_event_type_check CHECK (
    event_type IN (
      'email.delivered',
      'email.opened',
      'email.clicked',
      'email.bounced'
    )
  )
);

COMMENT ON TABLE public.email_delivery_events IS
  'Durable Resend delivery, open, click, and bounce events. Link, user-agent, raw-IP, and free-form metadata are intentionally omitted.';
COMMENT ON COLUMN public.email_delivery_events.email_send_log_id IS
  'Nullable send-log link because a provider webhook can arrive before its email_send_log row.';
COMMENT ON COLUMN public.email_delivery_events.resend_message_id IS
  'Resend provider message identifier retained even when the send-log link is unavailable.';
COMMENT ON COLUMN public.email_delivery_events.webhook_message_id IS
  'Unique Svix webhook message identifier used for replay idempotency.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_delivery_events_webhook_message_id
  ON public.email_delivery_events(webhook_message_id);

CREATE INDEX IF NOT EXISTS idx_email_delivery_events_resend_message_id
  ON public.email_delivery_events(resend_message_id);

CREATE INDEX IF NOT EXISTS idx_email_delivery_events_email_send_log_id
  ON public.email_delivery_events(email_send_log_id);

CREATE INDEX IF NOT EXISTS idx_email_delivery_events_event_type_event_at
  ON public.email_delivery_events(event_type, event_at DESC);

ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_delivery_events FROM PUBLIC;
REVOKE ALL ON TABLE public.email_delivery_events FROM anon;
REVOKE ALL ON TABLE public.email_delivery_events FROM authenticated;
REVOKE ALL ON SEQUENCE public.email_delivery_events_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.email_delivery_events_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.email_delivery_events_id_seq FROM authenticated;
GRANT ALL ON TABLE public.email_delivery_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.email_delivery_events_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
