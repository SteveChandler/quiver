BEGIN;

-- Invoker RPCs need identity/confirmation fields, never auth credentials or writes.
GRANT SELECT (id, email, created_at, email_confirmed_at)
  ON TABLE auth.users TO service_role;

COMMIT;
