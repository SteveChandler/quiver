-- Create intel posts and beach reviews tables
-- Enables community-generated content for beaches

BEGIN;

-- Create intel post tag enum
DO $$ BEGIN
    CREATE TYPE intel_post_tag AS ENUM ('parking', 'hazard', 'crowd', 'conditions', 'access', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create intel_posts table
CREATE TABLE IF NOT EXISTS public.intel_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    beach_id UUID REFERENCES public.beaches(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    tag intel_post_tag NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    photo_storage_path TEXT,
    confirmations_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    surf_conditions JSONB, -- Additional surf-specific metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure beach_id column exists on intel_posts if table pre-existed without it
ALTER TABLE public.intel_posts ADD COLUMN IF NOT EXISTS beach_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'intel_posts' AND c.conname = 'intel_posts_beach_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.intel_posts
        ADD CONSTRAINT intel_posts_beach_id_fkey
        FOREIGN KEY (beach_id) REFERENCES public.beaches(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Ensure missing intel_posts columns exist for legacy environments
ALTER TABLE public.intel_posts ADD COLUMN IF NOT EXISTS surf_conditions JSONB;
ALTER TABLE public.intel_posts ADD COLUMN IF NOT EXISTS confirmations_count INTEGER;
ALTER TABLE public.intel_posts ALTER COLUMN confirmations_count SET DEFAULT 0;
UPDATE public.intel_posts SET confirmations_count = 0 WHERE confirmations_count IS NULL;
ALTER TABLE public.intel_posts ALTER COLUMN confirmations_count SET NOT NULL;
ALTER TABLE public.intel_posts ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE public.intel_posts ALTER COLUMN is_active SET DEFAULT true;
UPDATE public.intel_posts SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.intel_posts ALTER COLUMN is_active SET NOT NULL;

-- Create intel_post_confirmations table
CREATE TABLE IF NOT EXISTS public.intel_post_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_post_id UUID NOT NULL REFERENCES public.intel_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(intel_post_id, user_id)
);

-- Create beach_reviews table
CREATE TABLE IF NOT EXISTS public.beach_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    wave_quality_rating INTEGER NOT NULL CHECK (wave_quality_rating >= 1 AND wave_quality_rating <= 5),
    crowd_density_rating INTEGER NOT NULL CHECK (crowd_density_rating >= 1 AND crowd_density_rating <= 5),
    parking_rating INTEGER NOT NULL CHECK (parking_rating >= 1 AND parking_rating <= 5),
    accessibility_rating INTEGER NOT NULL CHECK (accessibility_rating >= 1 AND accessibility_rating <= 5),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    visit_date DATE,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure helpful_count exists for environments with pre-existing beach_reviews
ALTER TABLE public.beach_reviews
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER;
-- Backfill default and not-null if the column existed without constraints
ALTER TABLE public.beach_reviews
  ALTER COLUMN helpful_count SET DEFAULT 0;
UPDATE public.beach_reviews SET helpful_count = 0 WHERE helpful_count IS NULL;
ALTER TABLE public.beach_reviews
  ALTER COLUMN helpful_count SET NOT NULL;

-- Ensure beach_id column exists on beach_reviews if table pre-existed without it
ALTER TABLE public.beach_reviews ADD COLUMN IF NOT EXISTS beach_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'beach_reviews' AND c.conname = 'beach_reviews_beach_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.beach_reviews
        ADD CONSTRAINT beach_reviews_beach_id_fkey
        FOREIGN KEY (beach_id) REFERENCES public.beaches(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Create beach_review_likes for helpful votes
CREATE TABLE IF NOT EXISTS public.beach_review_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.beach_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(review_id, user_id)
);

-- Create spatial and performance indexes
CREATE INDEX IF NOT EXISTS intel_posts_location_idx ON public.intel_posts USING GIST (
    ST_Point(longitude, latitude)
);
CREATE INDEX IF NOT EXISTS intel_posts_beach_id_idx ON public.intel_posts(beach_id);
CREATE INDEX IF NOT EXISTS intel_posts_user_id_idx ON public.intel_posts(user_id);
CREATE INDEX IF NOT EXISTS intel_posts_tag_idx ON public.intel_posts(tag);
CREATE INDEX IF NOT EXISTS intel_posts_created_at_idx ON public.intel_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS intel_posts_is_active_idx ON public.intel_posts(is_active);
CREATE INDEX IF NOT EXISTS intel_posts_confirmations_count_idx ON public.intel_posts(confirmations_count DESC);

CREATE INDEX IF NOT EXISTS intel_post_confirmations_post_id_idx ON public.intel_post_confirmations(intel_post_id);
CREATE INDEX IF NOT EXISTS intel_post_confirmations_user_id_idx ON public.intel_post_confirmations(user_id);

CREATE INDEX IF NOT EXISTS beach_reviews_beach_id_idx ON public.beach_reviews(beach_id);
CREATE INDEX IF NOT EXISTS beach_reviews_user_id_idx ON public.beach_reviews(user_id);
CREATE INDEX IF NOT EXISTS beach_reviews_overall_rating_idx ON public.beach_reviews(overall_rating);
CREATE INDEX IF NOT EXISTS beach_reviews_created_at_idx ON public.beach_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS beach_reviews_helpful_count_idx ON public.beach_reviews(helpful_count DESC);

CREATE INDEX IF NOT EXISTS beach_review_likes_review_id_idx ON public.beach_review_likes(review_id);
CREATE INDEX IF NOT EXISTS beach_review_likes_user_id_idx ON public.beach_review_likes(user_id);

-- Add triggers to update helpful_count on beach_reviews
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.beach_reviews 
        SET helpful_count = helpful_count + 1 
        WHERE id = NEW.review_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.beach_reviews 
        SET helpful_count = GREATEST(helpful_count - 1, 0) 
        WHERE id = OLD.review_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'beach_review_likes_count_trigger'
    ) THEN
        CREATE TRIGGER beach_review_likes_count_trigger
            AFTER INSERT OR DELETE ON public.beach_review_likes
            FOR EACH ROW EXECUTE FUNCTION update_review_helpful_count();
    END IF;
END $$;

-- Add trigger to update confirmations_count on intel_posts
CREATE OR REPLACE FUNCTION update_intel_confirmations_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = confirmations_count + 1 
        WHERE id = NEW.intel_post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = GREATEST(confirmations_count - 1, 0) 
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'intel_post_confirmations_count_trigger'
    ) THEN
        CREATE TRIGGER intel_post_confirmations_count_trigger
            AFTER INSERT OR DELETE ON public.intel_post_confirmations
            FOR EACH ROW EXECUTE FUNCTION update_intel_confirmations_count();
    END IF;
END $$;

COMMIT;