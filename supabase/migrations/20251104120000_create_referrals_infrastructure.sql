-- Referrals System Migration
-- Creates infrastructure for user referral tracking and reward management
-- This migration supports the onboarding flow's referral code entry feature
--
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following SQL:
--   DROP TABLE IF EXISTS public.referrals CASCADE;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS referral_code;
--   DROP FUNCTION IF EXISTS public.generate_referral_code();
--   DROP FUNCTION IF EXISTS public.get_user_referral_stats(UUID);

-- ============================================================================
-- SECTION 1: Add referral_code column to profiles table
-- ============================================================================

DO $$
BEGIN
    -- Add referral_code column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'referral_code'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN referral_code TEXT;

        COMMENT ON COLUMN public.profiles.referral_code IS
            'Unique referral code that this user can share with others. Generated on first access.';
    END IF;
END $$;

-- Create unique index on referral_code (case-insensitive)
-- This ensures referral codes are unique regardless of case
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_lower
    ON public.profiles (LOWER(referral_code))
    WHERE referral_code IS NOT NULL;

-- Create standard index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
    ON public.profiles (referral_code)
    WHERE referral_code IS NOT NULL;

-- ============================================================================
-- SECTION 2: Create referrals table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The user who created and shared the referral code
    referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- The user who signed up using the referral code
    referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- The actual referral code that was entered (stored for audit purposes)
    referral_code TEXT NOT NULL,

    -- Referral status: pending (just signed up), completed (referee completed onboarding), expired (unused)
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'expired')),

    -- When the referral was marked as completed
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    -- 1. User cannot refer themselves
    CONSTRAINT referrals_no_self_referral CHECK (referrer_id != referee_id),

    -- 2. Each user can only be referred once (unique referee)
    CONSTRAINT referrals_unique_referee UNIQUE (referee_id),

    -- 3. Completed referrals must have a completion timestamp
    CONSTRAINT referrals_completed_at_when_completed
        CHECK (
            (status = 'completed' AND completed_at IS NOT NULL) OR
            (status != 'completed' AND completed_at IS NULL)
        )
);

-- Add helpful comments for documentation
COMMENT ON TABLE public.referrals IS
    'Tracks user referrals. Created when a new user signs up with a referral code.';

COMMENT ON COLUMN public.referrals.referrer_id IS
    'User who created and shared the referral code';

COMMENT ON COLUMN public.referrals.referee_id IS
    'User who signed up using the referral code (can only be referred once)';

COMMENT ON COLUMN public.referrals.referral_code IS
    'The actual code entered (stored for audit/analytics purposes)';

COMMENT ON COLUMN public.referrals.status IS
    'pending: just signed up; completed: finished onboarding; expired: code no longer valid';

-- ============================================================================
-- SECTION 3: Create indexes for performance
-- ============================================================================

-- Index for looking up referrals by the code entered (with case-insensitivity)
CREATE INDEX IF NOT EXISTS idx_referrals_code_lower
    ON public.referrals (LOWER(referral_code));

-- Index for finding all users referred by a specific referrer (for stats/leaderboards)
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id
    ON public.referrals (referrer_id);

-- Index for checking if a user has already been referred
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id
    ON public.referrals (referee_id);

-- Index for filtering by status (e.g., counting completed referrals)
CREATE INDEX IF NOT EXISTS idx_referrals_status
    ON public.referrals (status);

-- Composite index for referrer stats queries (count by referrer and status)
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
    ON public.referrals (referrer_id, status);

-- Index for recent referrals queries (ordered by created_at)
CREATE INDEX IF NOT EXISTS idx_referrals_created_at
    ON public.referrals (created_at DESC);

-- ============================================================================
-- SECTION 4: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view referrals where they are the referrer
-- This allows users to see who they've successfully referred
CREATE POLICY "Users can view own referrals as referrer"
    ON public.referrals
    FOR SELECT
    USING ((SELECT auth.uid()) = referrer_id);

-- Policy: Users can view referrals where they are the referee
-- This allows users to see who referred them
CREATE POLICY "Users can view own referrals as referee"
    ON public.referrals
    FOR SELECT
    USING ((SELECT auth.uid()) = referee_id);

-- Policy: Users can create referral records when they sign up
-- The referee_id must match their own user ID
CREATE POLICY "Users can create referrals for themselves"
    ON public.referrals
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = referee_id);

-- Policy: Users can update their own referral status (e.g., marking as completed)
-- Only the referee can update their referral record
CREATE POLICY "Users can update own referrals as referee"
    ON public.referrals
    FOR UPDATE
    USING ((SELECT auth.uid()) = referee_id)
    WITH CHECK ((SELECT auth.uid()) = referee_id);

-- Note: No DELETE policy - referrals should be immutable for audit purposes
-- If deletion is needed, it should be done via service role

-- ============================================================================
-- SECTION 5: Create helper functions
-- ============================================================================

-- Function to generate a unique referral code for a user
-- Format: 6-character alphanumeric code (uppercase)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    max_attempts INTEGER := 10;
    attempt INTEGER := 0;
BEGIN
    -- Try to generate a unique code (max 10 attempts to avoid infinite loops)
    LOOP
        -- Generate 6-character alphanumeric code
        new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

        -- Check if code already exists (case-insensitive)
        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE LOWER(referral_code) = LOWER(new_code)
        ) INTO code_exists;

        -- Exit if unique code found
        EXIT WHEN NOT code_exists;

        -- Increment attempt counter
        attempt := attempt + 1;

        -- Raise exception if max attempts reached
        IF attempt >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', max_attempts;
        END IF;
    END LOOP;

    RETURN new_code;
END;
$$;

COMMENT ON FUNCTION public.generate_referral_code() IS
    'Generates a unique 6-character alphanumeric referral code (case-insensitive uniqueness check)';

-- Function to get referral statistics for a user
CREATE OR REPLACE FUNCTION public.get_user_referral_stats(user_id UUID)
RETURNS TABLE (
    total_referrals BIGINT,
    completed_referrals BIGINT,
    pending_referrals BIGINT,
    expired_referrals BIGINT,
    referral_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_referrals,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_referrals,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired_referrals,
        p.referral_code
    FROM public.profiles p
    LEFT JOIN public.referrals r ON r.referrer_id = p.id
    WHERE p.id = user_id
    GROUP BY p.id, p.referral_code;
END;
$$;

COMMENT ON FUNCTION public.get_user_referral_stats(UUID) IS
    'Returns referral statistics for a given user (total, completed, pending, expired counts)';

-- ============================================================================
-- SECTION 6: Create triggers
-- ============================================================================

-- Trigger to automatically update updated_at timestamp
-- Reuse existing function if available, otherwise it's already created in other migrations
CREATE TRIGGER update_referrals_updated_at
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 7: Grant permissions
-- ============================================================================

-- Grant necessary permissions for authenticated users
GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant execute permission on helper functions
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_referral_stats(UUID) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of what was created:
-- 1. profiles.referral_code column (with unique case-insensitive index)
-- 2. referrals table (with comprehensive constraints)
-- 3. Performance indexes (7 indexes for fast queries)
-- 4. RLS policies (view own referrals, create for self, update for self)
-- 5. Helper functions (generate_referral_code, get_user_referral_stats)
-- 6. Triggers (auto-update updated_at)
-- 7. Proper permissions for authenticated users
