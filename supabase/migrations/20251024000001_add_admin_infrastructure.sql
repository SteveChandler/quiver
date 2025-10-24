-- Migration: Add Admin Infrastructure
-- Description: Add is_admin column to profiles, create admin_audit_log table, seed admin user and badge
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A)

BEGIN;

-- ================================================
-- 1. Add is_admin column to profiles table
-- ================================================

DO $$
BEGIN
    -- Add is_admin column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'is_admin'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added is_admin column to profiles table';
    ELSE
        RAISE NOTICE 'is_admin column already exists in profiles table';
    END IF;
END $$;

-- Create index for performance on admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- ================================================
-- 2. Create admin_audit_log table
-- ================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (LENGTH(action) <= 100),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('beach', 'session', 'review', 'photo', 'intel', 'user', 'forecast', 'system')),
    entity_id UUID,
    payload_summary JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON public.admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON public.admin_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- Enable RLS on admin_audit_log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin users can view all audit logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'admin_audit_log'
        AND policyname = 'Admins can view audit logs'
    ) THEN
        CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND is_admin = true
                )
            );
    END IF;
END $$;

-- Service role can insert audit logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'admin_audit_log'
        AND policyname = 'Service role can insert audit logs'
    ) THEN
        CREATE POLICY "Service role can insert audit logs" ON public.admin_audit_log
            FOR INSERT
            WITH CHECK (true);
    END IF;
END $$;

-- ================================================
-- 3. Seed admin user
-- ================================================

-- Update the designated admin user
UPDATE public.profiles
SET is_admin = true
WHERE id = 'bcdc5d59-2e22-4006-98a6-cada8618577a'
  AND is_admin = false;

-- Log if the update occurred
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count
    FROM public.profiles
    WHERE id = 'bcdc5d59-2e22-4006-98a6-cada8618577a' AND is_admin = true;

    IF admin_count > 0 THEN
        RAISE NOTICE 'Admin user bcdc5d59-2e22-4006-98a6-cada8618577a is now flagged as admin';
    ELSE
        RAISE WARNING 'Admin user bcdc5d59-2e22-4006-98a6-cada8618577a not found in profiles table';
    END IF;
END $$;

-- ================================================
-- 4. Ensure team_admin badge exists and assign it
-- ================================================

-- Ensure badge_definitions table exists (should be created by gamification migration)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'badge_definitions') THEN
        -- Insert or update team_admin badge
        INSERT INTO public.badge_definitions (
            badge_slug,
            name,
            description,
            icon,
            category,
            xp_reward
        ) VALUES (
            'team_admin',
            'Quiver Team',
            'Official Quiver admin account',
            'ShieldCheck',
            'global',
            0
        )
        ON CONFLICT (badge_slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            icon = EXCLUDED.icon,
            category = EXCLUDED.category;

        RAISE NOTICE 'team_admin badge definition created/updated';

        -- Assign badge to admin user
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_badges') THEN
            INSERT INTO public.user_badges (user_id, badge_slug)
            VALUES ('bcdc5d59-2e22-4006-98a6-cada8618577a', 'team_admin')
            ON CONFLICT (user_id, badge_slug) DO NOTHING;

            RAISE NOTICE 'team_admin badge assigned to admin user';
        END IF;
    ELSE
        RAISE NOTICE 'badge_definitions table not found - skipping badge seeding (will be handled by gamification migration)';
    END IF;
END $$;

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;
-- DROP INDEX IF EXISTS idx_profiles_is_admin;
-- UPDATE public.profiles SET is_admin = false WHERE id = 'bcdc5d59-2e22-4006-98a6-cada8618577a';
-- DELETE FROM public.user_badges WHERE badge_slug = 'team_admin';
-- DELETE FROM public.badge_definitions WHERE badge_slug = 'team_admin';
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- Verify admin setup:
-- SELECT id, full_name, email, is_admin FROM public.profiles WHERE is_admin = true;
--
-- Check audit log table exists:
-- SELECT * FROM information_schema.tables WHERE table_name = 'admin_audit_log';
--
-- Verify admin badge:
-- SELECT ub.*, bd.name FROM public.user_badges ub
-- JOIN public.badge_definitions bd ON ub.badge_slug = bd.badge_slug
-- WHERE ub.user_id = 'bcdc5d59-2e22-4006-98a6-cada8618577a';
