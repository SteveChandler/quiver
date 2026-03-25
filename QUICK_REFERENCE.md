# Quiver PMF Strategy: Quick Reference

**Print this. Stick it on your monitor.**

---

## The Problem

```
1,300 weekly visitors
        ↓ (0.2% CTA click)
Signup clicks: 9
        ↓ (~0% conversion)
Signups: 21 in 90 days
        ↓ (57% onboard)
Onboarded: 12
        ↓ (9.5% log session)
Sessions: 2
        ↓ (0% share)
Active users: 0
Social actions: 0
```

**Why**: Funnel broken (best CTA deleted), session form too long, no social proof.

---

## The North Star Metric

**WASL** = Weekly Active Session Loggers

Current: **0**
Day 30: **3-5**
Day 60: **8-12**
Day 90: **15+** ← PMF signal

---

## 90-Day Plan

| Phase | Weeks | Goal | Output |
|-------|-------|------|--------|
| **Fix Funnel** | 1-4 | Signups 3-5/week | Restore best CTA, fix auth, simplify onboarding |
| **Session Logging** | 5-8 | 20% first-session rate | One-tap logging, share prompt, activity feed |
| **Social Loop** | 9-12 | 15% D7 retention | Follows, comments, personalized feed |

---

## Week 1: Restore Funnel (Mar 18-22)

### 4 Things to Fix

1. **Restore `surf-call-conditions` gate** (best-converting CTA: 2.4% click rate)
   - Status: Deleted Mar 11
   - File: `components/beach-detail/spot-surf-report.tsx`
   - Effort: 2-3 hours

2. **Fix cam-hero double-firing** (27x metrics inflation via IntersectionObserver)
   - Status: Broken
   - File: `lib/analytics/signup-conversion-tracking.ts`
   - Effort: 2 hours

3. **Fix email confirmation redirect** (loses context after signup)
   - Status: Hardcoded to `/`
   - File: `components/auth/unified-auth-modal.tsx`
   - Effort: 2-3 hours

4. **Unblock Apple auth** (client secret not configured)
   - Status: Broken
   - File: `scripts/generate-apple-secret.mjs`
   - Effort: 1-2 hours (setup) + 1 hour (code)

### Success Criteria
- ✓ Signup CTA click rate: 0.5%+ (up from 0.2%)
- ✓ cam-hero fires 1x per session (was 27x)
- ✓ Auth funnel events in Supabase `user_events` table
- ✓ Email redirect preserves beach context

---

## Key Metrics to Track

### Daily Dashboard
- **WASL**: Count users who logged 1+ session this week
- **Daily signups**: New profiles created
- **Signup conversion**: (Signups / Unique Visitors) × 100

### Weekly Dashboard
- **CTA click-through rate**: (Clicks / Views) × 100
- **Onboarding completion**: (Completed / Signups) × 100
- **First-session rate**: (Users with session / Signups) × 100
- **D7 retention**: (Returned week 2 / Signups week 1) × 100
- **Share rate**: (Sessions shared / Sessions created) × 100

### Red Flags (Pause & Debug)
- WASL < 1 for 2 weeks
- Signup conversion < 1%
- First-session rate < 15% (after Week 8)
- D7 retention < 8% (after Week 8)

---

## What NOT to Do (Q2)

- ❌ Build monetization (premature)
- ❌ Add advanced ML features (building for 0 users)
- ❌ Launch formal mobile app (Capacitor is sufficient)
- ❌ Buy paid traffic (1.6% conversion = negative ROI)
- ❌ Optimize forecasts beyond 90% accuracy (not the constraint)

---

## What to Prioritize (Q2)

1. **Week 1-4**: Funnel fixes (highest ROI)
2. **Week 5-8**: Session logging + sharing (activation)
3. **Week 9-12**: Social features (retention)
4. **Continuous**: Track WASL weekly

---

## Decision Criteria (June 9)

### ✓ Green Light (Scale)
- WASL ≥ 15
- First-session rate ≥ 50%
- D7 retention ≥ 15%
- Signup conversion ≥ 2.5%

**Action**: Ship mobile app, launch referral, buy traffic

### ❌ Pivot Scenario
- WASL < 10 after 12 weeks
- D7 retention < 8%
- Share rate < 10%

**Action**: Switch to forecast-only, pivot segment, explore B2B

---

## Resource Allocation

- **1.5 FTE Frontend**: CTA, session logging UI, feed, share
- **0.5 FTE Backend**: Auth, session endpoints, comments
- **0.5 FTE QA**: E2E testing (funnel, session, share)
- **1.0 FTE Product**: Metrics, weekly reviews, priorities
- **0.5 FTE Design**: Session modal, feed cards, follow UX

**Total**: 4 FTE (no new hires)

---

## Competitive Advantage

| Feature | Surfline | Magicseaweed | **Quiver** |
|---------|----------|-------------|-----------|
| Forecast coverage | Premium | Free | 279 beaches |
| Beginner guidance | ❌ | ❌ | ✓ Yes |
| Social + gamification | ❌ | ❌ | ✓ Yes |
| Community activity | ❌ | Weak | ✓ Real-time |
| Price | $$$ | Free | **Free** |

**Our edge**: Belong, not broadcast. Community first.

---

## Documents to Read

1. **PMF_EXECUTIVE_SUMMARY.md** — 5 min version
2. **PRODUCT_STRATEGY_PMF_PATH_2026_Q2.md** — Complete strategy
3. **MONTH1_WEEK1_TECHNICAL_SPEC.md** — Engineering specs

---

## Meetings

- **Every Monday 10am**: 30-min sync (metrics review + iteration priorities)
- **Week 1 Friday**: Metrics dashboard live
- **Week 4 Friday**: Month 1 review (signups 3-5/week?)
- **Week 8 Friday**: Month 2 review (WASL 3-8? First-session rate 20%?)
- **Week 12 Friday**: Month 3 review + Decision (scale or pivot?)

---

## Checkpoints

| Week | Checkpoint | Target |
|------|-----------|--------|
| **4** | Signup conversion | >2% (up from 0.2%) |
| **8** | First-session rate | 20% (up from 9.5%) |
| **12** | WASL + D7 retention | 15+ WASL, 15%+ D7 |

---

## Day 1 Execution

Monday, March 18, 2026:

1. **10am**: Kickoff meeting (explain strategy to team)
2. **11am**: Break into 3 teams (funnel, session logging, social)
3. **1pm**: Engineering team assigns Week 1 tasks (see TECHNICAL_SPEC.md)
4. **2pm**: Product creates metrics dashboard skeleton
5. **EOD**: Team synced on Week 1 deliverables

---

## One-Liner Philosophy

**We have the infrastructure; users can't find the signup flow or reason to log sessions. Fix both in 12 weeks or pivot.**

---

## FAQ (30 Seconds Each)

**Q: Why WASL?**
A: Session logging is core. Signals real users who trust the app.

**Q: Why not test with small cohort?**
A: 20 users total. Need 1,300/week to measure signal.

**Q: What if share never hits 20%?**
A: Focus on feed/follows instead. Both drive retention.

**Q: Why cut monetization?**
A: 1.6% conversion, 0% retention. Premature. Fix activation first.

**Q: Timeline realistic?**
A: Yes. Fixes are mostly UX/messaging, not new features.

**Q: What if we miss targets?**
A: Clear pivot signal by Jun 9. No guessing.

---

## Success Looks Like (June 9)

- 15+ real users log sessions weekly
- 50%+ of signups log first session within 14 days
- 15%+ come back after 7 days
- 20%+ of sessions are shared externally
- Users follow each other, comment on sessions, tag friends
- Activity feed shows local crew surfing
- Zero regrets about strategy choice

---

**Confidence**: HIGH
**Start date**: Monday, March 18, 2026
**Decision date**: Sunday, June 9, 2026
**Expected outcome**: PMF validation or clear pivot signal
