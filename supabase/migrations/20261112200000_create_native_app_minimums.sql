BEGIN;

-- Oldest store version and OTA bundle the native app may run, one row per platform.
-- Read by GET /api/v1/app/minimum-version. Additive only.
--
-- The values are public: every app install reads them before sign-in. So the route
-- reads with the cookie-less anon client (createPublicReadClient) through the SELECT
-- policy below, and needs no service role. Clients get no writes; an operator sets a
-- row with the owner connection.
--
-- Both rows ship with nulls, so nothing forces an update until a row is set.
-- The route also re-validates each value, and ignores a bundle date later than now.
CREATE TABLE IF NOT EXISTS public.native_app_minimums (
  platform text PRIMARY KEY,
  minimum_version text,
  minimum_bundle_created_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT native_app_minimums_platform_check CHECK (platform IN ('ios', 'android')),
  CONSTRAINT native_app_minimums_version_format
    CHECK (minimum_version ~ '^\d+(\.\d+){0,3}$')
);

-- Existing repo trigger function; this migration creates no function.
DROP TRIGGER IF EXISTS trg_native_app_minimums_set_updated_at ON public.native_app_minimums;
CREATE TRIGGER trg_native_app_minimums_set_updated_at
  BEFORE UPDATE ON public.native_app_minimums
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.native_app_minimums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS native_app_minimums_public_read ON public.native_app_minimums;
CREATE POLICY native_app_minimums_public_read
  ON public.native_app_minimums
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON public.native_app_minimums FROM PUBLIC;
REVOKE ALL ON public.native_app_minimums FROM anon, authenticated;
GRANT SELECT ON public.native_app_minimums TO anon, authenticated;
GRANT ALL ON public.native_app_minimums TO service_role;

INSERT INTO public.native_app_minimums (platform, minimum_version, minimum_bundle_created_at)
VALUES ('ios', NULL, NULL), ('android', NULL, NULL)
ON CONFLICT (platform) DO NOTHING;

COMMIT;
