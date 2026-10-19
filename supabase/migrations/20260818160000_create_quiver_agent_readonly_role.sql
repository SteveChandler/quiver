-- Dedicated NOLOGIN role and sanitized evidence views for controller-owned queries.
--
-- The controller connects as the production owner, immediately SET ROLEs inside an
-- explicit READ ONLY transaction, and never exposes owner credentials to a model.
-- The role cannot read production tables directly; owner-backed, security-barrier views
-- expose only the columns and normalized metadata dimensions required by the catalog.
--
-- Rollback (approval-gated):
--   REVOKE quiver_agent_readonly FROM postgres;
--   DROP SCHEMA quiver_agent_evidence CASCADE;
--   DROP ROLE quiver_agent_readonly;

BEGIN;

DO $role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quiver_agent_readonly') THEN
    RAISE EXCEPTION 'quiver_agent_readonly already exists; inspect memberships before applying';
  END IF;
  CREATE ROLE quiver_agent_readonly
    NOLOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    NOREPLICATION
    NOBYPASSRLS;
END
$role$;

ALTER ROLE quiver_agent_readonly SET default_transaction_read_only = on;
ALTER ROLE quiver_agent_readonly SET statement_timeout = '60s';
ALTER ROLE quiver_agent_readonly SET lock_timeout = '5s';
ALTER ROLE quiver_agent_readonly SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE quiver_agent_readonly SET search_path = pg_catalog, quiver_agent_evidence;

CREATE SCHEMA quiver_agent_evidence;
REVOKE ALL ON SCHEMA quiver_agent_evidence FROM PUBLIC;
GRANT USAGE ON SCHEMA quiver_agent_evidence TO quiver_agent_readonly;

CREATE VIEW quiver_agent_evidence.profiles
WITH (security_barrier = true)
AS
SELECT
  id,
  created_at,
  analytics_is_real_user,
  onboarding_completed_at
FROM public.profiles;

CREATE VIEW quiver_agent_evidence.user_events
WITH (security_barrier = true)
AS
SELECT
  id,
  user_id,
  CASE
    WHEN event_type ~ '^[a-z0-9][a-z0-9._:-]{0,63}$' THEN event_type
    ELSE '[invalid]'
  END AS event_type,
  created_at,
  expires_at,
  session_id,
  bot_flagged,
  CASE
    WHEN coalesce(metadata->>'platform', metadata->>'_platform')
      ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$'
    THEN coalesce(metadata->>'platform', metadata->>'_platform')
  END AS platform,
  CASE
    WHEN coalesce(metadata->>'app_build', metadata->>'$app_build')
      ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$'
    THEN coalesce(metadata->>'app_build', metadata->>'$app_build')
  END AS app_build,
  CASE
    WHEN coalesce(metadata->>'app_version', metadata->>'$app_version')
      ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$'
    THEN coalesce(metadata->>'app_version', metadata->>'$app_version')
  END AS app_version,
  CASE
    WHEN coalesce(metadata->>'runtime_version', metadata->>'expo_runtime_version')
      ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$'
    THEN coalesce(metadata->>'runtime_version', metadata->>'expo_runtime_version')
  END AS runtime_version,
  CASE WHEN metadata->>'source' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'source' END AS source,
  CASE WHEN metadata->>'mode' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'mode' END AS mode,
  CASE WHEN metadata->>'step' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'step' END AS step,
  CASE WHEN metadata->>'action' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'action' END AS action,
  CASE WHEN metadata->>'screen' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'screen' END AS screen
  ,CASE WHEN metadata->>'provider' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'provider' END AS provider
  ,CASE WHEN metadata->>'email_method' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'email_method' END AS email_method
  ,CASE WHEN metadata->>'reason' ~ '^[a-z0-9][a-z0-9._:-]{0,79}$'
    THEN metadata->>'reason' END AS reason
  ,CASE WHEN metadata->>'view' ~ '^[a-z0-9][a-z0-9._:-]{0,39}$'
    THEN metadata->>'view' END AS view
  ,CASE WHEN metadata->>'requires_verification' IN ('true', 'false')
    THEN metadata->>'requires_verification' END AS requires_verification
FROM public.user_events;

REVOKE ALL ON TABLE quiver_agent_evidence.profiles FROM PUBLIC;
REVOKE ALL ON TABLE quiver_agent_evidence.user_events FROM PUBLIC;
GRANT SELECT ON TABLE quiver_agent_evidence.profiles TO quiver_agent_readonly;
GRANT SELECT ON TABLE quiver_agent_evidence.user_events TO quiver_agent_readonly;

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM quiver_agent_readonly;
REVOKE ALL PRIVILEGES ON TABLE public.user_events FROM quiver_agent_readonly;

GRANT CONNECT ON DATABASE postgres TO quiver_agent_readonly;
GRANT quiver_agent_readonly TO postgres;

COMMENT ON ROLE quiver_agent_readonly IS
  'NOLOGIN controller role: read-only SELECT on sanitized evidence views only.';

COMMIT;
