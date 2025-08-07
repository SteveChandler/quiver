-- Add check_ins table for community surf condition reports
-- Migration: 20250116000000_add_check_ins_table.sql
-- Purpose: Enable community-driven surf forecasting with real-time condition check-ins

-- Create check_ins table
CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    
    -- Surf conditions
    wave_height NUMERIC(4,1) CHECK (wave_height >= 0 AND wave_height <= 50),
    wind_speed NUMERIC(4,1) CHECK (wind_speed >= 0 AND wind_speed <= 150),
    wind_direction TEXT CHECK (wind_direction IN ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'OFFSHORE', 'ONSHORE', 'CROSS')),
    water_temp NUMERIC(4,1) CHECK (water_temp >= 32 AND water_temp <= 100),
    
    -- Community data
    crowd_level INTEGER CHECK (crowd_level >= 1 AND crowd_level <= 5), -- 1=empty, 5=packed
    vibe TEXT, -- Free text for session notes
    
    -- Forecast accuracy rating
    forecast_accuracy_rating TEXT CHECK (forecast_accuracy_rating IN ('accurate', 'somewhat', 'inaccurate')) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_check_ins_user_id ON public.check_ins(user_id);
CREATE INDEX idx_check_ins_beach_id ON public.check_ins(beach_id);
CREATE INDEX idx_check_ins_checked_in_at ON public.check_ins(checked_in_at DESC);
CREATE INDEX idx_check_ins_beach_checked_in_at ON public.check_ins(beach_id, checked_in_at DESC);
CREATE INDEX idx_check_ins_forecast_accuracy ON public.check_ins(forecast_accuracy_rating);

-- Enable Row Level Security
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- RLS Policies using performance-optimized patterns
-- Users can read all check-ins (public community data)
CREATE POLICY "check_ins_select_public" ON public.check_ins
    FOR SELECT USING (true);

-- Users can insert their own check-ins
CREATE POLICY "check_ins_insert_own" ON public.check_ins
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can update their own check-ins
CREATE POLICY "check_ins_update_own" ON public.check_ins
    FOR UPDATE USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own check-ins
CREATE POLICY "check_ins_delete_own" ON public.check_ins
    FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_check_ins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_ins_updated_at
    BEFORE UPDATE ON public.check_ins
    FOR EACH ROW
    EXECUTE FUNCTION update_check_ins_updated_at();

-- Add function to get recent check-ins for a beach
CREATE OR REPLACE FUNCTION get_recent_check_ins(
    beach_uuid UUID,
    hours_back INTEGER DEFAULT 24,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    wave_height NUMERIC,
    wind_speed NUMERIC,
    wind_direction TEXT,
    water_temp NUMERIC,
    crowd_level INTEGER,
    vibe TEXT,
    forecast_accuracy_rating TEXT,
    username TEXT,
    profile_picture_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id,
        ci.user_id,
        ci.checked_in_at,
        ci.wave_height,
        ci.wind_speed,
        ci.wind_direction,
        ci.water_temp,
        ci.crowd_level,
        ci.vibe,
        ci.forecast_accuracy_rating,
        p.username,
        p.profile_picture_url
    FROM public.check_ins ci
    LEFT JOIN public.profiles p ON ci.user_id = p.user_id
    WHERE ci.beach_id = beach_uuid
        AND ci.checked_in_at > (now() - (hours_back || ' hours')::interval)
    ORDER BY ci.checked_in_at DESC
    LIMIT limit_count;
END;
$$;

-- Add function to get forecast accuracy stats for a beach
CREATE OR REPLACE FUNCTION get_forecast_accuracy_stats(
    beach_uuid UUID,
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_reports INTEGER,
    accurate_count INTEGER,
    somewhat_count INTEGER,
    inaccurate_count INTEGER,
    accuracy_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_reports,
        COUNT(CASE WHEN forecast_accuracy_rating = 'accurate' THEN 1 END)::INTEGER as accurate_count,
        COUNT(CASE WHEN forecast_accuracy_rating = 'somewhat' THEN 1 END)::INTEGER as somewhat_count,
        COUNT(CASE WHEN forecast_accuracy_rating = 'inaccurate' THEN 1 END)::INTEGER as inaccurate_count,
        ROUND(
            (COUNT(CASE WHEN forecast_accuracy_rating = 'accurate' THEN 1 END)::NUMERIC / 
             NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 1
        ) as accuracy_percentage
    FROM public.check_ins
    WHERE beach_id = beach_uuid
        AND checked_in_at > (now() - (days_back || ' days')::interval);
END;
$$;

-- Grant necessary permissions
GRANT ALL ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
GRANT EXECUTE ON FUNCTION get_recent_check_ins TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_check_ins TO service_role;
GRANT EXECUTE ON FUNCTION get_forecast_accuracy_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_forecast_accuracy_stats TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.check_ins IS 'Community surf condition check-ins for real-time reporting and forecast accuracy tracking';
COMMENT ON FUNCTION get_recent_check_ins IS 'Retrieve recent check-ins for a beach with user profile information';
COMMENT ON FUNCTION get_forecast_accuracy_stats IS 'Calculate forecast accuracy statistics for a beach over a specified time period';
