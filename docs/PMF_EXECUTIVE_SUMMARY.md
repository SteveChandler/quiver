# Quiver: Path to PMF — Executive Summary

**Date**: March 13, 2026
**Time to PMF**: 90 days (by June 9)
**Status**: Ready to execute

---

## The Problem in One Sentence

Quiver has built world-class forecast infrastructure (90.4% ML accuracy, 279 beaches, 1M+ data points) but inverted the funnel: 1,300 weekly visitors → 0 active session loggers.

---

## The Numbers

### Current Funnel
- 1,300 weekly visitors (50% bot traffic; ~650 real surfers)
- 21 signups in 90 days (1.6% conversion from visitors)
- 12 completed onboarding (57% of signups)
- 2 logged a session (9.5% of signups; 1 is founder)
- 0 weekly active session loggers (WASL = 0)
- 0 social actions ever (follows: 0, shares: 0, comments: 0)

### Why Users Don't Convert
1. **Best-converting CTA deleted** (2.4% click rate was axed Mar 11; now 0.2% CTA click rate)
2. **Session logging has 5+ form steps** with no motivation
3. **No social proof or activity feed** (1 active user = isolation)
4. **Email confirmation kills momentum** (broken redirect)
5. **Auth funnel not instrumented** (can't measure where users drop)

---

## The Solution (3 Phases)

### Phase 1: Fix Broken Funnel (Week 1-4)
**Goal**: Restore signup conversion to 1-2%; get to 3-5 signups/week

**Actions**:
- Restore best-converting CTA copy ("See today's surf call")
- Fix email confirmation redirect (preserve context)
- Fix cam-hero double-firing bug (27x metrics inflation)
- Unblock Apple auth (client secret)
- Instrument auth funnel (GA4 + internal DB)
- Simplify onboarding (2 steps → beach + skill level)
- A/B test CTA copy for optimal conversion

**Success Metric**: Signup conversion >2% (up from 0.2% CTA click rate)

---

### Phase 2: Trigger First Session Logging (Week 5-8)
**Goal**: Get 20%+ of signups to log first session; activate sharing

**Actions**:
- One-tap session logging (post-session modal: rate + wave size + vibe + optional note)
- Post-session share prompt (celebration overlay with native share sheet)
- Local activity feed (shows last 24h sessions from home beach + nearby)
- Gamification activation (badge notifications, XP progress bar)
- Seed feed with synthetic activity (NPC intel system creates perception of active community)

**Success Metric**: 20% first-session rate (up from 9.5%), 20% share rate (up from 0%)

---

### Phase 3: Activate Social Loop (Week 9-12)
**Goal**: Create FOMO/retention loop through follows, comments, tags

**Actions**:
- Follow feature (discoverable on profiles + activity feed)
- Lightweight comments (text + emoji reactions)
- Tag friends (on session, creates invite + notification)
- Personalized feed (shows followed users + home beach community)
- Re-engagement email (contextual: followers' sessions, conditions alerts)

**Success Metric**: 15% D7 retention (up from 0%), 5% social action rate (up from 0%)

---

## Key Insights

### Insight #1: The Funnel Is Broken, Not the Product
- Forecast quality is excellent (90.4% ML accuracy)
- Infrastructure is production-ready (50+ event types, dual-fire analytics, mobile wrapper)
- The problem: Users can't *find* the signup flow, don't *know why* to log sessions, can't *see* their community

**Fix**: Reduce friction at 3 critical moments (signup, first session, social discovery)

### Insight #2: Beginners Are Underserved
- Surfline targets experienced surfers (premium paywall, advanced metrics)
- Magicseaweed is feature-parity with Surfline
- **Gap**: Personalized forecasts + social discovery + gamification for tech-savvy beginners (18-35)

**Opportunity**: 2-3M beginner surfers in US; Quiver can own top 100K most tech-forward

### Insight #3: Social Creates the Moat
- Forecast data is commoditized (IOOS, NDBC, CDIP all public)
- Our differentiation isn't accuracy; it's **belonging**
- Sessions + follows + activity feed create FOMO/retention loops that Surfline can't match

**Action**: Double down on community features over forecast refinement (Q2)

---

## 90-Day Targets

| Metric | Current | Day 30 | Day 60 | Day 90 |
|--------|---------|--------|--------|---------|
| **WASL** | 0 | 3-5 | 8-12 | 15+ |
| **Weekly signups** | 0-2 | 3-5 | 5-8 | 8-12 |
| **First-session rate** | 9.5% | 15% | 25% | 50% |
| **D7 retention** | 0% | 5% | 10% | 15% |
| **Share rate** | 0% | 5% | 15% | 20% |
| **Social action rate** | 0% | 2% | 3% | 5% |

**North Star**: WASL (Weekly Active Session Loggers) must reach 15+ by day 90 to validate PMF.

---

## What Gets Cut

**Deprioritize in Q2**:
- Monetization (premature at 0 users)
- Advanced ML features (building for nobody)
- New forecast metrics (swell direction, wind shear, crowd forecasts)
- Paid acquisition (1-2% conversion, 0% retention = negative ROI)
- Formal mobile app launch (Capacitor wrapper is sufficient)

**Keep but don't expand**:
- Gamification (already built; just activate messaging)
- Email system (generic digest; don't over-personalize)
- NPC intel (use for feed seeding, not new features)

---

## Resource Plan

**Headcount**: No new hires needed
- 1.5 FTE Frontend: CTA optimization, session logging UI, feed, share
- 0.5 FTE Backend: Auth instrumentation, session endpoints, comments
- 0.5 FTE QA: E2E testing (funnel, session, share, social)
- 1.0 FTE Product: Metrics dashboard, weekly reviews, priorities
- 0.5 FTE Design: Session modal, feed cards, follow discovery

**Budget**: Only ongoing infrastructure (Supabase, Vercel, Fly.io). No paid marketing or analytics tools.

---

## Decision Criteria (Jun 9)

### Green Light (Scale)
- WASL ≥ 15
- D7 retention ≥ 15%
- First-session rate ≥ 50%
- Signup conversion ≥ 2.5%

**Action**: Ship to app stores, launch referral, begin paid acquisition

### Pivot Signal (One of These)
- WASL < 10 despite 12 weeks of work → core value proposition doesn't resonate
- D7 retention < 8% → retention problem unsolvable at this stage
- First-session rate < 25% → activation friction unfixable
- Share rate < 10% → social loop doesn't generate viral growth

**Action**: Switch to forecast-only model, pivot to different segment, or explore B2B/partnerships

---

## Why This Works

1. **Minimal shipping cadence** (1 major feature per 2 weeks) → fast iteration
2. **Highest-impact features first** (fix funnel before social features)
3. **Built on existing infrastructure** (no new tables, mostly UX/messaging)
4. **Measurable progress** (weekly metrics dashboard, clear targets)
5. **Fallback plan** (clear pivot decision points if targets miss)

---

## Timeline

| Week | Focus | Output |
|------|-------|--------|
| **1-4** | Fix funnel | Signup conversion >2% |
| **5-8** | Session logging + sharing | 20% first-session rate, 20% share rate |
| **9-12** | Social loop | 15% D7 retention, 5% social action rate |
| **Week 13+** | Decision | Scale, pivot, or sunset |

---

## The Ask

**Approve this roadmap and unblock the team to ship**. No design committee. No "let's research this more." 12 weeks of fast iteration, then measure against clear targets.

If we hit the targets, Quiver is on the path to PMF and worth scaling.
If we miss, we'll have clear data to pivot or sunset.

Either way, we'll have learned more than 6 months of internal debate.

---

**Next Steps**:
1. Monday (Mar 18): Kickoff meeting with engineering + design
2. Friday (Mar 22): First metrics dashboard live
3. Weekly: Monday syncs (30 min) for metrics review + iteration priorities
4. June 9: Decision point (scale vs. pivot)
