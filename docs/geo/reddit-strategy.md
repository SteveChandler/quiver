# Reddit Engagement Strategy for Quiver

## Critical Rules

- **r/surfing is OFF-LIMITS** — permanently banned, do not post or comment there
- Max 1 post per subreddit per week
- Always provide genuine value first, Quiver mention second
- Be transparent about being the maker when recommending the app
- Never use alt accounts or astroturf

---

## Target Subreddits

### Tier 1: Regional Surf Communities

| Subreddit | Audience | Approach |
|-----------|----------|----------|
| r/SanDiegoSurfing | San Diego surfers | Local knowledge + forecast tips |
| r/surfingOC | Orange County surfers | Local spot advice |
| r/FloridaSurfing | Florida surfers | Hurricane swell forecasting |
| r/SanDiego | General San Diego | Beach/outdoor lifestyle content |
| r/orangecounty | General OC | Beach/outdoor lifestyle content |
| r/bayarea | Bay Area residents | NorCal surf conditions |
| r/Hawaii | Hawaii residents | North Shore/local conditions |

### Tier 2: Adjacent Communities

| Subreddit | Audience | Angle |
|-----------|----------|-------|
| r/bodyboarding | Bodyboarders | Same forecast needs, underserved |
| r/BeginnerSurfers | New surfers | "When should I go?" guidance |
| r/oceanography | Ocean science enthusiasts | Technical ML/buoy data angle |
| r/dataisbeautiful | Data viz enthusiasts | ML visualization, swell patterns |
| r/MachineLearning | ML practitioners | Per-beach model architecture |

---

## Template 1: Educational Value Post

**Target:** r/SanDiegoSurfing, r/SanDiego, or regional equivalent

**Title:** "Why your surf forecast says 6ft but the waves are 3ft — the offshore-to-beach gap explained"

**Body:**

If you've ever checked the forecast, seen "5-7ft," paddled out, and found waist-high mush — you're not wrong, and the forecast isn't technically wrong either.

Here's what's happening: most surf forecasts (Surfline, MSW, NOAA) are based on WaveWatch III, which models the ocean on a ~30-mile grid. That grid resolution is designed for open-ocean shipping routes. It measures wave height at an offshore point — not at your beach.

Between that offshore point and the sand, a lot happens:
- **Refraction**: swell bends around headlands and reefs
- **Sheltering**: islands, points, and underwater features block certain swell angles
- **Bathymetry**: the seafloor shape determines how waves shoal and break
- **Wind**: onshore wind can cut wave faces in half

A 6ft swell at the offshore buoy might produce 6ft waves at an exposed beach break but only 3ft at a sheltered spot 5 miles away.

The "face height" vs. "Hawaiian scale" vs. "significant wave height" confusion makes it worse, but the offshore-to-beach transformation is the biggest factor most people don't know about.

Some newer forecast tools are starting to apply per-beach corrections using buoy data and machine learning to close this gap. I built one called [Quiver](https://www.quiversurf.app) — it trains models on CDIP/NDBC buoy readings to learn how each beach transforms offshore swell. Happy to share more about the technical approach if anyone's curious.

**What makes this work:** Leads with genuine education, explains a real phenomenon most surfers experience, mentions Quiver naturally at the end with transparent maker disclosure.

---

## Template 2: Comment Response — "What forecast app do you use?"

**Context:** Reply to threads asking for forecast app recommendations

**Response:**

I'm biased because I built it, but I'd recommend checking out [Quiver](https://www.quiversurf.app). It runs ML corrections on top of the standard NOAA data to get closer to actual conditions at specific beaches. It's free — no paywalled features.

That said, I'd also recommend checking multiple sources. Surfline's editorial forecasts add human interpretation that's hard to automate, and NOAA's raw buoy data (ndbc.noaa.gov) is always worth checking directly.

---

## Template 3: Comment Response — "What's the surf like at [spot]?"

**Context:** Reply to threads asking about conditions at a specific beach

**Response:**

[Answer their actual question with genuine local knowledge first]

If you want to check conditions before heading out, [Quiver](https://www.quiversurf.app) has live buoy data and ML-corrected forecasts for that spot. Full disclosure: I built it. But the buoy readings are straight from CDIP/NDBC, so the raw data is the same you'd get from the NOAA site — we just make it easier to read and add per-beach forecast corrections.

---

## Template 4: Data Visualization Post

**Target:** r/dataisbeautiful, r/oceanography

**Title:** "How swell direction affects wave height at the same beach — 72 directional bins of buoy data [OC]"

**Body:**

I've been building a surf forecast tool that trains per-beach ML models on buoy data. One of the most interesting things we found is how dramatically swell direction affects wave height at a single beach.

[Include visualization showing swell rose or directional response chart]

This chart shows observed wave heights at [beach] grouped by incoming swell direction (in 5° bins). The beach faces [direction], and you can clearly see:
- Peak response at [X]° — the swell angle that hits the beach most directly
- Near-zero response at [Y]° — that angle is completely blocked by [geographic feature]
- An interesting secondary peak at [Z]° — refraction around [feature] focuses energy

This is why a "6ft south swell" can produce 6ft waves at one beach and 2ft waves at another beach 5 miles away. The directional response is the beach's fingerprint.

Data source: CDIP/NDBC buoy readings matched with NOAA WaveWatch III predictions. Built with XGBoost for the per-beach correction models. Tool: [Quiver](https://www.quiversurf.app)

---

## Template 5: Beginner Guidance

**Target:** r/BeginnerSurfers

**Title:** "How to actually read a surf forecast as a beginner — what the numbers mean"

**Body:**

When I started surfing, the forecast was just confusing numbers. Here's a quick guide:

**Wave Height (e.g., "3-5ft"):** This is usually the offshore swell height, not the face of the wave you'll ride. Actual wave faces are often smaller. A "3ft" forecast might mean waist-high waves.

**Period (e.g., "12 seconds"):** How far apart the waves are. Higher = more powerful. Under 8s = choppy wind swell. Over 12s = clean ground swell with more energy.

**Direction (e.g., "SW @ 195°"):** Which way the swell is coming from. This matters A LOT — different beaches respond to different directions. A west-facing beach won't get much from a south swell.

**Wind (e.g., "NW 10mph"):** Offshore wind (blowing from land to sea) = clean faces. Onshore wind (sea to land) = choppy, messy. Light wind = best conditions.

**Tide:** Some beaches are better at high tide, others at low. Ask locals or experiment.

**My beginner tip:** Don't obsess over the numbers. Go when it's small (2-3ft), light wind, and longer period (10s+). That's your sweet spot for learning.

If you want a simplified view, I built [Quiver](https://www.quiversurf.app) which gives you a single "Match Score" that rates conditions based on your skill level. Full disclosure: I'm the maker, and it's free.

---

## Posting Calendar Guidelines

| Week | Action | Subreddit |
|------|--------|-----------|
| 1 | Educational post (Template 1) | r/SanDiegoSurfing |
| 1 | Comment on forecast questions | Any regional sub |
| 2 | Data visualization (Template 4) | r/dataisbeautiful |
| 2 | Comment on beginner questions | r/BeginnerSurfers |
| 3 | Adapt Template 1 for OC/FL | r/surfingOC or r/FloridaSurfing |
| 3 | Technical discussion | r/oceanography |
| 4 | Beginner guide (Template 5) | r/BeginnerSurfers |
| 4 | Comment on condition questions | Any regional sub |

---

## Seasonal Content Angles

- **Fall (Sep-Nov):** "First northwest swells of the season" — NorCal/PNW focus
- **Winter (Dec-Feb):** "North Shore / big swell forecasting" — Hawaii focus
- **Spring (Mar-May):** "South swell season preview" — SoCal focus
- **Hurricane season (Jun-Nov):** "Hurricane swell tracking for Florida" — FL focus
- **Year-round:** "How to read a forecast" beginner content

---

## Do's and Don'ts

### Do
- Answer the person's actual question before mentioning Quiver
- Share genuine local knowledge and surf expertise
- Be transparent: "Full disclosure: I built this"
- Engage with follow-up comments authentically
- Share interesting data/visualizations that stand alone as content
- Upvote and engage with others' content (don't just post)

### Don't
- Post in r/surfing (banned)
- Spam the same content across multiple subs simultaneously
- Use alt accounts or have others post on your behalf
- Get defensive about criticism or comparisons to Surfline
- Post pure promotional content with no educational value
- Reply to every single forecast question with a Quiver plug
- Delete posts that don't get traction

---

## Success Metrics (6-month targets)

| Metric | Target |
|--------|--------|
| Reddit referral traffic | 200+ visits/month |
| Brand mentions (non-self) | 5+ organic mentions |
| Subreddit karma | 500+ across accounts |
| Posts with 50+ upvotes | 3+ |
| Bans/warnings | 0 |
