# Email Core Loop Design

## Overview

Build the foundational engagement loop for Quiver: notification-driven, decision-focused, learning over time.

### The Core Loop

1. **Trigger** — Email with a clear surf call
2. **Action** — User opens Quiver
3. **Immediate Value** — Clear yes/no decision (not a dashboard, not a wall of data)
4. **Light Commitment** — "Log this session" (1 tap) or "Save this window"
5. **Stored Memory** — Quiver gets smarter → felt improvement

### Principles

- Decision-first, not data-first
- One clear call per email
- No login required for email actions (signed tokens)
- Trust is earned by saying "no" when conditions are bad

---

## The 3-Email MVP

### Email 1: Welcome + Preferences

**Sent:** Immediately on signup

**Subject:** `Welcome to Quiver — set your surf defaults (10 seconds)`

**Body:**

```
Quiver emails you one thing: the best yes/no surf call.

When do you usually surf?
[Dawn patrol]  [After work]  [Weekends]

What's your level?
[Beginner]  [Intermediate]  [Advanced]

How often should we email?
[Daily (even if flat)]  [Only when it's good]

Home break?
[Set home beach →]

Or just reply with your home break name.
```

**Button URLs:**
- `/prefs/set?time=dawn&token=...`
- `/prefs/set?time=after_work&token=...`
- `/prefs/set?time=weekends&token=...`
- `/prefs/set?level=beginner&token=...`
- `/prefs/set?level=intermediate&token=...`
- `/prefs/set?level=advanced&token=...`
- `/prefs/set?frequency=daily&token=...`
- `/prefs/set?frequency=only_good&token=...`
- `/prefs/home-beach?token=...`

**Success page:** "Saved ✓" + "Open Quiver" button

**Home beach picker page:**
- Header: "Pick your home break"
- Search box with typeahead
- "Nearby suggestions" (top 5 based on geo or popular defaults)
- Save → "Done ✓"
- No charts, no swell/wind tables — just a preference picker

---

### Email 2: Daily "Best Window"

**Sent:** 5:15–6:00am local time

**Who gets it:**
- `email_frequency = 'daily'` → always
- `email_frequency = 'only_good'` → only if best score ≥ 6.0

**Subject (good day):** `⚡ Today: 6.8/10 at La Jolla Shores (6:30–8:00)`

**Subject (not worth it):** `🌊 Not worth it today — next window Thu Jan 22`

**Body (good day):**

```
YES — worth it if you can go by 6:30

[Offshore]  [Tide rising]  [Medium period]

Best option:
La Jolla Shores — 6.8/10 (6:30–8:00) ← your home break

Backups:
Scripps — 6.2/10 (7:00–9:00)
Blacks — 5.9/10 (6:00–8:30)

[Open in Quiver]  [Save this window]
```

**Body (not worth it):**

```
NO — not worth the paddle today.

[Onshore]  [Dropping tide]  [Short period]

Next good window: Thu Jan 22

[Open in Quiver]
```

**Key formatting rules:**
- YES/NO is big and prominent
- Why: 3 chips max (not prose)
- Best option: home break highlighted
- Backups: 2 lines, no extra stats
- Dates are specific (not "Thursday" — use "Thu Jan 22")

---

### Email 3: "Heads Up" Alert

**Sent:** 2-3 hours before a good window starts

**Who gets it:**
- Score ≥ user's threshold (default 6.5)
- Haven't received a heads-up today
- Didn't already get a daily email featuring this window

**Subject:** `⏰ Surf in ~2 hours: 7.2/10 at Sunset Cliffs (4:30–6:00)`

**Body:**

```
Light winds holding, tide about to turn.

[Open in Quiver]  [Log this session]
```

**Frequency cap:** Max 1 per user per local date

---

## Session Logging (The Memory Loop)

**Purpose:** How Quiver gets smarter. User says "I went" → system learns their preferences.

**Triggered from:**
- "Log this session" link in heads-up email
- "How was it?" prompt in app after a saved window passes

**Minimal logging page:**

```
How was it?

[👎 Skip]  [👍 Good]  [🔥 Fired]

(optional) Notes: [____________]

[Save]
```

**How it makes Quiver smarter:**
- Compare `predicted_score` vs `rating` to calibrate per-user thresholds
- If user consistently rates 6.5 windows as "fired" → lower their bar
- If user skips sessions below 7.0 → raise their bar
- Track which beaches they actually go to vs. just save

---

## Email Infrastructure

### Provider

Resend — simple API, good DX, reasonable pricing.

### Token System

Signed JWTs for stateless verification:

```typescript
{
  user_id: string,
  purpose: 'prefs' | 'save_window' | 'log_session',
  exp: number // 7 days from creation
}
```

- Signed with app secret
- No DB lookup needed to validate
- All email actions work without login

### Scheduling (Timezone-Safe)

One cron every 15 minutes using pg_cron:

1. pg_cron triggers every 15m
2. Calls `net.http_post()` to Edge Function
3. Edge Function finds eligible users (local time 05:15–06:00, not yet sent today)
4. Sends emails via Resend
5. Logs to `email_send_log`

**Edge Functions:**
- `/daily-best-window/run` — morning digest
- `/heads-up-alert/run` — 2-3 hour alerts

### Email Templates

Stored in code (not Resend dashboard) for version control. Plain HTML to start, React Email later if needed.

---

## Database Schema

### user_email_prefs

```sql
create table if not exists user_email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_frequency text not null default 'daily'
    check (email_frequency in ('daily', 'only_good', 'off')),
  min_good_score numeric not null default 6.0,
  skill_level text not null default 'beginner'
    check (skill_level in ('beginner', 'intermediate', 'advanced')),
  pref_time_bucket text not null default 'dawn'
    check (pref_time_bucket in ('dawn', 'after_work', 'weekends')),
  timezone text not null default 'America/Los_Angeles',
  home_beach_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### email_send_log

```sql
create table if not exists email_send_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null, -- 'welcome', 'daily_best_window', 'heads_up_alert'
  local_date date not null, -- user-local date for "1/day" rule
  sent_at timestamptz not null default now(),
  subject text not null,
  best_score numeric null,
  best_beach_id uuid null,
  meta jsonb not null default '{}'::jsonb
);

create unique index if not exists uniq_daily_best_window_per_day
  on email_send_log(user_id, email_type, local_date);
```

### saved_windows

```sql
create table if not exists saved_windows (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  beach_id uuid not null,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  source text not null default 'email', -- 'email', 'app'
  created_at timestamptz not null default now(),
  unique(user_id, beach_id, start_ts, end_ts)
);
```

### session_logs

```sql
create table if not exists session_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  beach_id uuid not null,
  window_start timestamptz not null,
  window_end timestamptz null,
  rating text not null check (rating in ('skip', 'good', 'fired')),
  notes text null,
  source text not null default 'email', -- 'email', 'app', 'manual'
  predicted_score numeric null, -- what Quiver said it would be
  created_at timestamptz not null default now()
);
```

---

## Route Handlers

| Route | Method | Purpose |
|-------|--------|---------|
| `/prefs/set` | GET | Set time/level/frequency via signed token |
| `/prefs/home-beach` | GET | Show beach picker UI |
| `/prefs/home-beach` | POST | Save beach selection |
| `/window/save` | GET | Save a window (1-tap from email) |
| `/session/log` | GET | Show session logging UI |
| `/session/log` | POST | Save session log |

All routes verify signed tokens — no login required.

### Token Verification Pattern

```typescript
// Verify token, extract user_id
const payload = verifyToken(token, process.env.EMAIL_TOKEN_SECRET);
if (!payload || payload.exp < Date.now()) {
  return { error: 'Invalid or expired link' };
}
const userId = payload.user_id;
```

---

## Skill-Level Personalization

### Thresholds

| Level | YES if score >= |
|-------|-----------------|
| Beginner | 6.2 |
| Intermediate | 6.0 |
| Advanced | 5.8 |

### Ranking Adjustments

- **Beginner:** Boost beaches with cleaner/smaller/safer entry conditions
- **Intermediate:** No adjustment
- **Advanced:** No safety boost; allow bigger/rowdier conditions to rank higher

Start with per-beach tags (e.g., `beginner_friendly: true`) — doesn't need to be sophisticated to feel personal.

---

## Success Metrics

### Engagement

- Welcome email completion rate (% who set at least one preference)
- Daily email open rate
- "Save this window" click rate
- "Log this session" completion rate

### Trust

- Unsubscribe rate (should be <1%)
- "Not worth it" email open rate (should match good-day rate — proves trust)

### Learning

- Session logs per user per month
- Correlation between predicted score and user rating
- Threshold drift over time (are we learning individual preferences?)

---

## Implementation Order

1. **Resend setup** — API key, domain verification
2. **Database migrations** — 4 tables above
3. **Token utility** — sign/verify functions
4. **Welcome email** — trigger on signup, preference routes
5. **Home beach picker** — simple search + nearby suggestions
6. **Daily email** — Edge Function + pg_cron
7. **Heads-up alert** — Edge Function + pg_cron
8. **Save window flow** — route + success page
9. **Session logging** — route + minimal UI
10. **Personalization v1** — skill-level thresholds

---

## Open Questions

1. **Reply parsing** — Do we want to actually parse "La Jolla Shores" replies, or just use them for user research initially?
2. **Timezone detection** — Use browser/IP on signup, or ask explicitly?
3. **Email design** — Plain HTML first, or invest in React Email upfront?
4. **"Next good window" prediction** — How accurate is the multi-day forecast? Should we hedge the language?
