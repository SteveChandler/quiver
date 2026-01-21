# Scoring Fix: Wave Size Penalty & Tide Direction Matching

## Problem Statement

The personalization scoring algorithm has two issues:

1. **Wave Size Penalty Too Weak**: A user preferring 3-6ft waves sees 2.3ft conditions rated as "Perfect Match" (9.4/10). The current -8 points per 0.5ft penalty is overwhelmed by good wind/tide/period scores.

2. **Missing Tide Direction**: Beaches only store optimal tide HEIGHT (e.g., 2-4ft) but not DIRECTION (rising/falling). Many breaks work significantly better on specific tide movements.

## Goals

- A 2.3ft wave for a "3-6ft" preference user should NEVER be "Perfect Match"
- Beaches that work best on falling tide should score lower during rising tide
- Maintain nuance - close misses should still score reasonably, just not "perfect"

## Success Criteria

- Avalanche at 2.3ft for "Medium 3-6ft" user → max score ~70 ("Excellent"), not 85+ ("Perfect")
- Tide direction mismatch → -10 to -15 point penalty

---

## Design

### 1. Wave Size Scoring Fix

**Current logic (too weak):**
```typescript
// Penalty: -8 points per 0.5ft outside range, max -30
const penalty = Math.min(30, Math.floor(outsideRange / 0.5) * 8);
```

**Changes:**
1. Increase penalty steepness: -12 points per 0.5ft (was -8)
2. Add score cap: If waves are outside preferred range, cap total at 75 (can never reach "Perfect Match" at 85+)
3. Keep "close range" tolerance: Waves within 20% of range get lighter penalty

**Scoring Table:**

| Wave vs Preference | Points | Max Possible Score |
|-------------------|--------|-------------------|
| Inside range (3-6ft) | 25 pts | 100 (Perfect) |
| Close range (2.4-3ft or 6-7.2ft) | 15 pts | 90 (Excellent) |
| Outside range (like 2.3ft) | 5 pts, then -12/0.5ft penalty | Capped at 75 |

**Example: 2.3ft waves, user prefers 3-6ft**
- Base: 5 points (outside range)
- Outside by: 0.7ft → penalty = floor(0.7/0.5) × 12 = 12 points
- Score cap: 75 max regardless of other factors

### 2. Tide Direction - Database Schema

**New field on `beaches` table:**

```sql
ALTER TABLE beaches
ADD COLUMN preferred_tide_direction text
CHECK (preferred_tide_direction IN ('rising', 'falling', 'either', 'slack'));
```

**Values:**
- `rising` - Beach works best on incoming tide
- `falling` - Beach works best on outgoing tide
- `slack` - Beach works best at high/low slack
- `either` - No strong preference (default)
- `NULL` - Unknown/not specified (treated as "either")

### 3. Tide Direction - Scoring Logic

**Penalty matrix:**

| Forecast Tide | Beach Prefers | Points Adjustment |
|---------------|---------------|-------------------|
| Rising | Rising | +0 (no penalty) |
| Rising | Falling | -12 points |
| Rising | Either/NULL | +0 |
| Falling | Falling | +0 |
| Falling | Rising | -12 points |
| Slack | Slack | +0 |
| Slack | Rising/Falling | -6 points (partial) |
| Any | Either/NULL | +0 |

**Implementation:**
```typescript
const beachTideDir = beach.preferred_tide_direction;
const forecastTideDir = forecast.tide_status; // "rising" | "falling" | "slack"

if (beachTideDir && beachTideDir !== 'either') {
  if (beachTideDir !== forecastTideDir) {
    const dirPenalty = forecastTideDir === 'slack' ? 6 : 12;
    total = Math.max(0, total - dirPenalty);
    reasons.push(`Tide is ${forecastTideDir}, beach prefers ${beachTideDir}`);
  }
}
```

### 4. Data Population

Beach tide direction preferences extracted via AI inference from existing `description`, `best_conditions_prose`, `wave_tips`, and `real_takeaways` fields.

**Extraction prompt used:** Analyze surf spot descriptions for tide direction mentions, output JSON with beach_id, preferred_tide_direction, confidence, and evidence.

---

## Implementation

### Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_add_beach_tide_direction.sql` | Add column + seed data |
| `lib/services/surf-discovery-service.ts` | Wave size cap + tide direction penalty |
| `types/database.generated.ts` | Regenerate after migration |

### Migration Template

```sql
-- Add preferred_tide_direction column
ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS preferred_tide_direction text
CHECK (preferred_tide_direction IN ('rising', 'falling', 'either', 'slack'));

COMMENT ON COLUMN beaches.preferred_tide_direction IS
'Optimal tide movement for this beach: rising, falling, slack, or either';

-- Seed data from AI research
-- UPDATE beaches SET preferred_tide_direction = 'falling' WHERE id = 'xxx';
```

### Code Changes

1. **Wave size cap** (~5 lines): After penalty calculation, add score cap when outside range
2. **Increase penalty** (1 line): Change `* 8` to `* 12`
3. **Tide direction penalty** (~10 lines): New block after tide height scoring

---

## Testing

1. User with "Medium 3-6ft" preference viewing 2.3ft conditions → score ≤ 75
2. Beach with `preferred_tide_direction = 'falling'` during rising tide → -12 point penalty visible
3. Beach with `preferred_tide_direction = 'either'` → no tide direction penalty
4. Existing functionality unchanged for beaches with NULL tide direction
