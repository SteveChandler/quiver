-- Rollback Database Performance Optimization Migration
-- This reverts changes from 20250102000002_database_performance_optimization.sql
-- Use this if the optimization causes unexpected issues

-- ================================================
-- 1. REMOVE ADDED FOREIGN KEY INDEXES
-- ================================================

-- Remove the foreign key indexes we added
DROP INDEX IF EXISTS idx_boards_user_id_fkey;
DROP INDEX IF EXISTS idx_comments_parent_comment_fkey;
DROP INDEX IF EXISTS idx_favorite_beaches_beach_id_fkey;
DROP INDEX IF EXISTS idx_profiles_default_beach_id_fkey;

-- ================================================
-- 2. RESTORE REMOVED INDEXES (IF NEEDED)
-- ================================================

-- Restore session participants indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants (session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_status ON session_participants (status);

-- Restore session invitations indexes
CREATE INDEX IF NOT EXISTS idx_session_invitations_session_id ON session_invitations (session_id);
CREATE INDEX IF NOT EXISTS idx_session_invitations_inviter_id ON session_invitations (inviter_id);
CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_id ON session_invitations (invitee_id);
CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_email ON session_invitations (invitee_email);
CREATE INDEX IF NOT EXISTS idx_session_invitations_status ON session_invitations (status);
CREATE INDEX IF NOT EXISTS idx_session_invitations_created_at ON session_invitations (created_at);

-- Restore buoy indexes
CREATE INDEX IF NOT EXISTS idx_buoys_uuid_kind ON buoys (buoy_uuid, kind);
CREATE INDEX IF NOT EXISTS idx_buoys_kind ON buoys (kind);

-- Restore beach location indexes
CREATE INDEX IF NOT EXISTS idx_beaches_location_lat ON beaches (latitude);
CREATE INDEX IF NOT EXISTS idx_beaches_location_lng ON beaches (longitude);
CREATE INDEX IF NOT EXISTS idx_beaches_location_composite ON beaches (latitude, longitude);

-- Restore beach ownership indexes
CREATE INDEX IF NOT EXISTS idx_beaches_owner_id ON beaches (owner_id);
CREATE INDEX IF NOT EXISTS idx_beaches_private_owner ON beaches (is_private, owner_id);
CREATE INDEX IF NOT EXISTS idx_beaches_user_private ON beaches (owner_id, is_private);

-- Restore intel confirmation index
CREATE INDEX IF NOT EXISTS intel_post_confirmations_user_id_idx ON intel_post_confirmations (user_id);

-- ================================================
-- 3. REMOVE MONITORING FUNCTION
-- ================================================

DROP FUNCTION IF EXISTS check_foreign_key_indexes();

-- ================================================
-- 4. UPDATE STATISTICS
-- ================================================

-- Update table statistics after rollback
ANALYZE boards;
ANALYZE comments;
ANALYZE favorite_beaches;
ANALYZE profiles;

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