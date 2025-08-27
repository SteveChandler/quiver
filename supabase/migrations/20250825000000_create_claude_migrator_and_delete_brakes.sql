-- 00_create_claude_migrator_and_delete_brakes.sql

-- 1) Dedicated, least-privilege role for agents/migrations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claude_migrator') THEN
    CREATE ROLE claude_migrator LOGIN PASSWORD 'dM4pXh6jL7zRcF2'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO claude_migrator;
-- (optional) allow creating new tables in public:
-- GRANT CREATE ON SCHEMA public TO claude_migrator;

-- 2) NO DELETE/TRUNCATE privileges on user-critical tables
REVOKE ALL ON TABLE auth.users FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE auth.users TO claude_migrator;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO claude_migrator;

-- 3) Universal "delete brakes" — even if someone grants DELETE later
CREATE EXTENSION IF NOT EXISTS plpgsql;

CREATE OR REPLACE FUNCTION prevent_delete_on_protected()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- DBA escape hatch: allow deletes only if this flag is set inside a transaction
  IF current_setting('app.allow_destructive', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DELETE blocked on % (user=%). Set app.allow_destructive=on inside a transaction if you truly need to proceed.',
      TG_TABLE_NAME, current_user;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_users ON auth.users;
CREATE TRIGGER trg_prevent_delete_users
BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION prevent_delete_on_protected();

DROP TRIGGER IF EXISTS trg_prevent_delete_profiles ON public.profiles;
CREATE TRIGGER trg_prevent_delete_profiles
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION prevent_delete_on_protected();
