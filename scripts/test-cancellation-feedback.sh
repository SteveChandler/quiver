#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/quiver-cancellation-feedback.XXXXXX")"
pg_bin="${CANCELLATION_TEST_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
if [[ ! -x "$pg_bin/initdb" ]]; then pg_bin="$(pg_config --bindir)"; fi
"$pg_bin/initdb" -D "$test_dir/data" -A trust -U postgres > "$test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$test_dir/data" -m fast stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$test_dir/data" -l "$test_dir/server.log" -o "-k $test_dir -h '' -p 55439" start >/dev/null
psql_local() { "$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$test_dir" -p 55439 -U postgres -d postgres "$@"; }
psql_local <<'SQL'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.revenuecat_provider_events (provider_event_id text PRIMARY KEY);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO revenuecat_provider_events VALUES ('event-1');
SQL
psql_local -f "$repo_dir/supabase/migrations/20260927004735_cancellation_feedback.sql"
psql_local <<'SQL'
DO $$ BEGIN
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='public.cancellation_feedback'::regclass);
  ASSERT NOT has_table_privilege('anon','public.cancellation_feedback','SELECT');
  ASSERT NOT has_table_privilege('authenticated','public.cancellation_feedback','INSERT');
  ASSERT NOT has_table_privilege('service_role','public.cancellation_feedback','UPDATE');
END $$;
SET ROLE service_role;
INSERT INTO cancellation_feedback(cancellation_event_id,user_id,outcome,reason,note,source)
VALUES ('event-1','11111111-1111-4111-8111-111111111111','submitted','avoid_charge','Useful feedback','native_home');
INSERT INTO cancellation_feedback(cancellation_event_id,user_id,outcome,source)
VALUES ('event-1','11111111-1111-4111-8111-111111111111','dismissed','native_settings')
ON CONFLICT(cancellation_event_id) DO NOTHING;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM cancellation_feedback)=1;
  ASSERT (SELECT reason FROM cancellation_feedback)='avoid_charge';
  BEGIN
    INSERT INTO cancellation_feedback(cancellation_event_id,user_id,outcome,reason,source)
    VALUES ('event-1','11111111-1111-4111-8111-111111111111','dismissed','price','native_home');
    RAISE EXCEPTION 'Invalid dismissal accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SQL
echo 'PASS: migration, permissions, validation, and first-response-wins persistence'
