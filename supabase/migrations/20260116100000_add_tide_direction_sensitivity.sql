-- Add tide direction sensitivity column to beaches table
-- Allows per-beach override of sensitivity (derived from break_type when NULL)

ALTER TABLE public.beaches
ADD COLUMN IF NOT EXISTS tide_direction_sensitivity TEXT
CHECK (tide_direction_sensitivity IS NULL OR tide_direction_sensitivity IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.beaches.tide_direction_sensitivity IS
'Override for tide direction sensitivity. NULL = derive from break_type. low/medium/high = explicit override.';
