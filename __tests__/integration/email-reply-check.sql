DO $$
DECLARE u uuid:='11111111-1111-4111-8111-111111111111';
BEGIN
 PERFORM record_gmail_reply_v2('mail@gmail.com','m1','t1','surfer@example.com',now(),'<outbound>');
 PERFORM record_gmail_reply_v2('mail@gmail.com','m1','t1','surfer@example.com',now(),'<outbound>');
 ASSERT (SELECT count(*) FROM email_reply_events WHERE provider_id='gmail:mail@gmail.com:m1')=1, 'event';
 ASSERT (SELECT paused_at IS NOT NULL FROM email_contact_state WHERE user_id=u), 'pause';
 ASSERT cardinality(gmail_reply_known(ARRAY['m1','unknown']))=1, 'known cardinality';
 ASSERT (gmail_reply_known(ARRAY['m1','unknown']))[1]='unknown', 'known id';
 ASSERT NOT has_function_privilege('anon','public.gmail_reply_known(text[])','execute');
 ASSERT NOT has_function_privilege('authenticated','public.record_gmail_reply_v2(text,text,text,text,timestamptz,text)','execute');
END $$;
