-- Migration: Create push_notification_log table for tracking push notification attempts
-- Part of Delivery Monitoring Infrastructure feature

-- Logs individual push notification attempts
CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  notification_type TEXT NOT NULL CHECK (notification_type IN ('daily_digest', 'forecast_alert', 'welcome', 'other')),
  title TEXT NOT NULL,
  body TEXT,

  -- Delivery tracking
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'no_token')),
  error_message TEXT,

  -- Context
  beach_id UUID REFERENCES public.beaches(id) ON DELETE SET NULL,
  data JSONB DEFAULT '{}',

  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Service role only
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON public.push_notification_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes for common queries
CREATE INDEX idx_push_notification_log_user_sent
  ON public.push_notification_log (user_id, sent_at DESC);

CREATE INDEX idx_push_notification_log_status_sent
  ON public.push_notification_log (status, sent_at DESC);

CREATE INDEX idx_push_notification_log_type_sent
  ON public.push_notification_log (notification_type, sent_at DESC);

COMMENT ON TABLE public.push_notification_log IS 'Tracks individual push notification delivery attempts';
