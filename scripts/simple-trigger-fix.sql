-- Simple fix for user_follows trigger field mismatch
-- Run this directly in your SQL editor

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS user_follows_count_trigger ON user_follows;

-- Drop the problematic function
DROP FUNCTION IF EXISTS update_follow_counts();

-- Create the corrected function with proper field names
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER user_follows_count_trigger
    AFTER INSERT OR DELETE ON user_follows
    FOR EACH ROW
    EXECUTE FUNCTION update_follow_counts(); 