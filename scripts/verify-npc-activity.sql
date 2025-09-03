-- Verification Queries for NPC Daily Activity
-- These queries help monitor and verify that the NPC daily seeder is working correctly

-- ============================================================================
-- YESTERDAY'S ACTIVITY SUMMARY
-- ============================================================================

-- Check all NPC activity from yesterday
SELECT 
  'Yesterday''s NPC Activity Summary' as report_type,
  CURRENT_DATE - INTERVAL '1 day' as target_date;

-- Sessions created yesterday by NPCs
SELECT 
  'Sessions' as content_type,
  COUNT(*) as created_yesterday,
  COUNT(DISTINCT s.user_id) as unique_npcs,
  ROUND(AVG(s.rating), 2) as avg_rating,
  ROUND(AVG(s.duration_minutes), 0) as avg_duration_minutes
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE p.is_mock = true
  AND DATE(s.created_at) = CURRENT_DATE - INTERVAL '1 day';

-- Intel posts created yesterday by NPCs  
SELECT 
  'Intel Posts' as content_type,
  COUNT(*) as created_yesterday,
  COUNT(DISTINCT ip.user_id) as unique_npcs,
  ROUND(AVG(ip.confirmations_count), 1) as avg_confirmations,
  string_agg(DISTINCT ip.tag, ', ') as tags_used
FROM intel_posts ip
JOIN profiles p ON ip.user_id = p.id  
WHERE p.is_mock = true
  AND DATE(ip.created_at) = CURRENT_DATE - INTERVAL '1 day';

-- Beach reviews created yesterday by NPCs
SELECT 
  'Beach Reviews' as content_type,
  COUNT(*) as created_yesterday,
  COUNT(DISTINCT br.user_id) as unique_npcs,
  ROUND(AVG(br.overall_rating), 2) as avg_overall_rating,
  ROUND(AVG(br.wave_quality_rating), 2) as avg_wave_rating
FROM beach_reviews br
JOIN profiles p ON br.user_id = p.id
WHERE p.is_mock = true
  AND DATE(br.created_at) = CURRENT_DATE - INTERVAL '1 day';

-- ============================================================================
-- WEEKLY ACTIVITY TRENDS
-- ============================================================================

-- NPC activity over the last 7 days
SELECT 
  'Last 7 Days Activity Trend' as report_type;

SELECT 
  DATE(created_at) as activity_date,
  COUNT(CASE WHEN content_type = 'session' THEN 1 END) as sessions,
  COUNT(CASE WHEN content_type = 'intel' THEN 1 END) as intel_posts,  
  COUNT(CASE WHEN content_type = 'review' THEN 1 END) as reviews,
  COUNT(*) as total_content
FROM (
  SELECT created_at, 'session' as content_type 
  FROM sessions s JOIN profiles p ON s.user_id = p.id 
  WHERE p.is_mock = true
  
  UNION ALL
  
  SELECT created_at, 'intel' as content_type
  FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id
  WHERE p.is_mock = true
  
  UNION ALL
  
  SELECT created_at, 'review' as content_type
  FROM beach_reviews br JOIN profiles p ON br.user_id = p.id  
  WHERE p.is_mock = true
) npc_activity
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY activity_date DESC;

-- ============================================================================  
-- ACTIVE NPC PROFILES
-- ============================================================================

-- Most active NPCs in the last 7 days
SELECT 
  'Most Active NPCs (Last 7 Days)' as report_type;

SELECT 
  p.full_name,
  COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) as sessions,
  COUNT(CASE WHEN ip.id IS NOT NULL THEN 1 END) as intel_posts,
  COUNT(CASE WHEN br.id IS NOT NULL THEN 1 END) as reviews,
  COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) + 
  COUNT(CASE WHEN ip.id IS NOT NULL THEN 1 END) + 
  COUNT(CASE WHEN br.id IS NOT NULL THEN 1 END) as total_content
FROM profiles p
LEFT JOIN sessions s ON p.id = s.user_id AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'
LEFT JOIN intel_posts ip ON p.id = ip.user_id AND ip.created_at >= CURRENT_DATE - INTERVAL '7 days'  
LEFT JOIN beach_reviews br ON p.id = br.user_id AND br.created_at >= CURRENT_DATE - INTERVAL '7 days'
WHERE p.is_mock = true
GROUP BY p.id, p.full_name
HAVING COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) + 
       COUNT(CASE WHEN ip.id IS NOT NULL THEN 1 END) + 
       COUNT(CASE WHEN br.id IS NOT NULL THEN 1 END) > 0
ORDER BY total_content DESC, p.full_name;

-- ============================================================================
-- CONTENT DISTRIBUTION
-- ============================================================================

-- Beach coverage - which beaches are getting NPC content
SELECT 
  'Beach Coverage by NPC Content' as report_type;

SELECT 
  b.name as beach_name,
  COUNT(DISTINCT s.id) as npc_sessions,
  COUNT(DISTINCT ip.id) as npc_intel_posts,
  COUNT(DISTINCT br.id) as npc_reviews,
  COUNT(DISTINCT s.id) + COUNT(DISTINCT ip.id) + COUNT(DISTINCT br.id) as total_npc_content,
  MAX(GREATEST(
    COALESCE(s.created_at, '1900-01-01'::timestamp),
    COALESCE(ip.created_at, '1900-01-01'::timestamp), 
    COALESCE(br.created_at, '1900-01-01'::timestamp)
  )) as last_npc_activity
FROM beaches b
LEFT JOIN sessions s ON b.id = s.beach_id 
  AND EXISTS(SELECT 1 FROM profiles p WHERE p.id = s.user_id AND p.is_mock = true)
LEFT JOIN intel_posts ip ON b.id = ip.beach_id
  AND EXISTS(SELECT 1 FROM profiles p WHERE p.id = ip.user_id AND p.is_mock = true)  
LEFT JOIN beach_reviews br ON b.id = br.beach_id
  AND EXISTS(SELECT 1 FROM profiles p WHERE p.id = br.user_id AND p.is_mock = true)
GROUP BY b.id, b.name
HAVING COUNT(DISTINCT s.id) + COUNT(DISTINCT ip.id) + COUNT(DISTINCT br.id) > 0
ORDER BY total_npc_content DESC, last_npc_activity DESC;

-- ============================================================================
-- QUALITY METRICS 
-- ============================================================================

-- Content quality indicators
SELECT 
  'NPC Content Quality Metrics' as report_type;

-- Session ratings distribution  
SELECT 
  'Session Ratings' as metric_type,
  s.rating,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE p.is_mock = true AND s.rating IS NOT NULL
GROUP BY s.rating
ORDER BY s.rating;

-- Intel post tag distribution
SELECT 
  'Intel Post Tags' as metric_type,
  ip.tag as category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM intel_posts ip  
JOIN profiles p ON ip.user_id = p.id
WHERE p.is_mock = true
GROUP BY ip.tag
ORDER BY count DESC;

-- Beach review ratings distribution (overall)
SELECT 
  'Beach Review Overall Ratings' as metric_type,
  br.overall_rating as rating,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM beach_reviews br
JOIN profiles p ON br.user_id = p.id  
WHERE p.is_mock = true AND br.overall_rating IS NOT NULL
GROUP BY br.overall_rating
ORDER BY br.overall_rating;

-- ============================================================================
-- DIAGNOSTIC QUERIES
-- ============================================================================

-- Check for potential issues
SELECT 
  'Diagnostic Checks' as report_type;

-- NPCs without recent activity (potential inactive accounts)
SELECT 
  'NPCs with no activity in 7+ days' as check_type,
  p.full_name,
  (
    SELECT MAX(created_at) FROM (
      SELECT created_at FROM sessions WHERE user_id = p.id
      UNION ALL
      SELECT created_at FROM intel_posts WHERE user_id = p.id  
      UNION ALL  
      SELECT created_at FROM beach_reviews WHERE user_id = p.id
    ) all_activity
  ) as last_activity_date
FROM profiles p
WHERE p.is_mock = true
  AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT user_id FROM sessions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM intel_posts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      UNION ALL  
      SELECT user_id FROM beach_reviews WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    ) recent_activity WHERE recent_activity.user_id = p.id
  )
ORDER BY last_activity_date DESC NULLS LAST;

-- Sessions without ratings (potential data quality issue)
SELECT 
  'Sessions missing ratings' as check_type,
  COUNT(*) as sessions_without_ratings,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sessions s JOIN profiles p ON s.user_id = p.id WHERE p.is_mock = true), 1) as percentage_of_npc_sessions
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE p.is_mock = true AND s.rating IS NULL;

-- Intel posts without confirmations (might indicate low engagement)
SELECT
  'Intel posts with 0 confirmations' as check_type,
  COUNT(*) as posts_with_zero_confirmations,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE p.is_mock = true), 1) as percentage_of_npc_intel
FROM intel_posts ip
JOIN profiles p ON ip.user_id = p.id  
WHERE p.is_mock = true AND ip.confirmations_count = 0;

-- ============================================================================
-- QUICK STATUS CHECK
-- ============================================================================

-- Overall NPC system status
SELECT 
  'NPC System Status Summary' as report_type,
  COUNT(DISTINCT p.id) as total_mock_users,
  COUNT(DISTINCT CASE WHEN recent_activity.user_id IS NOT NULL THEN p.id END) as active_npcs_7days,
  (SELECT COUNT(*) FROM sessions s2 JOIN profiles p2 ON s2.user_id = p2.id 
   WHERE p2.is_mock = true AND DATE(s2.created_at) = CURRENT_DATE - INTERVAL '1 day') as sessions_yesterday,
  (SELECT COUNT(*) FROM intel_posts ip2 JOIN profiles p3 ON ip2.user_id = p3.id
   WHERE p3.is_mock = true AND DATE(ip2.created_at) = CURRENT_DATE - INTERVAL '1 day') as intel_posts_yesterday,  
  (SELECT COUNT(*) FROM beach_reviews br2 JOIN profiles p4 ON br2.user_id = p4.id
   WHERE p4.is_mock = true AND DATE(br2.created_at) = CURRENT_DATE - INTERVAL '1 day') as reviews_yesterday
FROM profiles p
LEFT JOIN (
  SELECT user_id FROM sessions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  UNION 
  SELECT user_id FROM intel_posts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  UNION
  SELECT user_id FROM beach_reviews WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'  
) recent_activity ON p.id = recent_activity.user_id
WHERE p.is_mock = true;