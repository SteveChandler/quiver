# Live Coast Pulse Intel Integration Design

**Date:** 2026-01-13
**Status:** Approved

## Overview

Improve the Live Coast Pulse by removing the horizontal carousel and enhancing the vertical timeline feed with community intel posts including text reports, photos, and emoji condition ratings.

## Decisions Made

| Decision | Choice |
|----------|--------|
| Intel post types | Text reports, photo check-ins, emoji ratings |
| Posting locations | Beach detail (full posts), home screen (quick check-ins) |
| Feed display | Mixed chronologically with buoy/forecast data |
| Photo display | Thumbnail preview, tap to expand full-screen |
| Condition rating | Emoji scale: fire, shaka, meh, thumbsdown |
| Who can post | Any logged-in user |
| Content quality | Profanity filter + report button + community voting + trusted badges |
| Post persistence | Forever (live feed shows recent only) |
| Voting system | Keep existing confirmations (positive-only) |
| Trust indicators | Use existing user_xp.level (1-9) for display rings |

## Existing Infrastructure (No Changes Needed)

### Database Tables
- `intel_posts` - Posts with photo_url, surf_conditions JSONB, location, tags
- `intel_post_confirmations` - Binary "confirm" voting with count trigger
- `user_xp` - XP totals and levels (1-9)
- `user_badges` - Earned badges per user
- `badge_definitions` - Badge metadata

### API Endpoints
- `GET /api/intel` - Fetch nearby intel with filters (lat/lon, radius, tag, limit)
- `POST /api/intel` - Create intel post with photo, conditions, location
- `POST /api/intel/[id]/confirm` - Confirm a post
- `DELETE /api/intel/[id]/confirm` - Remove confirmation

## New Implementation Required

### 1. Database Migration

```sql
-- Add emoji_rating to intel_posts
ALTER TABLE intel_posts ADD COLUMN emoji_rating TEXT
  CHECK (emoji_rating IN ('fire', 'shaka', 'meh', 'thumbsdown'));

-- Create intel_reports table
CREATE TABLE intel_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intel_post_id UUID NOT NULL REFERENCES intel_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(intel_post_id, user_id)
);

-- Add report_count to intel_posts for auto-hide threshold
ALTER TABLE intel_posts ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0;

-- Create trigger for report count
CREATE OR REPLACE FUNCTION update_intel_report_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE intel_posts
        SET report_count = report_count + 1
        WHERE id = NEW.intel_post_id;
        -- Auto-hide if report_count >= 3
        UPDATE intel_posts
        SET is_active = false
        WHERE id = NEW.intel_post_id AND report_count >= 3;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE intel_posts
        SET report_count = GREATEST(report_count - 1, 0)
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intel_reports_count_trigger
    AFTER INSERT OR DELETE ON intel_reports
    FOR EACH ROW EXECUTE FUNCTION update_intel_report_count();

-- RLS for intel_reports
ALTER TABLE intel_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report posts" ON intel_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reports" ON intel_reports
    FOR SELECT USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_intel_reports_post_id ON intel_reports(intel_post_id);
CREATE INDEX idx_intel_posts_emoji_rating ON intel_posts(emoji_rating);
```

### 2. New API Endpoint

**`POST /api/intel/[id]/report`**

```typescript
// Request body
{ reason?: string }

// Response
{ success: true, reported: true }

// Validation
- User must be authenticated
- User cannot report own post
- User can only report each post once
```

### 3. Files to Delete

- `components/dashboard/live-pulse-carousel.tsx`

### 4. Files to Modify

**`components/dashboard/coast-pulse.tsx`**
- Add "+" button in header for quick check-ins
- Render intel posts with emoji rating display
- Show photo thumbnails (48x48px, tap to expand)
- Display user level rings based on user_xp.level
- Add vote controls (existing confirm/unconfirm)
- Add report option in overflow menu

**`app/api/coast-pulse/route.ts`**
- Fetch intel posts alongside buoy/forecast data
- Merge and sort all items chronologically
- Include user XP level for trust indicators

**`components/home-screen/index.tsx`**
- Remove LivePulseCarousel import and usage

**`components/home-screen/forecast-tab.tsx`**
- Remove LivePulseCarousel import and usage (if present)

### 5. New Files to Create

**`app/api/intel/[id]/report/route.ts`**
- POST handler for reporting posts
- Validate user auth, prevent self-reports, enforce one report per user

**`components/intel/quick-checkin-sheet.tsx`**
- Bottom sheet triggered by "+" button
- Emoji picker (required)
- Optional text note (140 chars)
- Optional single photo
- Auto-detect nearest beach from GPS
- Submit button

**`components/intel/photo-modal.tsx`**
- Full-screen dark overlay
- Swipe to dismiss
- Show poster info and caption at bottom

**`components/intel/emoji-picker.tsx`**
- Four emoji options in a row
- fire | shaka | meh | thumbsdown
- Single select, required for posting

### 6. UI Specifications

**Feed Item Layout (Intel Post):**
```
+-------------------------------------------+
| [USER] @username [level ring]             |
| "Glassy and fun, chest high sets"         |
| [emoji]  [photo thumb]                    |
| [confirm] 12  |  5 min ago  |  0.3 mi     |
+-------------------------------------------+
```

**User Level Rings:**
- Level 1-2: No ring (new)
- Level 3-4: Gray ring (regular)
- Level 5-6: Blue ring (trusted)
- Level 7-9: Gold ring (local legend)

**Quick Check-in Sheet:**
```
+-------------------------------------------+
| Quick Check-in                         X  |
|-------------------------------------------|
| How's it looking?                         |
| [fire] [shaka] [meh] [thumbsdown]        |
|-------------------------------------------|
| [Optional note... 140 chars]              |
|-------------------------------------------|
| [camera] Add photo    [pin] La Jolla      |
|-------------------------------------------|
|           [ Post Check-in ]               |
+-------------------------------------------+
```

## Testing Requirements

- E2E tests for posting intel from home screen
- E2E tests for photo upload and display
- E2E tests for reporting flow
- Unit tests for emoji picker component
- Integration tests for coast-pulse feed merging

## Migration Checklist

1. [ ] Create and apply database migration
2. [ ] Implement report API endpoint
3. [ ] Delete horizontal carousel component
4. [ ] Update coast-pulse API to include intel
5. [ ] Modify coast-pulse component for intel display
6. [ ] Create quick check-in sheet component
7. [ ] Create photo modal component
8. [ ] Create emoji picker component
9. [ ] Remove carousel from home screen
10. [ ] Add E2E tests
11. [ ] Update ARCHITECTURE.md docs
