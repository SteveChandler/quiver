-- Minimal dependencies in a new isolated PostgreSQL cluster only.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text, analytics_is_real_user boolean, notif_email_enabled boolean,
  onboarding_completed_at timestamptz DEFAULT now(), home_beach_id uuid DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now() - interval '4 days');
CREATE TABLE public.email_suppression_list(email text);
CREATE TABLE public.user_email_prefs(user_id uuid, email_frequency text);
CREATE TABLE public.user_entitlements(user_id uuid PRIMARY KEY, is_pro boolean DEFAULT false, is_trialing boolean DEFAULT false, trial_ends_at timestamptz, lapsed_at timestamptz);
CREATE TABLE public.email_send_log(user_id uuid, email_type text, resend_message_id text, sent_at timestamptz);
GRANT USAGE ON SCHEMA public, auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public, auth TO service_role;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO profiles VALUES ('11111111-1111-4111-8111-111111111111', 'surfer@example.com', true, true);
ALTER TABLE auth.users ADD COLUMN created_at timestamptz DEFAULT now()-interval '12 hours', ADD COLUMN email text DEFAULT 'surfer@example.com', ADD COLUMN email_confirmed_at timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN display_name text, ADD COLUMN timezone text;
UPDATE profiles SET timezone=(SELECT name FROM pg_timezone_names WHERE extract(hour FROM now() AT TIME ZONE name) BETWEEN 10 AND 15 LIMIT 1);
ALTER TABLE user_entitlements ADD COLUMN product_id text, ADD COLUMN expires_at timestamptz;
CREATE TABLE sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,status text,deleted_at timestamptz);
CREATE TABLE user_events(user_id uuid,bot_flagged boolean,event_type text,created_at timestamptz,metadata jsonb DEFAULT '{}');
CREATE TABLE revenuecat_provider_events(provider_event_id text PRIMARY KEY,app_user_id uuid,environment text,processed_at timestamptz,product_id text,period_type text,event_type text,purchased_at timestamptz,expiration_at timestamptz,event_timestamp timestamptz);
ALTER TABLE email_send_log ADD COLUMN id bigserial PRIMARY KEY, ADD COLUMN subject text, ADD COLUMN local_date date, ADD COLUMN meta jsonb, ADD COLUMN message_instance_id uuid;

ALTER TABLE email_suppression_list ADD COLUMN reason text;
CREATE UNIQUE INDEX ON email_suppression_list(email);
ALTER TABLE email_send_log ADD COLUMN delivered_at timestamptz,ADD COLUMN opened_at timestamptz,ADD COLUMN clicked_at timestamptz,ADD COLUMN bounced_at timestamptz;
CREATE TABLE email_delivery_events(id bigserial PRIMARY KEY,email_send_log_id bigint,resend_message_id text,webhook_message_id text UNIQUE,event_type text CONSTRAINT email_delivery_events_event_type_check CHECK(event_type IN ('email.delivered','email.opened','email.clicked','email.bounced')),event_at timestamptz);
CREATE TABLE email_click_events(email_send_log_id bigint,resend_message_id text,webhook_message_id text UNIQUE,clicked_at timestamptz,link text,user_agent text);

CREATE TABLE alert_rules(user_id uuid,enabled boolean,notify_email boolean);
GRANT ALL ON ALL TABLES IN SCHEMA public,auth TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

CREATE TABLE cron_runs(id uuid DEFAULT gen_random_uuid(),route text,job text,status text,started_at timestamptz DEFAULT now(),finished_at timestamptz,produced integer,summary jsonb);
GRANT ALL ON cron_runs TO service_role;

ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
