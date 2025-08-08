-- Fix Supabase Security Linter: View should use security_invoker
-- Lint: security_definer_view_public_enhanced_forecasts_with_quality
-- Context: Views run with definer privileges by default; explicitly set invoker semantics

-- Recreate view with security_invoker to avoid definer-style privilege escalation
CREATE OR REPLACE VIEW public.enhanced_forecasts_with_quality
WITH (security_invoker = true) AS
SELECT 
    ef.*,
    get_overall_quality_score(ef.raw_forecast) AS overall_quality_score,
    CASE 
        WHEN ef.raw_forecast ? 'data_sources' 
        THEN jsonb_array_length(ef.raw_forecast->'data_sources')
        ELSE 0 
    END AS data_source_count,
    CASE 
        WHEN ef.raw_forecast ? 'cdip_data' AND ef.raw_forecast->'cdip_data' IS NOT NULL
        THEN TRUE 
        ELSE FALSE 
    END AS has_cdip_data,
    CASE 
        WHEN ef.raw_forecast ? 'noaa_data' AND ef.raw_forecast->'noaa_data' IS NOT NULL
        THEN TRUE 
        ELSE FALSE 
    END AS has_noaa_data,
    CASE 
        WHEN ef.raw_forecast ? 'fetch_timestamps' AND ef.raw_forecast->'fetch_timestamps' ? 'cdip'
        THEN (ef.raw_forecast->'fetch_timestamps'->>'cdip')::TIMESTAMP WITH TIME ZONE
        ELSE NULL 
    END AS cdip_fetch_time,
    CASE 
        WHEN ef.raw_forecast ? 'fetch_timestamps' AND ef.raw_forecast->'fetch_timestamps' ? 'noaa'
        THEN (ef.raw_forecast->'fetch_timestamps'->>'noaa')::TIMESTAMP WITH TIME ZONE
        ELSE NULL 
    END AS noaa_fetch_time
FROM public.enhanced_forecasts ef;

-- Preserve documentation and permissions
COMMENT ON VIEW public.enhanced_forecasts_with_quality IS 'Enhanced view of forecasts with extracted quality metrics and data source flags';
GRANT SELECT ON public.enhanced_forecasts_with_quality TO authenticated;

