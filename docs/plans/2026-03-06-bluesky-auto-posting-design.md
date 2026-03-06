# Bluesky Automated Content Posting

**Date:** 2026-03-06
**Status:** Design Complete
**Goal:** Automatically post beginner-focused surf content to Bluesky to build brand presence and drive signups
**Platform:** Bluesky (@quiversurf.bsky.social)
**Launch Market:** San Diego (expand after month 2)

---

## Overview

A Supabase Edge Function (`bluesky-auto-post`) that runs on cron schedules, queries forecast and ML prediction data, scores beaches for beginner-friendliness, generates posts from templates, and publishes to Bluesky via the AT Protocol.

Adapted from the Instagram Content Strategy (`2026-03-05-instagram-content-strategy.md`) with the same brand voice, audience targeting, and content pillars — adjusted for Bluesky's platform mechanics and fully automated execution.

---

## Brand Identity

**Positioning:** The beginner's surf buddy + community hub

**Voice:** A chill friend who surfs and actually explains things without being condescending or gatekeepy.

**Core promise:** "Is today workable for someone at my level at my spot?" — Quiver answers this question that no other surf app does well.

**What we're NOT:** We don't reference competitors. We don't talk down to anyone. We don't gatekeep.

---

## Target Audience

- Beginner and intermediate surfers
- Older surfers (40+) who prioritize safety, mellow spots, less crowded windows
- Longboarders (underserved by existing tools that dismiss small/slow days)
- ~4.2 million surfers in the U.S., 35-40% started in the last 5 years

See `2026-03-05-instagram-content-strategy.md` for full audience research and demographics.

---

## Automated Post Types

Three post types, all data-driven and automatable:

| Post Type | Format | Cadence | Source Data |
|-----------|--------|---------|------------|
| **Today's a Go/No** | Text-only | Daily 6-7 AM PT | Current conditions scored for beginners |
| **Weekend Wave Check** | Image card + text | Thursdays 5 PM PT | Weekend forecast for SD beaches |
| **Longboard Sunday** | Image card + text | Sundays 4 PM PT | Small-wave spots with clean conditions |

### Cadence Phases

- **Month 1 ("daily"):** All 3 types fire on schedule (~5-7 posts/week)
- **Month 2+ ("settled"):** Reduce to ~2x/week total, keep best-performing types

---

## Architecture

```
Supabase pg_cron
  |
  |-- "0 14 * * *"   (6-7 AM PT daily)     -> Today's a Go/No
  |-- "0 1 * * 5"    (Thu 5 PM PT weekly)   -> Weekend Wave Check
  |-- "0 0 * * 1"    (Sun 4 PM PT weekly)   -> Longboard Sunday
  |
  v
Edge Function: bluesky-auto-post (post_type param from cron)
  |
  1. Read posting_config -> should I post today?
  2. Query DB for forecast data + beach info
  3. Score beaches for beginner-friendliness
  4. Pick template (rotate, avoid recent repeats)
  5. Fill data slots from query results
  6. If image post: fetch PNG from quiversurf.app/api/og/...
  7. Upload image blob to Bluesky CDN
  8. Create post via AT Protocol
  9. Log result to posting_log
```

### New Database Tables

```sql
-- Cadence and enable/disable control
create table posting_config (
  id uuid primary key default gen_random_uuid(),
  post_type text not null,         -- 'go_no', 'weekend_wave', 'longboard_sunday'
  enabled boolean default true,
  cadence_phase text default 'daily', -- 'daily' or 'settled'
  last_posted_at timestamptz,
  created_at timestamptz default now()
);

-- Audit log of everything posted
create table posting_log (
  id uuid primary key default gen_random_uuid(),
  post_type text not null,
  bluesky_uri text,                -- AT Protocol post URI
  content_text text not null,
  image_url text,                  -- OG image URL used (if any)
  template_index int,              -- which template was used
  beaches_featured text[],         -- spots mentioned
  success boolean default true,
  error_message text,
  posted_at timestamptz default now()
);
```

### Existing Tables Used

- `forecast_data` — wave height, swell period, wind, tide predictions
- `beaches` — beach metadata, location, slug
- `ml_predictions` + `observations` — for future accuracy brag posts

### Secrets (Supabase Vault)

- `BLUESKY_HANDLE` — Bluesky username
- `BLUESKY_APP_PASSWORD` — generated app password (not account password)

---

## Beginner Scoring Logic

For each SD beach, compute a beginner-friendliness score from the current forecast window:

| Factor | Good for beginners | Score boost | Bad for beginners | Score penalty |
|--------|-------------------|-------------|-------------------|---------------|
| Wave height | 1-3 ft | +3 | 5+ ft | -3 |
| Swell period | 8-12s (mellow) | +2 | 15s+ (powerful) | -2 |
| Wind speed | <8 mph | +2 | 12+ mph | -2 |
| Wind direction | Offshore/calm | +2 | Onshore | -1 |
| Tide | Mid-tide windows | +1 | Extreme low/high | -1 |

**Thresholds:**
- Score >= 7: Go (green)
- Score 4-6: Maybe (yellow)
- Score < 4: No (red)

The function selects the top 2-3 scoring beaches for "Go" posts, or declares a rest day if no beaches score above 4.

---

## Template System

### Today's a Go/No (text-only)

**GO templates:**
```
"San Diego -- today's a go.
{beach_1}: {height}ft, {wind_desc}. {one_line_reason}.
{beach_2}: {height}ft, {wind_desc}. {one_line_reason}.
Best window: {time_window}.
quiversurf.app"

"Get out there, San Diego.
{beach_1} is looking {vibe} -- {height}ft with {wind_desc}.
{time_window} is your window.
quiversurf.app"

"Good morning, San Diego. Conditions are working.
{beach_1}: {height}ft, {wind_desc}.
{beach_2}: {height}ft, {wind_desc}.
Head out before {end_time}.
quiversurf.app"
```

**MAYBE templates:**
```
"San Diego -- maybe today.
{beach_1} could work if you go early -- {height}ft but {caveat}.
{beach_2} is a skip unless you're comfortable in {condition}.
quiversurf.app"

"Not the cleanest day in San Diego, but {beach_1} has a window.
{height}ft with {wind_desc}. Go {time_window} if you're going.
quiversurf.app"
```

**NO templates:**
```
"San Diego -- rest day.
{reason} across the board.
Good day to stretch, wax your board, or watch some surf clips.
Tomorrow's looking {tomorrow_outlook}.
quiversurf.app"

"Skip it today, San Diego. {reason}.
Save your energy -- {tomorrow_outlook} tomorrow.
quiversurf.app"
```

### Weekend Wave Check (image + text)

```
"Weekend Wave Check -- San Diego
Saturday: {sat_verdict} -- {sat_summary}
Sunday: {sun_verdict} -- {sun_summary}
Best call: {best_window}.
Full forecast: quiversurf.app"

"Your San Diego weekend surf plan:
{best_day} {best_time} is the move.
{best_beach} -- {height}ft, {wind_desc}, {vibe}.
The rest of the weekend: {other_summary}.
quiversurf.app"

"Weekend outlook for San Diego:
{best_day} is your day. {best_beach} looking {vibe}.
{other_day}: {other_summary}.
quiversurf.app"
```

Image: New `/api/og/weekend-wave-check` route with Saturday/Sunday breakdown layout.

### Longboard Sunday (image + text)

```
"Longboard Sunday -- {beach}
{height}ft, {wind_desc}, {tide_desc}.
{vibe_line}.
quiversurf.app/{beach_path}"

"Small wave paradise today.
{beach}: {height}ft and {wind_desc}.
Grab the log, take your time.
quiversurf.app/{beach_path}"

"Sunday session at {beach}.
{height}ft, {wind_desc}. {tide_desc}.
This is what longboarding is for.
quiversurf.app/{beach_path}"
```

Image: Existing `/api/og/beach?id={beach_id}` route.

### Template Rotation

Store `template_index` in `posting_log`. For each post, pick a template that wasn't used in the last 3 posts of that type.

### Data Slot Definitions

| Slot | Source | Example |
|------|--------|---------|
| `{beach_1}`, `{beach_2}` | Top-scoring beginner beaches | "La Jolla Shores" |
| `{height}` | `forecast_data.wave_height` | "2-3" |
| `{wind_desc}` | Derived from wind speed + direction | "light offshore" |
| `{one_line_reason}` | Template phrases keyed to score factors | "clean and mellow" |
| `{time_window}` | Best tide + wind window | "6-10 AM" |
| `{end_time}` | End of best window | "10 AM" |
| `{vibe}` | Composite adjective from conditions | "glassy" |
| `{caveat}` | Primary negative factor | "wind picks up by noon" |
| `{condition}` | Condition descriptor | "choppy surf" |
| `{reason}` | Why it's a no-go | "Onshore wind and high tide" |
| `{tomorrow_outlook}` | Next day's verdict | "much better" |
| `{sat_verdict}` / `{sun_verdict}` | Go/Maybe/Skip | "Go" |
| `{sat_summary}` / `{sun_summary}` | One-line day summary | "2-3ft, light offshore, clean" |
| `{best_day}` | Better weekend day | "Saturday" |
| `{best_time}` | Best time that day | "morning" |
| `{best_beach}` | Top beach for that window | "Tourmaline" |
| `{other_summary}` | Summary of the other day | "choppier but still fun" |
| `{tide_desc}` | Tide state | "incoming mid-tide" |
| `{vibe_line}` | Mood sentence | "Perfect morning to cruise on a log" |
| `{beach_path}` | URL path for the beach | "ca/san-diego/tourmaline" |

---

## Bluesky API Integration

### Authentication

```ts
const session = await fetch(
  "https://bsky.social/xrpc/com.atproto.server.createSession",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: BLUESKY_HANDLE,
      password: BLUESKY_APP_PASSWORD,
    }),
  }
);
const { accessJwt, did } = await session.json();
```

Fresh session per Edge Function invocation (tokens expire ~2h, each run is short).

### Image Upload

```ts
const imageBytes = await fetch(
  "https://quiversurf.app/api/og/weekend-wave-check?..."
).then((r) => r.arrayBuffer());

const upload = await fetch(
  "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessJwt}`,
      "Content-Type": "image/png",
    },
    body: imageBytes,
  }
);
const { blob } = await upload.json();
```

### Post Creation

```ts
await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessJwt}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    repo: did,
    collection: "app.bsky.feed.post",
    record: {
      $type: "app.bsky.feed.post",
      text: postText,
      createdAt: new Date().toISOString(),
      embed: blob
        ? {
            $type: "app.bsky.embed.images",
            images: [{ alt: altText, image: blob }],
          }
        : undefined,
      facets: buildLinkFacets(postText),
    },
  }),
});
```

### Key Implementation Notes

- URLs must be wrapped in `facets` with **byte-level** indices (UTF-8 byte offsets, not character offsets)
- Images require an `alt` text field for accessibility
- App passwords are generated in Bluesky Settings > App Passwords (separate from account password)
- Rate limit: 1,666 creates/day (more than sufficient)

### Error Handling

- Bluesky API down: log failure to `posting_log`, don't retry (next cron run picks up)
- OG image route fails: post text-only (graceful degradation)
- No good beaches found: post a "rest day" template instead of skipping

---

## Bluesky Profile Setup

- **Handle:** `@quiversurf.bsky.social`
- **Display name:** Quiver - Surf Forecast
- **Bio:** "Your surf buddy for San Diego waves. Should you go today? We'll tell you. quiversurf.app"
- **Avatar:** Quiver logo on brand teal background
- **Link:** `quiversurf.app/?utm_source=bluesky`

---

## Rollout Plan

### Phase 1 -- Setup (Day 1)
- Create Bluesky account
- Generate app password, store in Supabase Vault
- Set up profile (bio, avatar, link)

### Phase 2 -- Build (Days 2-4)
- Migration: `posting_config` and `posting_log` tables
- Edge Function `bluesky-auto-post`:
  - Beginner scoring logic
  - Template system (~12 templates across 3 post types)
  - Bluesky API client (auth, upload, post)
  - OG image fetching with fallback to text-only
- New OG route: `/api/og/weekend-wave-check`

### Phase 3 -- Test (Days 5-6)
- Dry-run mode: function runs but logs output without posting
- Verify: correct beaches selected, scoring makes sense, templates read well, images render
- Manual test post to confirm Bluesky API integration

### Phase 4 -- Launch (Day 7)
- Enable cron jobs
- Monitor `posting_log` daily for first week
- Manual engagement on Bluesky (follow SD surf accounts, reply to posts)

### Phase 5 -- Settle (Week 5)
- Switch `cadence_phase` from `'daily'` to `'settled'`
- Evaluate which post types got engagement
- Decision point: add manual content pillars or keep automated-only

---

## Future Enhancements (Not in V1)

- **LLM-generated copy:** Replace templates with Claude API for more varied, natural posts
- **Forecast accuracy brags:** "Our ML model predicted Xft, actual was Yft" posts using `ml_predictions` + `observations`
- **Manual content pillars:** Spot Check guides, Learn the Ocean explainers (from Instagram strategy)
- **Custom Bluesky feed:** Create a "San Diego Surf Conditions" feed that aggregates Quiver posts
- **Geographic expansion:** LA/OC (month 3), SF/Santa Cruz (month 4), OR/WA/HI (month 5+)
- **Cross-posting:** Add X/Twitter or Threads as additional targets from the same Edge Function
- **Engagement tracking:** Track likes/reposts/replies from Bluesky API to measure what content works

---

## Content-to-Download Funnel

```
See post -> Tap profile -> Read bio -> Tap link -> Land on quiversurf.app -> See SD forecast -> Sign up
```

- Bio link: `quiversurf.app/?utm_source=bluesky`
- Don't link to Quiver in every post. Bio link is enough for most. Include `quiversurf.app` at the end of each post as a subtle CTA.
- Don't link to app store directly -- let the site convince them first.

---

## Estimated Build Effort

| Piece | Effort |
|-------|--------|
| Migration (2 tables) | Small |
| Edge Function (scoring + templates + Bluesky client) | Medium |
| New OG route (`/api/og/weekend-wave-check`) | Small |
| Bluesky account setup | Trivial |
| **Total** | **~2-3 days** |
