# Quiver Growth Playbook
## Pre-PMF Strategy for 0-to-1,000 Users

**Date:** March 13, 2026
**Status:** Active
**Current state:** WAU 1, MAU 9, 21 signups in 90 days, 9.5% activation

---

## 0. Diagnosis: Why Nothing Is Working

Before prescribing solutions, here is a frank assessment of why Quiver has 1 active user despite 1,300 weekly visitors and a genuinely differentiated product.

**The core problem is not acquisition. It is the gap between visiting and belonging.**

1. **Visitors arrive but see no reason to create an account.** The forecast data is excellent and freely available. There is no moment where a visitor thinks "I need to sign up to get this." The content gates that exist (surf call details) feel like arbitrary paywalls, not natural progressions.

2. **The 21 people who did sign up saw an empty app.** Zero community activity. Zero social proof of other humans using it. No sessions logged by others. No conditions reports. The authenticated experience is lonelier than the anonymous one.

3. **Email delivery is 94% failing.** Welcome emails never arrive. The one moment a new user might form a habit -- the first 24 hours -- passes in silence.

4. **The product asks for commitment before delivering value.** "Log a session" requires effort. "Report conditions" is better (lower friction) but was only added recently. The activation metric (first session logged) asks too much of someone who just arrived.

5. **Attribution is blind.** Until the recent UTM fix, there was zero visibility into what is working. Every channel decision has been a guess.

**The strategic implication:** Do not optimize the funnel. Rebuild the value exchange. A surfer should get something *better* when they sign up -- and it should be immediately obvious what that something is before they create an account.

---

## 1. Channel Strategy

### Pre-PMF Channels (Now -- With 1 Active User)

At this scale, scalable channels are premature. The only channels that work at n=1 are the ones that produce direct conversations with individual surfers.

**Do:**

| Channel | Why It Works at n=1 | Effort | Expected Outcome |
|---------|---------------------|--------|------------------|
| Bluesky auto-posts (already built) | Builds brand awareness in surf community. You have the infrastructure; the marginal cost is zero. | Low (maintain) | 50-100 followers in 90 days, brand credibility |
| Reddit r/surfing + r/sandiegosurfing | Direct contact with displaced Surfline users. Every thread about Surfline pricing is an opportunity. | 2 hrs/week | 5-10 signups/month from genuine participation |
| Local San Diego lineup conversations | Your top beach is Blacks with 674 uniques/mo. You surf there. Talk to people in the water. | 0 extra effort | 3-5 power users who give you real feedback |
| Direct outreach to surf schools (SD) | The `/for-surf-schools` page exists. Email 10 schools. Offer the forecast dashboard for free with their branding. | 4 hrs one-time | 1-2 partnerships = 20-50 students/month exposed |
| Instagram (organic, manual) | Post the weekend-wave-check OG image every Friday. Post surf-call cards when conditions are good. Link in bio to Blacks forecast. | 1 hr/week | Slow build, but creates sharable assets |

**Do NOT:**

| Channel | Why It Fails at n=1 |
|---------|---------------------|
| Paid ads (Google, Meta) | CAC will be $50+ for a free product with no retention. Burning cash for users who churn in 24 hours. |
| SEO content marketing (blog posts) | You already rank. More content does not solve the conversion problem. Fix what happens after they arrive first. |
| Influencer outreach | No product-market fit yet. An influencer mention would send 1,000 visitors to an empty community and waste the opportunity. |
| Product Hunt launch | Same problem. A spike of signups into an empty product produces churn, not growth. |
| Email newsletters | 94% delivery failure. Fix Resend configuration before investing in email as a channel. |

### Post-PMF Channels (After 50 WAU and 30% D7 Retention)

These channels only activate after the product retains the users it already has.

| Channel | Unlock Condition | Expected Impact |
|---------|-----------------|-----------------|
| SEO content: "free Surfline alternative" pages | After activation rate hits 25%+ | 500-1,000 additional monthly visitors with intent |
| Instagram/TikTok surf-call sharing | After share flow works and 10+ users share/week organically | Viral coefficient contribution |
| Surf school partnerships (scaled) | After 2-3 pilot schools prove retention | 100-500 users/quarter per school |
| Strava-style "Year in Review" / monthly recap | After 20+ users have 30+ sessions | Massive viral moment, once per year |
| Paid retargeting (warm audiences only) | After organic conversion rate exceeds 3% | Efficient CAC on visitors who already engaged |

---

## 2. SEO Conversion Strategy

### The Problem

1,300 weekly visitors. ~49% are likely bots (Windows/Chrome/1280px pattern already detected). Real surfer traffic is approximately 650/week. Of those, 21 signed up in 90 days -- a 0.1% conversion rate.

The visitors are getting exactly what they came for (forecast data) and leaving satisfied. This is the right behavior for the user but the wrong behavior for growth.

### The Principle

**Do not gate the forecast.** Gating forecast data would make Quiver into discount Surfline. The entire value proposition is "free, ML-accurate forecasts." Instead, create value that only exists for logged-in users and make that value visible to anonymous visitors.

### Strategy: "Show the Door, Don't Lock the Window"

**Tier 1: Visible-but-gated premium insights (already partially built)**

The surf call (YES/MAYBE/NO verdict + best window + score) is the right thing to gate. It is genuinely valuable, synthesized from the raw data that remains free, and answers the surfer's actual question: "Should I go?"

Current implementation: `PublicContentGate` on surf-call conditions shows the verdict badge but gates the detail. This converts at 2.4% -- the highest-converting CTA in the product.

Action items:
- Keep this gate. It works. Do not remove it.
- Improve the teaser copy. Instead of "Get My Forecast" (generic), show what they are missing: "Today's best window is 6:30-9:45am. Sign up to see why." This requires rendering the time window server-side and passing it to the gate component as a prop.
- Add a second data point to the teaser: "3 surfers reported conditions at Blacks this morning." This creates FOMO and social proof simultaneously. Requires the conditions report count to be available server-side.

**Tier 2: Community signals visible to anonymous visitors**

Currently, anonymous visitors see zero social activity. No names, no reports, no session logs. The page feels like a tool, not a community.

Action items:
- Show "Recent Reports" to anonymous visitors (currently implemented but may be empty because nobody is reporting). When reports exist, this is free social proof.
- Add a "Local Crew" count to beach pages: "14 surfers track Blacks on Quiver." Even if the number is small (3-5), it signals that real people use this. Query: count of users who have `beach_id` in their favorites or have logged a session there.
- Show the last 3 session photos (if any exist) in a strip below the forecast. Photos are proof of life.

**Tier 3: Personalized value proposition on exit-intent**

Do not use a popup. Use a persistent, non-intrusive bar at the bottom of beach pages for anonymous visitors. The current sticky signup bar was removed (per CHANGELOG -- "removed 3 of 4 auth gates to reduce friction"). That was correct for a traditional gate. Replace it with a value-proposition bar:

"Get a text when Blacks hits 4ft+ offshore. Free."

This is specific, valuable, and clearly requires an account. It frames signup as "getting alerts" rather than "creating an account." Implementation: a single-line bottom bar with the beach name and a condition threshold, linking to the auth modal with `source: 'alert-bar'` for tracking.

**Tier 4: SEO page-level conversion optimization**

Each intent page type should have a CTA matched to its search intent:

| Page Type | Search Intent | CTA |
|-----------|--------------|-----|
| `/ca/san-diego/blacks` (beach detail) | "What are conditions at Blacks?" | "Get today's surf call for Blacks" (existing, keep) |
| `/tide/san-diego` (tide intent) | "When should I surf based on tide?" | "Get tide-based surf windows for your beaches" |
| `/beginner/san-diego` (beginner intent) | "Where can a beginner surf in SD?" | "Get beginner-friendly beach alerts when conditions are right" |
| `/forecast/san-diego` (regional forecast) | "SD surf forecast this week" | "Get the best day this week for your home break" |
| `/water-temp/san-diego` (water temp) | "What wetsuit for SD?" | Already answered on page -- low conversion intent, deprioritize |

The CTA for each page type should be different. Currently, intent pages use generic CTAs. Swap to intent-matched copy.

### Expected Impact

Moving conversion from 0.1% to 1% on 650 real weekly visitors = 6-7 signups/week instead of ~1.6/week. This is meaningful only if activation improves simultaneously (see Section 5).

---

## 3. "Free Surfline Alternative" Content Strategy

### Market Context

Surfline raised prices 21% in April 2025. Free tier is now limited to 5 checks/week. This is the single largest market-creation event in surf tech in 3 years. Magicseaweed's closure in May 2023 displaced millions of users. Surf-Forecast.com grew to 3.7M monthly visits by being free but has no community features, no ML, and a terrible mobile experience.

### Keyword Targets

| Keyword | Monthly Volume (est.) | Competition | Quiver Advantage |
|---------|----------------------|-------------|-----------------|
| "free surfline alternative" | 1,000-2,000 | Low (few credible alternatives) | Genuinely free, ML forecasts |
| "surfline free alternative" | 800-1,200 | Low | Same |
| "free surf forecast" | 3,000-5,000 | Medium (Surf-Forecast.com dominates) | Better UX, ML accuracy |
| "surfline vs" | 2,000+ | Medium | Comparison angle |
| "surf forecast [city]" | 500-2,000 per city | Medium | Already ranking for some |
| "surfline price increase" / "surfline too expensive" | Seasonal spikes | Very low | Directly relevant |
| "is surfline worth it" | 1,000+ | Low | Review/comparison angle |

### Content Plan

**Priority 1: Comparison landing page (this month)**

URL: `/vs/surfline` or `/compare/surfline`

This is not a hit piece. It is a factual, respectful comparison that acknowledges Surfline's strengths (cam network, editorial content, brand trust) while making Quiver's advantages clear (free unlimited access, ML-corrected forecasts, community features, open data philosophy).

Structure:
- Feature-by-feature comparison table
- Price comparison (Surfline Premium $119.99/yr vs Quiver free)
- Forecast accuracy data (link to `/forecast-accuracy` page)
- "What you get for free" section
- Beach coverage comparison (honest -- Surfline covers more beaches globally)
- CTA: "Try the forecast for your home break" -> deeplink to user's nearest beach

SEO: Target "surfline alternative" and "surfline vs" as primary keywords. H1: "Surfline Alternative: Free ML-Powered Surf Forecasts"

**Priority 2: Reddit and community seeding**

Surfline pricing threads appear on r/surfing every week. Every one is an opportunity to share a genuine, helpful link (not spam). The approach:

- Never badmouth Surfline. Say: "I've been using Quiver for my SD spots and the forecasts are solid. It's free and has ML-corrected predictions. Worth checking: quiversurf.app/ca/san-diego/blacks"
- Always link to a specific beach page, not the homepage. The beach page is the proof.
- Use UTM tags: `?utm_source=reddit&utm_medium=social&utm_campaign=surfline_thread`
- Do this authentically from a personal account, not a brand account. Surfers smell marketing immediately.

**Priority 3: Forecast accuracy content (already exists, amplify)**

The `/forecast-accuracy` page already exists. This is Quiver's strongest differentiator vs Surf-Forecast.com (which has no ML correction). Amplify this:

- Add real accuracy metrics to the page (pull from ML health stats: 90.4% match rate)
- Create a monthly "Forecast Report Card" blog post or social post showing accuracy stats
- Add accuracy badges to beach pages: "Quiver's forecast was within 0.5ft at Blacks 91% of the time this month"

**Priority 4: "Surfline Free Tier Changes" reactive content**

Monitor for Surfline pricing changes. When they happen (and they will -- 21% increase suggests more coming), be ready with:
- Social posts within 24 hours
- Updated comparison page
- Reddit thread participation

### What NOT to Do

- Do not create generic "best surf spots" content. This is commodity content that every surf site has. It does not differentiate Quiver.
- Do not write content that requires ongoing maintenance (daily blog, news updates). You are a solo developer. Content debt will crush you.
- Do not attack Surfline's brand. Many surfers have a love/hate relationship with Surfline. Position Quiver as "also" not "instead of."

---

## 4. Viral Loop Design: The Surf Call Card

### Why This One Mechanic

Of all possible viral mechanics (referrals, challenges, leaderboards, streaks), the shareable surf call card is the only one that works at n=1. Here is why:

- Referral programs require existing users who love the product enough to invite friends. You have 1 active user.
- Challenges and leaderboards require a community. You have no community.
- Streaks require retention. You have no retention.
- But a shareable card works with a single user, because the sharing happens on external platforms (Instagram, iMessage, WhatsApp) where the audience already exists.

### What the Card Is

The surf call card is a pre-dawn image that answers: "Should I go surfing today?"

You have already built the infrastructure: `/api/og/surf-call` generates the image, `ShareSheet` handles the share flow, `buildSurfCallShareUrl` constructs the URL. The Weekend Wave Check OG route is also built. The technical foundation is done.

**The missing piece is the trigger and the deeplink.**

### Exact Card Specification

**Format:** 1080x1920 (Instagram Story) primary, 1200x630 (OG/Twitter) secondary

**Content on the card:**

```
[Top]
  Quiver logo (small, upper-left)
  "San Diego" region label (upper-right)

[Center]
  Beach name: "BLACKS"
  Score: "8.1 / 10" (large, Charming Orange)
  Verdict: GO badge (green)
  Best window: "6:30 - 9:45am" (Charming Orange highlight)

[Condition badges (sticker-style, rotated)]
  "3-5ft"  "Light Offshore"  "Rising Tide"  "Clean Swell"

[Bottom]
  "quiversurf.app/ca/san-diego/blacks" (deeplink URL)
  QR code (optional, if space allows)
```

This is essentially what the `/api/og/surf-call` route already generates, with two changes:
1. The deeplink URL must be visible and readable on the card
2. The card must include UTM parameters when the link is shared

### Share Flow (Exact Steps)

1. **Trigger:** User opens the Oracle home screen at 5:30am. The surf call for their home break loads automatically.

2. **Share button:** Prominent share icon in the Oracle hero section (already exists via "Share your session" button, but needs to be wired to the surf call data instead of session data).

3. **User taps share:** The `ShareSheet` component opens with three options:
   - Copy Link (copies `quiversurf.app/ca/san-diego/blacks?utm_source=quiver&utm_medium=share&utm_campaign=surf_call_share`)
   - Save Image (downloads the surf call card as PNG for Instagram Story)
   - More (opens native share sheet)

4. **The recipient clicks the link or scans the QR:** They land on the beach page for Blacks. The page shows the same forecast data (free). At the bottom of the surf call section, they see: "Get tomorrow's surf call for Blacks. Free." -> auth modal.

5. **The new user signs up.** Attribution cookie captures `utm_campaign=surf_call_share`. The `ref` code from the sharing user is embedded in the URL if they shared via Copy Link.

### What Makes It Viral

The card is inherently shareable because it answers a question every surfer's friends are asking: "Is it going today?" Surfers already text each other about conditions. Quiver's card replaces the informal "yeah it's looking good" text with a beautifully branded, data-rich image that makes the sender look knowledgeable.

The card is NOT an ad for Quiver. It is a useful artifact that happens to have Quiver's branding. This is the Strava model: the activity summary card is useful to the sharer and their audience, and the branding creates passive awareness.

### Key Metric

Track `share_completed` events (already instrumented in `ShareSheet`). Target: 5 shares/week from existing users within 30 days of implementation. Do not set a viral coefficient target -- at n=1, K-factor is meaningless. Focus on share rate per active user.

### Implementation Gap Analysis

What exists:
- `/api/og/surf-call` route (1200x630 format, needs 1080x1920 variant)
- `ShareSheet` component with Copy Link / Save / More
- `buildSurfCallShareUrl` function
- UTM attribution middleware
- Referral code system

What is missing:
- The surf call share button on the Oracle home screen is wired to "Share your session" (`InviteSheet`), not to the surf call card. Rewire it.
- No 1080x1920 (Story) variant of the surf call OG image. The session card (`/api/og/session`) is 1080x1920 but the surf call card is 1200x630. Add a `format=story` query param to `/api/og/surf-call` that renders at Story dimensions.
- The deeplink URL is not rendered on the card image itself. Add `quiversurf.app/{beach_path}` as visible text at the bottom of the card.
- No automated pre-dawn sharing prompt. Consider a push notification (Capacitor/FCM) at 5:30am local time: "Today's call for Blacks: GO (8.1/10). Share it with your crew." This is the trigger that turns passive users into sharers.

---

## 5. Activation Experiments

Current activation rate: 9.5% (2 of 21 signups logged a session). Target: 25%+ within 60 days.

### Experiment 1: Redefine "Activated" to "Reported Conditions"

**Hypothesis:** "Log a Session" is too high-friction for activation. "Report Conditions" (wave size + vibe, 2 taps) was added recently and is a dramatically lower commitment. If we count "reported conditions" as activated, the activation bar is lower and the user gets immediate value (they see their report on the page, they contributed to the community).

**Implementation:** Change the activation metric from `sessions.count >= 1` to `(sessions.count >= 1 OR intel_posts.count >= 1)`. Update the onboarding flow to prompt "Report conditions at your home break" as the primary action after signup, instead of "Log your first session."

**Success metric:** Activation rate measured as (users who reported conditions OR logged a session within 7 days) / (signups) > 25%.

**Effort:** Small. Metric change + onboarding copy change. 1-2 days.

### Experiment 2: Instant Personalization on Signup

**Hypothesis:** New users sign up and see a generic authenticated home screen. There is no "aha moment" -- nothing that is clearly better than the anonymous experience they just had. If the first screen after signup shows a personalized surf call for their home break (selected during onboarding), the user immediately sees the value of having an account.

**Implementation:** After onboarding (home break selection), redirect to `/oracle` with their home break pre-selected. The Oracle home screen shows today's surf call, best window, nearby alternatives. This is the personalized experience that is gated for anonymous users.

**Success metric:** % of users who return within 48 hours of signup > 30% (vs. current near-zero).

**Effort:** Medium. Onboarding redirect logic + ensuring Oracle works for users with zero session history. 2-3 days.

### Experiment 3: Welcome Push Notification Instead of Welcome Email

**Hypothesis:** Welcome emails fail at 94% delivery. But the Capacitor app supports push notifications via FCM. For mobile users, send a push notification 4 hours after signup: "Good news -- conditions at [home break] look [good/fair] tomorrow morning. Best window: [time]." This brings them back while the signup intent is still warm.

**Implementation:** Trigger a delayed push notification from the signup server action. Use the existing FCM infrastructure. For web-only users, fall back to browser notification permission request (lower priority).

**Success metric:** D1 return rate for users who receive the push > 40%.

**Effort:** Medium. Server-side trigger + notification content generation from forecast data. 2-3 days.

### Experiment 4: Pre-Populated First Session

**Hypothesis:** "Log a Session" feels like homework. If we pre-populate a session template based on the user's home break and today's conditions (beach name, date, estimated wave height, wind conditions), the user only needs to tap "confirm" and optionally add a photo and rating. This turns a 2-minute task into a 5-second task.

**Implementation:** Add a "Quick Log" button to the Oracle home screen that pre-fills session fields from the current surf call data. User sees: "Blacks | Today | 3-5ft | Light offshore" and can confirm with one tap, or edit before saving.

**Success metric:** Session logging rate among users who see the Quick Log button > 15%.

**Effort:** Medium. New UI component + pre-fill logic from surf call data. 3-4 days.

### Experiment 5: "Your Forecast Accuracy" Hook

**Hypothesis:** Quiver's ML forecasts are 90.4% accurate, but users do not experience this as a personal benefit. If we track how the forecast compared to the user's reported conditions and show a "Your forecast was 94% accurate today" message after each session or conditions report, it creates a feedback loop that builds trust and habit.

**Implementation:** After a user reports conditions or logs a session, compare their reported wave height to Quiver's forecast for that beach/time. Show the accuracy as a toast or card: "Forecast said 3-5ft, you reported 4ft. Nailed it." Store this per-user for a "Your Forecast Accuracy" profile stat.

**Success metric:** Users who see accuracy feedback have 2x higher D7 retention than those who do not.

**Effort:** Medium-High. Comparison logic + UI component + per-user accuracy tracking. 4-5 days.

---

## 6. Anti-Patterns: What NOT to Do

### 1. Do Not Build a Referral Program Yet

The referral infrastructure is built (codes, leaderboard, middleware capture). Good. Do not market it. A referral program with 1 active user produces zero referrals. Worse, showing an empty leaderboard signals that nobody uses the product. Hide the referral leaderboard UI until there are 20+ users with sessions.

### 2. Do Not Add More Features

Quiver has: ML forecasts, surf calls, tide charts, water temp, cam access, session logging, conditions reports, social feed, follows, likes, comments, personalization, intent pages for 7 intents across 50+ cities, regional forecasts, email digests, push notifications, referral system, attribution tracking, and Bluesky auto-posting.

This is a feature set for a 100K-user product being used by 1 person. Every new feature increases maintenance burden and dilutes focus. The next 90 days should add zero new features and focus entirely on making the existing features retain the users you acquire.

### 3. Do Not Optimize the Landing Page

The landing page gets relatively little traffic compared to beach pages. Surfers arrive via SEO on `/ca/san-diego/blacks`, not via `quiversurf.app/`. Optimizing the landing page is working on the wrong page. Optimize the beach detail page -- that is where your visitors are.

### 4. Do Not Chase Virality Metrics

K-factor, viral coefficient, and share rate are meaningless at n=1. Track absolute numbers: "How many people signed up this week?" and "How many came back?" Percentages and ratios will mislead you when the denominators are single digits.

### 5. Do Not Launch on Product Hunt

A PH launch sends 500-2,000 visitors in 24 hours to a product with no community, broken welcome emails, and near-zero retention. You will get a burst of signups that all churn within a week. Save the PH launch for when you have 50+ WAU and visible community activity.

### 6. Do Not Scale Bluesky Posting Before Fixing Engagement

The auto-posting system is well-built (3 post types, template rotation, image cards). But posting into the void without engaging with replies, following surf accounts, and building relationships on the platform will make Quiver look like a bot. Spend 15 minutes after each auto-post engaging with replies and following relevant accounts.

### 7. Do Not Multi-Region Before San Diego Is Proven

Quiver covers CA, OR, WA, HI, Baja, and PR. But Blacks (San Diego) has 674 uniques/month while most other beaches have low single digits. Focus all community-building effort on San Diego. Win one city completely before expanding attention to others.

### 8. Do Not Hire for Growth

At this stage, growth is a founder task. Hiring a growth marketer before PMF means paying someone to optimize a product that does not retain users. The feedback loop between product changes and growth impact must be felt directly by the person who can change the product.

---

## 7. Timeline

### This Week (March 13-20): Fix the Foundation

**3 things only:**

1. **Fix welcome email delivery.** Diagnose and fix the 94% delivery failure in Resend. Check: sender domain DNS (SPF/DKIM/DMARC), Resend API key validity, `from` address configuration, bounce rate reputation. If Resend is permanently broken, switch to a working provider. This blocks every retention initiative.

2. **Restore the surf-call CTA as the primary conversion point.** Verify the `PublicContentGate` on surf-call conditions is working and tracking. Improve the teaser to show the actual best-window time: "Today's best window is 6:30-9:45am. Sign up to see why." This was the 2.4% converting CTA -- it needs to be visible and compelling on every beach page.

3. **Post the first manual Instagram post.** Use the Weekend Wave Check OG image (`/api/og/weekend-wave-check`). Post it as a Story with a "link" sticker to the San Diego forecast page. Do this on Friday for the weekend. Track with UTM: `?utm_source=instagram&utm_medium=social&utm_campaign=weekend_wave_01`.

### This Month (March 14 - April 14): Activation Sprint

**Week 2 (Mar 20-27):**
- Implement Experiment 1: Redefine activation to include conditions reports
- Change onboarding to prompt "Report conditions at your home break" as first action
- Add "Quick Log" pre-populated session button to Oracle home screen (Experiment 4)

**Week 3 (Mar 27 - Apr 3):**
- Wire surf call share button on Oracle to generate and share the surf-call card (Viral Loop implementation)
- Add 1080x1920 (Story) format option to `/api/og/surf-call`
- Add visible deeplink URL to the card
- Post first 3 Reddit comments in Surfline pricing threads (with UTM tracking)

**Week 4 (Apr 3-10):**
- Implement Experiment 2: Post-signup redirect to Oracle with home break pre-loaded
- Add "Local Crew" count to beach pages (social proof for anonymous visitors)
- Analyze attribution data from first 3 weeks of UTM tracking -- first-ever visibility into what is working

**Week 5 (Apr 10-14):**
- Review activation rate. If conditions reports are being filed, the metric should show improvement.
- Review share rate. If surf-call cards are being shared, track where recipients are landing and whether they convert.
- Decide whether to continue with current approach or pivot.

### This Quarter (March 14 - June 14): The Climb to 50 WAU

**Month 2 (April 14 - May 14): Content + Social Proof**

- Build the `/vs/surfline` comparison page (Content Strategy Priority 1)
- Implement "Your Forecast Accuracy" feedback loop (Experiment 5)
- Add accuracy badges to the top 10 most-visited beach pages
- Begin weekly Bluesky engagement (15 min after each auto-post)
- Target: 5 WAU, 20 MAU, 10% D7 retention

**Month 3 (May 14 - June 14): Community Seeding**

- If San Diego has 10+ active users: launch a "SD Dawn Patrol" group/crew feature (lightweight: just a shared leaderboard of who surfed this week)
- If share rate exceeds 5/week: promote the referral system (unhide the leaderboard)
- Pilot 1-2 surf school partnerships in San Diego
- Begin conditions-based push notifications for the morning surf check (Experiment 3)
- Target: 20 WAU, 50 MAU, 20% D7 retention

**End of Quarter Decision Gate:**

If by June 14, Quiver has 50+ WAU and 20%+ D7 retention:
- PMF signal confirmed. Begin scaling channels (SEO content, Instagram strategy, school partnerships).
- Consider Product Hunt launch.
- Begin weekly growth experiment cadence (10/month target).

If by June 14, Quiver has <20 WAU:
- PMF not found. Conduct user interviews with the 10-20 most active users to understand what is working and what is not.
- Consider a product pivot: pure forecast tool (drop community), or pure community tool (drop ML complexity), or niche focus (beginners only, or SD only).
- Do not continue building features without evidence of retention.

---

## Appendix: Key Files Referenced

| File | Purpose |
|------|---------|
| `/app/api/og/surf-call/route.tsx` | Surf call OG image generation (1200x630) |
| `/app/api/og/session/route.tsx` | Session card OG image (1080x1920) |
| `/app/api/og/weekend-wave-check/route.tsx` | Weekend Wave Check card (1200x630) |
| `/components/share/share-sheet.tsx` | Share sheet UI (Copy Link / Save / More) |
| `/lib/share/build-share-card-url.ts` | URL builders for all share card types |
| `/lib/share/share-image.ts` | Cross-platform image share utility |
| `/lib/attribution.ts` | UTM and referral cookie handling |
| `/lib/analytics/auth-events.ts` | Auth funnel event tracking |
| `/supabase/functions/bluesky-auto-post/index.ts` | Bluesky auto-posting Edge Function |
| `/supabase/migrations/20260313190000_create_bluesky_posting_tables.sql` | Bluesky posting infrastructure |
| `/docs/features/ATTRIBUTION_TRACKING.md` | Attribution system documentation |
| `/docs/features/SOCIAL_SHARING.md` | Social sharing system documentation |
