BEGIN;

CREATE TABLE IF NOT EXISTS public.email_click_events (
  id bigserial PRIMARY KEY,
  email_send_log_id bigint NULL REFERENCES public.email_send_log(id) ON DELETE CASCADE,
  resend_message_id text NOT NULL,
  webhook_message_id text NULL,
  clicked_at timestamptz NOT NULL,
  link text NOT NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_click_events_link_not_blank CHECK (length(btrim(link)) > 0)
);

COMMENT ON TABLE public.email_click_events IS
  'First-party record of Resend email click events. Stores clicked links and user agent only; raw IP addresses are intentionally omitted.';
COMMENT ON COLUMN public.email_click_events.webhook_message_id IS
  'Svix webhook message id used to make webhook replays idempotent when present.';
COMMENT ON COLUMN public.email_click_events.user_agent IS
  'Click user agent from Resend payload; raw IP address is intentionally not stored.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_click_events_webhook_message_id
  ON public.email_click_events(webhook_message_id)
  WHERE webhook_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_click_events_email_send_log_id
  ON public.email_click_events(email_send_log_id);

CREATE INDEX IF NOT EXISTS idx_email_click_events_resend_message_id
  ON public.email_click_events(resend_message_id);

CREATE INDEX IF NOT EXISTS idx_email_click_events_clicked_at
  ON public.email_click_events(clicked_at DESC);

ALTER TABLE public.email_click_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_click_events FROM anon;
REVOKE ALL ON TABLE public.email_click_events FROM authenticated;
GRANT ALL ON TABLE public.email_click_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.email_click_events_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
