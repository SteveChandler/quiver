Query Quiver application metrics from Supabase and present a formatted dashboard.

Run these 8 SQL queries **in parallel** against project `vawdnbbgawichorsjiwe` using `execute_sql`:

### Query 1: Users
```sql
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_users_24h
FROM profiles
WHERE email NOT ILIKE '%test%' AND email NOT LIKE '%@local.test';
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
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test';
```

### Query 3: Content
```sql
SELECT
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS total_reviews,
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS reviews_7d,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS total_intel,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE ip.created_at >= NOW() - INTERVAL '7 days' AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS intel_7d,
  (SELECT COUNT(*) FROM boards b JOIN profiles p ON b.user_id = p.id WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS total_boards,
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
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test';
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
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test';
```

### Query 6: Content Creation Activity (7d)
```sql
SELECT
  (SELECT COUNT(*) FROM sessions s JOIN profiles p ON s.user_id = p.id
   WHERE s.created_at >= NOW() - INTERVAL '7 days' AND s.deleted_at IS NULL
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS sessions_created_7d,
  (SELECT COUNT(*) FROM boards b JOIN profiles p ON b.user_id = p.id
   WHERE b.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS boards_added_7d,
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id
   WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS reviews_written_7d,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id
   WHERE ip.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS intel_posted_7d;
```

### Query 7: Top Viewed Beaches (7d)
```sql
SELECT
  b.name AS beach_name,
  COUNT(*) AS view_count
FROM user_events ue
JOIN profiles p ON ue.user_id = p.id
JOIN beaches b ON ue.beach_id = b.id
WHERE ue.event_type = 'beach_view'
  AND ue.created_at >= NOW() - INTERVAL '7 days'
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test'
GROUP BY b.id, b.name
ORDER BY view_count DESC
LIMIT 5;
```

### Query 8: Daily Active Users (last 7 days trend)
```sql
SELECT
  DATE(ue.created_at) AS day,
  COUNT(DISTINCT ue.user_id) AS active_users
FROM user_events ue
JOIN profiles p ON ue.user_id = p.id
WHERE ue.created_at >= NOW() - INTERVAL '7 days'
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test'
GROUP BY DATE(ue.created_at)
ORDER BY day DESC;
```

## Output Format

Present results as a markdown dashboard:

```
## App Dashboard (excluding test accounts)

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

### User Behavior (7d)
| Metric | Value |
|--------|-------|
| Users with Events | {users_with_events_7d} |
| Total Events | {total_events_7d} |
| Avg Events/User | {avg_events_per_user} |
| Page Views | {page_views} |
| Beach Views | {beach_views} |
| Discovery Clicks | {discovery_clicks} |
| Discovery Skips | {discovery_skips} |
| Forecast Checks | {forecast_checks} |
| Session Actions | {session_actions} |
| CTA Clicks | {cta_clicks} |

### Content Created (7d)
| Metric | Value |
|--------|-------|
| Sessions Logged | {sessions_created_7d} |
| Boards Added | {boards_added_7d} |
| Reviews Written | {reviews_written_7d} |
| Intel Posted | {intel_posted_7d} |

### Top Beaches Viewed (7d)
| Beach | Views |
|-------|-------|
| {beach_1} | {views_1} |
| {beach_2} | {views_2} |
| {beach_3} | {views_3} |
| {beach_4} | {views_4} |
| {beach_5} | {views_5} |

### Daily Active Users (7d)
| Date | Users |
|------|-------|
| {day_1} | {dau_1} |
| {day_2} | {dau_2} |
| {day_3} | {dau_3} |
| {day_4} | {dau_4} |
| {day_5} | {dau_5} |
| {day_6} | {dau_6} |
| {day_7} | {dau_7} |

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
```

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **No new users in 24h** (new_users_24h = 0) — "Zero signups in last 24h"
- **No sessions in 7d** (sessions_7d = 0) — "No sessions logged in 7 days"
- **No user events in 7d** (total_events_7d = 0) — "No user behavior tracked in 7 days"
- **Zero content created** (sessions_created_7d + boards_added_7d + reviews_written_7d + intel_posted_7d = 0) — "No content created in 7 days"
- **Low engagement** (avg_events_per_user < 2 AND total_events_7d > 0) — "Low user engagement (avg < 2 events/user)"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
