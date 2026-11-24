-- Suppress an address after one hard bounce or complaint (unchanged) or after a second bounced message of any type.
-- Expand only: record_lifecycle_provider_event stays as it is for code that deploys before this file is applied;
-- lib/email/provider-events.ts calls record_lifecycle_provider_event_v2 and falls back only while v2 does not exist.
-- Safe to run more than once.
BEGIN;

-- Provider bounce classification (Resend data.bounce.type / subType), kept so the bounce cause is provable later.
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS bounce_type text;
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS bounce_subtype text;

ALTER TABLE public.email_suppression_list DROP CONSTRAINT IF EXISTS email_suppression_list_reason_check;
ALTER TABLE public.email_suppression_list ADD CONSTRAINT email_suppression_list_reason_check
 CHECK (reason IN ('hard_bounce','typo','manual','complaint','repeat_bounce'));

CREATE OR REPLACE FUNCTION public.record_lifecycle_provider_event_v2(p_webhook_id text,p_provider_id text,p_type text,p_at timestamptz,
 p_recipients text[],p_hard_bounce boolean,p_bounce_type text DEFAULT NULL,p_bounce_subtype text DEFAULT NULL,
 p_link text DEFAULT NULL,p_user_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE log_id bigint; recipient text; bounced_messages integer;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 SELECT id INTO log_id FROM public.email_send_log WHERE resend_message_id=p_provider_id LIMIT 1;
 INSERT INTO public.email_delivery_events(email_send_log_id,resend_message_id,webhook_message_id,event_type,event_at,bounce_type,bounce_subtype)
 VALUES(log_id,p_provider_id,p_webhook_id,p_type,p_at,
  CASE WHEN p_type='email.bounced' THEN p_bounce_type END,CASE WHEN p_type='email.bounced' THEN p_bounce_subtype END)
 ON CONFLICT(webhook_message_id) DO NOTHING;
 IF p_type='email.complained' OR (p_type='email.bounced' AND p_hard_bounce) THEN
   IF cardinality(p_recipients)=0 THEN RAISE EXCEPTION 'Suppression recipient missing'; END IF;
   FOREACH recipient IN ARRAY p_recipients LOOP
    INSERT INTO public.email_suppression_list(email,reason) VALUES(lower(trim(recipient)),CASE WHEN p_type='email.complained' THEN 'complaint' ELSE 'hard_bounce' END)
    ON CONFLICT(email) DO NOTHING;
    UPDATE public.email_contact_state SET paused_at=coalesce(paused_at,now())
    WHERE user_id IN (SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(recipient)));
   END LOOP;
 END IF;
 UPDATE public.email_send_log SET
  delivered_at=CASE WHEN p_type='email.delivered' THEN least(delivered_at,p_at) ELSE delivered_at END,
  opened_at=CASE WHEN p_type='email.opened' THEN least(opened_at,p_at) ELSE opened_at END,
  clicked_at=CASE WHEN p_type='email.clicked' THEN least(clicked_at,p_at) ELSE clicked_at END,
  bounced_at=CASE WHEN p_type='email.bounced' THEN least(bounced_at,p_at) ELSE bounced_at END
 WHERE id=log_id;
 -- Count distinct bounced messages (not webhook deliveries) to the address, this one included.
 IF p_type='email.bounced' AND NOT p_hard_bounce THEN
   FOREACH recipient IN ARRAY coalesce(p_recipients,'{}') LOOP
    SELECT count(*) INTO bounced_messages FROM (
     SELECT l.resend_message_id FROM public.email_send_log l JOIN public.profiles p ON p.id=l.user_id
     WHERE l.bounced_at IS NOT NULL AND l.resend_message_id IS NOT NULL AND lower(trim(p.email))=lower(trim(recipient))
     UNION SELECT p_provider_id) messages;
    IF bounced_messages>=2 THEN
     INSERT INTO public.email_suppression_list(email,reason) VALUES(lower(trim(recipient)),'repeat_bounce') ON CONFLICT(email) DO NOTHING;
     UPDATE public.email_contact_state SET paused_at=coalesce(paused_at,now())
     WHERE user_id IN (SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(recipient)));
    END IF;
   END LOOP;
 END IF;
 IF p_type='email.clicked' AND p_link IS NOT NULL THEN
  INSERT INTO public.email_click_events(email_send_log_id,resend_message_id,webhook_message_id,clicked_at,link,user_agent)
  VALUES(log_id,p_provider_id,p_webhook_id,p_at,p_link,p_user_agent) ON CONFLICT DO NOTHING;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.record_lifecycle_provider_event_v2(text,text,text,timestamptz,text[],boolean,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_lifecycle_provider_event_v2(text,text,text,timestamptz,text[],boolean,text,text,text,text) TO service_role;

-- Backfill: addresses whose profile already has two or more bounced send-log messages.
INSERT INTO public.email_suppression_list(email,reason)
SELECT lower(trim(p.email)),'repeat_bounce' FROM public.email_send_log l JOIN public.profiles p ON p.id=l.user_id
WHERE l.bounced_at IS NOT NULL AND nullif(trim(p.email),'') IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM public.email_suppression_list s WHERE lower(trim(s.email))=lower(trim(p.email)))
GROUP BY lower(trim(p.email)) HAVING count(*)>=2
ON CONFLICT(email) DO NOTHING;
UPDATE public.email_contact_state SET paused_at=coalesce(paused_at,now())
WHERE user_id IN (SELECT p.id FROM public.profiles p JOIN public.email_suppression_list s ON s.email=lower(trim(p.email))
 WHERE s.reason='repeat_bounce');

NOTIFY pgrst, 'reload schema';

COMMIT;
