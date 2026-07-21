-- Reconcile migration history with the nullable discovery-radius preference
-- already present in production. This timestamp intentionally precedes
-- 20260715051000_local_match_candidates.sql, the first migration that reads it.
-- Production tracks the consumer already, so apply and track this migration
-- with the approved out-of-order ledger procedure after it is merged.
--
-- Rollback is forward-only: do not drop this user preference or its data. If
-- its schema ever needs correction, add another idempotent migration.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_drive_minutes integer;

COMMENT ON COLUMN public.profiles.max_drive_minutes IS
  'Optional maximum drive time preference in minutes for discovery candidate radius. NULL means no cap/current behavior.';

COMMIT;
