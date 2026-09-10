CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.beaches (
  id uuid PRIMARY KEY, lat double precision DEFAULT 33.1, lon double precision DEFAULT -117.6,
  swell_window_center_deg double precision DEFAULT 180, swell_window_halfwidth_deg double precision DEFAULT 90,
  swell_access_factors double precision[], terrain_enabled boolean, deepwater_decay_factor double precision,
  shoaling_factors jsonb, deleted_at timestamptz, is_private boolean NOT NULL DEFAULT false, owner_id uuid
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  home_beach_id uuid NULL,
  notif_push_enabled boolean NOT NULL DEFAULT true,
  notif_forecast_alerts boolean NOT NULL DEFAULT true
);
CREATE TABLE public.favorite_beaches (
  user_id uuid NOT NULL,
  beach_id uuid NULL,
  custom_spot_id uuid NULL,
  alerts_enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE public.alert_rules (
  user_id uuid NOT NULL,
  beach_id uuid NULL,
  enabled boolean NOT NULL DEFAULT true,
  notify_push boolean NOT NULL DEFAULT true
);
CREATE TABLE public.user_devices (
  user_id uuid NOT NULL,
  retired_at timestamptz NULL
);
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
DO $$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
DO $$
BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
GRANT SELECT ON public.notification_events TO service_role;

INSERT INTO public.beaches (id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
INSERT INTO auth.users (id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.profiles (id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
