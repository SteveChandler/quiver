-- Rollback Database Performance Optimization Migration
-- This reverts changes from 20250102000002_database_performance_optimization.sql
-- Use this if the optimization causes unexpected issues

-- ================================================
-- 1. REMOVE ADDED FOREIGN KEY INDEXES
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.idx_boards_user_id_fkey') IS NOT NULL THEN
    DROP INDEX IF EXISTS idx_boards_user_id_fkey;
  END IF;
  IF to_regclass('public.idx_comments_parent_comment_fkey') IS NOT NULL THEN
    DROP INDEX IF EXISTS idx_comments_parent_comment_fkey;
  END IF;
  IF to_regclass('public.idx_favorite_beaches_beach_id_fkey') IS NOT NULL THEN
    DROP INDEX IF EXISTS idx_favorite_beaches_beach_id_fkey;
  END IF;
  IF to_regclass('public.idx_profiles_default_beach_id_fkey') IS NOT NULL THEN
    DROP INDEX IF EXISTS idx_profiles_default_beach_id_fkey;
  END IF;
END $$;

-- ================================================
-- 2. RESTORE REMOVED INDEXES (IF NEEDED)
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.session_participants') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON public.session_participants (session_id);
    CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON public.session_participants (user_id);
    CREATE INDEX IF NOT EXISTS idx_session_participants_status ON public.session_participants (status);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.session_invitations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_session_invitations_session_id ON public.session_invitations (session_id);
    CREATE INDEX IF NOT EXISTS idx_session_invitations_inviter_id ON public.session_invitations (inviter_id);
    CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_id ON public.session_invitations (invitee_id);
    CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_email ON public.session_invitations (invitee_email);
    CREATE INDEX IF NOT EXISTS idx_session_invitations_status ON public.session_invitations (status);
    CREATE INDEX IF NOT EXISTS idx_session_invitations_created_at ON public.session_invitations (created_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.buoys') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_buoys_uuid_kind ON public.buoys (buoy_uuid, kind);
    CREATE INDEX IF NOT EXISTS idx_buoys_kind ON public.buoys (kind);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.beaches') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_beaches_location_lat ON public.beaches (latitude);
    CREATE INDEX IF NOT EXISTS idx_beaches_location_lng ON public.beaches (longitude);
    CREATE INDEX IF NOT EXISTS idx_beaches_location_composite ON public.beaches (latitude, longitude);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.beaches') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_beaches_owner_id ON public.beaches (owner_id);
    CREATE INDEX IF NOT EXISTS idx_beaches_private_owner ON public.beaches (is_private, owner_id);
    CREATE INDEX IF NOT EXISTS idx_beaches_user_private ON public.beaches (owner_id, is_private);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS intel_post_confirmations_user_id_idx ON public.intel_post_confirmations (user_id);
  END IF;
END $$;

-- ================================================
-- 3. REMOVE MONITORING FUNCTION
-- ================================================

DROP FUNCTION IF EXISTS check_foreign_key_indexes();

-- ================================================
-- 4. UPDATE STATISTICS
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.boards') IS NOT NULL THEN
    EXECUTE 'ANALYZE public.boards';
  END IF;
  IF to_regclass('public.comments') IS NOT NULL THEN
    EXECUTE 'ANALYZE public.comments';
  END IF;
  IF to_regclass('public.favorite_beaches') IS NOT NULL THEN
    EXECUTE 'ANALYZE public.favorite_beaches';
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'ANALYZE public.profiles';
  END IF;
END $$;

-- Add rollback notification
DO $$
BEGIN
    RAISE NOTICE 'Database Performance Optimization Rollback Complete:';
    RAISE NOTICE '  ✓ Removed 4 foreign key indexes';
    RAISE NOTICE '  ✓ Restored 16 previously unused indexes';
    RAISE NOTICE '  ✓ Removed monitoring function';
    RAISE NOTICE '  ✓ Updated table statistics';
    RAISE NOTICE '  ⚠️  Database returned to pre-optimization state';
END $$; 