
# 🏄 Quiver Gamification System

A complete spec for gamifying the Quiver app with XP, badges, levels, and UI enhancements.

---

## 🎯 Overview

We are adding a **gamification system** to our surf app **Quiver** that rewards users for actions like planning surf sessions, adding boards, posting beach intel, and inviting friends.

---

## 🌊 1. Level Progression System

Users earn **Stoke XP** and move through tiered levels:

| Tier | Title               | Description |
|------|---------------------|-------------|
| 1    | **Kook**            | New users just starting out |
| 2    | **Grom**            | Beginner, but active |
| 3    | **Paddler**         | Starting to contribute |
| 4    | **Wavestorm Warrior** | Mid-level surfer |
| 5    | **Rip Rider**       | Heavy contributor |
| 6    | **Barrel Hunter**   | Trusted community member |
| 7    | **Point Breaker**   | Influencer-like status |
| 8    | **Lineup Legend**   | Respected leader |
| 9    | **Quiver King/Queen** | Top-tier power user |

Each level has an XP threshold and unlocks profile perks.

---

## 🔥 2. XP-Generating Actions

| Action | XP |
|--------|----|
| Plan a session | +50 |
| Add a board | +30 |
| Tag board to session | +20 |
| Post beach intel | +50 |
| Review intel | +25 |
| Tag friends in session | +20 |
| Invite a friend | +100 |
| Post surf photos | +15 |
| Get a like/upvote | +10 |
| Write reflection | +25 |
| Add surf tags | +20 |
| Record temp | +10 |
| Submit crowd/parking | +10 |

---

## 🛡️ 3. Badges

### Global Badges

- **First Ride** – First session
- **Quiver Builder** – 3+ boards
- **Wave Whisperer** – 10+ intel posts
- **Session Captain** – 5 group sessions
- **Crowd Control** – 10 beach reviews
- **Local’s Tip** – 5+ likes on intel
- **The Recruiter** – Invite 3+ friends
- **Tag Team** – Tag 10 surfers
- **Sunrise Chaser** – Session before 6am
- **Dawn Patrol Legend** – 5+ pre-7am sessions
- **Storm Chaser** – Session during swell event

### Journal+ Badges

- **First Entry**
- **Consistency King/Queen**
- **Board Logger**
- **Water Watcher**
- **Wave Rater**
- **Seasoned Tracker**

### Quiver Badges

- **Quiver Starter**
- **Board Collector**
- **Tech Spec Pro**
- **Ride Logger**
- **Twin Fin Fan**
- **Quiver King/Queen**

---

## 💠 4. UI Enhancements

### Profile Page

- Level, XP, badge display
- “Next level” tooltip
- XP bar and confetti on level up

### Journal+ Tab

- XP banner: “Log reflection for +25 XP”
- Badge tab inside Journal+
- Per-session XP display

### Quiver Tab

- XP shown per board
- Badge indicators on board cards
- Tooltips: “Earn XP by tagging this board”

### Global

- XP toasts and badge unlocks
- Mobile support: horizontal scroll + collapsed badges

---

## 🗃️ 5. Database Schema

### `user_xp`

| Column | Type |
|--------|------|
| id | UUID |
| user_id | UUID |
| xp_total | INTEGER |
| level | INTEGER |
| last_updated | TIMESTAMP |

### `user_badges`

| Column | Type |
|--------|------|
| id | UUID |
| user_id | UUID |
| badge_slug | TEXT |
| unlocked_at | TIMESTAMP |
| context | JSONB |

### `badge_definitions`

| Column | Type |
|--------|------|
| badge_slug | TEXT |
| name | TEXT |
| description | TEXT |
| icon | TEXT |
| category | TEXT |
| xp_reward | INTEGER |

### `xp_events` (optional)

| Column | Type |
|--------|------|
| id | UUID |
| user_id | UUID |
| action | TEXT |
| xp | INTEGER |
| timestamp | TIMESTAMP |
| related_entity_id | UUID |

---

## ✅ Next Steps

1. Database Migrations for Gamification Schema

Prompt:

Write SQL migration scripts to create the following tables in PostgreSQL (Supabase-compatible):

user_xp: stores total XP and level for each user

user_badges: stores earned badge records per user

badge_definitions: defines static badge metadata

xp_events (optional): logs all XP-relevant events

Add appropriate indexes and constraints (e.g., FK to users). Assume UUID primary keys. Ensure compatibility with Supabase RLS and policies.
🔌 2. API/Server Actions
a. Track and Increment XP

Prompt:

Create a server-side function (TypeScript/Edge or Supabase Function) to:

Accept a user_id and an XP event (e.g., "log_session")

Lookup XP value based on event type

Add XP to user_xp table and update level if threshold crossed

Log the event in xp_events

Use a clear, maintainable pattern for managing event-to-XP mapping. Return updated XP and level in the response.
b. Evaluate Badge Unlocks

Prompt:

Write a server-side handler to evaluate and unlock badges for a given user_id after any XP-generating event.

Logic should:

Fetch existing user_badges

Compare against badge_definitions criteria (e.g., number of sessions logged, boards added, friends invited, etc.)

Insert any newly unlocked badges into user_badges with timestamp

Optionally return new badge unlocks with associated XP bonus

c. Trigger UI Animations / Toast Feedback

Prompt:

Provide frontend trigger logic (React + Shadcn/Tailwind) to:

Display toast when XP is earned (e.g., “+50 XP – Session logged”)

Animate badge unlock (confetti / flash badge modal)

Optionally add Framer Motion or Radix UI for micro-interactions

The system should accept a response payload from the server that includes:

{ xpGained: number, newLevel?: number, newBadges?: Badge[] }

🧑‍🎨 3. React/Tailwind UI Components
a. Profile XP Bar and Badge Section

Prompt:

Build a UserProfileXPCard React component with Tailwind + Shadcn UI. It should display:

Avatar, username, level, total XP

XP progress bar with % to next level

Row of earned badge icons (limit to 3, with “View All” button)

Tooltip on hover to show XP breakdown

Example layout:

🌟 Level 3 – Paddler | 🔥 2150 XP
XP Bar: ▓▓▓▓▓░░░░░░ 58%
Badges: [🌊][📍][🤝] [+ View All]

b. XP Boosters in Journal+/Quiver

Prompt:

Create XPBoosterCard components to inject into the Journal+ and Quiver tabs.

These cards should:

Show motivational message: “💡 Add a reflection to earn +25 XP!”

Include icon, action, XP value

Dismiss or collapse once action completed

Use Tailwind for mobile-first layout and animate on mount using Framer Motion.

c. Modal or Tabbed Badge View

Prompt:

Build a BadgeGallery component that:

Shows all unlocked and locked badges for the user

Groups by category: Journal+, Quiver, Global

Tooltip on hover: badge name, description, unlock criteria

Locked badges should show grayscale + “locked” overlay

Include tabs or filters for badge types (Shadcn UI Tabs)

Accepts prop: badges: Badge[], where Badge includes:

{
  slug: string;
  name: string;
  icon: string;
  category: 'Journal' | 'Quiver' | 'Global';
  unlocked: boolean;
  unlockedAt?: string;
}
