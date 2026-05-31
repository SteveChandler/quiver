# Retired Document

Status: Retired
Reason: March 2026 Q2 PMF roadmap is historical context, not the current operating plan.
Retired on: 2026-05-31
Replacement: [Current Planning Roadmap](../../../.planning/ROADMAP.md)

# Quiver: Path to Product-Market Fit (Q2 2026)

**Date**: March 13, 2026
**Status**: Strategic Assessment + 90-Day Roadmap
**Audience**: Product team, Engineering leadership
**Goal**: Move from 0 WASL (Weekly Active Session Loggers) to sustainable growth loop

---

## Executive Summary

Quiver has built an impressive infrastructure (279 beaches, 90.4% ML accuracy, 50+ event types, dual-fire analytics) but has shipped features without user adoption. The product has **inverted the funnel**:

- **1,300 weekly visitors** → **21 signups in 90 days** (1.6% conversion)
- **12 completed onboarding** (57% of signups) → **2 logged a session** (9.5% of signups)
- **0 active session loggers in past 7 days** (WASL = 0)
- **0 follows, 0 likes, 0 comments, 0 shares** (all social features unused)

The core problem is not the forecast data or gamification system—it's **activation friction**. Users don't log sessions because:

1. **Signup funnel is broken** (0.2% CTA click rate, best-converting CTA was deleted)
2. **No clear path to first session** (users onboard but don't know what to do next)
3. **Session logging feels like work** (form is 5+ steps; no in-app reason to log)
4. **No social proof or community pressure** (solo experience; 1 active user = isolation)

This document proposes a **90-day sprint to PMF** focused on three obsessions:

1. **Fix the broken funnel** (restore signup flow, drop friction to <3 CTA clicks)
2. **Trigger first session logging** (add contextual prompts, one-tap options, social proof)
3. **Activate the social loop** (make sharing & following frictionless, add feed visibility)

---

## Part 1: Current State Assessment

### What's Been Built

#### Infrastructure (Grade: A)

- **Forecast Engine**: 279 beaches, 903 IOOS/CDIP/NDBC buoys, ML models achieving 90.4% match rate with IOOS observations
- **Forecast Data**: 872K marine forecast rows, 1M+ tide rows, 42K enhanced forecasts
- **Analytics**: GA4 + internal `user_events` table, 50+ event types defined, bot filtering in place, attribution cookies
- **Gamification**: 28 badge types, 185 XP events tracked, 9 level tiers
- **Infrastructure for Social**: `user_follows`, `session_invitations`, `session_likes`, `comments` tables all exist but have 0 usage
- **Mobile**: Capacitor wrapper in App Store, push notifications system, Firebase Cloud Messaging
- **Email**: Welcome, re-engagement, forecast alerts, weekly recap ~~(but weak context/CTAs)~~ — **delivery fixed 2026-03-14** (SPF/DKIM/DMARC configured in Resend)

#### Features Built But Unused (Grade: F)

| Feature | Built | Deployed | Usage | Health |
|---------|-------|----------|-------|--------|
| Session social sharing | Yes | Yes | 0% | Wired but untested at scale |
| User follows | Yes | Yes | 0 follows ever | UI not discoverable |
| Session invitations | Yes | Yes | 1 sent ever | Friction too high (3+ taps) |
| Session likes/comments | Yes | Yes | 0 ever | No feed to display them on |
| Favorite beaches | Yes | Yes | 3 total (1 user) | No usage signal |
| Saved windows | Yes | Yes | 0 total | Not promoted |
| Photo upload | Yes | Yes | 0 photos ever | Form friction + no gallery view |
| Push notifications | Yes | Partial | Not tracked | No adoption metrics |
| XP/badges | Yes | Yes | 11 of 20 users earned XP | Gamification resonates but low usage base |

#### Features With Weak Usage

| Feature | Volume | Notes |
|---------|--------|-------|
| Sessions logged | 127 active | 89% from 1 user; 2 total from real users |
| Intel posts | 2,786 total | 78% NPC-generated; 22% user-created (~620 posts) |
| Beach reviews | 605 total | Across 208 beaches; low engagement |
| Onboarding completion | 48% | Below 70% target; drop-off after beach selection |
| Web app installs | ~50 | From 1,300 weekly visitors; no retention |
| Mobile app downloads | <10 | App Store presence but near-zero traction |

### The Funnel: Complete Picture

```
Weekly SEO Traffic: 1,300 visitors
  ↓ (sign-up CTA click rate: 0.2%)
Signup Clicks: 9 clicks (7 signup, 2 signin)
  ↓ (modal submission rate: ~0%)
Completed Signups: 21 in 90 days (~1.6% conversion from visitors)
  ↓ (onboarding completion: 57%)
Onboarding Complete: 12 users
  ↓ (first session logging: 9.5%)
First Session Logged: 2 users (1 is the founder; 1 is real)
  ↓ (return behavior: 4.8% of signups)
Second Session: 1 user
  ↓ (social actions: 0%)
Any Social Action: 0 users
```

**Critical Findings**:
- The worst conversion gap is **signup → first session (90.5% drop-off)**
- Even users who complete onboarding (12 users) don't log sessions
- The app has been live for months but has 0 active session loggers (WASL = 0)
- 49% of traffic is bot/Windows machines (real surfer traffic ~650/week)

### Root Causes: The Broken Funnel

#### 1. Signup CTA Performance is Terrible (0.2% click rate)

From the Mar 12 funnel audit:

| CTA Source | Views | Clicks | Click Rate | Status |
|------------|-------|--------|-----------|--------|
| `cam-hero` | 2,201 | 2 | 0.09% | Active (fires 27x/session) |
| `beach-detail-blacks` | 731 | 0 | 0% | Active |
| `overview-inline` | 584 | 0 | 0% | Deleted Mar 10 |
| **`surf-call-conditions`** | **252** | **6** | **2.4%** | **DELETED Mar 11** (best converter!) |
| `personalized-forecast-teaser` | 168 | 0 | 0% | Active |
| `best-window-gate` | 133 | 0 | 0% | Active |

**The best-converting CTA (2.4% click rate) was deleted March 11.** This alone explains why signups dropped to zero in the week of Mar 12.

#### 2. Auth Funnel is Instrumented But Not Wired

- `auth_modal_opened` event fires to GA4 but **zero events in the internal `user_events` table**
- Email confirmation redirect is hardcoded (`/?signup=confirm-email`) instead of preserving context
- ~~Apple auth is broken (client secret JWT never configured)~~ **FIXED 2026-03-14** — client_id was App ID instead of Services ID; secret was hex not JWT. Both corrected via Management API.
- No tracking for `signup_started`, `signup_failed`, `auth_provider_selected`

#### 3. Session Logging Has 5+ Steps + No Motivation

Users who sign up have no context for why they should log a session:

1. Navigate to "Log Session" or "New Session"
2. Select date (defaults to today; confusing)
3. Select time (two separate inputs for start/end)
4. Select beach (long list if home beach not set)
5. Add conditions (wave height, vibe, optional notes)
6. Add board/equipment (optional but presented as form step)
7. Confirm and submit

By step 3-4, users abandon because:
- No in-app motivation ("Why log this?")
- No social context ("Who will see this?")
- No community pressure ("Others are logging sessions")
- No quick-capture option (not optimized for mid-session logging)

#### 4. Social Features Are Built But Not Discoverable

Example: User logs a session. Current behavior:
- Session is created ✓
- User can manually tap "share" to open OS share sheet ✓
- But there's **no post-session share prompt**
- No feed to display the shared session
- No way to see friends' sessions
- No notification when someone likes/follows

#### 5. Onboarding Doesn't Set Up for Activation

Current onboarding flow:
1. Email verification (kills momentum)
2. Beach selection (single beach)
3. Skill level (no context)
4. Preference questions (optional, low engagement)

**Missing**:
- Guidance on what to do next (where's the forecast?)
- Social context (who else surfs your beach?)
- Motivation for first session (how many logged sessions this week?)
- Time context (when should you paddle out?)

---

## Part 2: PMF Hypothesis

### Falsifiable Hypothesis

**If Quiver enables beginner surfers to confidently decide whether to paddle out (via accurate, personalized forecasts) + log their sessions (via frictionless capture) + see their progression (via gamification) + connect with their local crew (via social discovery), then we can sustain >15% D7 retention and >20% share rate, achieving product-market fit in the beginner surfer segment.**

**How we'll test**:
- 30-day metrics: Restore signup flow → measure 2-3% signups → 20%+ onboarding completion
- 60-day metrics: Launch contextual session logging → measure 15%+ first-session rate → 30%+ logging repeat rate
- 90-day metrics: Activate social loop → measure 5%+ social action rate → 10%+ share rate

### Why Beginners

**Target**: Beginner surfers, 18-35, tech-savvy, picking up surfing as a new sport.

**Why this segment**:
- **Seasonal volatility** drives forecast checking (beginners avoid cold/rough conditions)
- **Progression-driven** (high motivation to track "am I getting better?")
- **High social sharing** (excited to show friends they're learning)
- **Gamification-responsive** (habituated to fitness app XP/badge systems)
- **Underserved** (Surfline targets experienced surfers; free alternatives are generalist forecasts)

**TAM in US**: ~2-3M beginner-intermediate surfers; Quiver targeting top 100K most tech-forward.

---

## Part 3: Define "Activation"

### The Metric That Matters Most

**Weekly Active Session Loggers (WASL)**: Users who logged at least one session in the past 7 days.

**Why this metric**:
- Session logging is the core behavior that makes Quiver valuable (engagement + data for ML + social sharing)
- Beginner surfers average 1-2 sessions/week in season, so 15 WASL = healthy core of active users
- WASL drives all downstream metrics (retention, social sharing, referrals)
- Directly tied to business model (premium features, ads, sponsorships)

**Current state**: WASL = 0 (no real user logged a session in past 7 days)
**Target for 30 days**: WASL = 3-5 (weekly loggers emerging)
**Target for 60 days**: WASL = 8-12 (core habit forming)
**Target for 90 days**: WASL = 15+ (sustainable engagement)

### Secondary Activation Metric

**First-Session Rate**: % of signups who log at least one session within 14 days.

**Current state**: 9.5% (2 of 21 signups)
**Target for 30 days**: 20% (first session within 7 days)
**Target for 60 days**: 35% (first session within 5 days)
**Target for 90 days**: 50% (industry benchmark for content/activity apps)

**Why both metrics**:
- WASL measures active user base (sticky engagement)
- First-Session Rate measures conversion efficiency (how well funnel works)

---

## Part 4: MVP Scope (Zero-Based)

### If Starting Over: Minimum Feature Set to Test PMF

If we had 2 weeks and a blank slate, here's what we'd ship:

#### Week 1: Core Forecast + Signup

1. **Forecast Detail Page** (beach → wave height, wind, tide, best window)
   - Live now but needs signup CTA optimization
2. **Signup Flow** (Google One Tap + email)
   - Fix: Restore best-converting CTA copy ("See today's surf call")
   - Fix: Email confirmation redirect preserves context
   - Fix: Auth funnel instrumentation (track modal opens, provider selection)
3. **Home Beach Selection** (post-signup, geo-based or manual search)
   - Currently in onboarding; should be prerequisite for forecast personalization

#### Week 2: Session Logging + Social Proof

4. **One-Tap Session Logging** (post-session share prompt)
   - Star rating (how was it?)
   - Wave size emoji (1-2ft through 5+ft)
   - Vibe emoji (Firing/Fun/Meh/Rough)
   - Optional note
   - Straight to share sheet (not a form)
5. **Social Proof Feed** (home page shows local activity)
   - Last 24h sessions from home beach + nearby
   - Name, time ago, vibe emoji, optional photo
   - No comments/likes yet; just visibility
6. **Share Integration** (post-session: "Share Your Vibe")
   - Native OS share sheet (already wired)
   - Pre-filled caption with beach name + time window
   - Click-to-share shouldn't require >1 tap

#### What We'd NOT Ship (Even Though Built):

- User follows (too complex for MVP; just show activity)
- Comments/likes (premature; no engagement base yet)
- Referrals (cool but doesn't drive core adoption)
- Gamification (nice-to-have; distracts from activation)
- Detailed onboarding (kill it; straight to forecast + beach selection)
- Photo uploads (add after first 50 active users)
- Notifications (enable but don't prompt; low signal at this stage)
- Personalized email (generic digest is fine)

**Total scope**: 3 full-stack features (signup fix, session logging, feed), all <2 week sprint.

**Why this works**:
- Every session logged is a potential share (viral channel)
- Feed creates FOMO/social proof (motivates non-users)
- Forecast is the trust anchor (no need for more features)
- Friction is 2 taps post-session (rate + share)

---

## Part 5: 90-Day Roadmap

### Week-by-Week Execution

#### MONTH 1: Fix the Broken Funnel (Mar 18 - Apr 14)

**Goal**: Restore signup flow to 1-2% conversion; get to 3-5 signups/week.

**Week 1 (Mar 18-22): Auth Funnel Restoration**
- Restore `surf-call-conditions` PublicContentGate (best-converting CTA, 2.4% click rate)
  - Restore conditions detail gated behind "See today's surf call for [Beach]"
  - Copy: "Know what you're surfing before you paddle out"
- Fix `cam-hero` double-firing IntersectionObserver bug (27x inflation)
  - Module-level dedup Set tracks `(source, pageLoadId)` pair
  - Verify: cam-hero should fire ≤1x per page session
- Fix email confirmation redirect (preserve return context)
  - Capture `?returnTo=` in signup flow; store in `localStorage`
  - Email confirmation redirect: `/?returnTo=/ca/san-diego/blacks` instead of hardcoded `/`
- ~~Wire Apple Sign-In client secret~~ **DONE 2026-03-14** — Fixed via Management API (wrong client_id + wrong secret format)
- **Ship**: "Signup Funnel Fix" branch with all 4 changes; A/B test old vs new CTA copy

**Week 2 (Mar 25-29): Auth Instrumentation + Metrics**
- Wire auth funnel events to `user_events` table
  - `auth_modal_opened`: Track when modal first appears (not per keystroke)
  - `auth_provider_selected`: Google, Apple, Email (not supabase internal)
  - `signup_started`: Form submission initiated
  - `signup_error`: Capture error codes (email taken, invalid email, etc.)
  - `signup_success`: Signup record created
  - `email_confirmation_sent`: After signup, before return
  - `email_confirmed`: Email link clicked, account activated
- Add bot filtering to `/api/events` endpoint
  - Expanded checks: empty User-Agent, Accept-Language patterns, headless patterns
  - Test against known bot traffic (Windows+Chrome+1280px fingerprint)
- Deploy growth metrics dashboard to internal `/dashboard/growth`
  - WASL, WAU, D7 retention, signup conversion by source
  - Real-time funnel: visitors → CTA clicks → auth opens → signups → onboarded → first session
- **Ship**: "Auth Instrumentation" PR with dual GA4 + internal DB events
- **Verify**: Measure CTA click rate, auth modal open rate, signup completion rate

**Week 3 (Apr 1-5): CTA Copy Optimization + GSC Fixes**
- Optimize CTA copy across 4 high-traffic pages
  - Landing page hero: "Forecast 279 beaches instantly" → "Know your conditions before you paddle out"
  - Beach detail gate: "How well does this spot match you?" → "See the full 7-day forecast for [Beach]"
  - Forecast tab teaser: "Get your personalized forecast" → "See your best window today"
  - Map sidebar (after 3rd beach): "Get alerts for [Beach]" → "Plan your session now"
- Fix Google Search Console CTR crisis (41 pages, 0 clicks despite 100+ impressions)
  - Tide pages: reframe titles from "Tide Chart & Surf Windows" to "Best Tide to Surf {Beach}" (beats Google Knowledge Panel)
  - Water temp: reframe to "What Wetsuit for {Beach}?" (gear-intent)
  - Remove " | Quiver" duplicate branding from title tags
  - Test titles in Google Search Console preview tool
- **Ship**: "CTA Copy + GSC Titles" PR
- **Measure**: CTR impact on GSC dashboard (should see +20% clicks if copy changes are good)

**Week 4 (Apr 8-14): Onboarding Simplification**
- Simplify onboarding to 2 mandatory steps (down from 5)
  - Step 1: Home beach selection (geo-based default, or search; this is THE decision)
  - Step 2: Skill level (radio buttons: Beginner / Intermediate / Advanced)
  - Remove: email verification timing issue (send after onboarding starts, not before)
  - Remove: preference questions (low signal; add to settings later)
- Add post-onboarding context: "Here's what your crew has been surfing"
  - Show last 7 days of local sessions (home beach + 10 miles)
  - Names, times, conditions (wave size + vibe emoji)
  - Creates social proof: "Others are logging sessions here"
- First-time user deep link: onboarding → forecast page → session planner
  - Breadcrumb: "Your forecast → [date/time] → Let's plan your session → Log it after"
  - Don't gate forecast behind more auth
- **Ship**: "Onboarding Simplification + Local Activity Context"
- **Target**: 70% onboarding completion (up from 50%)
- **Measure**: Drop-off rate by step; time-to-completion

**Month 1 Success Criteria**:
- ✓ Signup conversion rate: 1-2% of unique visitors (up from 0.2% CTA click rate)
- ✓ Weekly signups: 3-5 real users (vs. 0-2 currently)
- ✓ Onboarding completion: 70%+ (up from 50%)
- ✓ Auth funnel instrumentation: All events firing to both GA4 + internal DB
- ✓ CTA metrics: Identify best-performing copy variation

---

#### MONTH 2: Trigger First Session Logging (Apr 15 - May 12)

**Goal**: Get 20%+ of onboarded users to log their first session (up from 9.5%).

**Week 5 (Apr 15-19): Post-Session Capture Flow**
- Ship "One-Tap Session Logging" feature
  - Contextual trigger: After user navigates away from beach page or manual "I surfed" tap
  - Modal (not full-page): Star rating (1-5), Wave size emoji (1-2 / 3-4 / 5-6 / 6+), Vibe (Firing / Fun / Meh / Rough), Optional note (textarea)
  - Backend: Creates minimal `sessions` record (user_id, beach_id, date, time_window inferred from best_window, conditions captured)
  - Creates `intel_posts` record if conditions present (source: 'conditions_report')
  - Deduplicates: One report per user per beach per calendar day
- Alternative in-app trigger: "Log a Session" CTA visible in:
  - Home screen (post-onboarding, next to forecast)
  - Beach detail page (sticky footer when forecast visible)
  - Profile page (empty state: "Log your first session")
- **Ship**: "One-Tap Session Logging" PR
- **Measure**: Session creation rate (% of active users), average time to first session
- **Target**: 20%+ of onboarded users log first session within 7 days

**Week 6 (Apr 22-26): Post-Session Share Prompt**
- Ship "Share Your Vibe" celebration overlay
  - Triggers immediately after session creation
  - Full-screen card with:
    - Confetti animation (respects `prefers-reduced-motion`)
    - Session summary: beach, time, conditions emoji, conditions text
    - Call-to-action: "Share your vibe" (native share sheet)
    - Secondary: "Skip" (dismiss)
  - Share pre-fills: "Just finished a [Vibe] session at [Beach]. Conditions: [Wave/Wind/Tide]" + link
- Integrate with existing share infrastructure (OG image generation)
  - `/api/og/session/{id}` generates shareable card image
  - Include beach photo, wave height, conditions, time
- **Ship**: "Post-Session Share Prompt"
- **Measure**: Share rate (% of sessions shared), click-through from shared links
- **Target**: 20%+ of sessions shared externally (social proof + acquisition channel)

**Week 7 (Apr 29-May 3): Local Activity Feed**
- Ship "What Your Crew has Been Surfing" feed
  - Visible on home screen + dedicated "Activity" tab
  - Shows last 24h sessions + intel from home beach + 10-mile radius
  - Per entry: User avatar + name, beach name, time (e.g., "2h ago"), wave size emoji, vibe emoji, optional note, optional photo thumbnail
  - Sorting: Most recent first
  - Filter by: Today / This week / All time
  - Empty state: "No sessions logged yet. Be first!" (motivates logging)
- Seed activity feed with synthetic sessions for first 20 days (until real users start logging)
  - NPC intel system already does this; leverage for activity feed visibility
  - Example: "Alex just logged a Fun session at Pacific Beach (3-4ft)" at 8am, "Jamie caught Firing conditions at Blacks" at 10am
  - Creates perception of active community
- **Ship**: "Activity Feed" component + home screen integration
- **Measure**: Feed engagement (% of users viewing), time spent, CTR to user profiles
- **Target**: 50%+ of users view activity feed; 10% click to user profiles

**Week 8 (May 6-12): Gamification Activation**
- Activate existing XP/badge system (already built, deployed)
  - Make visible in home screen welcome: "You earned +50 XP for your first session!"
  - Add progress bar to profile page (current level → next level)
  - Make badges visible on public profile (earned badges show on your profile card)
- Create "Beginner's Achievement" path: First 5 sessions earn cumulative badge
  - e.g., "Wave Whisperer" earned after 5 sessions, "Consistency King" after 10 sessions in 30 days
- **Ship**: "Gamification Activation" (UI/messaging changes only; schema already exists)
- **Measure**: Badge earning rate, level progression, impact on repeat logging
- **Target**: 50%+ of active users earn first badge within 7 days

**Month 2 Success Criteria**:
- ✓ First-session rate: 20%+ of signups log first session within 7 days (up from 9.5%)
- ✓ Repeat logging rate: 30%+ of first-session loggers log second session within 30 days
- ✓ Share rate: 20%+ of sessions shared externally
- ✓ Activity feed adoption: 50%+ of users view feed, 10%+ interact
- ✓ WASL: 3-8 weekly active session loggers (up from 0)

---

#### MONTH 3: Activate Social Loop (May 13 - Jun 9)

**Goal**: Get 5%+ social action rate (follows, shares, comments); achieve 10%+ D7 retention.

**Week 9 (May 13-17): Follow Feature (Minimal)**
- Ship "Follow" button on user profiles
  - Shows on: User profile card, Activity feed entries, Leaderboard entries
  - Design: Ghost button with "Follow" text, filled state shows checkmark + "Following"
  - Backend: Creates `user_follows` record, persists user preference to UI
  - Notifications: Send push notification to followed user "Alex started following you" (soft notification, no urgency)
- Create "People Who Surf Your Beach" discovery page
  - Shows top 10 users who've logged sessions at home beach
  - Sorted by: Most recent session, XP earned, number of sessions
  - CTA: "Follow [User]" to see their sessions in your feed
  - Motivation: "Learn from locals, find session partners"
- **Ship**: "Follow Feature" PR
- **Measure**: Follow acceptance rate (% of profiles with 1+ followers), follow-to-follow rate
- **Target**: 15%+ of active users follow at least 1 other user

**Week 10 (May 20-24): Session Invite + Comments (Lightweight)**
- Ship "Tag Your Friends" on session logging
  - Added to post-session flow: "Who surfed with you?"
  - Typeahead search (search by name, email, username)
  - Creates invitation records + notification to friend
  - Friend gets: "Alex tagged you in a session at Blacks on May 20"
  - CTA: "Accept" or "Decline" (implicit invite acceptance for social graph)
- Add lightweight comment system
  - Text only initially (no media)
  - Max 200 chars per comment
  - Visible on: Session detail page, Activity feed (1-line preview, "View comments")
  - Emoji reactions (👍❤️🤙🏄) as lightweight engagement
- **Ship**: "Tag Friends + Comments" PR
- **Measure**: Tag acceptance rate, comment rate per session, retention impact
- **Target**: 20%+ of sessions have 1+ friend tagged, 10% have comments

**Week 11 (May 27-31): Feed Personalization**
- Ship "Your Feed" personalized by follows + home beach
  - Shows sessions from: Followed users + home beach community + nearby beaches
  - Weighting: Followed users 50%, home beach 40%, nearby 10%
  - Sorts by: Most recent first, with "from someone you follow" badge
  - Filter: "My Crew" (followed users) / "My Spot" (home beach) / "Nearby"
- Add "Find Local Surfers" discovery page
  - Recommends users to follow based on: same home beach, nearby beaches, skill level match
  - CTA: "Follow [User] — also surfs [Beach]"
- **Ship**: "Personalized Feed" PR
- **Measure**: Feed engagement (sessions viewed, clicks, CTR to profiles), DAU impact
- **Target**: 60%+ of active users check feed daily

**Week 12 (Jun 2-9): Retention Optimization + Metrics**
- Analyze D7 retention cohorts (target: >15%)
  - Which features drive return visits? (Feed views, forecast checks, session logging, follows)
  - Which onboarding cohorts have best retention? (Geo-selected home beach > manual selection)
  - Which signup sources drive best retention? (Organic > paid experiments)
- Implement lightweight re-engagement emails
  - "Alex just logged a session at your beach" (if follower or home beach match)
  - "Conditions are firing at Blacks today" (weekly digest if no logins in 5 days)
  - Unsubscribe-friendly (single CTA to reactivate)
- Add session reminders
  - Post-session: "Plan your next session for tomorrow?" (based on forecast)
  - Pre-session: "Conditions look good at 6am. Set a reminder?" (24h before best window)
- **Ship**: "Re-engagement Email + Reminder System" PR
- **Measure**: D7 retention by cohort, email re-activation rate, reminder click-through
- **Target**: 15%+ D7 retention across all cohorts

**Month 3 Success Criteria**:
- ✓ WASL: 15+ weekly active session loggers
- ✓ D7 retention: 15%+ of signup cohorts return within 7 days
- ✓ Share rate: 20%+ of sessions shared
- ✓ Social action rate: 5%+ of users perform follow/comment/tag action
- ✓ Feed engagement: 60%+ of active users check feed, 20%+ click through
- ✓ First-session rate: 50%+ of signups log first session within 14 days

---

### What to STOP Doing

**Immediately deprioritize** (Q2 roadmap):
- Monetization experiments (paywalls, ads, sponsorships) — premature at 0 WASL
- Advanced ML features (hyper-personalization, bias correction, model improvements) — building for 0 users
- New reporting tools (swell direction, crowd forecasts, wind shear) — nobody is logging sessions yet
- Mobile app push beyond Capacitor wrapper — web adoption is baseline
- Detailed user research with existing users — not enough real users to learn from

**Keep but don't expand** (Q2):
- Gamification (already built; just activate messaging)
- Email system (keep generic digest; don't over-personalize)
- Analytics infrastructure (track everything but don't act on complex metrics)
- NPC intel bots (useful for activity feed, but don't add features)

---

## Part 6: Success Metrics

### The Dashboard

Track these metrics weekly on `/dashboard/growth`:

#### Primary Metric (North Star)
- **WASL (Weekly Active Session Loggers)**: Count of distinct users who logged ≥1 session in past 7 days
  - Current: 0
  - 30-day target: 3-5
  - 60-day target: 8-12
  - 90-day target: 15+

#### Acquisition
- **Weekly Signups**: New `profiles` created, excluding test accounts
  - Current: 0-2 per week
  - Target: 3-5 per week by week 4
  - Target: 5-8 per week by week 8
  - Target: 8-12 per week by week 12

- **Signup Conversion Rate**: (Signups / Unique Visitors) × 100
  - Current: 1.6% (21 signups / ~1,300 visitors over 90 days)
  - Target: 2% by week 4
  - Target: 2.5% by week 8
  - Target: 3% by week 12

- **CTA Click-Through Rate**: (CTA Clicks / CTA Views) × 100
  - Current: 0.2% (9 clicks / 4,423 views)
  - Target: 0.5% by week 2 (after double-fire fix)
  - Target: 1% by week 4 (after CTA copy optimization)

#### Activation
- **Onboarding Completion Rate**: (Completed onboarding / Signups) × 100
  - Current: 57%
  - Target: 70% by week 4

- **First-Session Rate**: (Users with ≥1 session / Signups) × 100
  - Current: 9.5%
  - Target: 20% by week 8
  - Target: 35% by week 12
  - Target: 50% by week 16 (beyond roadmap)

- **Time to First Session**: Median days from signup to first session
  - Current: 14+ days (or never)
  - Target: <7 days by week 8
  - Target: <5 days by week 12

#### Retention
- **D7 Retention**: (Cohort members who returned within 7-14 days / Cohort size) × 100
  - Current: 0% (all non-founder cohorts)
  - Target: 8% by week 8
  - Target: 15% by week 12
  - Target: 20% by week 16

- **Repeat Logging Rate**: (Users with ≥2 sessions / Users with ≥1 session) × 100
  - Current: 50% (1 of 2 users)
  - Target: 40% by week 8 (larger sample, lower %)
  - Target: 50% by week 12
  - Target: 60% by week 16

#### Engagement
- **Sessions per Active User (7d)**: Average sessions logged by WASL
  - Current: 0
  - Target: 1.0 by week 8
  - Target: 1.2 by week 12

- **Session Share Rate**: (Sessions shared / Sessions created) × 100
  - Current: 0%
  - Target: 5% by week 8
  - Target: 15% by week 12
  - Target: 20% by week 16

#### Viral/Social
- **Follow Rate**: (Follows created / Active users) × 100
  - Current: 0%
  - Target: 5% by week 10
  - Target: 15% by week 12

- **Social Action Rate**: (Users with ≥1 follow/comment/tag / Active users) × 100
  - Current: 0%
  - Target: 2% by week 10
  - Target: 5% by week 12

- **Activity Feed Engagement**: (Users who viewed ≥1 session / Active users) × 100
  - Current: N/A
  - Target: 40% by week 7
  - Target: 60% by week 12

#### Funnel Health
- **Full Signup Funnel**: (Signups → Onboarded → First Session → Social Action)
  - Current: 21 → 12 → 2 → 0 (0% to last step)
  - Target by week 12: 50 → 35 → 15 → 3 (6% social action)

### Anomaly Thresholds (Red Flags)

| Metric | Threshold | Action |
|--------|-----------|--------|
| WASL | < 1 for 2 weeks | All-hands emergency; review entire funnel |
| Signup conversion | < 1% | Pause acquisition spend; fix CTA |
| First-session rate | < 15% | Session logging friction too high; simplify form |
| D7 retention | < 8% | Onboarding or initial experience broken; investigate drop-off step |
| Share rate | < 5% | Share UX broken or not discoverable; audit |
| Session abandonment rate | > 50% | Form is too long; truncate or split |

---

## Part 7: Resource Allocation & Dependencies

### Team Composition (Recommended)

| Role | Allocation | Owner | Responsibility |
|------|-----------|-------|-----------------|
| **Frontend** | 1.5 FTE | @engineering | CTA optimization, session logging UI, feed, share prompt |
| **Backend** | 0.5 FTE | @engineering | Auth instrumentation, session model changes, comment/follow endpoints |
| **QA** | 0.5 FTE | @engineering | E2E testing (funnel, session logging, share flow, social actions) |
| **Product** | 1.0 FTE | @product-manager | Metrics dashboard, weekly reviews, iteration priorities |
| **Design** | 0.5 FTE | @design (if available) | Session logging modal, feed cards, share prompt, follow discovery |

**Not needed Q2**: Analytics engineer, content writer, paid marketing, data scientist (ML improvements)

### Critical Dependencies

**External**:
- Google API (One Tap authentication) — already integrated
- Firebase Cloud Messaging (push notifications) — already integrated
- Supabase Edge Functions (API routes) — already working

**Internal**:
- Forecast data freshness (90.4% ML accuracy) — P0 for trust signal
- Beach photography (hero images for activity feed) — exists but could be higher quality
- OG image generation (`/api/og/*` routes) — already working

### Timeline Risks

**High risk** (could slip):
- ~~Apple Sign-In client secret generation~~ **RESOLVED 2026-03-14**
- Auth instrumentation dual-fire — GA4 + internal DB sync
- Session logging form UX — if mobile testing reveals issues

**Medium risk** (might slip 1 week):
- Activity feed seeding with NPCs — needs careful data population
- Personalized email copy — domain complexity
- Comment threading (emoji reactions) — backend logic

**Low risk** (unlikely to slip):
- CTA copy testing — config changes
- Onboarding simplification — mostly UI removal
- Share prompt — existing infrastructure

---

## Part 8: Implementation Checklist

### Pre-Launch (Mar 18-22)

- [ ] **Engineering**: Standup meeting with product + design to align on Week 1 deliverables
- [ ] **Product**: Create `/dashboard/growth` private Grafana dashboard with weekly metrics
- [ ] **QA**: Set up test accounts + automation for signup → first session flow
- [ ] **Design**: Create spec for "One-Tap Session Logging" modal (Week 5 deliverable)
- [ ] **Product**: Schedule weekly Monday syncs (30 min: metrics review + iteration priorities)

### Week 1 Checkpoint (Mar 22)

- [ ] Auth funnel PR merged: cam-hero double-fire fix, email redirect, Apple Sign-In, CTA restoration
- [ ] Growth metrics dashboard live (pulling real data from GA4 + Supabase)
- [ ] Signup conversion rate tracked (target: 1%+ CTA click rate)
- [ ] Team aligned on Month 1 success criteria

### Week 4 Checkpoint (Apr 14)

- [ ] Onboarding completion rate: 70%+ (up from 50%)
- [ ] Weekly signup rate: 3-5 per week (up from 0-2)
- [ ] CTA metrics: Identify best-performing copy variation
- [ ] Month 2 (session logging) design specs finalized

### Week 8 Checkpoint (May 12)

- [ ] First-session rate: 20%+ (2+ sessions logged per week)
- [ ] Share rate: 10%+ (emerging, post-session prompt active)
- [ ] WASL: 3-8 weekly active loggers
- [ ] Activity feed live and showing local sessions
- [ ] Month 3 (social) design specs finalized

### Week 12 Checkpoint (Jun 9)

- [ ] WASL: 15+ weekly active loggers
- [ ] D7 retention: 15%+ across cohorts
- [ ] First-session rate: 50%+ within 14 days
- [ ] Share rate: 20%+ of sessions shared
- [ ] Social action rate: 5%+ of users follow/comment
- [ ] Decide: Continue scaling vs. pivot

---

## Part 9: Decision Criteria for Success/Pivot

### Path to PMF (Green Light for Scaling)

By end of Q2 (Jun 9), if we see:
- ✓ WASL ≥ 15
- ✓ D7 retention ≥ 15%
- ✓ First-session rate ≥ 50%
- ✓ Signup conversion ≥ 2.5%
- ✓ Cohort retention growing week-over-week (not declining)

**Action**: Ship to app stores, launch referral program, begin paid acquisition experiments.

### Pivot Scenarios (Red Lights)

**Scenario 1: Signup funnel doesn't improve**
- If CTA click rate stays <0.5% after copy testing → GTM problem, not product
- Decision: Shift to partnerships/B2B (sell to surf schools, resorts)

**Scenario 2: Onboarded users won't log sessions**
- If first-session rate stays <15% despite 10x easier form → core need validation failed
- Decision: Pivot to forecast-only tool (like Surf-Forecast.com); add monetization

**Scenario 3: Churn too high to sustain growth**
- If D7 retention stays <8% despite 3 months of retention work → product-market mismatch
- Decision: Restart with different user segment (experienced surfers? beach tourists?)

**Scenario 4: Social features don't create engagement loops**
- If share rate never reaches 20% or follow rate <5% → virality hypothesis failed
- Decision: Cut social features; focus on utility (forecast) + individual achievement

---

## Part 10: Strategic Recommendations

### 1. Move Forecast to Public (No Auth Required)

**Current state**: Forecast is gated behind signup/login for authenticated users only.

**Recommendation**: Make forecast public for all beach pages.
- **Why**: Lowers activation friction (users see forecast before committing to signup)
- **Impact**: Forecast quality is Quiver's moat; showcasing it early builds trust
- **Timeline**: Ship alongside Week 1 CTA restoration

### 2. Kill Feature Parity with Surfline / Magic Seaweed

**Current state**: Roadmap has "advanced" features (wind shear, crowd forecasts, swell direction).

**Recommendation**: Ignore Surfline. Build for activation, not feature completeness.
- **Why**: We'll never beat Surfline at raw forecast detail; beginners don't need it
- **Focus**: Personalization + social + gamification (things Surfline doesn't do well)
- **Timeline**: Q3+, only if WASL > 50

### 3. Lean Into Community > Data

**Current state**: Company obsessed with ML accuracy, forecast data, buoy networks.

**Recommendation**: Shift messaging and UX to emphasize community (local sessions, crew, discovery).
- **Why**: 0 follow users isn't about forecast quality; it's about FOMO/social proof
- **Examples**: "Your crew is firing at Blacks right now", "5 locals just logged sessions", "Tag your paddlout partner"
- **Timeline**: Integrated into Month 2-3 roadmap

### 4. Optimize for Mobile (Web Wrapper Comes Last)

**Current state**: Product being optimized for desktop breakpoints; Capacitor wrapper feels secondary.

**Recommendation**: Mobile-first from onboarding through sharing.
- **Why**: Surfers check at dawn (6am on their phones); desktop usage is minimal
- **Changes**: Test post-session flow on iPhone/Android; native share sheet is primary
- **Timeline**: QA emphasis in Week 5-6

### 5. Double Down on Acquisition From Organic / Referrals

**Current state**: Paid acquisition experiments not planned.

**Recommendation**: Don't buy traffic until WASL > 50 and LTV is measurable.
- **Why**: Signup conversion is only 2% and retention is 0%; paid would burn cash
- **Focus**: Organic SEO (tides, water temps, forecasts), referral loop (shares), brand (Reddit, local communities)
- **Timeline**: May onwards, only if retention targets hit

---

## Part 11: Competitive Context

### Why Quiver, Not Surfline / Magicseaweed / Swellinfo?

| Aspect | Surfline | Magicseaweed | Swellinfo | **Quiver** |
|--------|----------|-------------|-----------|-----------|
| **Forecast coverage** | 100s beaches (premium) | 100s beaches | 50s beaches | 279 beaches + local ML |
| **Beginner guidance** | ⚠️ Expert-focused | ⚠️ Expert-focused | ⚠️ Expert-focused | ✓ **Skill-level matched** |
| **Social features** | None | None | None | ✓ **Sessions, follows, activity feed** |
| **Gamification** | None | None | None | ✓ **XP, badges, levels** |
| **Community** | ❌ Paywall | ⚠️ Weak reviews | ❌ Minimal | ✓ **Real-time activity** |
| **Pricing** | Premium ($$$) | Free | Free | **Free (future: premium)** |
| **Mobile experience** | 🎯 Native | 🎯 Native | ⚠️ Dated | ✓ **Native (Capacitor) + web** |

**Quiver's edge**: Personalized forecasts for beginners + social discovery. We're not competing on forecast accuracy; we're competing on belonging.

---

## Appendix: FAQ

### Q: Why focus on WASL instead of DAU/MAU?

**A**: WASL is the most meaningful metric because session logging is the core activity. DAU is inflated (people check forecast but don't log). MAU is too slow to measure (monthly is 4x slower feedback loop). WASL = real, engaged users who trust the app enough to record their behavior.

### Q: Shouldn't we test the hypothesis with a smaller group first?

**A**: We don't have a small group to test with. We have 20 real users; testing on a cohort of 5 would take 6 months and miss seasonality. Better to ship and measure against all traffic (1,300/week).

### Q: What if the share rate never hits 20%?

**A**: Share rate is a growth lever, not a retention lever. If share rate stalls <10%, we focus on feed/follows (keeping users in the app instead of pushing them out). Both are valid paths.

### Q: Why not build an AI coach / predictive features / etc.?

**A**: Because 0 users are using the core app. Building advanced features for non-existent users is the sunk cost fallacy. Fix the funnel first, then level up.

### Q: When should we launch the mobile app formally?

**A**: Once WASL > 20. Right now web + Capacitor wrapper is good enough. Formal mobile launch (TestFlight, App Store) requires polish and marketing budget we should spend on organic acquisition instead.

### Q: Should we hire product marketing or sales for Q2?

**A**: No. Spend on:
1. Engineering (1.5 FTE frontend for session logging, feed, share)
2. Product (1 PM for metrics, iteration)
3. QA (0.5 FTE for funnel automation)

Sales/marketing are premature when conversion is 1-2%. Marketing should be "ship great features" not "buy traffic."

---

## Summary: The Path Forward

Quiver has built infrastructure without users. The fix is not more features—it's **removing friction from the three critical moments**:

1. **Signup** (broken funnel, 0.2% CTA click rate) → Fix in Week 1
2. **First session** (5-step form, no motivation) → Fix in Week 5
3. **Social proof** (built but not discoverable) → Fix in Week 9

If we execute flawlessly on this 90-day plan, we'll move from 0 WASL to 15+ weekly active session loggers, hit 50% first-session rate, and achieve 15% D7 retention. That's product-market fit for the beginner surfer segment.

If we don't hit those targets by Jun 9, we'll have clear data to pivot to a different segment or business model.

The path is clear. The execution starts Monday.

---

**Document Owner**: Product Management
**Last Updated**: March 13, 2026
**Next Review**: March 20, 2026 (Week 1 metrics)
