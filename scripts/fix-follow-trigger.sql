-- ================================================
-- Fix User Follows Trigger - Field Name Mismatch
-- ================================================
-- The trigger is looking for 'followed_id' but the table has 'following_id'

-- First, check the current trigger function
DO $$
BEGIN
    -- Drop the existing trigger function if it exists
    DROP FUNCTION IF EXISTS update_follow_counts() CASCADE;
    
    -- Recreate the trigger function with correct field names
    CREATE OR REPLACE FUNCTION update_follow_counts()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            -- Increment followers count for the user being followed
            UPDATE profiles SET followers_count = followers_count + 1 
            WHERE id = NEW.following_id;
            
            -- Increment following count for the user doing the following
            UPDATE profiles SET following_count = following_count + 1 
            WHERE id = NEW.follower_id;
            
            RETURN NEW;
            
        ELSIF TG_OP = 'DELETE' THEN
            -- Decrement followers count for the user being unfollowed
            UPDATE profiles SET followers_count = followers_count - 1 
            WHERE id = OLD.following_id;
            
            -- Decrement following count for the user doing the unfollowing
            UPDATE profiles SET following_count = following_count - 1 
            WHERE id = OLD.follower_id;
            
            RETURN OLD;
        END IF;
        
        RETURN NULL;
    END;
    $trigger$ LANGUAGE plpgsql;
    
    -- Create the trigger on user_follows table
    DROP TRIGGER IF EXISTS user_follows_count_trigger ON user_follows;
    CREATE TRIGGER user_follows_count_trigger
        AFTER INSERT OR DELETE ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts();
        
    RAISE NOTICE 'Fixed user_follows trigger with correct field names (following_id, follower_id)';
    
END $$; 