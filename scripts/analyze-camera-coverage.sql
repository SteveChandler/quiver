-- Comprehensive analysis of beach camera coverage
-- Research which beaches should have cameras but don't

BEGIN;

-- 1. Overall coverage statistics
SELECT
  'Overall Statistics' AS category,
  COUNT(*) AS total_beaches,
  COUNT(CASE WHEN bs.camera_url IS NOT NULL AND bs.camera_url != '' THEN 1 END) AS beaches_with_cameras,
  ROUND(100.0 * COUNT(CASE WHEN bs.camera_url IS NOT NULL AND bs.camera_url != '' THEN 1 END) / COUNT(*), 1) AS camera_coverage_pct
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
WHERE b.is_private = false;

-- 2. Coverage by state/region
SELECT
  'Coverage by State' AS category,
  b.state,
  COUNT(*) AS total_beaches,
  COUNT(CASE WHEN bs.camera_url IS NOT NULL AND bs.camera_url != '' THEN 1 END) AS beaches_with_cameras,
  ROUND(100.0 * COUNT(CASE WHEN bs.camera_url IS NOT NULL AND bs.camera_url != '' THEN 1 END) / COUNT(*), 1) AS camera_coverage_pct
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
WHERE b.is_private = false
GROUP BY b.state
ORDER BY COUNT(*) DESC;

-- 3. Top beaches by popularity score without cameras
SELECT
  'Top beaches by popularity (no camera)' AS category,
  b.name,
  b.city,
  b.state,
  b.slug,
  b.popularity_score,
  b.is_featured
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
WHERE b.is_private = false
  AND (bs.camera_url IS NULL OR bs.camera_url = '')
  AND b.popularity_score > 0
ORDER BY b.popularity_score DESC
LIMIT 30;

-- 4. Featured beaches without cameras
SELECT
  'Featured beaches without cameras' AS category,
  b.name,
  b.city,
  b.state,
  b.slug,
  b.popularity_score,
  b.is_featured
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
WHERE b.is_private = false
  AND (bs.camera_url IS NULL OR bs.camera_url = '')
  AND b.is_featured = true
ORDER BY b.popularity_score DESC;

-- 5. Count of favorite beaches (user favorites) without cameras
SELECT
  'Popular beaches by user favorites (no camera)' AS category,
  b.name,
  b.city,
  b.state,
  b.slug,
  COUNT(fb.user_id) AS favorite_count,
  b.popularity_score,
  b.is_featured
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
LEFT JOIN favorite_beaches fb ON b.id = fb.beach_id
WHERE b.is_private = false
  AND (bs.camera_url IS NULL OR bs.camera_url = '')
GROUP BY b.id, b.name, b.city, b.state, b.slug, b.popularity_score, b.is_featured
HAVING COUNT(fb.user_id) > 0
ORDER BY COUNT(fb.user_id) DESC
LIMIT 30;

-- 6. Beaches with most sessions logged (activity) but no camera
SELECT
  'Active beaches by sessions (no camera)' AS category,
  b.name,
  b.city,
  b.state,
  b.slug,
  COUNT(s.id) AS session_count,
  b.popularity_score,
  b.is_featured
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
LEFT JOIN sessions s ON b.id = s.beach_id
WHERE b.is_private = false
  AND (bs.camera_url IS NULL OR bs.camera_url = '')
GROUP BY b.id, b.name, b.city, b.state, b.slug, b.popularity_score, b.is_featured
HAVING COUNT(s.id) > 0
ORDER BY COUNT(s.id) DESC
LIMIT 30;

-- 7. Beaches with most intel posts but no camera
SELECT
  'Beaches with intel posts (no camera)' AS category,
  b.name,
  b.city,
  b.state,
  b.slug,
  COUNT(ip.id) AS intel_post_count,
  b.popularity_score,
  b.is_featured
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
LEFT JOIN intel_posts ip ON b.id = ip.beach_id
WHERE b.is_private = false
  AND (bs.camera_url IS NULL OR bs.camera_url = '')
GROUP BY b.id, b.name, b.city, b.state, b.slug, b.popularity_score, b.is_featured
HAVING COUNT(ip.id) > 0
ORDER BY COUNT(ip.id) DESC
LIMIT 30;

-- 8. Beaches with reviews but no camera
SELECT
  'Beaches with reviews (no camera)' AS category,
  b.name,
  b.city,
  b.state,
  b.slug,
  COUNT(br.id) AS review_count,
  AVG(br.rating)::numeric(3,1) AS avg_rating,
  b.popularity_score,
  b.is_featured
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
LEFT JOIN beach_reviews br ON b.id = br.beach_id
WHERE b.is_private = false
  AND (bs.camera_url IS NULL OR bs.camera_url = '')
GROUP BY b.id, b.name, b.city, b.state, b.slug, b.popularity_score, b.is_featured
HAVING COUNT(br.id) > 0
ORDER BY COUNT(br.id) DESC
LIMIT 30;

-- 9. Home beaches (user's home beach) without cameras
SELECT
  'Home beaches without cameras' AS category,
  b.name,
  b.city,
  b.state,
  b.slug,
  COUNT(p.id) AS home_beach_user_count,
  b.popularity_score,
  b.is_featured
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
LEFT JOIN profiles p ON b.id = p.home_beach_id
WHERE b.is_private = false
  AND (bs.camera_url IS NULL OR bs.camera_url = '')
GROUP BY b.id, b.name, b.city, b.state, b.slug, b.popularity_score, b.is_featured
HAVING COUNT(p.id) > 0
ORDER BY COUNT(p.id) DESC
LIMIT 30;

-- 10. Regional gaps - cities with multiple beaches but low camera coverage
SELECT
  'Cities with camera coverage gaps' AS category,
  b.city,
  b.state,
  COUNT(*) AS total_beaches,
  COUNT(CASE WHEN bs.camera_url IS NOT NULL AND bs.camera_url != '' THEN 1 END) AS beaches_with_cameras,
  ROUND(100.0 * COUNT(CASE WHEN bs.camera_url IS NOT NULL AND bs.camera_url != '' THEN 1 END) / COUNT(*), 1) AS camera_coverage_pct
FROM beaches b
LEFT JOIN beach_sources bs ON b.id = bs.beach_id
WHERE b.is_private = false
GROUP BY b.city, b.state
HAVING COUNT(*) >= 3
ORDER BY
  COUNT(*) DESC,
  camera_coverage_pct ASC
LIMIT 20;

-- 11. Combined activity score (weighted composite) - beaches without cameras
WITH activity_scores AS (
  SELECT
    b.id,
    b.name,
    b.city,
    b.state,
    b.slug,
    b.popularity_score,
    b.is_featured,
    COALESCE(COUNT(DISTINCT fb.user_id), 0) AS favorite_count,
    COALESCE(COUNT(DISTINCT s.id), 0) AS session_count,
    COALESCE(COUNT(DISTINCT ip.id), 0) AS intel_count,
    COALESCE(COUNT(DISTINCT br.id), 0) AS review_count,
    COALESCE(COUNT(DISTINCT p.id), 0) AS home_beach_count,
    -- Weighted composite score
    (
      COALESCE(b.popularity_score, 0) * 1 +
      COALESCE(COUNT(DISTINCT fb.user_id), 0) * 10 +
      COALESCE(COUNT(DISTINCT s.id), 0) * 5 +
      COALESCE(COUNT(DISTINCT ip.id), 0) * 3 +
      COALESCE(COUNT(DISTINCT br.id), 0) * 2 +
      COALESCE(COUNT(DISTINCT p.id), 0) * 15 +
      CASE WHEN b.is_featured THEN 50 ELSE 0 END
    ) AS composite_score
  FROM beaches b
  LEFT JOIN beach_sources bs ON b.id = bs.beach_id
  LEFT JOIN favorite_beaches fb ON b.id = fb.beach_id
  LEFT JOIN sessions s ON b.id = s.beach_id
  LEFT JOIN intel_posts ip ON b.id = ip.beach_id
  LEFT JOIN beach_reviews br ON b.id = br.beach_id
  LEFT JOIN profiles p ON b.id = p.home_beach_id
  WHERE b.is_private = false
    AND (bs.camera_url IS NULL OR bs.camera_url = '')
  GROUP BY b.id, b.name, b.city, b.state, b.slug, b.popularity_score, b.is_featured
)
SELECT
  'Top priority beaches for cameras (composite score)' AS category,
  name,
  city,
  state,
  slug,
  composite_score,
  favorite_count,
  session_count,
  intel_count,
  review_count,
  home_beach_count,
  popularity_score,
  is_featured
FROM activity_scores
WHERE composite_score > 0
ORDER BY composite_score DESC
LIMIT 50;

COMMIT;
