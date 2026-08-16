# Quiver Growth Metrics Framework

> **Status note — 2026-08-13:** This framework has not been revised since
> March 2026. Its February 2026 baseline predates known material events, so
> re-derive figures before using them. The sections below identify review
> targets; they do not replace the underlying queries or prove a current value.
>
> Most likely stale or unverified:
>
> - **Baseline, activation funnel, retention cohorts, attribution, and XP
>   tables:** these are dated February snapshots. Their current values are
>   unverified.
> - **Share rate and social-event rows:** the baseline labels these as
>   pre-instrumentation. Current values and event coverage are unverified.
> - **AARRR overview and the WAU/MAU, retention, engagement, and referral
>   definitions:** no post-February re-derivation is recorded here. Treat the
>   current values and denominator coverage as unverified until rerun against
>   current schema and event data.
> - **Any interpretation that depends on alert receipt:** a 2026-08-10
>   read-only production investigation found named queue rows still
>   `sent=false` and a delivery-path `hold_state_unavailable` block before the
>   provider boundary. Alert-driven activation or retention conclusions are
>   therefore unverified for the affected period; this framework does not
>   contain a replacement alert-delivery metric.

**Purpose:** Define, track, and validate Quiver's growth-first strategy through measurable AARRR metrics and actionable thresholds.

**Last updated:** February 2026

---

## Target Market

**Beginner surfers who are tech-savvy.** Ages 18-35, already comfortable with fitness/activity tracking apps (Strava, Apple Health, etc.), picking up surfing as a new sport.

### Behavioral Profile

- **Session frequency:** 1-2x/week in season, near-zero in off-season. Beginners don't push through cold/rough conditions.
- **Progression-driven:** High motivation to track improvement over time. "Am I getting better?" is the core question.
- **Forecast-dependent:** Check conditions frequently but need beginner-friendly guidance ("Is today good for me?" not just raw swell data).
- **High social sharing:** Beginners love showing they're picking up a new sport. Share rate should exceed typical surf apps.
- **Gamification-responsive:** XP, levels, streaks, and badges align with fitness app habits they already have.
- **Seasonal volatility:** Sharper drop-off in winter/off-season than experienced surfers. Plan for 40-60% seasonal WAU decline.

### Implications for Targets

All targets below are calibrated for this audience. Key adjustments vs. a general surf app:
- Lower session frequency targets (beginners surf less often)
- Higher share rate targets (beginners share more)
- Longer time-to-first-session window (they may not surf the day they sign up)
- Higher stickiness potential (progression tracking creates habitual check-ins even on non-surf days)

---

## North Star Metric

**Weekly Active Session Loggers (WASL)** -- Users who logged at least one surf session in the past 7 days.

- **Target:** 10-15 per week (early stage). Beginner surfers average 1-2 sessions/week in season, so 10-15 WASL represents a healthy core of active users. Scale to 50+ as user base grows.
- **Data source:** `sessions` table
- **Core query:**

```sql
SELECT COUNT(DISTINCT user_id) AS wasl
FROM sessions
WHERE created_at >= NOW() - INTERVAL '7 days';
```

WASL directly measures the behavior that makes Quiver valuable: people surfing and recording it. All other metrics ladder up to growing this number.

---

## AARRR Metrics Overview

| Category | Key Metrics | Target | Data Source |
|----------|------------|--------|-------------|
| **Acquisition** | Weekly signups, source breakdown | Track trend | `profiles.created_at`, UTM params in `signup_context` |
| **Activation** | Onboarding completion rate, time-to-first-session, first social action | >70% onboard, <7d first session | `profiles`, `sessions`, `user_events` |
| **Retention** | D7, D30 cohorts, WAU/MAU stickiness | D7 >15%, stickiness >30% | Cross-table activity (`sessions`, `beach_reviews`, `intel_posts`, `user_events`, `user_follows`) |
| **Engagement** | Sessions/WAU/week, content creation ratio, social actions/WAU | >1.2 sessions, >15% creators | `sessions`, `intel_posts`, `beach_reviews`, `user_events` |
| **Viral/Referral** | Share rate, invite acceptance rate, referral conversion | >20% share, >30% accept | `user_events` (`social_share`, `social_invite_*`), `session_invitations` |

---

## Metric Definitions

### 1. WASL (Weekly Active Session Loggers)

- **Definition:** Count of distinct users who created at least one session in the past 7 days.
- **Target:** 10-15 per week. Beginner surfers average 1-2 sessions/week, so 10-15 WASL represents enough active loggers to generate visible local feed activity. Scale to 50+ as user base grows.
- **Data source:** `sessions.user_id`, `sessions.created_at`

```sql
SELECT COUNT(DISTINCT user_id) AS wasl
FROM sessions
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### 2. WAU (Weekly Active Users)

- **Definition:** Count of distinct users who performed any tracked activity in the past 7 days. Activity includes logging sessions, posting intel, writing reviews, following users, or any tracked event.
- **Target:** Track trend (WAU should grow week-over-week).
- **Data source:** Union across `sessions`, `reviews`, `intel_posts`, `user_events`, `user_follows`

```sql
SELECT COUNT(DISTINCT user_id) AS wau
FROM (
    SELECT user_id FROM sessions       WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM beach_reviews         WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM intel_posts     WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM user_events     WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT follower_id AS user_id FROM user_follows WHERE created_at >= NOW() - INTERVAL '7 days'
) activity;
```

### 3. MAU (Monthly Active Users)

- **Definition:** Count of distinct users who performed any tracked activity in the past 30 days. Uses the same activity union as WAU.
- **Target:** Track trend.
- **Data source:** Same tables as WAU, with a 30-day window. (`sessions`, `beach_reviews`, `intel_posts`, `user_events`, `user_follows`)

```sql
SELECT COUNT(DISTINCT user_id) AS mau
FROM (
    SELECT user_id FROM sessions       WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM beach_reviews         WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM intel_posts     WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM user_events     WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT follower_id AS user_id FROM user_follows WHERE created_at >= NOW() - INTERVAL '30 days'
) activity;
```

### 4. Stickiness (WAU / MAU)

- **Definition:** Ratio of weekly active users to monthly active users. Measures how consistently users return within a month.
- **Target:** >30%. Beginner surfers check forecasts and progression stats even on non-surf days, but session logging is less frequent. 30%+ indicates the app is part of their weekly routine. Stretch goal: >40% with strong progression features.
- **Data source:** Derived from WAU and MAU queries above.

```sql
SELECT
    (wau_count::NUMERIC / NULLIF(mau_count, 0)) AS stickiness
FROM
    (SELECT COUNT(DISTINCT user_id) AS wau_count FROM ( /* WAU union */ ) w) wau_q,
    (SELECT COUNT(DISTINCT user_id) AS mau_count FROM ( /* MAU union */ ) m) mau_q;
```

### 5. D7 Retention

- **Definition:** Percentage of users in a signup cohort who performed any tracked activity at least 7 days after their signup date.
- **Target:** >15%. Beginner surfers may not surf in their first week after signup -- they're waiting for the right conditions and building confidence. 15% D7 return (for any activity, not just sessions) is a strong signal. Stretch goal: >25% once beginner condition guidance is live.
- **Data source:** `profiles.created_at` (signup), activity union (return)

```sql
WITH cohort AS (
    SELECT id AS user_id, created_at::DATE AS signup_date
    FROM profiles
    WHERE created_at::DATE = :cohort_date
),
returned AS (
    SELECT DISTINCT s.user_id
    FROM cohort c
    JOIN (
        SELECT user_id, created_at FROM sessions
        UNION ALL
        SELECT user_id, created_at FROM beach_reviews
        UNION ALL
        SELECT user_id, created_at FROM intel_posts
        UNION ALL
        SELECT user_id, created_at FROM user_events
    ) s ON s.user_id = c.user_id
    WHERE s.created_at >= c.signup_date + INTERVAL '7 days'
      AND s.created_at <  c.signup_date + INTERVAL '14 days'
)
SELECT
    COUNT(r.user_id)::NUMERIC / NULLIF(COUNT(c.user_id), 0) AS d7_retention
FROM cohort c
LEFT JOIN returned r ON r.user_id = c.user_id;
```

### 6. D30 Retention

- **Definition:** Percentage of users in a signup cohort who performed any tracked activity between 30 and 60 days after their signup date.
- **Target:** >8%. Beginner surfers have sharper seasonal drop-off and may go weeks between sessions. 8% D30 retention at early stage is a healthy signal that progression tracking and forecast features keep them engaged.
- **Data source:** Same as D7, with adjusted time window.

```sql
-- Same structure as D7 retention, replacing the time window:
WHERE s.created_at >= c.signup_date + INTERVAL '30 days'
  AND s.created_at <  c.signup_date + INTERVAL '60 days'
```

### 7. Activation Funnel

- **Definition:** Step-by-step conversion from signup through to repeat engagement.
- **Stages:**
  1. **Signup** -- User creates an account (`profiles.created_at`)
  2. **Onboarding complete** -- User finishes onboarding flow (`profiles.onboarding_completed = true` or equivalent event)
  3. **First session** -- User logs their first surf session (`MIN(sessions.created_at)`)
  4. **First social action** -- User performs a social action: follow, share, or comment (`user_events` with relevant event types)
  5. **Second session** -- User logs a second session (validates return behavior)
- **Target:** >70% signup-to-onboarding, <7d signup-to-first-session (beginners may not surf the same day they sign up -- they're waiting for good beginner conditions)
- **Data source:** `profiles`, `sessions`, `user_events`

```sql
WITH funnel AS (
    SELECT
        p.id AS user_id,
        p.created_at AS signed_up_at,
        p.onboarding_completed,
        MIN(s.created_at) AS first_session_at,
        (SELECT MIN(ue.created_at) FROM user_events ue
         WHERE ue.user_id = p.id
           AND ue.event_type IN ('social_share', 'social_follow', 'social_comment')
        ) AS first_social_at,
        (SELECT MIN(s2.created_at) FROM sessions s2
         WHERE s2.user_id = p.id
           AND s2.created_at > (SELECT MIN(s3.created_at) FROM sessions s3 WHERE s3.user_id = p.id)
        ) AS second_session_at
    FROM profiles p
    LEFT JOIN sessions s ON s.user_id = p.id
    WHERE p.created_at >= :cohort_start AND p.created_at < :cohort_end
    GROUP BY p.id, p.created_at, p.onboarding_completed
)
SELECT
    COUNT(*) AS signups,
    COUNT(*) FILTER (WHERE onboarding_completed) AS onboarded,
    COUNT(*) FILTER (WHERE first_session_at IS NOT NULL) AS first_session,
    COUNT(*) FILTER (WHERE first_social_at IS NOT NULL) AS first_social,
    COUNT(*) FILTER (WHERE second_session_at IS NOT NULL) AS second_session
FROM funnel;
```

### 8. Content Creation Ratio

- **Definition:** Percentage of WAU who created content (sessions, intel posts, or reviews) in the past 7 days.
- **Target:** >15%. Beginner surfers are primarily session loggers, not intel reporters or reviewers. 15%+ creation ratio means enough users are logging sessions to generate local feed activity. Stretch goal: >25% as intel and review features gain traction.
- **Data source:** `sessions`, `intel_posts`, `beach_reviews`, WAU denominator

```sql
WITH creators AS (
    SELECT DISTINCT user_id FROM (
        SELECT user_id FROM sessions    WHERE created_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT user_id FROM intel_posts WHERE created_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT user_id FROM beach_reviews     WHERE created_at >= NOW() - INTERVAL '7 days'
    ) c
)
SELECT
    COUNT(*)::NUMERIC / NULLIF(:wau, 0) AS content_creation_ratio
FROM creators;
```

### 9. Share Rate

- **Definition:** Percentage of sessions that were shared externally in the past 30 days. A "share" is a `social_share` event in `user_events` linked to a session.
- **Target:** >20%. Beginners share at higher rates than experienced surfers -- they're excited about a new sport and want to show friends. This is the primary viral loop and acquisition channel. Each shared session is a potential touchpoint for other beginner surfers in their social circle.
- **Data source:** `user_events` (event_type = `social_share`), `sessions`

```sql
WITH share_stats AS (
    SELECT
        (SELECT COUNT(*) FROM user_events
         WHERE event_type = 'social_share'
           AND created_at >= NOW() - INTERVAL '30 days') AS shares,
        (SELECT COUNT(*) FROM sessions
         WHERE created_at >= NOW() - INTERVAL '30 days') AS total_sessions
)
SELECT
    shares::NUMERIC / NULLIF(total_sessions, 0) AS share_rate
FROM share_stats;
```

### 10. Invite Acceptance Rate

- **Definition:** Percentage of sent session invitations that were accepted in the past 30 days.
- **Target:** >30%. High acceptance signals that the invite copy and UX are compelling, and that inviters are targeting the right people.
- **Data source:** `session_invitations` (status column), `user_events` (`social_invite_sent`, `social_invite_accepted`)

```sql
SELECT
    COUNT(*) FILTER (WHERE status = 'accepted')::NUMERIC
        / NULLIF(COUNT(*), 0) AS invite_acceptance_rate
FROM session_invitations
WHERE created_at >= NOW() - INTERVAL '30 days';
```

---

## Anomaly Thresholds

When a metric drops below its anomaly threshold, it signals a systemic issue that requires immediate investigation.

| Metric | Anomaly Threshold | Action |
|--------|-------------------|--------|
| WASL | < 3 | Critical: review entire funnel from acquisition through activation |
| D7 Retention | < 5% | Investigate onboarding funnel -- check drop-off between steps |
| Stickiness (WAU/MAU) | < 15% | Review engagement features -- users are not forming habits |
| Share Rate | < 5% | Check share UX, add contextual share prompts post-session |
| Invite Acceptance | < 15% | Review invite copy and UX, check notification delivery |
| Content Creation Ratio | < 5% | Add creation prompts, reduce friction in session logging |
| Onboarding Completion | < 50% | Simplify onboarding flow, identify drop-off step |

---

## Dashboard Reference

- **Live growth data:** Use the `/growth-metrics` skill command to pull current metric values.
- **Operational metrics:** See `/dashboard` for system health, forecast accuracy, and ML model performance.

---

## Baseline -- February 2026

First production baseline captured February 13, 2026. All queries exclude test/admin accounts and `@example.invalid` seeded demo accounts (created 2026-02-05).

| Metric | Baseline Value | Target | Status | Date |
|--------|---------------|--------|--------|------|
| WASL | 0 | 10-15 | Below target | 2026-02-13 |
| WAU | 1 | Track trend | -- | 2026-02-13 |
| MAU | 2 | Track trend | -- | 2026-02-13 |
| Stickiness | 50.0% | >30% | Above target | 2026-02-13 |
| D7 Retention (latest cohort) | 0% (week of 2/2) | >15% | Below target | 2026-02-13 |
| D30 Retention | 0% (too early) | >8% | Insufficient data | 2026-02-13 |
| Onboarding Rate (90d) | 50.0% | >70% | Below target | 2026-02-13 |
| Content Creation Ratio | 0% | >15% | Below target | 2026-02-13 |
| Share Rate (30d) | 0% | >20% | Pre-instrumentation | 2026-02-13 |
| Invite Acceptance Rate | 0% | >30% | Pre-instrumentation | 2026-02-13 |

### Activation Funnel (90d signups)

| Stage | Count | Conversion |
|-------|-------|-----------|
| Signups | 14 | 100% |
| Onboarded | 7 | 50.0% |
| First Session | 1 | 7.1% |
| First Social Action | 0 | 0% (pre-instrumentation) |
| Second Session | 1 | 7.1% |

### Sessions per Active User (7d)

| Metric | Value |
|--------|-------|
| Avg sessions/user | 0 (no real sessions in 7d) |
| Median sessions/user | 0 |
| Max sessions/user | 0 |
| Active session loggers | 0 |

### Retention Cohorts

| Signup Week | Cohort Size | D7 Returned | D7% | D30 Returned | D30% |
|-------------|------------|-------------|-----|--------------|------|
| 2026-02-02 | 2 | 0 | 0% | 0 | 0% (too early) |
| 2026-01-26 | 3 | 1 | 33.3% | 0 | 0% (too early) |
| 2026-01-19 | 2 | 0 | 0% | 0 | 0% |
| 2026-01-12 | 1 | 0 | 0% | 0 | 0% |
| 2025-12-29 | 3 | 0 | 0% | 0 | 0% |
| 2025-12-15 | 1 | 0 | 0% | 0 | 0% |

### Badge/XP Distribution

| Level | Users | Avg XP | Max XP |
|-------|-------|--------|--------|
| 0 | 9 | 0 | 0 |
| 1 | 4 | 40 | 80 |
| 2 | 6 | 125 | 200 |
| 3 | 1 | 310 | 310 |

### Attribution (30d)

| Source | Medium | Signups | Onboarded | Onboard% | Has Session | Session% |
|--------|--------|---------|-----------|----------|-------------|----------|
| direct | none | 8 | 3 | 37.5% | 1 | 12.5% |

### Social Events (7d)

All zeros -- tracking code deployed but not yet live in production.

### Baseline Notes

- **Data hygiene:** Initial baseline (pre-correction) showed inflated numbers because 22+ `@example.invalid` seeded demo accounts (created 2026-02-05) were not excluded. All numbers below reflect real users only.
- **WASL (0)** means no real users logged a session in the past 7 days. The app has ~20 real accounts total but most are inactive or one-time signups. This is the most critical gap.
- **Stickiness (50%)** is based on very small numbers (WAU=1, MAU=2) so it's not statistically meaningful yet.
- **Onboarding rate (50%)** improved significantly from the pre-correction 18.4% -- seed accounts were dragging this down since they all skipped onboarding. 7 of 14 real signups completed onboarding.
- **Activation gap:** Only 1 of 14 real signups (7.1%) logged a session. This is the biggest conversion gap -- users sign up and onboard but don't log their first session.
- **D7 retention:** Only the 1/26 cohort shows any return activity (1 of 3 users, 33.3%). All other cohorts have 0% D7 retention.
- **Badge/XP:** 11 of 20 real users have earned XP (levels 1-3), suggesting gamification resonates with those who do engage.
- **Share rate and social events** are at zero because the social event tracking (Phase 2B) is not yet deployed to production.
- **Attribution** shows 100% direct traffic -- UTM tracking (Phase 2C) was just added and will populate after deploy.
