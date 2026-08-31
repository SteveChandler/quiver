BEGIN;

CREATE TABLE IF NOT EXISTS public.revenuecat_provider_events (
  provider_event_id text PRIMARY KEY,
  app_user_id uuid,
  app_user_id_status text NOT NULL,
  original_app_user_id uuid,
  event_type text NOT NULL,
  event_timestamp timestamptz NOT NULL,
  purchased_at timestamptz,
  expiration_at timestamptz,
  product_id text,
  period_type text,
  environment text NOT NULL,
  store text,
  entitlement_ids text[] NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.revenuecat_provider_events
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS app_user_id uuid,
  ADD COLUMN IF NOT EXISTS app_user_id_status text,
  ADD COLUMN IF NOT EXISTS original_app_user_id uuid,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiration_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_id text,
  ADD COLUMN IF NOT EXISTS period_type text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS store text,
  ADD COLUMN IF NOT EXISTS entitlement_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

DO $assert_revenuecat_provider_events_shape$
DECLARE
  conflicting_column text;
BEGIN
  SELECT expected.column_name INTO conflicting_column
  FROM (VALUES
    ('provider_event_id', 'text'), ('app_user_id', 'uuid'),
    ('app_user_id_status', 'text'), ('original_app_user_id', 'uuid'),
    ('event_type', 'text'), ('event_timestamp', 'timestamptz'),
    ('purchased_at', 'timestamptz'), ('expiration_at', 'timestamptz'),
    ('product_id', 'text'), ('period_type', 'text'), ('environment', 'text'),
    ('store', 'text'), ('entitlement_ids', '_text'), ('received_at', 'timestamptz'),
    ('processed_at', 'timestamptz')
  ) AS expected(column_name, udt_name)
  JOIN information_schema.columns actual
    ON actual.table_schema = 'public'
   AND actual.table_name = 'revenuecat_provider_events'
   AND actual.column_name = expected.column_name
  WHERE actual.udt_name <> expected.udt_name
  LIMIT 1;

  IF conflicting_column IS NOT NULL THEN
    RAISE EXCEPTION 'revenuecat_provider_events schema conflict: column % has the wrong type', conflicting_column;
  END IF;
END
$assert_revenuecat_provider_events_shape$;

ALTER TABLE public.revenuecat_provider_events
  ALTER COLUMN provider_event_id SET NOT NULL,
  ALTER COLUMN app_user_id_status SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN event_timestamp SET NOT NULL,
  ALTER COLUMN environment SET NOT NULL,
  ALTER COLUMN entitlement_ids SET DEFAULT '{}',
  ALTER COLUMN entitlement_ids SET NOT NULL,
  ALTER COLUMN received_at SET DEFAULT now(),
  ALTER COLUMN received_at SET NOT NULL;

DO $repair_revenuecat_provider_events_primary_key$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.revenuecat_provider_events'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.revenuecat_provider_events
      ADD PRIMARY KEY (provider_event_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.revenuecat_provider_events'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (provider_event_id)'
  ) THEN
    RAISE EXCEPTION 'revenuecat_provider_events schema conflict: primary key must be provider_event_id';
  END IF;
END
$repair_revenuecat_provider_events_primary_key$;

ALTER TABLE public.revenuecat_provider_events
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_provider_event_id_length,
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_app_user_id_status_check,
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_event_type_length,
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_product_id_length,
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_period_type_check,
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_environment_check,
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_store_length,
  DROP CONSTRAINT IF EXISTS revenuecat_provider_events_app_user_id_consistency,
  ADD CONSTRAINT revenuecat_provider_events_provider_event_id_length
    CHECK (char_length(provider_event_id) BETWEEN 1 AND 255),
  ADD CONSTRAINT revenuecat_provider_events_app_user_id_status_check
    CHECK (app_user_id_status IN ('uuid', 'missing', 'anonymous', 'invalid')),
  ADD CONSTRAINT revenuecat_provider_events_event_type_length
    CHECK (char_length(event_type) BETWEEN 1 AND 64),
  ADD CONSTRAINT revenuecat_provider_events_product_id_length
    CHECK (product_id IS NULL OR char_length(product_id) <= 255),
  ADD CONSTRAINT revenuecat_provider_events_period_type_check
    CHECK (period_type IS NULL OR period_type IN ('NORMAL', 'TRIAL', 'INTRO')),
  ADD CONSTRAINT revenuecat_provider_events_environment_check
    CHECK (environment IN ('PRODUCTION', 'SANDBOX')),
  ADD CONSTRAINT revenuecat_provider_events_store_length
    CHECK (store IS NULL OR char_length(store) <= 64),
  ADD CONSTRAINT revenuecat_provider_events_app_user_id_consistency CHECK (
    (app_user_id_status = 'uuid' AND app_user_id IS NOT NULL)
    OR (app_user_id_status <> 'uuid' AND app_user_id IS NULL)
  );

COMMENT ON TABLE public.revenuecat_provider_events IS
  'Immutable allowlisted RevenueCat webhook history for reproducible entitlement state; only processed_at is mutable as a delivery completion marker, and raw payloads and PII are intentionally excluded.';

CREATE INDEX IF NOT EXISTS idx_revenuecat_provider_events_user_time
  ON public.revenuecat_provider_events (app_user_id, event_timestamp, provider_event_id)
  WHERE app_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenuecat_provider_events_received_at
  ON public.revenuecat_provider_events (received_at DESC);

ALTER TABLE public.revenuecat_provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads RevenueCat provider events"
  ON public.revenuecat_provider_events;
CREATE POLICY "Service role reads RevenueCat provider events"
  ON public.revenuecat_provider_events FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role inserts RevenueCat provider events"
  ON public.revenuecat_provider_events;
CREATE POLICY "Service role inserts RevenueCat provider events"
  ON public.revenuecat_provider_events FOR INSERT
  TO service_role
  WITH CHECK (true);

REVOKE ALL ON public.revenuecat_provider_events FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.revenuecat_provider_events FROM service_role;
GRANT SELECT, INSERT ON public.revenuecat_provider_events TO service_role;
GRANT UPDATE (processed_at) ON public.revenuecat_provider_events TO service_role;

CREATE SCHEMA IF NOT EXISTS posthog_export;

CREATE OR REPLACE VIEW posthog_export.install_to_paid_profiles AS
SELECT
  p.id,
  p.created_at,
  p.onboarding_completed_at,
  p.analytics_is_real_user,
  p.analytics_exclusion_reason,
  p.is_system_account
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND p.analytics_is_real_user = true
  AND COALESCE(p.is_mock, false) = false
  AND COALESCE(p.is_system_account, false) = false
  AND p.id NOT IN (
    '73040cff-afe9-4fa0-a874-2016203fc015'::uuid,
    'c15c2ab3-275c-49d1-ac4f-dcc493db0653'::uuid
  );

CREATE OR REPLACE VIEW posthog_export.revenuecat_provider_events AS
SELECT
  rpe.provider_event_id,
  rpe.app_user_id,
  rpe.event_type,
  rpe.event_timestamp,
  rpe.purchased_at,
  rpe.expiration_at,
  rpe.product_id,
  rpe.period_type,
  rpe.environment,
  rpe.store,
  rpe.received_at
FROM public.revenuecat_provider_events rpe
JOIN posthog_export.install_to_paid_profiles p ON p.id = rpe.app_user_id;

CREATE OR REPLACE VIEW posthog_export.revenuecat_unjoined_daily AS
SELECT
  date_trunc('day', event_timestamp) AS event_day,
  app_user_id_status,
  environment,
  count(*) AS event_count
FROM public.revenuecat_provider_events
WHERE app_user_id_status <> 'uuid'
GROUP BY 1, 2, 3;

GRANT SELECT ON posthog_export.install_to_paid_profiles TO posthog_readonly;
GRANT SELECT ON posthog_export.revenuecat_provider_events TO posthog_readonly;
GRANT SELECT ON posthog_export.revenuecat_unjoined_daily TO posthog_readonly;

COMMIT;
