-- Drop the existing policy for viewing sessions
DROP POLICY IF EXISTS "Sessions are viewable by their owner" ON sessions;

-- Create a new policy to allow all users (including unauthenticated) to view all sessions
CREATE POLICY "Sessions are viewable by everyone" 
ON sessions 
FOR SELECT 
USING (true);

-- Keep existing policies for insert, update, and delete
-- These ensure users can only modify their own sessions 