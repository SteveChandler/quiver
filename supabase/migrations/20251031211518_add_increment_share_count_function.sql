-- Add database function to increment session share count
-- This is called after a successful share to update the counter

CREATE OR REPLACE FUNCTION increment_session_share_count(session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.sessions
  SET share_count = share_count + 1
  WHERE id = session_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_session_share_count(uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION increment_session_share_count(uuid) IS
  'Increments the share_count field on a session. Called after successful share.';
