-- Enhanced Forecast Sync Monitoring Queries
-- Run these periodically to monitor CDIP integration health

-- 1. Forecast Sync Summary (Last 24 Hours)
SELECT 
    COUNT(*) as total_forecasts,
    COUNT(CASE WHEN data_source = 'CDIP' THEN 1 END) as cdip_forecasts,
    COUNT(CASE WHEN data_source = 'NOAA_NWS' THEN 1 END) as noaa_forecasts,
    COUNT(CASE WHEN data_source = 'FALLBACK' THEN 1 END) as fallback_forecasts,
    ROUND(AVG(confidence_score), 2) as avg_confidence,
    COUNT(DISTINCT beach_id) as beaches_updated
FROM enhanced_forecasts 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 2. CDIP Data Quality Check
SELECT 
    beach_id,
    COUNT(*) as forecasts_count,
    COUNT(CASE WHEN has_cdip_data THEN 1 END) as with_cdip_data,
    ROUND(AVG(overall_quality_score), 2) as avg_quality_score,
    MAX(cdip_fetch_time) as last_cdip_fetch
FROM enhanced_forecasts_with_quality 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY beach_id
ORDER BY avg_quality_score DESC;

-- 3. Rate Limit and Error Monitoring
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as forecasts_created,
    COUNT(CASE WHEN data_source = 'FALLBACK' THEN 1 END) as fallback_count,
    ROUND(AVG(confidence_score), 2) as avg_confidence
FROM enhanced_forecasts 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 4. Southern California CDIP Coverage
SELECT 
    b.name as beach_name,
    b.latitude,
    b.longitude,
    COUNT(ef.id) as forecasts_count,
    COUNT(CASE WHEN ef.data_source = 'CDIP' THEN 1 END) as cdip_forecasts,
    ROUND(AVG(ef.confidence_score), 2) as avg_confidence
FROM beaches b
LEFT JOIN enhanced_forecasts ef ON b.id = ef.beach_id 
    AND ef.created_at > NOW() - INTERVAL '24 hours'
WHERE b.latitude BETWEEN 32.0 AND 35.0 
    AND b.longitude BETWEEN -120.0 AND -117.0
GROUP BY b.id, b.name, b.latitude, b.longitude
ORDER BY cdip_forecasts DESC;