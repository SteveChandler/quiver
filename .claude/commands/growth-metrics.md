Query Quiver growth metrics from Supabase and present a formatted dashboard.

## Execution

Run all 10 SQL queries below via the Supabase MCP `execute_sql` tool against project `vawdnbbgawichorsjiwe` directly from the main session (do NOT delegate to subagents — they cannot access MCP tools). Run queries in parallel where possible (queries are independent).

All queries exclude test/admin/seed accounts: `WHERE p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid' AND p.email NOT LIKE '%@example.invalid'`

**Important:** The `@example.invalid` domain is used for seeded demo/test accounts (created 2026-02-05). These MUST be excluded or metrics will be wildly inflated.

### Query 1: WAU / MAU / Stickiness

```sql
WITH wau AS (
  SELECT COUNT(DISTINCT user_id) AS cnt FROM (
    SELECT user_id FROM sessions WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM beach_reviews WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM intel_posts WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM user_events WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT follower_id AS user_id FROM user_follows WHERE created_at >= NOW() - INTERVAL '7 days'
  ) a
  JOIN profiles p ON p.id = a.user_id
  WHERE p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid'
),
mau AS (
  SELECT COUNT(DISTINCT user_id) AS cnt FROM (
    SELECT user_id FROM sessions WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM beach_reviews WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM intel_posts WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM user_events WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT follower_id AS user_id FROM user_follows WHERE created_at >= NOW() - INTERVAL '30 days'
  ) a
  JOIN profiles p ON p.id = a.user_id
  WHERE p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid'
)
SELECT wau.cnt AS wau, mau.cnt AS mau,
  ROUND(wau.cnt::numeric / NULLIF(mau.cnt, 0) * 100, 1) AS stickiness_pct
FROM wau, mau;
```

### Query 2: WASL (North Star)

```sql
SELECT COUNT(DISTINCT s.user_id) AS wasl
FROM sessions s
JOIN profiles p ON p.id = s.user_id
WHERE s.created_at >= NOW() - INTERVAL '7 days'
  AND p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid';
```

### Query 3: Retention Cohorts (D7 / D30 by signup week, last 60 days)

```sql
WITH cohorts AS (
  SELECT
    date_trunc('week', p.created_at)::date AS signup_week,
    p.id AS user_id
  FROM profiles p
  WHERE p.created_at >= NOW() - INTERVAL '60 days'
    AND p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid'
),
activity AS (
  SELECT user_id, created_at FROM sessions
  UNION ALL
  SELECT user_id, created_at FROM beach_reviews
  UNION ALL
  SELECT user_id, created_at FROM intel_posts
  UNION ALL
  SELECT user_id, created_at FROM user_events
)
SELECT
  c.signup_week,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT CASE
    WHEN a.created_at >= c.signup_week + INTERVAL '7 days'
     AND a.created_at <  c.signup_week + INTERVAL '14 days'
    THEN c.user_id END) AS returned_d7,
  ROUND(
    COUNT(DISTINCT CASE
      WHEN a.created_at >= c.signup_week + INTERVAL '7 days'
       AND a.created_at <  c.signup_week + INTERVAL '14 days'
      THEN c.user_id END)::numeric
    / NULLIF(COUNT(DISTINCT c.user_id), 0) * 100, 1
  ) AS d7_pct,
  COUNT(DISTINCT CASE
    WHEN a.created_at >= c.signup_week + INTERVAL '30 days'
     AND a.created_at <  c.signup_week + INTERVAL '60 days'
    THEN c.user_id END) AS returned_d30,
  ROUND(
    COUNT(DISTINCT CASE
      WHEN a.created_at >= c.signup_week + INTERVAL '30 days'
       AND a.created_at <  c.signup_week + INTERVAL '60 days'
      THEN c.user_id END)::numeric
    / NULLIF(COUNT(DISTINCT c.user_id), 0) * 100, 1
  ) AS d30_pct
FROM cohorts c
LEFT JOIN activity a ON a.user_id = c.user_id
GROUP BY c.signup_week
ORDER BY c.signup_week DESC;
```

### Query 4: Activation Funnel (last 90 days)

```sql
WITH signups AS (
  SELECT id AS user_id, created_at AS signed_up_at, (onboarding_completed_at IS NOT NULL) AS onboarding_completed
  FROM profiles
  WHERE created_at >= NOW() - INTERVAL '90 days'
    AND email NOT ILIKE '%test%' AND email NOT ILIKE '%quiver%' AND email NOT ILIKE '%admin%' AND email NOT LIKE '%@example.invalid'
),
first_sessions AS (
  SELECT user_id, MIN(created_at) AS first_session_at
  FROM sessions GROUP BY user_id
),
second_sessions AS (
  SELECT s1.user_id, MIN(s2.created_at) AS second_session_at
  FROM (SELECT user_id, MIN(created_at) AS first_at FROM sessions GROUP BY user_id) s1
  JOIN sessions s2 ON s2.user_id = s1.user_id AND s2.created_at > s1.first_at
  GROUP BY s1.user_id
),
first_social AS (
  SELECT user_id, MIN(created_at) AS first_social_at
  FROM user_events
  WHERE event_type IN ('social_follow', 'social_like', 'social_share', 'social_invite_send', 'social_intel_confirm')
  GROUP BY user_id
)
SELECT
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE s.onboarding_completed = true) AS onboarded,
  ROUND(COUNT(*) FILTER (WHERE s.onboarding_completed = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS onboard_pct,
  COUNT(*) FILTER (WHERE fs.first_session_at IS NOT NULL) AS first_session,
  ROUND(COUNT(*) FILTER (WHERE fs.first_session_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS first_session_pct,
  COUNT(*) FILTER (WHERE fso.first_social_at IS NOT NULL) AS first_social,
  ROUND(COUNT(*) FILTER (WHERE fso.first_social_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS first_social_pct,
  COUNT(*) FILTER (WHERE ss.second_session_at IS NOT NULL) AS second_session,
  ROUND(COUNT(*) FILTER (WHERE ss.second_session_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS second_session_pct
FROM signups s
LEFT JOIN first_sessions fs ON fs.user_id = s.user_id
LEFT JOIN first_social fso ON fso.user_id = s.user_id
LEFT JOIN second_sessions ss ON ss.user_id = s.user_id;
```

### Query 5: Social Engagement (7d)

```sql
SELECT
  COUNT(*) FILTER (WHERE event_type = 'social_follow') AS follows,
  COUNT(*) FILTER (WHERE event_type = 'social_like') AS likes,
  COUNT(*) FILTER (WHERE event_type = 'social_share') AS shares,
  COUNT(*) FILTER (WHERE event_type = 'social_invite_send') AS invites_sent,
  COUNT(*) FILTER (WHERE event_type = 'social_invite_respond' AND (metadata->>'action') = 'accepted') AS invites_accepted,
  COUNT(*) FILTER (WHERE event_type = 'social_intel_confirm') AS intel_confirms
FROM user_events
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND event_type LIKE 'social_%';
```

### Query 6: Content Creation Ratio

```sql
WITH creators AS (
  SELECT DISTINCT user_id FROM (
    SELECT user_id FROM sessions WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM intel_posts WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM beach_reviews WHERE created_at >= NOW() - INTERVAL '7 days'
  ) c
  JOIN profiles p ON p.id = c.user_id
  WHERE p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid'
),
wau AS (
  SELECT COUNT(DISTINCT user_id) AS cnt FROM (
    SELECT user_id FROM sessions WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM beach_reviews WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM intel_posts WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM user_events WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT follower_id AS user_id FROM user_follows WHERE created_at >= NOW() - INTERVAL '7 days'
  ) a
  JOIN profiles p ON p.id = a.user_id
  WHERE p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid'
)
SELECT
  (SELECT COUNT(*) FROM creators) AS creators,
  wau.cnt AS wau,
  ROUND((SELECT COUNT(*) FROM creators)::numeric / NULLIF(wau.cnt, 0) * 100, 1) AS creation_ratio_pct
FROM wau;
```

### Query 7: Sessions per Active User per Week

```sql
WITH weekly_sessions AS (
  SELECT s.user_id, COUNT(*) AS session_count
  FROM sessions s
  JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= NOW() - INTERVAL '7 days'
    AND p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid'
  GROUP BY s.user_id
)
SELECT
  ROUND(AVG(session_count), 2) AS avg_sessions,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY session_count) AS median_sessions,
  MAX(session_count) AS max_sessions,
  COUNT(*) AS active_users
FROM weekly_sessions;
```

### Query 8: Share Rate (30d)

```sql
SELECT
  (SELECT COUNT(*) FROM user_events WHERE event_type = 'social_share' AND created_at >= NOW() - INTERVAL '30 days') AS shares,
  (SELECT COUNT(*) FROM sessions s JOIN profiles p ON p.id = s.user_id WHERE s.created_at >= NOW() - INTERVAL '30 days' AND p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid') AS sessions,
  ROUND(
    (SELECT COUNT(*) FROM user_events WHERE event_type = 'social_share' AND created_at >= NOW() - INTERVAL '30 days')::numeric
    / NULLIF((SELECT COUNT(*) FROM sessions s JOIN profiles p ON p.id = s.user_id WHERE s.created_at >= NOW() - INTERVAL '30 days' AND p.email NOT ILIKE '%test%'), 0) * 100
  , 1) AS share_rate_pct;
```

### Query 9: Badge/XP Distribution

```sql
SELECT
  COALESCE(ux.level, 0) AS level,
  COUNT(*) AS users,
  ROUND(AVG(COALESCE(ux.xp_total, 0))) AS avg_xp,
  MAX(COALESCE(ux.xp_total, 0)) AS max_xp
FROM profiles p
LEFT JOIN user_xp ux ON ux.user_id = p.id
WHERE p.email NOT ILIKE '%test%' AND p.email NOT ILIKE '%quiver%' AND p.email NOT ILIKE '%admin%' AND p.email NOT LIKE '%@example.invalid'
GROUP BY COALESCE(level, 0)
ORDER BY level;
```

### Query 10: Signup Attribution (30d)

```sql
SELECT
  COALESCE(signup_context->>'utm_source', 'direct') AS source,
  COALESCE(signup_context->>'utm_medium', 'none') AS medium,
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE onboarding_completed_at IS NOT NULL) AS onboarded,
  ROUND(COUNT(*) FILTER (WHERE onboarding_completed_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS onboard_pct,
  COUNT(*) FILTER (WHERE id IN (SELECT DISTINCT user_id FROM sessions)) AS has_session,
  ROUND(COUNT(*) FILTER (WHERE id IN (SELECT DISTINCT user_id FROM sessions))::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS session_pct
FROM profiles
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND email NOT ILIKE '%test%' AND email NOT ILIKE '%quiver%' AND email NOT ILIKE '%admin%' AND email NOT LIKE '%@example.invalid'
GROUP BY source, medium
ORDER BY signups DESC;
```

## Output Format

Present results as a markdown report:

```
# Quiver Growth Metrics — {today's date}

## North Star
| Metric | Value | Target |
|--------|-------|--------|
| WASL (7d) | {wasl} | 10-15 |

## Activity
| Metric | Value |
|--------|-------|
| WAU | {wau} |
| MAU | {mau} |
| Stickiness | {stickiness_pct}% |
| Sessions/User (avg) | {avg_sessions} |
| Sessions/User (median) | {median_sessions} |
| Content Creation Ratio | {creation_ratio_pct}% |

## Activation Funnel (90d)
| Stage | Count | Rate |
|-------|-------|------|
| Signups | {signups} | 100% |
| Onboarded | {onboarded} | {onboard_pct}% |
| First Session | {first_session} | {first_session_pct}% |
| First Social | {first_social} | {first_social_pct}% |
| Second Session | {second_session} | {second_session_pct}% |

## Retention Cohorts
| Signup Week | Cohort | D7 | D7% | D30 | D30% |
|-------------|--------|----|-----|-----|------|
| {rows from query 3} |

## Social (7d)
| Action | Count |
|--------|-------|
| Follows | {follows} |
| Likes | {likes} |
| Shares | {shares} |
| Invites Sent | {invites_sent} |
| Invites Accepted | {invites_accepted} |
| Intel Confirms | {intel_confirms} |

## Viral (30d)
| Metric | Value | Target |
|--------|-------|--------|
| Share Rate | {share_rate_pct}% | >20% |
| Invite Acceptance | (from session_invitations) | >30% |

## Attribution (30d)
| Source | Medium | Signups | Onboarded | Onboard% | Has Session | Session% |
| {rows from query 10} |

## Badge/XP Distribution
| Level | Users | Avg XP | Max XP |
| {rows from query 9} |

## Anomaly Flags
{List any metrics that breach anomaly thresholds:}
- D7 retention < 5% in any cohort
- Stickiness < 15%
- Share rate < 5%
- Invite acceptance < 15%
- Content creation ratio < 5%
- Onboarding rate < 50%
- WASL < 3

If no anomalies: "No anomaly flags."
```

## Notes
- Social event queries (Query 5, 8) will show zeros until the social_* event tracking code is deployed.
- Query 9 (Badge/XP) uses `user_xp` table with `xp_total` and `level` columns.
- All queries use indexed `created_at` columns for performance.
