-- User Data Investigation and Recovery Queries
-- Run these queries to find traces of users in your database

-- 1. First, let's see what tables exist in the public schema
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Check for any remaining user references in auth schema
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'auth' 
  AND column_name ILIKE '%user%'
ORDER BY table_name, column_name;

-- 3. Find columns that might reference user IDs across all tables
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND (
    c.column_name ILIKE '%user%' 
    OR c.column_name ILIKE '%owner%'
    OR c.column_name ILIKE '%creator%'
    OR c.column_name ILIKE '%author%'
    OR c.data_type = 'uuid'
  )
ORDER BY t.table_name, c.column_name;

-- 4. Check sessions table for user traces
SELECT 
    DISTINCT user_id,
    COUNT(*) as session_count,
    MIN(created_at) as first_session,
    MAX(created_at) as last_session
FROM sessions 
WHERE user_id IS NOT NULL
GROUP BY user_id
ORDER BY last_session DESC;

-- 5. Check profiles table for user data
SELECT 
    id,
    email,
    display_name,
    created_at,
    updated_at
FROM profiles
ORDER BY created_at DESC;

-- 6. Check boards table for user ownership
SELECT 
    DISTINCT owner_id,
    COUNT(*) as board_count,
    MIN(created_at) as first_board,
    MAX(created_at) as last_board
FROM boards
WHERE owner_id IS NOT NULL
GROUP BY owner_id
ORDER BY last_board DESC;

-- 7. Check for any UUID patterns that might be user IDs
-- This will help identify potential user IDs in various tables
DO $$
DECLARE
    rec RECORD;
    query TEXT;
    result_count INTEGER;
BEGIN
    FOR rec IN 
        SELECT t.table_name, c.column_name
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public'
          AND c.data_type = 'uuid'
          AND c.column_name NOT IN ('id', 'board_id', 'session_id')
    LOOP
        query := format('SELECT COUNT(DISTINCT %I) FROM %I WHERE %I IS NOT NULL',
                       rec.column_name, rec.table_name, rec.column_name);
        
        EXECUTE query INTO result_count;
        
        IF result_count > 0 THEN
            RAISE NOTICE 'Table: %, Column: %, Distinct UUIDs: %', 
                        rec.table_name, rec.column_name, result_count;
        END IF;
    END LOOP;
END $$;

-- 8. Cross-reference user IDs across tables to find consistent patterns
WITH user_ids_in_sessions AS (
    SELECT DISTINCT user_id FROM sessions WHERE user_id IS NOT NULL
),
user_ids_in_profiles AS (
    SELECT DISTINCT id as user_id FROM profiles WHERE id IS NOT NULL
),
user_ids_in_boards AS (
    SELECT DISTINCT owner_id as user_id FROM boards WHERE owner_id IS NOT NULL
)
SELECT 
    'sessions' as source_table,
    user_id,
    CASE 
        WHEN user_id IN (SELECT user_id FROM user_ids_in_profiles) THEN 'YES'
        ELSE 'NO'
    END as has_profile,
    CASE 
        WHEN user_id IN (SELECT user_id FROM user_ids_in_boards) THEN 'YES'
        ELSE 'NO'
    END as has_boards
FROM user_ids_in_sessions

UNION ALL

SELECT 
    'profiles' as source_table,
    user_id,
    CASE 
        WHEN user_id IN (SELECT user_id FROM user_ids_in_sessions) THEN 'YES'
        ELSE 'NO'
    END as has_sessions,
    CASE 
        WHEN user_id IN (SELECT user_id FROM user_ids_in_boards) THEN 'YES'
        ELSE 'NO'
    END as has_boards
FROM user_ids_in_profiles

UNION ALL

SELECT 
    'boards' as source_table,
    user_id,
    CASE 
        WHEN user_id IN (SELECT user_id FROM user_ids_in_sessions) THEN 'YES'
        ELSE 'NO'
    END as has_sessions,
    CASE 
        WHEN user_id IN (SELECT user_id FROM user_ids_in_profiles) THEN 'YES'
        ELSE 'NO'
    END as has_profiles
FROM user_ids_in_boards

ORDER BY source_table, user_id;

-- 9. Extract user contact information where available
SELECT DISTINCT
    p.id as user_id,
    p.email,
    p.display_name,
    s.session_count,
    b.board_count,
    p.created_at as profile_created,
    GREATEST(p.updated_at, s.last_session, b.last_board) as last_activity
FROM profiles p
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as session_count,
        MAX(created_at) as last_session
    FROM sessions 
    GROUP BY user_id
) s ON p.id = s.user_id
LEFT JOIN (
    SELECT 
        owner_id,
        COUNT(*) as board_count,
        MAX(created_at) as last_board
    FROM boards 
    GROUP BY owner_id
) b ON p.id = b.owner_id
WHERE p.email IS NOT NULL OR p.display_name IS NOT NULL
ORDER BY last_activity DESC NULLS LAST;