# Conditions Report — "How Is It Out There?"

**Date:** 2026-03-04
**Status:** Design approved, ready for implementation

## Problem

"Log Session" is positioned as personal journaling — a selfish ask with no immediate reward. Users don't log sessions because there's nothing in it for them or anyone else. Meanwhile, the data we actually need (wave size, conditions quality) could be framed as a community contribution that helps other surfers.

## Solution

Replace "Log Session" on beach detail pages with "Report Conditions." Users contribute a quick 3-tap conditions report that's visible to other users. Behind the scenes, we also create a minimal session record for ML training and personal history.

## Design

### Entry Point

On beach detail pages, the current "Log Session" button becomes:
- **Button text:** "Report Conditions"
- **Subtitle below button:** "Help others know what it's really like"
- **Same placement** as current Log Session in `beach-actions.tsx`
- **Auth required:** non-authenticated users see the auth modal (existing pattern)

### Inline Report Card

Tapping "Report Conditions" expands an inline card on the beach page (no page navigation):

```
┌──────────────────────────────────┐
│ How is it out there?             │
│                                  │
│ Waves:                           │
│ [1-2ft] [2-3ft] [3-4ft]         │
│ [4-5ft] [5+ft]                   │
│                                  │
│ Vibe:                            │
│ [🔥 Firing] [🤙 Fun]             │
│ [😑 Meh] [💨 Rough]              │
│                                  │
│ Note (optional):                 │
│ [________________________]       │
│                                  │
│        [Share Report]            │
└──────────────────────────────────┘
```

**Inputs:**
1. **Wave size** — pill selector, single choice. Options: 1-2ft, 2-3ft, 3-4ft, 4-5ft, 5+ft. Required.
2. **Vibe** — pill selector, single choice. Options: Firing, Fun, Meh, Rough. Required.
3. **Note** — optional single-line text input. Placeholder: "Anything else surfers should know?"

**Submit:** "Share Report" button. On success: card collapses, shows brief confirmation "Report shared! Thanks for helping the community."

### Data Model

One action creates two records:

**1. Intel Post** (`intel_posts` table):
- `user_id`: authenticated user
- `beach_id`: current beach
- `content`: auto-generated from selections, e.g., "3-4ft, Firing 🔥" + user note if provided
- `wave_size_range`: selected range (for structured filtering)
- `vibe`: selected vibe (for structured filtering)
- Standard timestamps

**2. Minimal Session** (`sessions` table):
- `user_id`: authenticated user
- `beach_id`: current beach
- `arrival_time`: now (or today at a reasonable default)
- `status`: 'completed'
- `source`: 'conditions_report' (new enum value — distinguishes from full session logs)
- `notes`: auto-generated same as intel post content
- No rating, board, duration, or other fields

**Dedup:** One report per user per beach per calendar day. If already reported today, show "You already reported conditions here today" with option to update.

### Beach Page Display

New "Recent Reports" section on beach detail page (above or alongside existing intel):

```
Recent Reports
┌──────────────────────────────────┐
│ Steve · 2h ago                   │
│ 3-4ft · Firing 🔥                │
│ "Clean lines, light crowd"       │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ Jake · 5h ago                    │
│ 2-3ft · Fun 🤙                   │
│ "Getting choppy after 10am"      │
└──────────────────────────────────┘
```

- Show up to 3 most recent reports from the last 24 hours
- Each card: user display name, time ago, wave size, vibe emoji, note (if any)
- Empty state: no section shown (don't show "No reports yet" — that feels dead)
- Reports older than 24h are hidden (conditions data is perishable)

### Migration Needs

- Add `wave_size_range` column to `intel_posts` (nullable text, e.g., '3-4ft')
- Add `vibe` column to `intel_posts` (nullable text, e.g., 'firing')
- Add `source` column to `sessions` if not exists (nullable text, values: 'manual', 'conditions_report', 'email_one_tap')

## Files to Change

### Modified
1. `components/beach-detail/beach-actions.tsx` — rename button, add inline report card
2. `components/beach-detail/beach-quick-actions.tsx` — update action labels
3. Beach detail page — add Recent Reports section

### New
4. `components/beach-detail/conditions-report-card.tsx` — inline report form component
5. `components/beach-detail/recent-reports.tsx` — display recent community reports
6. `actions/conditions-report-actions.ts` — server action: create intel post + session
7. Migration: add `wave_size_range`, `vibe` to `intel_posts`; add `source` to `sessions`

## Success Metrics
- Reports submitted per week (target: >5 from non-founder users within first month)
- Conversion: users who view a beach page → submit a report (target: >2%)
- Session records created via reports (feeds ML pipeline)
- Return visits from reporters (do they come back to report again?)

## Future Enhancements (not in v1)
- Show aggregated "Community says: 3-4ft, Firing" badge on beach cards in discovery
- Push notification: "Someone just reported Blacks as Firing — check it out"
- Weekly "top reporter" recognition
