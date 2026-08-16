# Visitor Journey Analysis — Quiver
**Date:** 2026-03-10
**Period:** Last 7 days (2026-03-03 to 2026-03-10)
**Data source:** `user_events` table, anonymous visitors only

---

## Executive Summary

The three visitor journey patterns presented for analysis tell a much cleaner story once the data is segmented correctly: **Pattern 1 is entirely bot traffic**. Patterns 2 and 3 are real human behavior, but they reveal a serious product problem — content and feature pages are full dead-ends that fail to move visitors into the core product experience.

The corrected picture of real human traffic shows a shallow funnel with almost no depth: 436 real human sessions in 7 days, a 66% bounce rate, and effectively **zero authenticated conversions**. The single CTA click that looks like a win in the raw data is from a mobile user who found a water-temp intent page on iOS — not from any of the heavily trafficked Blacks beach or tab-view journeys.

---

## Section 1: Is Pattern 1 Bot Traffic?

**Yes. Definitively.**

### Evidence

Every single session matching the "Blacks tab explorer" pattern shares an identical device fingerprint:

| Field | Value |
|---|---|
| OS | Windows |
| Browser | Chrome |
| Viewport width | 1280px |
| Session duration (median) | 1.9 seconds |
| Sessions completing in < 10s | 97.8% (440 of 451) |

No variation whatsoever. A single human population would show variance in at least viewport width and session duration. This bot visits at exact 1280px width every time.

### Timing pattern

The bot operates on a structured schedule:

| Date | Bot sessions | Bot events | Notes |
|---|---|---|---|
| Mar 4 | 10 | 10 | Low baseline |
| Mar 5 | 25 | 25 | — |
| Mar 6 | 37 | 43 | — |
| Mar 7 | 37 | 49 | — |
| Mar 8 | 24 | 32 | — |
| Mar 9 | **325** | **2,514** | Spike — coincides with major landing page deploy (commit fc04229ab) |
| Mar 10 | 95 | 938 | Still elevated |

The Mar 9-10 surge is consistent with a search engine recrawler reindexing the site after detecting substantial content changes from the cyberpunk landing page redesign. The baseline cadence (5-6 sessions firing every ~6 hours in the early morning UTC) is consistent with a scheduled crawler running on a fixed cron.

### What the bot actually does (full sequence including all event types)

When signup_cta_view events are included, the bot's actual journey pattern is:

```
beach_view → cta → cta → cta → [3-9 more cta events] → page_view → tab:reviews → cta → tab:intel → tab:sessions
```

The "tab explorer" sequence is just the final 3 steps. The earlier events are rapid-fire signup_cta_view triggers caused by something in the page render or scroll emulation. The entire journey completes in under 3 seconds.

### Metric contamination from this bot

| Metric | Raw value (7d) | Bot-generated | Real human |
|---|---|---|---|
| Anonymous sessions | 1,036 | 553 (53%) | 483 |
| Total events | 5,507 | 3,611 (66%) | 1,896 |
| signup_cta_view events | 3,448 | ~2,490 (72%) | ~958 |
| tab_view: reviews | 61 | **61 (100%)** | 0 |
| tab_view: intel | 32 | **32 (100%)** | 0 |
| tab_view: sessions | 32 | **32 (100%)** | 0 |
| tab_view: forecast | 59 | 54 (92%) | 2 |
| signup_cta_click | 7 | **6 (86%)** | **1** |
| beach_view events (Blacks) | 565 | ~430 (76%) | ~135 |

**The "Reviews is the #1 tab" finding from the raw tab view data is entirely bot-generated.** Real humans almost never click tabs. In 7 days, only 3 total tab interactions came from human sessions (2 × forecast tab, 1 × overview tab).

**The "1.5% CTA click rate" headline number is 86% bot.** The true human CTA click rate over 7 days is 1 click from 92 unique sessions that saw the CTA — approximately **1.1%**, but the denominator is itself inflated by the cam-hero double-firing bug (see Section 4).

---

## Section 2: What Are Real Human Visitors Actually Doing?

After filtering out the bot fingerprint (Windows/Chrome/1280), the Windows/Chrome/800 variant (also under 10s sessions, same pattern), and two identified developer sessions (10+ hour durations), the clean dataset is:

**436 real human sessions over 7 days**

### Who they are

| Device | OS | Sessions | % |
|---|---|---|---|
| Mobile | Android | 330 | 68.6% |
| Desktop | Windows | ~50 | ~10% |
| Mobile | iOS | 49 | 10.2% |
| Desktop | macOS | 17 | 3.5% |
| Desktop | Linux | 3 | 0.6% |

Android is the dominant platform at 68.6%. This is likely underrepresented in Vercel Analytics (which showed 83% mobile / 17% desktop) because Vercel tracks page loads while user_events only fires after JavaScript initializes.

Almost all traffic is **direct** — the referrer field is empty or an internal path for 95%+ of sessions. Organic search clicks from Google Search Console do not appear as Google referrers, suggesting either privacy-stripping (Safari/Firefox) or users navigating directly after seeing a search result.

### Session depth distribution (clean human sessions)

| Depth | Sessions | % |
|---|---|---|
| 1 event (bounce) | 271 | **56.3%** |
| 2-3 events | 136 | 28.3% |
| 4-10 events | 52 | 10.8% |
| 11-25 events | 19 | 4.0% |
| 25+ events | 3 | 0.6% |

More than half of all real human sessions end after a single event. Fewer than 5% of sessions reach meaningful engagement depth (11+ events).

### What real humans do at Pattern 2 level (map exploration)

Map interaction sessions are genuinely human — diverse device fingerprints across macOS/Safari, Firefox, iOS, Android, and Windows Edge. These users exhibit active exploration behavior:

```
guides page → beginner page → map (12 interactions) → /ca → beach views
water-temp page → map → /ca → Silver Strand (multiple times) → Imperial Beach
beginner page → map (7 interactions) → beginner page (loop)
```

Map sessions that proceed to beach views show genuine browsing: they use the map to locate beaches, then navigate into state/city pages. However, 10 of the 11 unique map sessions see only the map and exit — a 91% dead-end rate.

### What real humans do at Pattern 3 level (multi-beach browsing)

Multi-beach browsing is rare among humans: **only 3 of 177 human sessions with a beach view visited more than one beach (1.7%)**. The Pattern 3 examples in the original data are real but uncommon. Most human visitors arrive at exactly one beach page and leave.

---

## Section 3: Where Do Real Visitors Drop Off?

### Full conversion funnel (clean human sessions, 7 days)

```
436 real sessions (100%)
  ↓
175 viewed a beach (40.1%)   ← 259 sessions lost here
  ↓
9 used the map (2.1%)        ← not a funnel step, but an alternate path
  ↓
3 clicked a tab (0.7%)       ← essentially zero
  ↓
92 saw a signup CTA (21.1%)  ← CTA is shown without beach view in many cases
  ↓
1 clicked signup CTA (0.2%)  ← from intent/water-temp page on iOS
  ↓
0 completed onboarding (0.0%)
```

### The critical drop-off: landing page → beach view

The highest-leverage drop-off point is between landing on a content page and reaching a beach detail page. Here's the breakdown by first landing page:

| Landing page | Sessions | Reached beach | Beach reach rate | Bounced (1 event) |
|---|---|---|---|---|
| `/ca/*` (state/city) | 209 | 158 | **75.6%** | 50 (24%) |
| `/map` | 84 | 0 | **0.0%** | 83 (98.8%) |
| `/features` | 82 | 0 | **0.0%** | 69 (84.2%) |
| Beach direct (beach_view first) | 11 | 10 | 90.9% | 8 (73%) |
| `/tide/*` | 20 | 0 | **0.0%** | 16 (80%) |
| `/water-temp/*` | 14 | 1 | 7.1% | 6 (43%) |
| `/longboard/*` | 14 | 1 | 7.1% | 11 (79%) |
| `/beginner/*` | 7 | 0 | 0.0% | 4 (57%) |

**The map page and features page are full conversion dead-ends.** 84 sessions landed on `/map` — 83 of them (98.8%) generated exactly 1 event and left without ever seeing a beach. The `/features` page is nearly as bad at 84% single-event bounce, 0% beach reach.

The `/ca/*` state/city pages perform completely differently: 75.6% of sessions that land there reach a beach. These are working as intended and are the backbone of the conversion path.

### Intent pages (tide/water-temp/longboard/beginner): stranded in content

20 sessions landed on tide pages, 14 on water-temp, 14 on longboard, 7 on beginner. Combined: 55 sessions, 1 beach view (1.8%). These pages get organic search traffic but provide no clear path into the product.

---

## Section 4: What the Data Tells Us About Product Opportunities

### Opportunity 1 — Fix the map page (immediate, high impact)

The map is the second most visited page by humans (84 sessions, 17.7% of all human landings) and has a **98.8% bounce rate with 0% beach view rate**. Every person who finds the map leaves without engaging.

Two likely causes: (a) the map loads without meaningful surf condition overlays, making it informational rather than interactive; (b) there is no obvious next step from the map to a specific beach page. Given the map explorer sessions that do work (e.g., the guides→beginner→map→beach journey), the path from map pin to beach page needs to be more prominent and compelling.

### Opportunity 2 — Build conversion paths into intent pages (high impact, structural)

The tide/water-temp/longboard/beginner intent pages collectively attract 55 sessions per week with nearly zero conversion to beach views. These are users with high purchase intent (searching "longboard surf spots California," "water temperature Haleiwa") who land, find what looks like a content page, and leave.

Adding prominent "see conditions at nearby beaches" modules or automatic beach cards below each intent page's content would create a natural conversion path. The `/ca/*` state pages prove this approach works — 75.6% of those sessions reach a beach.

### Opportunity 3 — Fix the cam-hero CTA double-firing (tracking quality, medium)

The `cam-hero` signup CTA source generated 734 raw events from only 27 unique human sessions (27 average per session). The IntersectionObserver is firing on every scroll direction change rather than deduplicating. This inflates the CTA view count by roughly 27x for that source. Two sessions (likely developer) generated 319 and 302 cam-hero CTA fires respectively over 13-18 hour periods.

This doesn't affect conversion rates directly, but it makes it impossible to accurately measure CTA exposure for the cam-hero component. The fix is to add a fired flag after the first IntersectionObserver trigger per session.

### Opportunity 4 — Double down on `/ca/*` state/city pages (highest ROI)

The only part of the product that reliably converts visitors into engaged beach viewers is the `/ca/*` hierarchy. 75.6% beach-reach rate from 209 sessions. These pages work because they're destination-specific — a user searching "surf Encinitas" lands on `/ca/encinitas/swamis`, sees actual surf conditions, and is naturally pulled deeper.

Swami's is the second most-viewed beach by humans (57 sessions, 57 unique visitors — meaning virtually no repeat visits). This suggests organic search is sending new users to Swami's but nothing about the experience makes them return. Adding a surf session log prompt or daily conditions summary could anchor repeat visits.

### Opportunity 5 — Mobile experience is not converting (structural)

Mobile (Android + iOS) represents 78.8% of human sessions but produced the only signup CTA click (from an iOS intent page). Desktop sessions have a 50.5% beach-view rate vs 33.1% for mobile. Desktop generated the only 3 tab interactions by humans.

The gap suggests the mobile beach detail page either doesn't expose enough of the product value (forecast quality, session logs, surf calls) to motivate signup, or the signup CTA on mobile is not prominent enough. Worth checking: does the mobile layout show the surf-call-conditions CTA above the fold on Blacks?

### Opportunity 6 — Block or filter the bot from analytics (data hygiene)

The bot is not generating sign-ups and is actively corrupting all funnel metrics. Since it consistently sends the exact same fingerprint (Windows/Chrome/1280px), it can be excluded at the analytics ingestion layer. Options:

- Add a `IS_BOT` field to user_events derived from the known fingerprint
- Add a `POSTGRES_URL_NON_POOLING` query filter in any dashboard queries
- Investigate whether this bot is a known crawler (GPTBot, Googlebot misconfigured, DataForSEO, etc.) by checking Vercel server logs for User-Agent strings

The bot spiked from ~30 sessions/day to 325 on March 9 immediately after the cyberpunk landing page deploy. It will likely continue elevated activity for another day or two as recrawling completes, then return to baseline.

---

## Summary of Key Numbers

| Metric | Raw (misleading) | Corrected (human only) |
|---|---|---|
| Anonymous sessions (7d) | 1,036 | 436 |
| Bot share of sessions | — | **53.4%** |
| Beach views (Blacks) | 565 | ~135 |
| Tab views (any) | 185 | **3** |
| CTA views | 3,448 | ~270 (deduplicated) |
| CTA clicks | 7 | **1** |
| Onboarding starts | 1 | 0 |
| Map page bounce rate | — | 98.8% |
| Features page bounce rate | — | 84.2% |
| Signup CTA click rate | 1.5% | ~0.4% (of CTA-exposed sessions) |
