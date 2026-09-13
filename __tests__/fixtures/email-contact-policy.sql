-- Minimal dependencies in a new isolated PostgreSQL cluster only.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text, analytics_is_real_user boolean, notif_email_enabled boolean,
  onboarding_completed_at timestamptz DEFAULT now(), home_beach_id uuid DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now() - interval '4 days');
CREATE TABLE public.email_suppression_list(email text);
CREATE TABLE public.user_email_prefs(user_id uuid, email_frequency text);
CREATE TABLE public.user_entitlements(user_id uuid, is_pro boolean DEFAULT false, is_trialing boolean DEFAULT false, trial_ends_at timestamptz, lapsed_at timestamptz);
CREATE TABLE public.email_send_log(user_id uuid, email_type text, resend_message_id text, sent_at timestamptz);
GRANT USAGE ON SCHEMA public, auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public, auth TO service_role;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO profiles VALUES ('11111111-1111-4111-8111-111111111111', 'surfer@example.com', true, true);
