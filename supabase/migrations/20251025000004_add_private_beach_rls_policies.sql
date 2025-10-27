-- Add RLS policies for private beaches
-- Allows users to create and manage their own private beach spots
-- Public beaches remain readable by all

BEGIN;

-- Ensure RLS is enabled on beaches table
ALTER TABLE public.beaches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PRIVATE BEACH POLICIES
-- ============================================================================

-- Policy: Users can view their own private beaches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beaches'
      AND policyname = 'Users can view own private beaches'
  ) THEN
    CREATE POLICY "Users can view own private beaches"
      ON public.beaches
      FOR SELECT
      TO authenticated
      USING (
        is_private = true
        AND owner_id = auth.uid()
      );
  END IF;
END $$;

-- Policy: Users can insert their own private beaches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beaches'
      AND policyname = 'Users can create private beaches'
  ) THEN
    CREATE POLICY "Users can create private beaches"
      ON public.beaches
      FOR INSERT
      TO authenticated
      WITH CHECK (
        is_private = true
        AND owner_id = auth.uid()
      );
  END IF;
END $$;

-- Policy: Users can update their own private beaches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beaches'
      AND policyname = 'Users can update own private beaches'
  ) THEN
    CREATE POLICY "Users can update own private beaches"
      ON public.beaches
      FOR UPDATE
      TO authenticated
      USING (
        is_private = true
        AND owner_id = auth.uid()
      )
      WITH CHECK (
        is_private = true
        AND owner_id = auth.uid()
      );
  END IF;
END $$;

-- Policy: Users can delete their own private beaches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beaches'
      AND policyname = 'Users can delete own private beaches'
  ) THEN
    CREATE POLICY "Users can delete own private beaches"
      ON public.beaches
      FOR DELETE
      TO authenticated
      USING (
        is_private = true
        AND owner_id = auth.uid()
      );
  END IF;
END $$;

-- ============================================================================
-- SERVICE ROLE BYPASS (for cron jobs, admin operations)
-- ============================================================================

-- Note: Service role automatically bypasses RLS, no special policy needed
-- The existing admin policies should handle admin access

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.beaches IS 'Surf spots/beaches. Public beaches (is_private=false) are readable by all. Private beaches (is_private=true) are only accessible to their owner.';

COMMIT;
