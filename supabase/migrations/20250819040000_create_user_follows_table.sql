-- Create user_follows table for social following functionality
-- Supports friend invitations and social discovery features

BEGIN;

-- Create user_follows table
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Prevent users from following themselves
    CONSTRAINT no_self_follow CHECK (follower_id != following_id),
    
    -- Prevent duplicate follows
    CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON public.user_follows(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view all follows (for public social discovery)
CREATE POLICY "user_follows_select_all" 
ON public.user_follows FOR SELECT 
USING (true);

-- Users can only create follows for themselves
CREATE POLICY "user_follows_insert_own" 
ON public.user_follows FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

-- Users can only delete their own follows
CREATE POLICY "user_follows_delete_own" 
ON public.user_follows FOR DELETE 
USING (auth.uid() = follower_id);

-- Add follower/following count columns to profiles if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Create function to update follow counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment counts
        UPDATE public.profiles 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
        UPDATE public.profiles 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement counts
        UPDATE public.profiles 
        SET following_count = GREATEST(following_count - 1, 0) 
        WHERE id = OLD.follower_id;
        
        UPDATE public.profiles 
        SET followers_count = GREATEST(followers_count - 1, 0) 
        WHERE id = OLD.following_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update follow counts
DROP TRIGGER IF EXISTS trigger_update_follow_counts ON public.user_follows;
CREATE TRIGGER trigger_update_follow_counts
    AFTER INSERT OR DELETE ON public.user_follows
    FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Initialize follow counts for existing users
UPDATE public.profiles SET 
    followers_count = (
        SELECT COUNT(*) FROM public.user_follows 
        WHERE following_id = profiles.id
    ),
    following_count = (
        SELECT COUNT(*) FROM public.user_follows 
        WHERE follower_id = profiles.id
    );

COMMIT;
