Query Quiver application metrics from Supabase and present a formatted dashboard.

**Exclusion filter** (applied to all queries joining profiles):
```
p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid' AND p.email NOT LIKE '%@example.invalid'
```
This filters out test accounts, local dev accounts, and seed/demo data (`@example.invalid`).

Run these 24 SQL queries **in parallel** against project `vawdnbbgawichorsjiwe` using the Supabase MCP `execute_sql` tool directly from the main session (do NOT delegate to subagents — they cannot access MCP tools):

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
  COUNT(*) FILTER (WHERE esl.email_type = 'weekly_recap') AS weekly_recap_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'conditions_alert') AS conditions_alert_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'session_prompt') AS session_prompt_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'first_session_nudge') AS first_session_nudge_emails
FROM email_send_log esl
JOIN profiles p ON esl.user_id = p.id
WHERE esl.sent_at >= NOW() - INTERVAL '7 days'
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```

### Query 5: User Behavior Events (7d) — includes anonymous visitors
```sql
SELECT
  COUNT(*) AS total_events_7d,
  COUNT(*) FILTER (WHERE ue.user_id IS NULL) AS anonymous_events_7d,
  COUNT(*) FILTER (WHERE ue.user_id IS NOT NULL) AS authenticated_events_7d,
  COUNT(DISTINCT ue.user_id) FILTER (WHERE ue.user_id IS NOT NULL) AS users_with_events_7d,
  COUNT(DISTINCT ue.session_id) FILTER (WHERE ue.user_id IS NULL) AS anonymous_visitors_7d,
  COUNT(*) FILTER (WHERE event_type = 'page_view') AS page_views,
  COUNT(*) FILTER (WHERE event_type = 'beach_view') AS beach_views,
  COUNT(*) FILTER (WHERE event_type = 'discovery_click') AS discovery_clicks,
  COUNT(*) FILTER (WHERE event_type = 'discovery_skip') AS discovery_skips,
  COUNT(*) FILTER (WHERE event_type = 'forecast_check') AS forecast_checks,
  COUNT(*) FILTER (WHERE event_type = 'session_action') AS session_actions,
  COUNT(*) FILTER (WHERE event_type = 'tab_view') AS tab_views,
  COUNT(*) FILTER (WHERE event_type = 'map_interaction') AS map_interactions,
  COUNT(*) FILTER (WHERE event_type LIKE 'forecast_%') AS forecast_interactions,
  COUNT(*) FILTER (WHERE event_type LIKE 'onboarding_%') AS onboarding_events,
  COUNT(*) FILTER (WHERE event_type IN ('share_started', 'share_completed', 'share_link_copied', 'share_image_saved', 'cam_share', 'share_intel_button_clicked', 'surf_plan_share')) AS share_events,
  COUNT(*) FILTER (WHERE event_type IN ('session_log_start', 'session_log_submit')) AS session_log_events,
  COUNT(*) FILTER (WHERE event_type IN ('intel_post_created', 'intel_post_confirmed', 'local_intel_tab_viewed', 'plan_session_from_intel')) AS intel_events,
  COUNT(*) FILTER (WHERE event_type = 'beach_search') AS beach_searches,
  COUNT(*) FILTER (WHERE event_type IN ('product_tour_started', 'product_tour_completed', 'product_tour_skipped', 'product_tour_step_viewed')) AS tour_events,
  COUNT(*) FILTER (WHERE event_type IN ('cta_click', 'signup_cta_click', 'signup_cta_view', 'signin_cta_click')) AS cta_events,
  COUNT(*) FILTER (WHERE event_type IN ('review_form_open', 'review_form_abandon', 'review_validation_error')) AS review_form_events,
  (SELECT COUNT(*) FROM user_events WHERE created_at >= NOW() - INTERVAL '7 days' AND bot_flagged = true) AS bot_flagged_events
FROM user_events ue
LEFT JOIN profiles p ON ue.user_id = p.id
WHERE ue.created_at >= NOW() - INTERVAL '7 days'
  AND (ue.bot_flagged IS NULL OR ue.bot_flagged = false)
  AND (ue.user_id IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'));
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
    SELECT ue.beach_id FROM user_events ue LEFT JOIN profiles p ON ue.user_id = p.id WHERE ue.created_at >= NOW() - INTERVAL '7 days' AND ue.event_type = 'beach_view' AND ue.beach_id IS NOT NULL AND (ue.user_id IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
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
  UNION ALL
  SELECT DATE(created_at), user_id FROM comments WHERE created_at >= NOW() - INTERVAL '7 days'
  UNION ALL
  SELECT DATE(created_at), user_id FROM session_likes WHERE created_at >= NOW() - INTERVAL '7 days'
  UNION ALL
  SELECT DATE(created_at), follower_id FROM user_follows WHERE created_at >= NOW() - INTERVAL '7 days'
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
  (SELECT MAX(ue.created_at) FROM user_events ue LEFT JOIN profiles p ON ue.user_id = p.id WHERE ue.user_id IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid')) AS latest_event,
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
  SELECT 'user_events', COUNT(DISTINCT ue.user_id) FILTER (WHERE ue.user_id IS NOT NULL), COUNT(*), MAX(ue.created_at)
  FROM user_events ue LEFT JOIN profiles p ON ue.user_id = p.id WHERE ue.created_at >= NOW() - INTERVAL '7 days' AND (ue.user_id IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
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
| Conditions Alert | {conditions_alert_emails} |
| Session Prompt | {session_prompt_emails} |
| First Session Nudge | {first_session_nudge_emails} |

### Email Engagement (7d)
| Metric | Value |
|--------|-------|
| Delivered | {delivered} |
| Opened | {opened} |
| Clicked | {clicked} |
| Bounced | {bounced} |
| Open Rate | {open_rate_pct}% |
| Click Rate | {click_rate_pct}% |

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

### User Behavior Events (7d) — includes anonymous visitors
| Metric | Value |
|--------|-------|
| Total Events | {total_events_7d} |
| Anonymous Events | {anonymous_events_7d} |
| Authenticated Events | {authenticated_events_7d} |
| Authenticated Users | {users_with_events_7d} |
| Anonymous Visitors (by session) | {anonymous_visitors_7d} |
| Page Views | {page_views} |
| Beach Views | {beach_views} |
| Tab Views | {tab_views} |
| Map Interactions | {map_interactions} |
| Forecast Interactions | {forecast_interactions} |
| Onboarding Events | {onboarding_events} |
| Share Events | {share_events} |
| Session Log Events | {session_log_events} |
| Intel Events | {intel_events} |
| Beach Searches | {beach_searches} |
| Tour Events | {tour_events} |
| CTA Events | {cta_events} |
| Review Form Events | {review_form_events} |
| Discovery Clicks | {discovery_clicks} |
| Forecast Checks | {forecast_checks} |
| Bot-Flagged (excluded) | {bot_flagged_events} |

### Signup Funnel (7d)
| Event | Count |
|-------|-------|
| {event_type} | {count} |
| ... | ... |

> **Key metric**: `signup_cta_click` (not `signup_cta_view`) is the real intent signal.
> CTA click rate = signup_cta_click / signup_cta_view.
> Auth funnel: signup_cta_click → auth_modal_opened → auth_method_selected → signup_started → signup_success.

### Onboarding Steps (7d)
| Event | Step | Count | Unique |
|-------|------|-------|--------|
| {event_type} | {step} | {count} | {unique_users} |
| ... | ... | ... | ... |

### Daily Anonymous vs Authenticated (7d)
| Date | Anonymous | Authenticated | Total Events |
|------|-----------|---------------|-------------|
| {day} | {anonymous_visitors} | {authenticated_users} | {total_events} |
| ... | ... | ... | ... |

### Gamification & XP
| Metric | Value |
|--------|-------|
| Users with XP | {users_with_xp} |
| Avg Level | {avg_level} |
| Max Level | {max_level} |
| XP Events (7d) | {xp_events_7d} |
| XP Earned (7d) | {xp_earned_7d} |
| XP Active Users (7d) | {xp_active_users_7d} |
| Total Badges Unlocked | {total_badges_unlocked} |
| Badges Unlocked (7d) | {badges_unlocked_7d} |
| Badge Types Defined | {total_badge_types} |

### Social Graph
| Metric | Value |
|--------|-------|
| Total Follows | {total_follows} |
| New Follows (7d) | {new_follows_7d} |
| Users Following Someone | {users_following_someone} |
| Users with Followers | {users_with_followers} |
| Avg Following/User | {avg_following_per_user} |
| Avg Followers/User | {avg_followers_per_user} |

### Session Engagement
| Metric | Total | 7d |
|--------|-------|----|
| Likes | {total_likes} | {likes_7d} |
| Comments | {total_comments} | {comments_7d} |
| Shares | {total_shares} | {shares_7d} |
| Media Uploads | {total_media} | {media_uploads_7d} |

### Referrals
| Metric | Value |
|--------|-------|
| Total Referrals | {total_referrals} |
| Completed | {completed_referrals} |
| Pending | {pending_referrals} |
| New (7d) | {referrals_7d} |
| Completed (7d) | {completed_7d} |
| Unique Referrers | {unique_referrers} |
| Conversion Rate | {conversion_rate_pct}% |

### Notifications & Devices
| Metric | Value |
|--------|-------|
| Notifications Sent (7d) | {notifications_7d} |
| Notifications Read (7d) | {notifications_read_7d} |
| Read Rate | {read_rate_pct}% |
| Users with Devices | {users_with_devices} |
| iOS Devices | {ios_devices} |
| Android Devices | {android_devices} |
| Web Devices | {web_devices} |
```

### Query 11: Fallback Health — Summary (24h / 7d)
```sql
SELECT
  severity,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS events_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS events_7d,
  COUNT(DISTINCT domain || '.' || field) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS unique_fallbacks_24h
FROM fallback_events
GROUP BY severity
ORDER BY CASE severity
  WHEN 'dangerous' THEN 1
  WHEN 'high' THEN 2
  WHEN 'medium' THEN 3
  WHEN 'low' THEN 4
END;
```

### Query 12: Fallback Health — Top Offenders (7d)
```sql
SELECT
  domain,
  field,
  severity,
  fallback_value,
  COUNT(*) AS occurrences_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS occurrences_24h,
  MAX(created_at) AS last_seen
FROM fallback_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY domain, field, severity, fallback_value
ORDER BY
  CASE severity WHEN 'dangerous' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
  occurrences_7d DESC
LIMIT 15;
```

Add to the dashboard output:

```
### Fallback Health (internal data quality)
| Severity | 24h | 7d | Unique Fallbacks (24h) |
|----------|-----|-----|----------------------|
| {severity} | {events_24h} | {events_7d} | {unique_fallbacks_24h} |
| ... | ... | ... | ... |

### Top Fallback Offenders (7d)
| Domain | Field | Severity | Default | 24h | 7d | Last Seen |
|--------|-------|----------|---------|-----|-----|-----------|
| {domain} | {field} | {severity} | {fallback_value} | {24h} | {7d} | {last_seen} |
| ... | ... | ... | ... | ... | ... | ... |
```

If the `fallback_events` table doesn't exist yet (query returns error), skip this section silently.

### Query 13: Forecast Pipeline Health (Per-Source)
```sql
SELECT
  source,
  beaches_with_data,
  ROUND(100.0 * beaches_with_data / total_beaches, 1) AS coverage_pct,
  critical_stale,
  warning_stale,
  ROUND(avg_age_hours, 1) AS avg_age_hours,
  ROUND(max_age_hours, 1) AS max_age_hours,
  latest_update
FROM (
  SELECT
    'enhanced' AS source,
    COUNT(*) AS beaches_with_data,
    (SELECT COUNT(*) FROM beaches) AS total_beaches,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 > 24) AS critical_stale,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 BETWEEN 16 AND 24) AS warning_stale,
    AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS avg_age_hours,
    MAX(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS max_age_hours,
    MAX(updated_at) AS latest_update
  FROM v_enhanced_forecast_latest
  UNION ALL
  SELECT
    'marine',
    COUNT(*),
    (SELECT COUNT(*) FROM beaches),
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > 6),
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 BETWEEN 3 AND 6),
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600),
    MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600),
    MAX(created_at)
  FROM v_marine_forecast_latest
) sources;
```

### Query 14: Enhanced Forecast Data Source Breakdown
```sql
SELECT
  COALESCE(data_source, 'UNKNOWN') AS data_source,
  COUNT(*) AS beach_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600), 1) AS avg_age_hours,
  COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 > 24) AS critical_count
FROM v_enhanced_forecast_latest
GROUP BY data_source
ORDER BY beach_count DESC;
```

### Query 15: Signup Funnel Breakdown (7d)
```sql
SELECT
  event_type,
  COUNT(*) AS count
FROM user_events
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (bot_flagged IS NULL OR bot_flagged = false)
  AND event_type IN (
    'signup_cta_view', 'signup_cta_click', 'signin_cta_click',
    'auth_modal_opened', 'auth_modal_closed_without_action',
    'auth_method_selected', 'auth_provider_selected',
    'signup_started', 'signup_success', 'signup_form_submitted',
    'login_success'
  )
GROUP BY event_type
ORDER BY count DESC;
```

### Query 16: Onboarding Step Funnel (7d)
```sql
SELECT
  event_type,
  metadata->>'step' AS step,
  COUNT(*) AS count,
  COUNT(DISTINCT COALESCE(user_id::text, session_id::text)) AS unique_users
FROM user_events
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (bot_flagged IS NULL OR bot_flagged = false)
  AND event_type LIKE 'onboarding_%'
GROUP BY event_type, metadata->>'step'
ORDER BY step, event_type;
```

### Query 17: Daily Anonymous vs Authenticated Visitors (7d)
```sql
SELECT
  DATE(created_at) AS day,
  COUNT(DISTINCT session_id) FILTER (WHERE user_id IS NULL) AS anonymous_visitors,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS authenticated_users,
  COUNT(*) AS total_events
FROM user_events
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (bot_flagged IS NULL OR bot_flagged = false)
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### Query 18: Gamification & XP
```sql
SELECT
  COUNT(DISTINCT ux.user_id) AS users_with_xp,
  ROUND(AVG(ux.level), 1) AS avg_level,
  MAX(ux.level) AS max_level,
  (SELECT COUNT(*) FROM xp_events xe JOIN profiles p2 ON xe.user_id = p2.id
   WHERE xe.created_at >= NOW() - INTERVAL '7 days'
   AND p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid') AS xp_events_7d,
  (SELECT COALESCE(SUM(xe.xp_amount), 0) FROM xp_events xe JOIN profiles p2 ON xe.user_id = p2.id
   WHERE xe.created_at >= NOW() - INTERVAL '7 days'
   AND p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid') AS xp_earned_7d,
  (SELECT COUNT(DISTINCT xe.user_id) FROM xp_events xe JOIN profiles p2 ON xe.user_id = p2.id
   WHERE xe.created_at >= NOW() - INTERVAL '7 days'
   AND p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid') AS xp_active_users_7d,
  (SELECT COUNT(*) FROM user_badges ub JOIN profiles p2 ON ub.user_id = p2.id
   WHERE p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid') AS total_badges_unlocked,
  (SELECT COUNT(*) FROM user_badges ub JOIN profiles p2 ON ub.user_id = p2.id
   WHERE ub.unlocked_at >= NOW() - INTERVAL '7 days'
   AND p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid') AS badges_unlocked_7d,
  (SELECT COUNT(*) FROM badge_definitions) AS total_badge_types
FROM user_xp ux
JOIN profiles p ON ux.user_id = p.id
WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```

### Query 19: Social Graph
```sql
SELECT
  (SELECT COUNT(*) FROM user_follows uf JOIN profiles p ON uf.follower_id = p.id
   WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_follows,
  (SELECT COUNT(*) FROM user_follows uf JOIN profiles p ON uf.follower_id = p.id
   WHERE uf.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS new_follows_7d,
  (SELECT COUNT(DISTINCT uf.follower_id) FROM user_follows uf JOIN profiles p ON uf.follower_id = p.id
   WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS users_following_someone,
  (SELECT COUNT(DISTINCT uf.following_id) FROM user_follows uf JOIN profiles p ON uf.following_id = p.id
   WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS users_with_followers,
  (SELECT ROUND(AVG(fc), 1) FROM (SELECT COUNT(*) AS fc FROM user_follows GROUP BY follower_id) t) AS avg_following_per_user,
  (SELECT ROUND(AVG(fc), 1) FROM (SELECT COUNT(*) AS fc FROM user_follows GROUP BY following_id) t) AS avg_followers_per_user;
```

### Query 20: Session Engagement (likes, comments, shares, media)
```sql
SELECT
  (SELECT COUNT(*) FROM session_likes sl JOIN profiles p ON sl.user_id = p.id
   WHERE sl.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS likes_7d,
  (SELECT COUNT(*) FROM session_likes sl JOIN profiles p ON sl.user_id = p.id
   WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_likes,
  (SELECT COUNT(*) FROM comments c JOIN profiles p ON c.user_id = p.id
   WHERE c.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS comments_7d,
  (SELECT COUNT(*) FROM comments c JOIN profiles p ON c.user_id = p.id
   WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_comments,
  (SELECT COUNT(*) FROM session_shares ss JOIN profiles p ON ss.user_id = p.id
   WHERE ss.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS shares_7d,
  (SELECT COUNT(*) FROM session_shares ss JOIN profiles p ON ss.user_id = p.id
   WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_shares,
  (SELECT COUNT(*) FROM session_media sm JOIN profiles p ON sm.user_id = p.id
   WHERE sm.created_at >= NOW() - INTERVAL '7 days' AND sm.deleted_at IS NULL
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS media_uploads_7d,
  (SELECT COUNT(*) FROM session_media sm JOIN profiles p ON sm.user_id = p.id
   WHERE sm.deleted_at IS NULL
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS total_media;
```

### Query 21: Referrals
```sql
SELECT
  COUNT(*) AS total_referrals,
  COUNT(*) FILTER (WHERE r.status = 'completed') AS completed_referrals,
  COUNT(*) FILTER (WHERE r.status = 'pending') AS pending_referrals,
  COUNT(*) FILTER (WHERE r.created_at >= NOW() - INTERVAL '7 days') AS referrals_7d,
  COUNT(*) FILTER (WHERE r.status = 'completed' AND r.completed_at >= NOW() - INTERVAL '7 days') AS completed_7d,
  COUNT(DISTINCT r.referrer_id) AS unique_referrers,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.status = 'completed') / NULLIF(COUNT(*), 0), 1) AS conversion_rate_pct
FROM referrals r
JOIN profiles p ON r.referrer_id = p.id
WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```

### Query 22: Notifications & Devices
```sql
SELECT
  (SELECT COUNT(*) FROM notifications n JOIN profiles p ON n.user_id = p.id
   WHERE n.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS notifications_7d,
  (SELECT COUNT(*) FROM notifications n JOIN profiles p ON n.user_id = p.id
   WHERE n.read_at IS NOT NULL AND n.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS notifications_read_7d,
  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE n.read_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
   FROM notifications n JOIN profiles p ON n.user_id = p.id
   WHERE n.created_at >= NOW() - INTERVAL '7 days'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS read_rate_pct,
  (SELECT COUNT(DISTINCT ud.user_id) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS users_with_devices,
  (SELECT COUNT(*) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE ud.platform = 'ios'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS ios_devices,
  (SELECT COUNT(*) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE ud.platform = 'android'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS android_devices,
  (SELECT COUNT(*) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE ud.platform = 'web'
   AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid') AS web_devices;
```

### Query 23: Email Engagement (7d)
```sql
SELECT
  COUNT(*) FILTER (WHERE esl.delivered_at IS NOT NULL) AS delivered,
  COUNT(*) FILTER (WHERE esl.opened_at IS NOT NULL) AS opened,
  COUNT(*) FILTER (WHERE esl.clicked_at IS NOT NULL) AS clicked,
  COUNT(*) FILTER (WHERE esl.bounced_at IS NOT NULL) AS bounced,
  ROUND(100.0 * COUNT(*) FILTER (WHERE esl.opened_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE esl.delivered_at IS NOT NULL), 0), 1) AS open_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE esl.clicked_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE esl.opened_at IS NOT NULL), 0), 1) AS click_rate_pct
FROM email_send_log esl
JOIN profiles p ON esl.user_id = p.id
WHERE esl.sent_at >= NOW() - INTERVAL '7 days'
  AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```

Add to the dashboard output:

```
### Forecast Pipeline Health
| Source | Beaches | Coverage | Critical (>24h) | Warning (16-24h) | Avg Age | Latest |
|--------|---------|----------|-----------------|------------------|---------|--------|
| {source} | {beaches_with_data} | {coverage_pct}% | {critical_stale} | {warning_stale} | {avg_age_hours}h | {latest_update} |

### Forecast Data Sources
| Source | Beaches | Avg Age | Critical |
|--------|---------|---------|----------|
| {data_source} | {beach_count} | {avg_age_hours}h | {critical_count} |
```

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **No new users in 24h** (new_users_24h = 0) — "Zero signups in last 24h"
- **No sessions in 7d** (sessions_7d = 0) — "No sessions logged in 7 days"
- **Zero content created** (sessions_created_7d + boards_added_7d + reviews_written_7d + intel_posted_7d = 0) — "No content created in 7 days"
- **DAU declining** (last 3 days of DAU trending downward) — "DAU trending down over last 3 days"
- **Data source stale** (any source in Query 9 older than 48h) — "{source} has no activity in 48h+"
- **Event tracking gap** (user_events unique_users_7d < 50% of cross-table DAU peak) — "Event tracking capturing <50% of real users — RLS bug likely still active"
- **Dangerous fallback spike** (Query 11: dangerous events_24h > 50) — "⚠ {n} dangerous fallbacks in 24h — scoring pipeline may be using fabricated data"
- **Synthetic data active** (Query 12: domain='noaa-coops' or 'noaa-wavewatch' with occurrences_24h > 0) — "NOAA fallback generators fired {n} times in 24h — possible API outage"
- **Enhanced forecasts critical** (Query 13: critical_stale > 35 for enhanced source) — "Enhanced forecasts: {n} beaches >24h stale — cron pipeline may be down"
- **Enhanced forecasts all stale** (Query 13: avg_age_hours > 16 for enhanced source) — "All enhanced forecasts avg {n}h old — discovery will show stale/empty results"
- **Marine forecasts stale** (Query 13: critical_stale > 50 for marine source) — "Marine forecasts: {n} beaches >6h stale"
- **Low forecast coverage** (Query 13: coverage_pct < 90 for enhanced source) — "Forecast coverage at {n}% — {missing} beaches have no data"
- **Zero social activity** (Query 19: new_follows_7d = 0 AND total_follows > 0) — "No new follows in 7 days — social features may be stale"
- **Zero session engagement** (Query 20: likes_7d + comments_7d + shares_7d = 0) — "No likes, comments, or shares in 7 days"
- **Referral stall** (Query 21: total_referrals > 0 AND referrals_7d = 0) — "No new referrals in 7 days"
- **Low notification read rate** (Query 22: read_rate_pct < 20 AND notifications_7d > 10) — "Notification read rate at {n}% — users may be ignoring notifications"
- **Email bounce spike** (Query 23: bounced > 0 AND bounced > delivered * 0.05) — "Email bounce rate >{n}% — check sender reputation"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
