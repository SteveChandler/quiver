BEGIN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notif_session_prompt_email boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.notif_session_prompt_email IS
  'Controls whether a user receives session prompt emails while allowing other forecast/condition email channels to stay enabled.';

COMMIT;
