-- Create user_follows table for production environment
-- This migration is safe and only adds the social following functionality

-- Create user_follows table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Ensure unique follow relationships
    UNIQUE(follower_id, following_id),
    
    -- Prevent self-following
    CHECK (follower_id != following_id)
);

-- Add RLS policies for user_follows
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Users can view all follow relationships (for discovery)
CREATE POLICY "Users can view follow relationships" ON public.user_follows
    FOR SELECT USING (true);

-- Users can only create follows where they are the follower
CREATE POLICY "Users can follow others" ON public.user_follows  
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can only delete follows where they are the follower
CREATE POLICY "Users can unfollow others" ON public.user_follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Add follower/following count columns to profiles if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Create function to update follow counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment follower count for the user being followed
        UPDATE public.profiles 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
        -- Increment following count for the user doing the following
        UPDATE public.profiles 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement follower count for the user being unfollowed
        UPDATE public.profiles 
        SET followers_count = GREATEST(0, followers_count - 1) 
        WHERE id = OLD.following_id;
        
        -- Decrement following count for the user doing the unfollowing
        UPDATE public.profiles 
        SET following_count = GREATEST(0, following_count - 1) 
        WHERE id = OLD.follower_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to automatically update follow counts
DROP TRIGGER IF EXISTS update_follow_counts_trigger ON public.user_follows;
CREATE TRIGGER update_follow_counts_trigger
    AFTER INSERT OR DELETE ON public.user_follows
    FOR EACH ROW
    EXECUTE FUNCTION update_follow_counts();

-- Initialize follower/following counts for existing users
UPDATE public.profiles SET 
    followers_count = (
        SELECT COUNT(*) FROM public.user_follows 
        WHERE following_id = profiles.id
    ),
    following_count = (
        SELECT COUNT(*) FROM public.user_follows 
        WHERE follower_id = profiles.id
    )
WHERE followers_count IS NULL OR following_count IS NULL;
