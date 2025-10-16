-- Add notification preference columns to profiles table
-- Provides granular control over push, email, and in-app notifications
-- with per-feature toggles for likes, follows, reminders, etc.

BEGIN;

-- Add master notification toggle columns
DO $$ 
BEGIN
    -- Master push notifications toggle
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_push_enabled'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_push_enabled boolean NOT NULL DEFAULT true;
    END IF;

    -- Master email notifications toggle
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_email_enabled'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_email_enabled boolean NOT NULL DEFAULT true;
    END IF;

    -- Master in-app notifications toggle
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_inapp_enabled'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_inapp_enabled boolean NOT NULL DEFAULT true;
    END IF;
END $$;

-- Add feature-specific notification toggle columns
DO $$ 
BEGIN
    -- Session invites notifications
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_session_invites'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_session_invites boolean NOT NULL DEFAULT true;
    END IF;

    -- Likes notifications
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_likes'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_likes boolean NOT NULL DEFAULT true;
    END IF;

    -- Follows notifications
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_follows'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_follows boolean NOT NULL DEFAULT true;
    END IF;

    -- Reminders notifications
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_reminders'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_reminders boolean NOT NULL DEFAULT true;
    END IF;

    -- XP updates notifications
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'notif_xp_updates'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN notif_xp_updates boolean NOT NULL DEFAULT true;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.notif_push_enabled IS 'Master toggle for all push notifications';
COMMENT ON COLUMN public.profiles.notif_email_enabled IS 'Master toggle for all email notifications';
COMMENT ON COLUMN public.profiles.notif_inapp_enabled IS 'Master toggle for all in-app notifications';
COMMENT ON COLUMN public.profiles.notif_session_invites IS 'Receive notifications for session invites';
COMMENT ON COLUMN public.profiles.notif_likes IS 'Receive notifications when someone likes your content';
COMMENT ON COLUMN public.profiles.notif_follows IS 'Receive notifications when someone follows you';
COMMENT ON COLUMN public.profiles.notif_reminders IS 'Receive reminder notifications for planned sessions';
COMMENT ON COLUMN public.profiles.notif_xp_updates IS 'Receive notifications for XP achievements and level ups';

COMMIT;


