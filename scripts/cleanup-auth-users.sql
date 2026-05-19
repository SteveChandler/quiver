-- ============================================================================
-- CLEANUP AUTH USERS - REVIEW CANDIDATES
-- ============================================================================
-- PURPOSE: Identify auth users who have never signed in or are unconfirmed
-- USAGE: Run this in Supabase SQL Editor to review before deletion
-- WARNING: This is a READ-ONLY query. Review results carefully before deletion.
-- ============================================================================

-- Basic query: Never signed in OR not confirmed
-- EXCLUDES mock test users (is_mock=true in profiles)
SELECT
  au.id,
  au.email,
  au.phone,
  au.confirmed_at,
  au.last_sign_in_at,
  au.raw_user_meta_data,
  au.created_at,
  -- Calculate account age for context
  EXTRACT(DAY FROM NOW() - au.created_at) AS age_in_days
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE
  (
    -- Never signed in
    au.last_sign_in_at IS NULL
    OR
    -- Not confirmed / awaiting email validation
    au.confirmed_at IS NULL
  )
  -- EXCLUDE mock test users
  AND (p.is_mock IS NULL OR p.is_mock = false)
ORDER BY au.created_at ASC
LIMIT 1000;

-- ============================================================================
-- OPTIONAL: Add age filter (only accounts older than 30 days)
-- ============================================================================
-- Uncomment the query below to only include older accounts:

/*
SELECT
  au.id,
  au.email,
  au.phone,
  au.confirmed_at,
  au.last_sign_in_at,
  au.raw_user_meta_data,
  au.created_at,
  EXTRACT(DAY FROM NOW() - au.created_at) AS age_in_days
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE
  (au.last_sign_in_at IS NULL OR au.confirmed_at IS NULL)
  AND (p.is_mock IS NULL OR p.is_mock = false)
  AND au.created_at < NOW() - INTERVAL '30 days'
ORDER BY au.created_at ASC
LIMIT 1000;
*/

-- ============================================================================
-- SUMMARY STATS: Get counts before proceeding
-- ============================================================================
SELECT
  COUNT(*) FILTER (WHERE au.last_sign_in_at IS NULL) AS never_signed_in,
  COUNT(*) FILTER (WHERE au.confirmed_at IS NULL) AS not_confirmed,
  COUNT(*) FILTER (WHERE au.last_sign_in_at IS NULL OR au.confirmed_at IS NULL) AS total_candidates,
  COUNT(*) AS total_users
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE (p.is_mock IS NULL OR p.is_mock = false);

-- ============================================================================
-- GHOST-USER AUDIT: confirmed email, still no sign-in after 1 hour
-- ============================================================================
SELECT
  au.id,
  au.email,
  au.email_confirmed_at,
  au.last_sign_in_at,
  au.created_at,
  EXTRACT(EPOCH FROM (NOW() - au.created_at)) / 3600 AS age_in_hours
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.email_confirmed_at IS NOT NULL
  AND au.last_sign_in_at IS NULL
  AND au.created_at <= NOW() - INTERVAL '1 hour'
  AND (p.is_mock IS NULL OR p.is_mock = false)
ORDER BY au.created_at DESC
LIMIT 1000;

-- ============================================================================
-- EXPORT USER IDS: Copy-paste ready format for deletion scripts
-- ============================================================================
-- Run this query to get user IDs formatted for the deletion scripts

-- Format 1: Space-separated (for bash script)
SELECT string_agg(id::text, ' ') AS user_ids_for_bash
FROM (
  SELECT au.id
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE
    (au.last_sign_in_at IS NULL OR au.confirmed_at IS NULL)
    -- EXCLUDE mock test users
    AND (p.is_mock IS NULL OR p.is_mock = false)
    -- Optional: Add age filter
    -- AND au.created_at < NOW() - INTERVAL '30 days'
  ORDER BY au.created_at ASC
  LIMIT 1000
) candidates;

-- Format 2: One per line (easier to review and select specific ones)
SELECT au.id AS user_id_to_delete
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE
  (au.last_sign_in_at IS NULL OR au.confirmed_at IS NULL)
  -- EXCLUDE mock test users
  AND (p.is_mock IS NULL OR p.is_mock = false)
  -- Optional: Add age filter
  -- AND au.created_at < NOW() - INTERVAL '30 days'
ORDER BY au.created_at ASC
LIMIT 1000;
