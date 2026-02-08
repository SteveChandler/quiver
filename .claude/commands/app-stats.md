Query Quiver application metrics from Supabase and present a formatted dashboard.

**Exclusion filter** (applied to all queries joining profiles):
```
p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid' AND p.email NOT LIKE '%@example.invalid'
```
This filters out test accounts, local dev accounts, and seed/demo data (`@example.invalid`).

Run these 10 SQL queries **in parallel** against project `vawdnbbgawichorsjiwe` using `execute_sql`:

### Query 1: Users
```sql
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_users_24h
FROM profiles
WHERE email NOT ILIKE '%test%' AND email NOT LIKE '%@local.test' AND email NOT LIKE '%@example.invalid';
```

### Query 2: Sessions
```sql
SELECT
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE s.created_at >= NOW() - INTERVAL '7 days') AS sessions_7d,
  COUNT(*) FILTER (WHERE s.created_at >= NOW() - INTERVAL '24 hours') AS sessions_24h,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '7 days') AS active_surfers_7d,
  ROUND(AVG(s.rating) FILTER (WHERE s.rating IS NOT NULL), 2) AS avg_rating,
  ROUND(AVG(s.duration_minutes) FILTER (WHERE s.duration_minutes IS NOT NULL), 0) AS avg_duration_min
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE s.deleted_at IS NULL
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```

### Query 3: Content
```sql
SELECT
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_reviews,
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS reviews_7d,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_intel,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE ip.created_at >= NOW() - INTERVAL '7 days' AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS intel_7d,
  (SELECT COUNT(*) FROM boards b JOIN profiles p ON b.user_id = p.id WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_boards,
  (SELECT COUNT(*) FROM beaches) AS total_beaches;
```

### Query 4: Delivery (7d)
```sql
SELECT
  COUNT(*) AS emails_7d,
  COUNT(*) FILTER (WHERE esl.email_type = 'welcome') AS welcome_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'forecast_digest') AS forecast_digest_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'reengagement') AS reengagement_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'weekly_recap') AS weekly_recap_emails
FROM email_send_log esl
JOIN profiles p ON esl.user_id = p.id
WHERE esl.sent_at >= NOW() - INTERVAL '7 days'
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```

### Query 5: User Behavior Events (7d)
```sql
SELECT
  COUNT(*) AS total_events_7d,
  COUNT(DISTINCT user_id) AS users_with_events_7d,
  COUNT(*) FILTER (WHERE event_type = 'page_view') AS page_views,
  COUNT(*) FILTER (WHERE event_type = 'beach_view') AS beach_views,
  COUNT(*) FILTER (WHERE event_type = 'discovery_click') AS discovery_clicks,
  COUNT(*) FILTER (WHERE event_type = 'discovery_skip') AS discovery_skips,
  COUNT(*) FILTER (WHERE event_type = 'forecast_check') AS forecast_checks,
  COUNT(*) FILTER (WHERE event_type = 'session_action') AS session_actions,
  COUNT(*) FILTER (WHERE event_type = 'cta_click') AS cta_clicks,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT user_id), 0), 1) AS avg_events_per_user
FROM user_events ue
JOIN profiles p ON ue.user_id = p.id
WHERE ue.created_at >= NOW() - INTERVAL '7 days'
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```

### Query 6: Content Creation Activity (7d)
```sql
SELECT
  (SELECT COUNT(*) FROM sessions s JOIN profiles p ON s.user_id = p.id
   WHERE s.created_at >= NOW() - INTERVAL '7 days' AND s.deleted_at IS NULL
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS sessions_created_7d,
  (SELECT COUNT(*) FROM boards b JOIN profiles p ON b.user_id = p.id
   WHERE b.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS boards_added_7d,
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id
   WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS reviews_written_7d,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id
   WHERE ip.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS intel_posted_7d;
```

### Query 7: Top Beaches by Activity (7d)
```sql
SELECT beach_name, total_activity FROM (
  SELECT b.name AS beach_name, COUNT(*) AS total_activity
  FROM (
    SELECT s.beach_id FROM sessions s JOIN profiles p ON s.user_id = p.id WHERE s.created_at >= NOW() - INTERVAL '7 days' AND s.deleted_at IS NULL AND s.beach_id IS NOT NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
    UNION ALL
    SELECT br.beach_id FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL AND br.beach_id IS NOT NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
    UNION ALL
    SELECT ip.beach_id FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE ip.created_at >= NOW() - INTERVAL '7 days' AND ip.beach_id IS NOT NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
    UNION ALL
    SELECT ue.beach_id FROM user_events ue JOIN profiles p ON ue.user_id = p.id WHERE ue.created_at >= NOW() - INTERVAL '7 days' AND ue.event_type = 'beach_view' AND ue.beach_id IS NOT NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
  ) activity
  JOIN beaches b ON activity.beach_id = b.id
  GROUP BY b.id, b.name
  ORDER BY total_activity DESC
  LIMIT 5
) top_beaches;
```

### Query 8: Daily Active Users — cross-table (last 7 days trend)
```sql
SELECT day, COUNT(DISTINCT user_id) AS active_users FROM (
  SELECT DATE(created_at) AS day, user_id FROM sessions WHERE created_at >= NOW() - INTERVAL '7 days' AND deleted_at IS NULL
  UNION ALL
  SELECT DATE(created_at), user_id FROM beach_reviews WHERE created_at >= NOW() - INTERVAL '7 days' AND deleted_at IS NULL
  UNION ALL
  SELECT DATE(created_at), user_id FROM intel_posts WHERE created_at >= NOW() - INTERVAL '7 days'
  UNION ALL
  SELECT DATE(created_at), user_id FROM user_events WHERE created_at >= NOW() - INTERVAL '7 days' AND user_id IS NOT NULL
  UNION ALL
  SELECT DATE(created_at), user_id FROM boards WHERE created_at >= NOW() - INTERVAL '7 days'
) combined
JOIN profiles p ON combined.user_id = p.id
WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
GROUP BY day
ORDER BY day DESC;
```

### Query 9: Data Freshness Check
```sql
SELECT
  (SELECT MAX(p.created_at) FROM profiles p WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS latest_signup,
  (SELECT MAX(s.created_at) FROM sessions s JOIN profiles p ON s.user_id = p.id WHERE s.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS latest_session,
  (SELECT MAX(ue.created_at) FROM user_events ue JOIN profiles p ON ue.user_id = p.id WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS latest_event,
  (SELECT MAX(esl.sent_at) FROM email_send_log esl JOIN profiles p ON esl.user_id = p.id WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS latest_email,
  (SELECT MAX(br.created_at) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS latest_review,
  (SELECT MAX(ip.created_at) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS latest_intel,
  NOW() AS current_time;
```

### Query 10: Activity Source Health (7d)
```sql
SELECT source, unique_users_7d, rows_7d, latest FROM (
  SELECT 'sessions' AS source, COUNT(DISTINCT s.user_id) AS unique_users_7d, COUNT(*) AS rows_7d, MAX(s.created_at) AS latest
  FROM sessions s JOIN profiles p ON s.user_id = p.id WHERE s.created_at >= NOW() - INTERVAL '7 days' AND s.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
  UNION ALL
  SELECT 'beach_reviews', COUNT(DISTINCT br.user_id), COUNT(*), MAX(br.created_at)
  FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
  UNION ALL
  SELECT 'intel_posts', COUNT(DISTINCT ip.user_id), COUNT(*), MAX(ip.created_at)
  FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE ip.created_at >= NOW() - INTERVAL '7 days' AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
  UNION ALL
  SELECT 'user_events', COUNT(DISTINCT ue.user_id), COUNT(*), MAX(ue.created_at)
  FROM user_events ue JOIN profiles p ON ue.user_id = p.id WHERE ue.created_at >= NOW() - INTERVAL '7 days' AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
  UNION ALL
  SELECT 'boards', COUNT(DISTINCT b.user_id), COUNT(*), MAX(b.created_at)
  FROM boards b JOIN profiles p ON b.user_id = p.id WHERE b.created_at >= NOW() - INTERVAL '7 days' AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
  UNION ALL
  SELECT 'email_send_log', COUNT(DISTINCT esl.user_id), COUNT(*), MAX(esl.sent_at)
  FROM email_send_log esl JOIN profiles p ON esl.user_id = p.id WHERE esl.sent_at >= NOW() - INTERVAL '7 days' AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
) sources
ORDER BY unique_users_7d DESC;
```

## Output Format

Present results as a markdown dashboard:

```
## App Dashboard (excluding test, seed & demo accounts)

### Users
| Metric | Value |
|--------|-------|
| Total Users | {total_users} |
| New (7d) | {new_users_7d} |
| New (24h) | {new_users_24h} |

### Sessions
| Metric | Value |
|--------|-------|
| Total Sessions | {total_sessions} |
| Sessions (7d) | {sessions_7d} |
| Sessions (24h) | {sessions_24h} |
| Active Surfers (7d) | {active_surfers_7d} |
| Avg Rating | {avg_rating} |
| Avg Duration | {avg_duration_min} min |

### Daily Active Users (7d) — cross-table
| Date | Users |
|------|-------|
| {day_1} | {dau_1} |
| ... | ... |

### Content Created (7d)
| Metric | Value |
|--------|-------|
| Sessions Logged | {sessions_created_7d} |
| Boards Added | {boards_added_7d} |
| Reviews Written | {reviews_written_7d} |
| Intel Posted | {intel_posted_7d} |

### Top Beaches by Activity (7d)
| Beach | Activity |
|-------|----------|
| {beach_1} | {count_1} |
| ... | ... |

### Content (totals)
| Metric | Value |
|--------|-------|
| Reviews (total / 7d) | {total_reviews} / {reviews_7d} |
| Intel Posts (total / 7d) | {total_intel} / {intel_7d} |
| Boards | {total_boards} |
| Beaches | {total_beaches} |

### Delivery (7d)
| Metric | Value |
|--------|-------|
| Emails Sent | {emails_7d} |
| Welcome | {welcome_emails} |
| Forecast Digest | {forecast_digest_emails} |
| Re-engagement | {reengagement_emails} |
| Weekly Recap | {weekly_recap_emails} |

### Event Tracking Health (7d)
| Source | Unique Users | Rows | Latest |
|--------|-------------|------|--------|
| {source} | {unique_users} | {rows} | {latest} |
| ... | ... | ... | ... |

### Data Freshness
| Table | Last Activity | Age |
|-------|--------------|-----|
| {table} | {timestamp} | {human_readable_age} |
| ... | ... | ... |

### User Behavior Events (7d) — KNOWN BROKEN
| Metric | Value |
|--------|-------|
| Users with Events | {users_with_events_7d} |
| Total Events | {total_events_7d} |
| Beach Views | {beach_views} |
| Page Views | {page_views} |
| Discovery Clicks | {discovery_clicks} |
| Forecast Checks | {forecast_checks} |

> **Note**: user_events is undercounting due to an RLS policy bug.
> The INSERT policy on user_events requires `allow_implicit_tracking = true`
> on the profile row, but the API defaults to allowing tracking when no
> profile preference exists — causing a silent mismatch. Most authenticated
> users' events are rejected at the DB layer. See migration
> `20260125120002_implicit_preference_learning.sql` lines 244-255.
```

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **No new users in 24h** (new_users_24h = 0) — "Zero signups in last 24h"
- **No sessions in 7d** (sessions_7d = 0) — "No sessions logged in 7 days"
- **Zero content created** (sessions_created_7d + boards_added_7d + reviews_written_7d + intel_posted_7d = 0) — "No content created in 7 days"
- **DAU declining** (last 3 days of DAU trending downward) — "DAU trending down over last 3 days"
- **Data source stale** (any source in Query 9 older than 48h) — "{source} has no activity in 48h+"
- **Event tracking gap** (user_events unique_users_7d < 50% of cross-table DAU peak) — "Event tracking capturing <50% of real users — RLS bug likely still active"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
