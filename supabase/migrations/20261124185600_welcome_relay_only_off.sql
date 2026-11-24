-- The campaign welcome goes to every new user again (Steven, 2026-11-24): a user gets it also when the founder's
-- Gmail welcome routine messages, holds or skips them. 20261124161000 set welcome_relay_only=true; this turns it off.
-- disabled_jobs ({friction,routine}) and evaluate_email_lifecycle are not changed.
-- Applied on production 2026-11-24 18:55 UTC. Undo: UPDATE public.email_contact_controls SET welcome_relay_only=true WHERE singleton;
BEGIN;
UPDATE public.email_contact_controls SET welcome_relay_only=false WHERE singleton;
COMMIT;
