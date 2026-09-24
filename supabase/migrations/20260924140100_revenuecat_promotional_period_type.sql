-- RevenueCat sends PROMOTIONAL for granted entitlements and PREPAID for
-- prepaid plans. The ledger CHECK rejected them, so those webhook events were
-- never recorded (Sentry NEXTJS-5J).

BEGIN;

ALTER TABLE public.revenuecat_provider_events
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_period_type_check;

ALTER TABLE public.revenuecat_provider_events
  ADD CONSTRAINT revenuecat_provider_events_period_type_check
    CHECK (period_type IS NULL OR period_type IN ('NORMAL', 'TRIAL', 'INTRO', 'PROMOTIONAL', 'PREPAID'));

COMMIT;
