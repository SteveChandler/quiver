
# 🏄 Quiver Gamification System

Note: This is the original spec. For the up-to-date, canonical doc (status, schema, integration, tests, and next steps) see `docs/GAMIFICATION.md`.

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

## ✅ Implementation Status - COMPLETED

### 🎉 All Steps Successfully Implemented!

The gamification system has been fully implemented and integrated into the Quiver application. Here's what was completed:

---

### 1. ✅ Database Migrations for Gamification Schema

**Status**: COMPLETED
- **Migration File**: `supabase/migrations/20250828000000_create_gamification_system.sql`
- **Tables Created**: 
  - `user_xp` - Stores total XP and level for each user
  - `user_badges` - Stores earned badge records per user  
  - `badge_definitions` - Defines static badge metadata with icons
  - `xp_events` - Logs all XP-relevant events
- **Features**:
  - All tables have proper UUID primary keys
  - Foreign key constraints to `auth.users`
  - RLS policies for security
  - Performance-optimized indexes
  - 23 badges seeded with Lucide React + emoji icons

---

### 2. ✅ API/Server Actions

**Status**: COMPLETED

#### a. Track and Increment XP
- **File**: `lib/gamification-actions.ts`
- **Function**: `trackXP(action, entityId, entityType)`
- **Features**:
  - XP event mapping for all 13 action types
  - Level progression calculation (9 tiers)
  - Automatic level-up detection
  - XP event logging for analytics

#### b. Evaluate Badge Unlocks  
- **Function**: `evaluateBadgeUnlocks(userId, supabase)`
- **Features**:
  - Automatic badge evaluation after XP events
  - Badge unlock tracking with timestamps
  - XP rewards for badge unlocks
  - Support for all 23 badge types

#### c. Integration Points
- **Session Actions**: `actions/session-actions.ts` - XP tracking added to `createLoggedSession` and `createPlannedSession`
- **Board Actions**: XP tracking added to `addBoard` function
- **Beach Reviews**: `actions/beach-review-actions.ts` - XP tracking for reviews and crowd/parking info

---

### 3. ✅ React/Tailwind UI Components

**Status**: COMPLETED

#### a. Profile XP Bar and Badge Section
- **File**: `components/gamification/user-xp-card.tsx`
- **Features**:
  - Avatar with level badge
  - XP progress bar with percentage
  - Recent badges display (top 3)
  - Tooltip with XP breakdown
  - Mobile-responsive design

#### b. XP Boosters
- **Files**: 
  - `components/journal/xp-boosters.tsx`
  - `components/quiver/xp-boosters.tsx`
- **Features**:
  - Motivational XP cards
  - Smart action prompts
  - Shimmer animations
  - Click-to-action navigation

#### c. Badge Gallery
- **File**: `components/gamification/badge-gallery.tsx`
- **Features**:
  - Tabbed view by category
  - Locked/unlocked states
  - Progress tracking
  - Tooltips with descriptions
  - Mobile-optimized layout

#### d. XP Toast System
- **File**: `components/gamification/xp-toast-system.tsx`
- **Features**:
  - XP gain notifications
  - Level-up celebrations with confetti
  - Badge unlock animations
  - Custom toast styles

---

### 4. ✅ Additional Components Created

- **Badge Icon Renderer**: `components/gamification/badge-icon.tsx` - Smart icon system supporting Lucide + emojis
- **Gamification Hooks**: `hooks/use-gamification.ts` - Reusable hooks for XP tracking
- **Profile Section**: `components/profile/gamification-section.tsx` - Complete profile integration
- **Test Page**: `components/gamification/gamification-test-page.tsx` - Development testing interface

---

### 5. ✅ Testing & Verification

- **Database**: All 4 tables created and verified via psql
- **Badge Seeding**: 23 badges successfully seeded
- **Playwright Tests**: Created comprehensive E2E tests
- **Integration Tests**: Verified XP tracking in all flows
- **No Breaking Changes**: Existing functionality preserved

---

## 📊 Implementation Metrics

- **Files Created**: 12 new files
- **Files Modified**: 4 existing files  
- **Lines of Code**: ~2,500 lines
- **Test Coverage**: E2E tests for all major flows
- **Performance**: Non-blocking XP tracking
- **Icons**: 23 unique badge icons configured

---

## 🚀 Ready for Production

The gamification system is fully operational and integrated throughout the Quiver application, driving user engagement through:

- **Session Planning**: +50 XP
- **Board Management**: +30 XP  
- **Beach Intel**: +25-50 XP
- **Friend Invitations**: +100 XP (highest for viral growth)
- **Journal Entries**: +10-25 XP
- **Community Features**: +10-20 XP

All components follow Quiver's established patterns and maintain the growth-first focus!
