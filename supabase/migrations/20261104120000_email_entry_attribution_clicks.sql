-- Count an email as having brought someone in when its tracked link was clicked,
-- not only when an app event carried the email's id.
--
-- Nov 4 2026: attributed_entry_at was NULL for all 351 accepted sends in 30 days.
-- Resend wraps every link in a click-tracking redirect, so an iPhone tap opens
-- Safari instead of the app and native_open_from_email has never fired; the web
-- landing pages dropped message_instance_id. Conditions alerts also link with the
-- delivery id (email_send_log.message_instance_id), never the attempt id.
--
-- Entry is now the earliest of:
--   * a Resend click within 7 days on a link into the product (www/go host:
--     /app, /beach, /sessions, /forecast, /map; never unsubscribe, settings or
--     sign-in links) from a non-scanner user agent, or
--   * a non-bot user event carrying either the attempt id or the delivery id.
-- attributed_entry_source says which one came first. Columns are appended, so
-- existing readers keep their shape.

BEGIN;

CREATE OR REPLACE VIEW public.email_lifecycle_outcomes WITH(security_invoker=true) AS
SELECT a.id AS message_instance_id,a.user_id,a.campaign_id,a.lifecycle_job,a.handoff_at,a.provider_id,
 now()>=a.handoff_at+interval '7 days' AS seven_day_window_mature,
 least(entry.clicked_at, entry.event_at) AS attributed_entry_at,
 (SELECT count(*) FROM public.sessions s WHERE s.user_id=a.user_id AND s.status='completed' AND s.deleted_at IS NULL
   AND s.email_completed_at BETWEEN a.handoff_at AND a.handoff_at+interval '7 days') AS completed_sessions_after_send,
 CASE
   WHEN entry.event_at IS NOT NULL AND (entry.clicked_at IS NULL OR entry.event_at <= entry.clicked_at) THEN 'app_event'
   WHEN entry.clicked_at IS NOT NULL THEN 'email_click'
 END AS attributed_entry_source
FROM public.email_contact_attempts a
CROSS JOIN LATERAL (
  SELECT
   (SELECT min(coalesce(c.clicked_at, c.created_at)) FROM public.email_click_events c
     WHERE a.provider_id IS NOT NULL AND c.resend_message_id=a.provider_id
       AND c.link ~ '^https://(www|go)\.quiversurf\.app/(app|beach|sessions|forecast|map)([/?#]|$)'
       AND c.user_agent IS NOT NULL
       AND c.user_agent !~* '(bot|crawl|spider|preview|scan|safelinks|proofpoint|mimecast|barracuda|headless)'
       AND coalesce(c.clicked_at, c.created_at) BETWEEN a.handoff_at AND a.handoff_at+interval '7 days') AS clicked_at,
   (SELECT min(e.created_at) FROM public.user_events e WHERE e.user_id=a.user_id AND e.bot_flagged IS NOT TRUE
     AND e.metadata->>'message_instance_id' IN (
       a.id::text,
       (SELECT l.message_instance_id::text FROM public.email_send_log l
         WHERE a.provider_id IS NOT NULL AND l.resend_message_id=a.provider_id AND l.message_instance_id IS NOT NULL ORDER BY l.id LIMIT 1))
     AND e.created_at BETWEEN a.handoff_at AND a.handoff_at+interval '7 days') AS event_at
) entry
WHERE a.state='accepted' AND a.lifecycle_job IS NOT NULL;

COMMENT ON VIEW public.email_lifecycle_outcomes IS 'Message-linked entry (a non-scanner Resend click into the product, or an app event carrying the attempt or delivery id; attributed_entry_source says which came first) and observational post-send sessions; not causal attribution or proof of paid conversion.';
REVOKE ALL ON public.email_lifecycle_outcomes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_lifecycle_outcomes TO service_role;

COMMIT;
