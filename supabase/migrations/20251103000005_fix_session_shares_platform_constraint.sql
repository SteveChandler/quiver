-- Fix session_shares platform constraint to include all platforms used by frontend
-- This migration resolves 400 errors when tracking shares with platforms like 'copy', 'tiktok', 'native', 'other'

-- Drop the existing constraint that was too restrictive
ALTER TABLE public.session_shares
  DROP CONSTRAINT IF EXISTS check_platform;

-- Add the updated constraint with all platforms
ALTER TABLE public.session_shares
  ADD CONSTRAINT check_platform
  CHECK (
    platform IN (
      'instagram',
      'x',
      'twitter',    -- Keep for backward compatibility
      'facebook',
      'tiktok',
      'copy',
      'native',
      'other',
      'generic',
      'download'
    )
  );

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT check_platform ON public.session_shares IS
  'Ensures platform is one of the supported share platforms. Includes legacy platforms for backward compatibility.';
