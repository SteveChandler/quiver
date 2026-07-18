BEGIN;

-- Row-level security cannot hide an individual profile column. Remove the
-- table-wide SELECT grant, then restore column-level access for every current
-- public profile column except analytics consent. Future columns remain private
-- until a migration explicitly grants them.
REVOKE SELECT ON TABLE public.profiles FROM PUBLIC;
REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
REVOKE SELECT (allow_implicit_tracking) ON TABLE public.profiles FROM PUBLIC;
REVOKE SELECT (allow_implicit_tracking) ON TABLE public.profiles FROM anon, authenticated;

DO $$
DECLARE
  public_profile_columns text;
BEGIN
  SELECT string_agg(format('%I', attribute.attname), ', ' ORDER BY attribute.attnum)
    INTO public_profile_columns
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.profiles'::regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND attribute.attname <> 'allow_implicit_tracking';

  IF public_profile_columns IS NULL THEN
    RAISE EXCEPTION 'profiles has no selectable public columns';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON TABLE public.profiles TO anon, authenticated',
    public_profile_columns
  );
END
$$;

-- The direct native insert policy previously read the now-private consent
-- column as the caller. Route the check through the owner-scoped definer RPC.
DROP POLICY IF EXISTS "Users can insert their own events" ON public.user_events;
CREATE POLICY "Users can insert their own events"
  ON public.user_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.get_my_analytics_tracking_allowed((SELECT auth.uid()))
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
