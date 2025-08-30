-- Rename default_beach_id column to home_beach_id for consistency
-- This migration standardizes the field name across the application

DO $$ 
BEGIN
    -- Check if default_beach_id exists and home_beach_id doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'default_beach_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'home_beach_id'
    ) THEN
        -- Rename the column
        ALTER TABLE public.profiles 
        RENAME COLUMN default_beach_id TO home_beach_id;
        
        -- Update the index name to match the new column name
        DROP INDEX IF EXISTS idx_profiles_default_beach_id;
        CREATE INDEX IF NOT EXISTS idx_profiles_home_beach_id ON public.profiles(home_beach_id);
        
        -- Add comment to document the change
        COMMENT ON COLUMN public.profiles.home_beach_id IS 'User''s preferred home beach for forecasts and session defaults';
    END IF;
END $$;