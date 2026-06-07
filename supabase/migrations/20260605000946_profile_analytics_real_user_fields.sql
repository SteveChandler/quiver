-- Add non-PII real-user reconciliation fields for analytics exports.
--
-- These fields let PostHog and weekly polling match the Supabase real-user
-- filter without syncing email or row-level examples into analytics tools.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analytics_is_real_user boolean,
  ADD COLUMN IF NOT EXISTS analytics_exclusion_reason text;

ALTER TABLE public.profiles
  ALTER COLUMN analytics_is_real_user SET DEFAULT true;

COMMENT ON COLUMN public.profiles.analytics_is_real_user IS
  'Non-PII analytics flag matching the canonical real-user filter for profile aggregates.';

COMMENT ON COLUMN public.profiles.analytics_exclusion_reason IS
  'Non-PII reason a profile is excluded from analytics real-user aggregates.';

CREATE OR REPLACE FUNCTION public.set_profile_analytics_real_user_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_email text;
BEGIN
  normalized_email := lower(coalesce(NEW.email, ''));

  IF coalesce(NEW.is_mock, false) THEN
    NEW.analytics_is_real_user := false;
    NEW.analytics_exclusion_reason := 'mock_profile';
  ELSIF NEW.email IS NOT NULL AND normalized_email LIKE '%@local.test' THEN
    NEW.analytics_is_real_user := false;
    NEW.analytics_exclusion_reason := 'local_test_email';
  ELSIF NEW.email IS NOT NULL AND normalized_email LIKE '%@example.invalid' THEN
    NEW.analytics_is_real_user := false;
    NEW.analytics_exclusion_reason := 'example_invalid_email';
  ELSIF NEW.email IS NOT NULL AND normalized_email LIKE '%test%' THEN
    NEW.analytics_is_real_user := false;
    NEW.analytics_exclusion_reason := 'test_email';
  ELSE
    NEW.analytics_is_real_user := true;
    NEW.analytics_exclusion_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_analytics_real_user_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_profile_analytics_real_user_fields() FROM anon, authenticated;

UPDATE public.profiles
SET
  analytics_is_real_user = CASE
    WHEN coalesce(is_mock, false) THEN false
    WHEN email IS NOT NULL AND lower(email) LIKE '%@local.test' THEN false
    WHEN email IS NOT NULL AND lower(email) LIKE '%@example.invalid' THEN false
    WHEN email IS NOT NULL AND lower(email) LIKE '%test%' THEN false
    ELSE true
  END,
  analytics_exclusion_reason = CASE
    WHEN coalesce(is_mock, false) THEN 'mock_profile'
    WHEN email IS NOT NULL AND lower(email) LIKE '%@local.test' THEN 'local_test_email'
    WHEN email IS NOT NULL AND lower(email) LIKE '%@example.invalid' THEN 'example_invalid_email'
    WHEN email IS NOT NULL AND lower(email) LIKE '%test%' THEN 'test_email'
    ELSE NULL
  END;

ALTER TABLE public.profiles
  ALTER COLUMN analytics_is_real_user SET NOT NULL;

DROP TRIGGER IF EXISTS set_profile_analytics_real_user_fields
  ON public.profiles;

CREATE TRIGGER set_profile_analytics_real_user_fields
  BEFORE INSERT OR UPDATE OF email, is_mock ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_analytics_real_user_fields();

NOTIFY pgrst, 'reload schema';

COMMIT;
