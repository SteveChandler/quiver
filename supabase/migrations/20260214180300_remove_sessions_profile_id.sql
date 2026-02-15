BEGIN;

-- Step 1: Ensure user_id FK exists (skip if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 2: Drop old RLS policies (including mock policies that reference profile_id)
DROP POLICY IF EXISTS sessions_select_own ON sessions;
DROP POLICY IF EXISTS sessions_insert_own ON sessions;
DROP POLICY IF EXISTS sessions_update_own ON sessions;
DROP POLICY IF EXISTS sessions_delete_own ON sessions;
DROP POLICY IF EXISTS sessions_select_public ON sessions;
DROP POLICY IF EXISTS sessions_insert_mock ON sessions;
DROP POLICY IF EXISTS sessions_update_mock ON sessions;
DROP POLICY IF EXISTS sessions_delete_mock ON sessions;

-- Step 3: Recreate RLS policies using user_id

CREATE POLICY sessions_select_own ON sessions
  FOR SELECT USING ((SELECT auth.uid()) = user_id OR is_public = true);
CREATE POLICY sessions_insert_own ON sessions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY sessions_update_own ON sessions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY sessions_delete_own ON sessions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Step 4: Drop old FK and column
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_profile_id_fkey;
ALTER TABLE sessions DROP COLUMN IF EXISTS profile_id;

-- Step 5: Also remove from history table
ALTER TABLE sessions_history DROP COLUMN IF EXISTS profile_id;

COMMIT;
