-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE TABLE user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_pro boolean NOT NULL DEFAULT false,
  is_trialing boolean NOT NULL DEFAULT false,
  trial_ends_at timestamptz,
  expires_at timestamptz,
  product_id text,
  will_renew boolean NOT NULL DEFAULT false,
  billing_issue boolean NOT NULL DEFAULT false,
  lapsed_at timestamptz,
  previous_product_id text,
  rc_raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_entitlements_active
  ON user_entitlements(user_id)
  WHERE is_pro = true;

ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entitlement"
  ON user_entitlements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage entitlements"
  ON user_entitlements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_user_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
