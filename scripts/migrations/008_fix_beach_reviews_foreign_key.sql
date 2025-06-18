-- Fix beach_reviews foreign key to reference profiles instead of auth.users
-- This migration updates the foreign key relationship to match the application's expectations

-- First, check if profiles table exists and has proper foreign key to auth.users
DO $$
BEGIN
    -- Check if profiles table exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        -- Create profiles table if it doesn't exist
        CREATE TABLE profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            full_name TEXT,
            email TEXT,
            phone_number TEXT,
            avatar_url TEXT,
            bio TEXT,
            location TEXT,
            experience_level TEXT,
            favorite_spot TEXT,
            instagram TEXT,
            default_beach_id UUID REFERENCES beaches(id),
            notification_session_reminders BOOLEAN DEFAULT true,
            notification_community_replies BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Enable RLS on profiles
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies for profiles
        CREATE POLICY "Users can view all profiles" ON profiles
            FOR SELECT USING (true);

        CREATE POLICY "Users can update their own profile" ON profiles
            FOR UPDATE USING (auth.uid() = id);

        CREATE POLICY "Users can insert their own profile" ON profiles
            FOR INSERT WITH CHECK (auth.uid() = id);

        -- Create updated_at trigger for profiles
        CREATE OR REPLACE FUNCTION update_profiles_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        CREATE TRIGGER update_profiles_updated_at
            BEFORE UPDATE ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_profiles_updated_at();

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
    END IF;
END $$;

-- Now update the beach_reviews foreign key constraint
-- Drop the existing foreign key constraint
ALTER TABLE beach_reviews DROP CONSTRAINT IF EXISTS beach_reviews_user_id_fkey;

-- Add the new foreign key constraint to reference profiles
ALTER TABLE beach_reviews 
ADD CONSTRAINT beach_reviews_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Ensure any existing beach_reviews have corresponding profiles
-- This will create profile records for any reviews that reference users without profiles
INSERT INTO profiles (id, full_name, email)
SELECT DISTINCT 
    br.user_id,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    au.email
FROM beach_reviews br
JOIN auth.users au ON br.user_id = au.id
WHERE br.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- Update the RLS policies to work with the new relationship
DROP POLICY IF EXISTS "Users can insert their own beach reviews" ON beach_reviews;
DROP POLICY IF EXISTS "Users can update their own beach reviews" ON beach_reviews;
DROP POLICY IF EXISTS "Users can delete their own beach reviews" ON beach_reviews;

-- Recreate RLS policies with profiles relationship
CREATE POLICY "Users can insert their own beach reviews" ON beach_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beach reviews" ON beach_reviews
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own beach reviews" ON beach_reviews
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment to document the change
COMMENT ON CONSTRAINT beach_reviews_user_id_fkey ON beach_reviews IS 
'References profiles table instead of auth.users for proper user data relationships'; 