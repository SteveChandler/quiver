-- Add updated_at trigger for user_devices table
-- This migration ensures the update_updated_at_column() function exists
-- and creates the trigger for automatic updated_at timestamp management

begin;

-- Create update_updated_at_column function if it doesn't exist
-- This function automatically updates the updated_at column when a row is modified
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS update_user_devices_updated_at ON public.user_devices;

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_user_devices_updated_at
    BEFORE UPDATE ON public.user_devices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

commit;
