-- Cluster roles required by the schema snapshot but not created by the local
-- Supabase image. Seeded before supabase/snapshots/schema.sql.
--
-- posthog_readonly exists in production for analytics reads; the snapshot's
-- GRANT statements reference it, so a local restore fails without it.
-- No password and NOLOGIN — this is a grant target only, never used to connect.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'posthog_readonly') THEN
    CREATE ROLE posthog_readonly NOLOGIN;
  END IF;
END
$$;
