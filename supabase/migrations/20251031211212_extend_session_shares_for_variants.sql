-- Extend session_shares table for social sharing variants
-- Adds aspect_ratio column and updates variant column to support numeric variants

-- Add aspect_ratio column
ALTER TABLE public.session_shares
  ADD COLUMN IF NOT EXISTS aspect_ratio text;

-- Add check constraint for aspect_ratio (allow NULL for backward compatibility)
ALTER TABLE public.session_shares
  ADD CONSTRAINT check_aspect_ratio
  CHECK (aspect_ratio IS NULL OR aspect_ratio IN ('1:1', '4:5', '9:16'));

-- Update variant column to support both old text variants and new numeric variants
-- Current values: 'story', 'square'
-- New values: '1', '2', '3', '4', '5', '6' (as text for consistency)
ALTER TABLE public.session_shares
  DROP CONSTRAINT IF EXISTS check_variant;

ALTER TABLE public.session_shares
  ADD CONSTRAINT check_variant
  CHECK (
    variant IS NULL OR
    variant IN ('story', 'square', '1', '2', '3', '4', '5', '6')
  );

-- Update platform constraint to match requirements
ALTER TABLE public.session_shares
  DROP CONSTRAINT IF EXISTS check_platform;

ALTER TABLE public.session_shares
  ADD CONSTRAINT check_platform
  CHECK (
    platform IN (
      'instagram',
      'x',
      'twitter',  -- Keep for backward compatibility
      'facebook',
      'generic',
      'download'
    )
  );

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_session_shares_variant
  ON public.session_shares(variant)
  WHERE variant IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_shares_aspect_ratio
  ON public.session_shares(aspect_ratio)
  WHERE aspect_ratio IS NOT NULL;

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_session_shares_analytics
  ON public.session_shares(platform, variant, aspect_ratio, created_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN public.session_shares.variant IS
  'Share card variant: legacy values (story, square) or numeric variants (1-6 as text)';

COMMENT ON COLUMN public.session_shares.aspect_ratio IS
  'Image aspect ratio for the shared card: 1:1 (square), 4:5 (portrait), or 9:16 (story)';

COMMENT ON COLUMN public.session_shares.platform IS
  'Platform where session was shared: instagram, x, facebook, generic, or download';
