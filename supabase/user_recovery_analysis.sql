-- User Recovery Analysis
-- This script helps identify users who had data in your system
-- and provides insights for potential re-engagement

-- 1. Comprehensive user activity analysis
WITH user_activity AS (
    -- Get all unique user IDs from various sources
    SELECT DISTINCT user_id as id, 'sessions' as source FROM sessions WHERE user_id IS NOT NULL
    UNION
    SELECT DISTINCT id, 'profiles' as source FROM profiles WHERE id IS NOT NULL
    UNION  
    SELECT DISTINCT owner_id as id, 'boards' as source FROM boards WHERE owner_id IS NOT NULL
),
user_stats AS (
    SELECT 
        ua.id as user_id,
        STRING_AGG(DISTINCT ua.source, ', ') as found_in_tables,
        COUNT(DISTINCT ua.source) as table_count
    FROM user_activity ua
    GROUP BY ua.id
),
detailed_stats AS (
    SELECT 
        us.user_id,
        us.found_in_tables,
        us.table_count,
        p.email,
        p.display_name,
        p.avatar_url,
        p.created_at as profile_created,
        p.updated_at as profile_updated,
        s.session_count,
        s.first_session,
        s.last_session,
        b.board_count,
        b.first_board,
        b.last_board,
        GREATEST(
            COALESCE(p.updated_at, p.created_at),
            COALESCE(s.last_session, '1900-01-01'::timestamptz),
            COALESCE(b.last_board, '1900-01-01'::timestamptz)
        ) as last_activity
    FROM user_stats us
    LEFT JOIN profiles p ON us.user_id = p.id
    LEFT JOIN (
        SELECT 
            user_id,
            COUNT(*) as session_count,
            MIN(created_at) as first_session,
            MAX(created_at) as last_session
        FROM sessions
        GROUP BY user_id
    ) s ON us.user_id = s.user_id
    LEFT JOIN (
        SELECT 
            owner_id,
            COUNT(*) as board_count,
            MIN(created_at) as first_board,
            MAX(created_at) as last_board
        FROM boards
        GROUP BY owner_id
    ) b ON us.user_id = b.owner_id
)
SELECT 
    user_id,
    email,
    display_name,
    found_in_tables,
    table_count,
    COALESCE(session_count, 0) as sessions,
    COALESCE(board_count, 0) as boards,
    profile_created,
    last_activity,
    CASE 
        WHEN email IS NOT NULL THEN 'contactable'
        WHEN display_name IS NOT NULL THEN 'identifiable'
        ELSE 'anonymous'
    END as contact_status,
    CASE
        WHEN last_activity >= NOW() - INTERVAL '30 days' THEN 'recent'
        WHEN last_activity >= NOW() - INTERVAL '90 days' THEN 'moderate'
        WHEN last_activity >= NOW() - INTERVAL '180 days' THEN 'old'
        ELSE 'very_old'
    END as activity_recency
FROM detailed_stats
ORDER BY last_activity DESC, session_count DESC, board_count DESC;

-- 2. User engagement patterns
SELECT 
    'User Engagement Summary' as analysis_type,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE email IS NOT NULL) as users_with_email,
    COUNT(*) FILTER (WHERE display_name IS NOT NULL) as users_with_name,
    COUNT(*) FILTER (WHERE session_count > 0) as users_with_sessions,
    COUNT(*) FILTER (WHERE board_count > 0) as users_with_boards,
    COUNT(*) FILTER (WHERE session_count > 5) as active_users,
    COUNT(*) FILTER (WHERE session_count > 20) as power_users,
    AVG(session_count) as avg_sessions_per_user,
    AVG(board_count) as avg_boards_per_user
FROM (
    -- Repeat the detailed_stats CTE here for this query
    WITH user_activity AS (
        SELECT DISTINCT user_id as id, 'sessions' as source FROM sessions WHERE user_id IS NOT NULL
        UNION
        SELECT DISTINCT id, 'profiles' as source FROM profiles WHERE id IS NOT NULL
        UNION  
        SELECT DISTINCT owner_id as id, 'boards' as source FROM boards WHERE owner_id IS NOT NULL
    ),
    user_stats AS (
        SELECT 
            ua.id as user_id,
            STRING_AGG(DISTINCT ua.source, ', ') as found_in_tables,
            COUNT(DISTINCT ua.source) as table_count
        FROM user_activity ua
        GROUP BY ua.id
    ),
    detailed_stats AS (
        SELECT 
            us.user_id,
            us.found_in_tables,
            us.table_count,
            p.email,
            p.display_name,
            p.avatar_url,
            p.created_at as profile_created,
            p.updated_at as profile_updated,
            COALESCE(s.session_count, 0) as session_count,
            s.first_session,
            s.last_session,
            COALESCE(b.board_count, 0) as board_count,
            b.first_board,
            b.last_board,
            GREATEST(
                COALESCE(p.updated_at, p.created_at),
                COALESCE(s.last_session, '1900-01-01'::timestamptz),
                COALESCE(b.last_board, '1900-01-01'::timestamptz)
            ) as last_activity
        FROM user_stats us
        LEFT JOIN profiles p ON us.user_id = p.id
        LEFT JOIN (
            SELECT 
                user_id,
                COUNT(*) as session_count,
                MIN(created_at) as first_session,
                MAX(created_at) as last_session
            FROM sessions
            GROUP BY user_id
        ) s ON us.user_id = s.user_id
        LEFT JOIN (
            SELECT 
                owner_id,
                COUNT(*) as board_count,
                MIN(created_at) as first_board,
                MAX(created_at) as last_board
            FROM boards
            GROUP BY owner_id
        ) b ON us.user_id = b.owner_id
    )
    SELECT * FROM detailed_stats
) user_summary;

-- 3. Identify high-value users for priority re-engagement
SELECT 
    'High-Value Users for Re-engagement' as priority_group,
    user_id,
    email,
    display_name,
    session_count,
    board_count,
    last_activity,
    CASE 
        WHEN session_count >= 20 AND board_count >= 5 THEN 'power_user'
        WHEN session_count >= 10 AND board_count >= 3 THEN 'active_user' 
        WHEN session_count >= 5 OR board_count >= 2 THEN 'engaged_user'
        ELSE 'casual_user'
    END as user_type
FROM (
    -- Repeat the query logic for high-value user identification
    WITH user_activity AS (
        SELECT DISTINCT user_id as id, 'sessions' as source FROM sessions WHERE user_id IS NOT NULL
        UNION
        SELECT DISTINCT id, 'profiles' as source FROM profiles WHERE id IS NOT NULL
        UNION  
        SELECT DISTINCT owner_id as id, 'boards' as source FROM boards WHERE owner_id IS NOT NULL
    ),
    user_stats AS (
        SELECT 
            ua.id as user_id,
            STRING_AGG(DISTINCT ua.source, ', ') as found_in_tables,
            COUNT(DISTINCT ua.source) as table_count
        FROM user_activity ua
        GROUP BY ua.id
    ),
    detailed_stats AS (
        SELECT 
            us.user_id,
            p.email,
            p.display_name,
            COALESCE(s.session_count, 0) as session_count,
            COALESCE(b.board_count, 0) as board_count,
            GREATEST(
                COALESCE(p.updated_at, p.created_at),
                COALESCE(s.last_session, '1900-01-01'::timestamptz),
                COALESCE(b.last_board, '1900-01-01'::timestamptz)
            ) as last_activity
        FROM user_stats us
        LEFT JOIN profiles p ON us.user_id = p.id
        LEFT JOIN (
            SELECT user_id, COUNT(*) as session_count, MAX(created_at) as last_session
            FROM sessions GROUP BY user_id
        ) s ON us.user_id = s.user_id
        LEFT JOIN (
            SELECT owner_id, COUNT(*) as board_count, MAX(created_at) as last_board
            FROM boards GROUP BY owner_id
        ) b ON us.user_id = b.owner_id
    )
    SELECT * FROM detailed_stats
) prioritized_users
WHERE email IS NOT NULL 
  AND (session_count >= 3 OR board_count >= 1)
ORDER BY 
    (session_count * 2 + board_count * 3) DESC, -- Weighted engagement score
    last_activity DESC;

-- 4. Create a re-engagement contact list
SELECT 
    'Contact List for Re-engagement Campaign' as export_type,
    email,
    display_name,
    user_id,
    session_count,
    board_count,
    to_char(last_activity, 'YYYY-MM-DD') as last_active_date,
    CASE 
        WHEN session_count >= 15 THEN 'Hey! We noticed you were a power user of Quiver...'
        WHEN session_count >= 5 THEN 'We miss you on Quiver! Your sessions were valuable...'
        WHEN board_count >= 3 THEN 'Your boards on Quiver showed great engagement...'
        ELSE 'We''d love to have you back on Quiver...'
    END as suggested_opening_line
FROM (
    WITH user_activity AS (
        SELECT DISTINCT user_id as id FROM sessions WHERE user_id IS NOT NULL
        UNION
        SELECT DISTINCT id FROM profiles WHERE id IS NOT NULL
        UNION  
        SELECT DISTINCT owner_id as id FROM boards WHERE owner_id IS NOT NULL
    )
    SELECT 
        p.email,
        p.display_name,
        ua.id as user_id,
        COALESCE(s.session_count, 0) as session_count,
        COALESCE(b.board_count, 0) as board_count,
        GREATEST(
            COALESCE(p.updated_at, p.created_at),
            COALESCE(s.last_session, '1900-01-01'::timestamptz),
            COALESCE(b.last_board, '1900-01-01'::timestamptz)
        ) as last_activity
    FROM user_activity ua
    LEFT JOIN profiles p ON ua.id = p.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as session_count, MAX(created_at) as last_session
        FROM sessions GROUP BY user_id
    ) s ON ua.id = s.user_id
    LEFT JOIN (
        SELECT owner_id, COUNT(*) as board_count, MAX(created_at) as last_board
        FROM boards GROUP BY owner_id
    ) b ON ua.id = b.owner_id
    WHERE p.email IS NOT NULL 
      AND p.email != ''
      AND (s.session_count > 0 OR b.board_count > 0)
) contact_data
ORDER BY (session_count * 2 + board_count * 3) DESC;

-- 5. Export user data for potential migration
SELECT 
    'User Data Export for Migration' as export_purpose,
    json_agg(
        json_build_object(
            'user_id', user_id,
            'email', email,
            'display_name', display_name,
            'avatar_url', avatar_url,
            'profile_created', profile_created,
            'last_activity', last_activity,
            'session_count', session_count,
            'board_count', board_count,
            'engagement_level', 
                CASE 
                    WHEN session_count >= 20 THEN 'power'
                    WHEN session_count >= 10 THEN 'active' 
                    WHEN session_count >= 3 THEN 'engaged'
                    ELSE 'casual'
                END
        )
    ) as users_json
FROM (
    WITH user_activity AS (
        SELECT DISTINCT user_id as id FROM sessions WHERE user_id IS NOT NULL
        UNION
        SELECT DISTINCT id FROM profiles WHERE id IS NOT NULL
        UNION  
        SELECT DISTINCT owner_id as id FROM boards WHERE owner_id IS NOT NULL
    )
    SELECT 
        ua.id as user_id,
        p.email,
        p.display_name,
        p.avatar_url,
        p.created_at as profile_created,
        COALESCE(s.session_count, 0) as session_count,
        COALESCE(b.board_count, 0) as board_count,
        GREATEST(
            COALESCE(p.updated_at, p.created_at),
            COALESCE(s.last_session, '1900-01-01'::timestamptz),
            COALESCE(b.last_board, '1900-01-01'::timestamptz)
        ) as last_activity
    FROM user_activity ua
    LEFT JOIN profiles p ON ua.id = p.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as session_count, MAX(created_at) as last_session
        FROM sessions GROUP BY user_id
    ) s ON ua.id = s.user_id
    LEFT JOIN (
        SELECT owner_id, COUNT(*) as board_count, MAX(created_at) as last_board
        FROM boards GROUP BY owner_id
    ) b ON ua.id = b.owner_id
    WHERE p.email IS NOT NULL OR s.session_count > 0 OR b.board_count > 0
) exportable_users;