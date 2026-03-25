# Quiver Data Landscape Audit

**Date**: 2026-03-13
**Analyst**: Analytics Reporter Agent
**Scope**: Full data source inventory, signal mapping, baseline metrics, data quality assessment, and infrastructure recommendations for quiversurf.app

---

## 1. Executive Summary

### Key Findings

Quiver has a **surprisingly rich data infrastructure** for a product at its stage -- 70+ database tables, 13 distinct event types flowing into `user_events`, dual-fire analytics (GA4 + internal), attribution capture, device enrichment, and bot filtering. The foundation is there. However, the data reveals a product in an extreme early-stage pattern: overwhelming reliance on 1-2 power users, near-zero social graph activity, and a conversion funnel that drops from 1,735 unique sessions to 12 CTA clicks to 0 tracked signups in a 30-day window.

**The #1 problem is not missing data -- it is that the data tells a story of a product that hasn't yet found its activation moment.** Only 7 of 42 real users (17%) have ever logged a surf session. Only 1 user accounts for 89% of all session logs. Social features (follows, likes, comments, shares) show literally zero usage. The signup funnel has a critical gap: auth_modal_opened, signup_started, and signup_success events show 0 in the internal `user_events` table despite signups occurring, suggesting these auth funnel events are firing to GA4 but failing to reach the internal database.

### Critical Gaps

1. **Broken auth funnel tracking**: auth_modal_opened (0), signup_started (0), and signup_success (0) in `user_events` despite 12+ signups in the tracking period. The dual-fire to `/api/events` is likely failing silently for pre-auth events.
2. **No server-side page view tracking**: 1,300+ weekly visitors per Vercel Analytics but only ~300/day in `user_events`. Most anonymous traffic is not captured because GA4/Vercel Analytics operate client-side and don't flow to the database.
3. **signup_context missing on 90% of users**: Only 6 of 44 non-mock profiles have `signup_context` populated (14%). This means attribution for the vast majority of signups is lost.
4. **Zero social graph**: 0 follows, 0 likes, 0 comments, 0 shares, 0 referrals. The social features exist in code and DB but have never been used.
5. **Conversion funnel RPC is broken**: `get_conversion_funnel()` function references a `bot_flagged` column that doesn't exist on `user_events`.

### Top 3 Recommendations

1. **Fix the auth funnel event pipeline** (P0, < 1 day): Auth events fire before the user is authenticated, but the anonymous flow requires a `sessionId`. Verify that `getVisitorId()` is available and passed correctly during auth modal interactions. This is the single highest-leverage analytics fix.

2. **Implement server-side visitor tracking** (P1, 2-3 days): Add middleware-level page view tracking that captures all requests (not just those from the JS-capable client). Use Vercel's `x-vercel-ip-*` headers or a lightweight fingerprinting approach to count unique visitors without requiring client-side JS.

3. **Build a single-page analytics dashboard** (P1, 3-5 days): Create an internal `/admin/analytics` page that queries `user_events` directly. Current state requires raw SQL to understand the business. A simple dashboard showing daily visitors, conversion funnel, feature usage, and cohort retention would transform decision-making speed.

---

## 2. Data Source Inventory

### 2.1 Database Tables (70 public tables)

#### User & Profile Data

| Table | Rows | Purpose | Data Quality | Signal Value |
|-------|------|---------|--------------|-------------|
| `profiles` | 68 (42 real, 24 mock, 2 system) | User accounts, preferences, signup context | Medium -- 90% missing signup_context | High |
| `user_events` | 16,604 | Behavioral event tracking, 13 event types | Good -- device enrichment on recent events | Critical |
| `user_devices` | 52 | Push notification device tokens | Good | Low |
| `user_xp` | 19 | Gamification XP totals | Good | Medium |
| `xp_events` | 185 | Individual XP earning events | Good | Medium |
| `user_badges` | 48 | Badge achievements | Good | Medium |
| `user_activities` | 59 | Activity feed entries | Good | Low |
| `user_beach_affinity` | 360 | Computed beach preferences per user | Good | High |
| `user_surf_preferences` | 1 | ML-learned surf preferences | Good but sparse | High |
| `user_implicit_preferences` | 0 | Aggregated behavioral preferences | Empty | High (potential) |
| `user_email_prefs` | 19 | Email notification preferences | Good | Low |
| `personalization_milestones` | 7 | Personalization progress | Good | Medium |

#### Content & Community

| Table | Rows | Purpose | Data Quality | Signal Value |
|-------|------|---------|--------------|-------------|
| `sessions` | 489 (127 active) | Surf session logs | Medium -- 362 deleted, low rating coverage | Critical |
| `intel_posts` | 2,786 | Community surf intel reports | Good -- mix of NPC (605) and real (2,181) | High |
| `beach_reviews` | 605 | Beach review ratings | Good -- all have content and dates | High |
| `boards` | 395 | User surfboard quiver | Good | Medium |
| `session_forecast_snapshots` | 410 | Forecast at time of session | Good | High |
| `session_media` | 0 | Session photos/videos | Empty | High (potential) |
| `session_shares` | 0 | Share tracking | Empty | Critical (missing) |
| `comments` | 0 | Session comments | Empty | Medium |
| `session_likes` | 0 | Session likes | Empty | Medium |
| `beach_review_likes` | 0 | Review likes | Empty | Medium |

#### Social Graph

| Table | Rows | Purpose | Data Quality | Signal Value |
|-------|------|---------|--------------|-------------|
| `user_follows` | 0 | Social following | Empty | Critical (missing) |
| `referrals` | 0 | Referral tracking | Empty | Critical (missing) |
| `session_invitations` | 1 | Session invite system | Near-empty | High (potential) |
| `favorite_beaches` | 3 | Beach favorites | Near-empty | Medium |
| `notifications` | 0 | In-app notifications | Empty | Medium |
| `saved_windows` | 0 | Saved surf windows | Empty | Medium |

#### Forecast & ML Pipeline

| Table | Rows | Purpose | Data Quality | Signal Value |
|-------|------|---------|--------------|-------------|
| `marine_forecasts` | 872,191 | Raw marine forecast data | Excellent -- all 279 beaches | Operational |
| `tide_forecasts` | 1,089,809 | Tide predictions | Excellent -- all 279 beaches | Operational |
| `enhanced_forecasts` | 42,129 | Enriched forecast with conditions | Good -- all 279 beaches | Operational |
| `corrected_forecasts` | 87,436 | ML-corrected wave heights | Good -- all 279 beaches | Operational |
| `beach_daily_intel` | 6,945 | Pre-computed daily surf intelligence | Good -- 73 beaches covered | Operational |
| `ml_predictions_log` | 28,030 | ML prediction audit trail | Excellent -- 242 beaches | High |
| `ml_model_registry` | 55 | Model version tracking | Good | High |
| `ioos_observations` | 22,962 | Ground truth wave observations | Good -- 90-day retention | High |
| `ioos_stations` | 196 | IOOS station metadata | Good | Operational |

#### Email & Communications

| Table | Rows | Purpose | Data Quality | Signal Value |
|-------|------|---------|--------------|-------------|
| `email_send_log` | 91 | Email delivery tracking | Good -- delivery, open, click, bounce tracked | High |
| `forecast_alert_deliveries` | 18 | Forecast alert tracking | Good | Medium |
| `embed_impressions` | 111 | Widget embed tracking | Good | Medium |
| `email_suppression_list` | 1 | Unsubscribe list | Good | Low |
| `posting_config` | 4 | Social posting configuration | Good | Low |
| `posting_log` | 1 | Social post tracking | Near-empty | Low |

#### Reference & Configuration

| Table | Rows | Purpose |
|-------|------|---------|
| `beaches` | 279 | Beach catalog with coordinates |
| `buoys` | 903 | NOAA buoy reference data |
| `beach_sources` | 104 | External source mappings per beach |
| `beach_editorial_content` | 250 | Curated beach descriptions |
| `city_editorial_content` | 3 | City landing page content |
| `badge_definitions` | 28 | Gamification badge catalog |
| `npc_content_templates` | 78 | AI content templates for NPC posts |
| `beach_photos` | 1,098 | Beach imagery from external sources |
| `ccc_access_locations` | 1,575 | California Coastal Commission data |
| `wq_monitoring_stations` | 5,318 | Water quality stations |
| `wq_samples` | 7,193 | Water quality samples |

### 2.2 External Analytics Tools

| Tool | Status | What It Tracks | Data Accessibility |
|------|--------|---------------|-------------------|
| **Vercel Web Analytics** | Active (`@vercel/analytics` v1.5.0) | Page views, unique visitors, top pages, referrers | Dashboard only (no API export to DB) |
| **Vercel Speed Insights** | Active (`@vercel/speed-insights` v1.3.1) | Core Web Vitals (LCP, FID, CLS) | Dashboard only |
| **Google Analytics 4** | Active (via gtag.js, lazy-loaded) | Page views with UTM attribution, custom events, conversion goals | GA4 dashboard, BigQuery export possible |
| **Sentry** | Active (`@sentry/nextjs` v10.27.0) | JavaScript errors, server errors, transactions, performance | Sentry dashboard, API available |
| **Ahrefs** | Active (analytics.js script, non-landing pages) | Backlinks, keyword rankings, site audit | Ahrefs dashboard |
| **Google Search Console** | Status unknown (no integration found in code) | Search impressions, clicks, CTR, position | Would need manual check |

### 2.3 Codebase Analytics Infrastructure

#### Core Tracking Module (`lib/analytics.ts`)
- Wraps `window.gtag()` for GA4 event firing
- Automatically merges UTM attribution from cookies
- Silent error swallowing to prevent UX disruption

#### Engagement Tracking (`lib/analytics/engagement-tracking.ts`)
- Dual-fires events to GA4 AND Vercel Analytics
- Tracks: `nearby_beach_click`, `best_conditions_click`, `partial_gate_viewed/signup`
- 6 tracked engagement events defined

#### Auth Events (`lib/analytics/auth-events.ts`)
- 15 auth-related tracking functions
- Dual-fires funnel events to both GA4 and `/api/events`
- Covers full auth lifecycle: modal open/close, provider selection, signup/login start/success/fail, magic link, redirect

#### Signup Conversion Tracking (`lib/analytics/signup-conversion-tracking.ts`)
- Session-level deduplication for `signup_cta_view` (via sessionStorage)
- Tracks: `signup_cta_view`, `signup_cta_click`, `signin_cta_click`
- Dual-fires to GA4 and `/api/events`

#### Attribution System (`lib/attribution.ts`)
- First-touch UTM attribution via cookies (90-day expiry)
- Captures: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landing_page`
- Server-side cookie parsing for middleware

#### Event API (`app/api/events/route.ts`)
- Accepts 50+ event types (see full list below)
- Bot filtering (user-agent, headless detection, fingerprint analysis)
- Per-user rate limiting (60/min authenticated, 30/min anonymous)
- Device enrichment via user-agent parsing
- Privacy gatekeeper (respects `allow_implicit_tracking` profile setting)
- Supports both authenticated and anonymous (via sessionId) events

#### 30 Components with Analytics Integration
Components actively importing from analytics modules include beach detail, forecast tab, home screen, share sheet, onboarding, landing page, signup CTAs, map, and profile views.

---

## 3. Signal Map (AARRR Framework)

### 3.1 Acquisition Signals

| Signal | Data Source | Current State | Quality |
|--------|-----------|---------------|---------|
| Total visitors/week | Vercel Analytics | ~1,300 (per project context) | Good but not in DB |
| SEO traffic sources | GA4 + attribution cookies | 2 signups from Google, 1 from DuckDuckGo | Sparse |
| Landing page performance | `user_events.page_view` | 6,423 events, 17 authenticated users | Partial -- most anon traffic uncaptured |
| UTM attribution | `profiles.signup_context` | 6 of 42 users have context (14%) | Poor |
| Device distribution (30d) | `user_events._device` | Windows 60%, Android 19%, macOS 16%, iOS 3% | Good for tracked events |
| Top entry beaches (30d) | `user_events.beach_view` | Blacks (2,633 views, 674 unique), Swami's (151, 148) | Good |
| Email acquisition | `email_send_log` | 17 welcome emails sent, 1 delivered, 0 opened | Concerning |
| Embed referrals | `embed_impressions` | 111 impressions total | Low volume |

### 3.2 Activation Signals

| Signal | Data Source | Current State | Quality |
|--------|-----------|---------------|---------|
| Onboarding completion | `profiles.onboarding_completed_at` | 20 of 42 real users (48%) | Good |
| First session logged | `sessions` | 7 of 42 users ever logged a session (17%) | Good |
| Home beach set | `profiles.home_beach_id` | 18 of 42 users (43%) | Good |
| Experience level set | `profiles.experience_level` | 13 of 42 users (31%) | Good |
| Display name set | `profiles.display_name` | 9 of 42 users (21%) | Good |
| Avatar uploaded | `profiles.avatar_url` | 13 of 42 users (31%) | Good |
| Board added | `boards` | 6 users have boards (14%) | Good |
| Onboarding step events | `user_events.onboarding_step` | 76 events from 8 users | Good |
| Time to first value | Not tracked | Unknown | Missing |

### 3.3 Engagement Signals

| Signal | Data Source | Current State | Quality |
|--------|-----------|---------------|---------|
| Daily active users (authed) | `user_events` (30d) | 0-8 per day, median ~2 | Good |
| Daily unique visitors (all) | `user_events` (30d) | 1-428 per day, recent spike from anon tracking | Good |
| Beach views/day | `user_events.beach_view` | ~100-500/day in recent week | Good |
| Forecast interactions | `user_events.forecast_interaction` | 245 total from 5 users (30d) | Good |
| Tab views | `user_events.tab_view` | 385 total from 2 users (30d) | Good |
| Map interactions | `user_events.map_interaction` | 117 total from 2 users (30d) | Good |
| Sessions logged/month | `sessions` | Jan: 38, Feb: 66, Mar: 20 (active, non-deleted) | Good |
| Session richness | `sessions` rating/quality | 6% rated, 16% have wave quality, 0% have descriptions | Poor |
| Intel posts created | `intel_posts` | 2,786 total (78% real user, 22% NPC) | Good |
| Review activity | `beach_reviews` | 605 reviews across 208 beaches | Good |
| Email engagement | `email_send_log` | 24% open rate (reengagement), 0% click rate (welcome) | Concerning |

### 3.4 Retention Signals

| Signal | Data Source | Current State | Quality |
|--------|-----------|---------------|---------|
| D1 retention | `user_events` + `profiles` | Sep-Dec cohorts: 0%, Jan: 27%, Feb: 27% | Available but thin |
| D7 retention | `user_events` + `profiles` | Sep-Dec cohorts: 0%, Jan: 27%, Feb: 18% | Available but thin |
| D30 retention | `user_events` + `profiles` | Sep-Dec cohorts: 0%, Jan: 27%, Feb: 0% (too early) | Available but thin |
| Weekly active users | `sessions` + `user_events` | ~1-3 authenticated users/week | Good |
| Session frequency per user | `sessions` | 1 user: 113 sessions, 1 user: 9 sessions, 5 users: 1 session | Extreme power-law |
| Re-engagement email effectiveness | `email_send_log` | 49 sent, 24% open rate, 2% click rate | Good |
| Churn prediction signals | Not computed | Not available | Missing |

### 3.5 Revenue/Growth Signals

| Signal | Data Source | Current State | Quality |
|--------|-----------|---------------|---------|
| Referral coefficient | `referrals` | 0 referrals, 0 viral coefficient | Empty |
| Share rate | `session_shares` | 0 shares ever recorded | Empty |
| Invite acceptance | `session_invitations` | 1 invitation ever sent | Near-empty |
| Content creation ratio | `sessions` + `intel_posts` | 7/42 users created content (17%) | Good |
| NPS/satisfaction | Not tracked | Not available | Missing |
| Signup conversion rate | `user_events` funnel | 1,735 sessions -> 949 CTA views -> 12 clicks -> 0 tracked completions | Critical gap |

---

## 4. Baseline Metrics Dashboard

### 4.1 User Base (as of 2026-03-13)

| Metric | Value | Trend |
|--------|-------|-------|
| Total real users | 42 | Flat (1 signup in March, 11/month in Jan-Feb) |
| Onboarding completion rate | 48% (20/42) | Improving (Jan 36%, Feb 73%) |
| Users who logged a session | 7 (17%) | Flat |
| Users with 3+ sessions | 2 (5%) | Flat |
| Weekly active users (authed) | 1-3 | Flat |
| Mock/NPC accounts | 24 | Static |

### 4.2 Signup Funnel (30-day window)

| Step | Unique Sessions | Drop-off |
|------|----------------|----------|
| Anonymous visitors (any event) | 1,735 | -- |
| CTA views (signup_cta_view) | 949 | 45% saw CTA |
| CTA clicks (signup_cta_click + signin_cta_click) | 12 | 1.3% of CTA viewers clicked |
| Auth modal opened | 0 (tracking gap) | Unknown |
| Signup started | 0 (tracking gap) | Unknown |
| Signup completed | 0 (tracking gap) | Unknown |

**Critical insight**: The funnel data shows a 98.7% drop between CTA view and CTA click. Either the CTAs are poorly converting, or many clicks are going to `/auth/sign-up` directly (bypassing tracked CTA clicks). The zero auth modal opens confirm a tracking gap, not zero signups.

### 4.3 Content & Engagement

| Metric | Value | Period |
|--------|-------|--------|
| Beach views/day (avg) | ~120 | Last 7 days |
| Unique beaches viewed/day | ~15-25 | Last 7 days |
| Most viewed beach | Blacks, San Diego (2,633 views, 674 unique visitors) | 30 days |
| Intel posts created | ~5-10/day | Ongoing (NPC + human) |
| Reviews | 605 total, 208 beaches covered (75% of 279) | All time |
| Sessions logged/month | 20-66 | Jan-Mar 2026 |
| Avg session duration | 63 minutes | All time |
| Avg session rating | 3.8/5 | All time (8 rated sessions) |

### 4.4 Email Performance

| Email Type | Sent | Delivered | Opened | Clicked | Open Rate | CTR |
|-----------|------|-----------|--------|---------|-----------|-----|
| Re-engagement | 49 | 29 | 12 | 1 | 41% (of delivered) | 3.4% (of delivered) |
| Welcome | 17 | 1 | 0 | 0 | 0% | 0% |
| First session nudge | 11 | 3 | 3 | 0 | 100% (of delivered) | 0% |
| Conditions alert | 10 | 0 | 0 | 0 | N/A | N/A |
| Weekly recap | 4 | 3 | 1 | 0 | 33% | 0% |

**Critical insight**: Welcome email delivery is catastrophically broken. 17 sent, 1 delivered, 0 opened. This means new users receive no post-signup touchpoint. The re-engagement emails show better delivery (59%) and decent open rates (41% of delivered), suggesting the underlying email infrastructure works but the welcome flow has a delivery issue.

### 4.5 ML Pipeline Health

| Metric | Value |
|--------|-------|
| Total predictions logged | 28,107 |
| Predictions with ground truth match | 27,771 (98.8%) |
| Predictions with error evaluation | 11,503 (41%) |
| Average absolute corrected error | 0.580m |
| Average absolute raw error | 0.718m |
| ML improvement vs raw | 19.2% error reduction |
| Beaches with predictions | 242 of 279 (87%) |
| Model versions deployed | 4 |
| Predictions in last 24h | 414 |
| Predictions in last 7d | 2,815 |

---

## 5. Data Quality Scorecard

### 5.1 Per-Table Quality Assessment

| Data Source | Completeness | Accuracy | Timeliness | Consistency | Coverage | Score |
|-------------|-------------|----------|-----------|-------------|----------|-------|
| `user_events` | 70% | 85% | 95% | 80% | 60% | **C+** |
| `profiles` | 45% | 90% | 80% | 85% | 95% | **C** |
| `sessions` | 55% | 85% | 90% | 75% | 100% | **C+** |
| `email_send_log` | 90% | 95% | 95% | 95% | 90% | **A-** |
| `ml_predictions_log` | 85% | 90% | 95% | 90% | 87% | **A-** |
| `intel_posts` | 80% | 80% | 95% | 85% | 85% | **B+** |
| `beach_reviews` | 95% | 85% | 90% | 90% | 75% | **A-** |
| `marine_forecasts` | 95% | 90% | 98% | 95% | 100% | **A** |
| `tide_forecasts` | 95% | 90% | 98% | 95% | 100% | **A** |
| Social tables (follows, likes, etc.) | 0% | N/A | N/A | N/A | 0% | **F** |

### 5.2 Specific Quality Issues

#### profiles -- Completeness: 45%

| Field | % Populated (real users) | Impact |
|-------|------------------------|--------|
| `signup_context` | 14% (6/42) | Cannot attribute 86% of signups |
| `display_name` | 21% (9/42) | Incomplete profile data |
| `experience_level` | 31% (13/42) | Cannot segment by experience |
| `home_beach_id` | 43% (18/42) | Cannot personalize for 57% |
| `bio` | 5% (2/42) | Near-zero profile richness |
| `home_region` | 0% (0/42) | Never populated |
| `preferred_session_time` | Unknown | Recently added field |
| `referral_code` | 19% (8/42) | 81% cannot refer friends |

#### user_events -- Coverage Gaps

- **Auth funnel events are broken**: `auth_modal_opened` (0), `signup_started` (0), `signup_success` (0) despite signups occurring. The dual-fire mechanism fails for pre-auth events.
- **Device enrichment inconsistent**: `page_view` has `_device` on 48% of events (3,093/6,423). `beach_view` has it on 40% (1,710/4,318). Earlier events lack enrichment because it was added later.
- **Anonymous tracking only started ~Mar 3**: `session_id` column was added in migration `20260301130001`. Before that, all anonymous events were lost. This explains the sharp increase in unique_visitors from 2-8/day to 100-400+/day.
- **signup_cta_view over-firing fixed**: After dedup fix on Mar 12, volume dropped but 4,928 events in 5 days from 949 unique sessions still seems high.

#### sessions -- Richness: 55%

| Field | % Populated (active sessions) |
|-------|-------------------------------|
| `rating` | 6% (8/127) |
| `description` | 0% (0/127) |
| `image_url` | 0% (0/127) |
| `wave_quality` | 16% (20/127) |
| `board_id` | 13% (16/127) |
| `crowd_level` | Not checked |
| `forecast_accuracy` | Not checked |
| `skill_ratings` | Not checked |

#### get_conversion_funnel() RPC -- Broken

The database function `get_conversion_funnel()` references a `bot_flagged` column on `user_events` that does not exist. This function cannot be called until fixed.

### 5.3 Data Gaps Timeline

| Date | Event | Impact |
|------|-------|--------|
| 2025-09-02 | First real signup | No event tracking existed yet |
| 2026-01-27 | First `signup_context` capture | 36 users signed up without attribution |
| 2026-02-02 | First `user_events` record | All prior behavioral data lost |
| 2026-02-12 | First `page_view` event | Behavioral tracking begins |
| 2026-03-01 | Anonymous session tracking added | Anonymous visitor data begins flowing |
| 2026-03-09 | First `signup_cta_view` events | CTA funnel tracking begins |
| 2026-03-12 | CTA dedup fix deployed | Event inflation addressed |

---

## 6. Recommendations (Prioritized)

### P0 -- Critical Fixes (This Week)

#### 6.1 Fix Auth Funnel Event Pipeline

**Problem**: `auth_modal_opened`, `signup_started`, `signup_success` all show 0 events in `user_events` despite signups occurring. The `fireToUserEvents()` function in `auth-events.ts` sends to `/api/events`, which requires either an auth cookie or a `sessionId`. Pre-auth events fire when the user is not authenticated and may not have a `sessionId` if `getVisitorId()` hasn't been initialized.

**Fix**: Ensure `getVisitorId()` is called and available before any auth modal interaction. Verify the `/api/events` anonymous flow accepts these events (they are in `ANONYMOUS_ALLOWED_EVENTS`). Add console logging in development to trace the full event lifecycle.

**Impact**: Without this fix, the entire signup funnel is invisible in the internal database. You can only see it in GA4.

#### 6.2 Fix Welcome Email Delivery

**Problem**: 17 welcome emails sent, 1 delivered. This is a 94% delivery failure rate.

**Fix**: Check the email sending service (likely Resend) for bounce/rejection logs. Verify sender domain DNS (SPF, DKIM, DMARC). Check if welcome emails are being caught by spam filters.

**Impact**: New users have no touchpoint after signup, contributing to the 83% never-return rate.

#### 6.3 Fix get_conversion_funnel() RPC

**Problem**: References non-existent `bot_flagged` column.

**Fix**: Remove the `bot_flagged` filter from the function, or add the column to `user_events` if bot tagging is desired.

### P1 -- High Priority (Next 2 Weeks)

#### 6.4 Implement First-Value-Action Tracking

**Problem**: No tracking of when a user first experiences value (checks forecast, views conditions for their home beach, logs first session).

**Fix**: Add a `first_value_at` timestamp to `profiles` that is set the first time a user: (a) views forecast for their home beach, (b) logs a surf session, or (c) receives a surf alert. Track time-to-first-value as the key activation metric.

#### 6.5 Build Internal Analytics Dashboard

**Problem**: All analytics require raw SQL queries. No one can see how the product is performing without database access.

**Fix**: Create `/admin/analytics` with:
- Daily/weekly/monthly visitor counts (from `user_events`)
- Signup funnel visualization (CTA view -> click -> modal -> signup -> onboarding)
- Feature usage heatmap (which events are firing, how many)
- Cohort retention grid (signup month vs. activity month)
- Email delivery metrics
- Top beaches by visitor count

#### 6.6 Backfill signup_context for OAuth Users

**Problem**: OAuth signups (Google, Apple) were silently dropping device/UTM metadata. Per project context, this was "just fixed."

**Fix**: Verify the fix is working for new signups. Consider adding a lightweight migration to set `signup_context` to `{ method: 'unknown', note: 'pre-tracking' }` for the 36 users without it, so queries don't need to handle NULL.

#### 6.7 Add Server-Side Page View Counter

**Problem**: `user_events.page_view` only captures ~20% of actual traffic because it requires client-side JavaScript execution.

**Fix**: Add a lightweight counter in Next.js middleware that increments a daily counter per path. This doesn't need to be per-user -- just total request counts by path, day, and referrer. Store in a new `page_view_counts` table. This would provide the "1,300 visitors/week" baseline that currently only exists in Vercel Analytics.

### P2 -- Medium Priority (Next Month)

#### 6.8 Implement Retention Cohort Computation

Create a scheduled function that computes D1/D7/D30/D90 retention for each signup cohort and writes to a `cohort_metrics` table. Currently this requires a complex CTE query each time.

#### 6.9 Add Feature Discovery Tracking

Currently tracked events don't capture many key product moments:
- Viewing the 7-day forecast chart
- Tapping into tide details
- Using the "Best Times to Surf" feature
- Viewing surf call/recommendation
- Interacting with water quality data

These are all potential activation triggers that should be measured.

#### 6.10 Implement Engagement Scoring

Create a computed `engagement_score` per user based on:
- Recency of last visit
- Frequency of visits in last 30 days
- Depth of engagement (number of distinct event types used)
- Content creation (sessions logged, intel posted)

This enables automated cohort segmentation and targeted re-engagement.

#### 6.11 Google Search Console Integration

No evidence of GSC data flowing into the codebase. Given that SEO is the primary traffic driver (1,300+ visitors/week from search), understanding keyword rankings, CTR, and impressions by page would be high-value. Consider using the GSC API to pull daily metrics into a database table.

### P3 -- Strategic (Next Quarter)

#### 6.12 Unified Analytics Data Warehouse

Currently data lives in three disconnected silos:
1. Vercel Analytics (page views, visitors)
2. GA4 (events, attribution, conversion goals)
3. Supabase `user_events` (behavioral events)

Long-term, consider a nightly ETL that pulls Vercel and GA4 data into Supabase (or a separate analytics DB), enabling cross-source queries.

#### 6.13 Predictive Churn Model

With 42 users, this is premature. But when the user base reaches 200+, build a churn prediction model using:
- Days since last visit
- Session frequency trend
- Feature breadth (number of distinct event types)
- Email engagement (opens, clicks)

#### 6.14 A/B Testing Infrastructure

No A/B testing infrastructure exists. When ready:
- Add a `experiments` table with variant assignments
- Implement assignment in middleware (cookie-based)
- Add `experiment_variant` to event metadata
- Build statistical significance calculator for experiment analysis

---

## 7. Appendix: Raw Query Results

### A. Event Type Distribution (All Time)

| Event Type | Count | Unique Users | Anonymous | Last 7d | Last 30d |
|-----------|-------|-------------|-----------|---------|----------|
| page_view | 6,423 | 17 | 1,771 | 2,381 | 6,290 |
| signup_cta_view | 4,928 | 2 | 4,449 | 4,928 | 4,928 |
| beach_view | 4,318 | 8 | 1,010 | 1,258 | 3,660 |
| tab_view | 385 | 2 | 184 | 296 | 385 |
| forecast_interaction | 245 | 5 | 3 | 75 | 245 |
| map_interaction | 117 | 2 | 72 | 113 | 117 |
| onboarding_step | 76 | 8 | 0 | 43 | 76 |
| review_form_open | 48 | 4 | 0 | 0 | 48 |
| cta_click | 44 | 3 | 0 | 0 | 44 |
| signup_cta_click | 8 | 0 | 8 | 8 | 8 |
| review_validation_error | 6 | 1 | 0 | 0 | 6 |
| review_form_abandon | 4 | 1 | 0 | 0 | 4 |
| signin_cta_click | 2 | 1 | 0 | 2 | 2 |

### B. Signup Cohort Retention

| Cohort | Size | D1 | D7 | D30 | Logged Session | Power Users (3+) |
|--------|------|----|----|-----|---------------|-----------------|
| Sep 2025 | 2 | 0% | 0% | 0% | 0% | 0% |
| Oct 2025 | 5 | 0% | 0% | 0% | 60% | 0% |
| Nov 2025 | 2 | 0% | 0% | 0% | 0% | 0% |
| Dec 2025 | 10 | 10% | 10% | 10% | 0% | 0% |
| Jan 2026 | 11 | 27% | 27% | 27% | 27% | 18% |
| Feb 2026 | 11 | 27% | 18% | N/A | 9% | 0% |
| Mar 2026 | 1 | 0% | N/A | N/A | 0% | 0% |

### C. Session Activity by Month (Active Only)

| Month | Sessions | Unique Users | Public Sessions | Avg Duration (min) |
|-------|----------|-------------|----------------|-------------------|
| Oct 2025 | 3 | 3 | 3 | 60 |
| Jan 2026 | 38 | 2 | 38 | 64 |
| Feb 2026 | 66 | 3 | 66 | 63 |
| Mar 2026 | 20 | 2 | 20 | 60 |

### D. Top 10 Beaches by Views (30d)

| Beach | City | State | Views | Unique Visitors |
|-------|------|-------|-------|----------------|
| Blacks | San Diego | CA | 2,633 | 674 |
| Swami's | Encinitas | CA | 151 | 148 |
| Ocean Beach Pier | San Diego | CA | 94 | 4 |
| Ocean Beach | San Diego | CA | 82 | 6 |
| Mission Beach (Central) | San Diego | CA | 64 | 2 |
| Sunset Cliffs North | San Diego | CA | 59 | 2 |
| Doheny State Beach | Dana Point | CA | 50 | 18 |
| Marine Street Beach | San Diego | CA | 41 | 2 |
| PB Point | San Diego | CA | 39 | 3 |
| Avalanche | San Diego | CA | 35 | 4 |

### E. Social Feature Usage (All Time)

| Feature | Total Records | Unique Users |
|---------|--------------|-------------|
| User follows | 0 | 0 |
| Session likes | 0 | 0 |
| Comments | 0 | 0 |
| Session shares | 0 | 0 |
| Referrals | 0 | 0 |
| Beach review likes | 0 | 0 |
| Forecast accuracy votes | 0 | 0 |
| Notifications | 0 | 0 |
| Session invitations | 1 | 1 |
| Favorite beaches | 3 | 1 |
| Saved windows | 0 | 0 |

### F. Device Distribution (30d from user_events)

| OS | Event Count | Unique Visitors | % of Visitors |
|----|-------------|----------------|---------------|
| Windows | 6,313 | 837 | 49% |
| Android | 1,950 | 716 | 42% |
| macOS | 1,670 | 38 | 2% |
| iOS | 324 | 71 | 4% |
| Linux | 80 | 23 | 1% |
| Unknown | 80 | 20 | 1% |

**Note**: Windows + Android dominance is unusual for a surf app and may indicate significant bot traffic that passes the current filters, or the app's SEO is attracting non-surfer audiences. The low iOS share (4% of unique visitors) is atypical for a surf demographic and worth investigating.

### G. Registered Event Types in API (50+ events)

The `/api/events` route accepts the following event types, organized by category:

**Implicit preference learning**: beach_view, discovery_click, discovery_skip, forecast_check, location_update
**Engagement**: page_view, forecast_interaction, session_action, profile_update, onboarding_step, cta_click
**Review lifecycle**: review_form_open, review_form_abandon, review_validation_error, review_submit
**Sharing**: share_started, share_completed, share_link_copied, share_image_saved, cam_share, share_intel_button_clicked, share_intel_signin_prompt, surf_plan_share
**Conversion**: signup_cta_click, signup_cta_view, signin_cta_click
**Auth funnel**: auth_modal_opened, auth_modal_closed_without_action, auth_method_selected, auth_provider_selected, signup_started, signup_success, login_success, signup_form_submitted
**Home screen**: home_at_beach_click, home_plan_weekend_click, home_plan_weekend_no_recommendation
**Session logging**: session_log_start, session_log_submit, session_share_opened_post_save, session_share_closed_post_save
**Product tour**: product_tour_started, product_tour_completed, product_tour_skipped, product_tour_step_viewed
**Beach detail**: beach_search, forecast_tab_click, horizon_strip_day_selected, match_score_teaser_click, match_score_teaser_view, set_home_beach, map_marker_click
**Intel**: local_intel_tab_viewed, intel_post_created, intel_post_confirmed, plan_session_from_intel
**Profile**: surf_profile_viewed, surf_profile_progress_shown
**Discovery**: personalized_score_shown, favorite_shown_in_carousel, mini_log_teaser_click, plan_unlock_click
**Social**: social_follow, social_like, social_invite_send, social_invite_respond, social_intel_confirm
**Engagement depth**: tab_view, map_interaction

Of these 50+ registered event types, only **13 have ever fired** in production. 37+ event types are defined but have zero data, representing either unshipped features or features with missing instrumentation.

---

## Summary of Data Health

| Category | Grade | Reasoning |
|----------|-------|-----------|
| Forecast & ML Pipeline | **A** | Robust, accurate, well-monitored. 2M+ forecast rows, ML improving raw error by 19%. |
| Event Tracking Infrastructure | **B-** | Good foundation (50+ event types, dual-fire, bot filtering) but broken auth funnel and inconsistent coverage. |
| User Profile Data | **C-** | 90% missing signup attribution. Low profile completeness across most fields. |
| Social/Growth Data | **F** | Zero usage across all social features. No referrals, no shares, no follows. |
| Email Analytics | **C** | Tracking exists but welcome delivery is broken. Re-engagement shows promise. |
| Conversion Funnel | **D** | Infrastructure exists but critical tracking gap in auth events. Cannot measure true conversion rate from internal data. |
| Content Data | **B+** | Good review and intel coverage. Session richness is low. |
| Operational Data | **A** | Beach catalog, forecast pipelines, observation stations all healthy and well-maintained. |

**Overall Data Landscape Grade: C+**

The infrastructure is ambitious and well-architected for a product at this stage. The primary issue is not the architecture but the execution gaps: broken tracking at the most critical funnel step (signup), missing attribution on most users, and zero social signal generation. Fixing the P0 items above would immediately upgrade the data quality from C+ to B+.
