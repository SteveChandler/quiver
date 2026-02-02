Query Quiver application metrics from Supabase and present a formatted dashboard.

Run these 4 SQL queries **in parallel** against project `vawdnbbgawichorsjiwe` using `execute_sql`:

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
  (SELECT COUNT(*) FROM email_send_log esl JOIN profiles p ON esl.user_id = p.id WHERE esl.sent_at >= NOW() - INTERVAL '7 days' AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test') AS emails_7d;
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

### Content
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
```

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **No new users in 24h** (new_users_24h = 0) — "Zero signups in last 24h"
- **No sessions in 7d** (sessions_7d = 0) — "No sessions logged in 7 days"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
