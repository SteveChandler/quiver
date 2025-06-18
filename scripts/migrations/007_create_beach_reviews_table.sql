-- Create beach_reviews table
CREATE TABLE IF NOT EXISTS beach_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    wave_quality_rating INTEGER NOT NULL CHECK (wave_quality_rating >= 1 AND wave_quality_rating <= 5),
    crowd_density_rating INTEGER NOT NULL CHECK (crowd_density_rating >= 1 AND crowd_density_rating <= 5),
    parking_rating INTEGER NOT NULL CHECK (parking_rating >= 1 AND parking_rating <= 5),
    accessibility_rating INTEGER NOT NULL CHECK (accessibility_rating >= 1 AND accessibility_rating <= 5),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    visit_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_beach_reviews_beach_id ON beach_reviews(beach_id);
CREATE INDEX IF NOT EXISTS idx_beach_reviews_user_id ON beach_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_beach_reviews_created_at ON beach_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beach_reviews_overall_rating ON beach_reviews(overall_rating);

-- Ensure one review per user per beach (users can update but not duplicate)
CREATE UNIQUE INDEX IF NOT EXISTS idx_beach_reviews_unique_user_beach ON beach_reviews(beach_id, user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_beach_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_beach_reviews_updated_at
    BEFORE UPDATE ON beach_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_beach_reviews_updated_at();

-- RLS (Row Level Security) policies
ALTER TABLE beach_reviews ENABLE ROW LEVEL SECURITY;

-- Users can view all reviews
CREATE POLICY "Users can view all beach reviews" ON beach_reviews
    FOR SELECT USING (true);

-- Users can insert their own reviews
CREATE POLICY "Users can insert their own beach reviews" ON beach_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update their own beach reviews" ON beach_reviews
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete their own beach reviews" ON beach_reviews
    FOR DELETE USING (auth.uid() = user_id); 