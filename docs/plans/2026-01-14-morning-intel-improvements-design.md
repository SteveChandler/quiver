# Unified Surf Scoring & Window Logic

**Date**: 2026-01-14
**Status**: Draft
**Author**: Steven Chandler + Claude

## Problem Statement

Two systems display surf recommendations with inconsistent logic:

### 1. Morning Surf Intel (daily notification)
- **Score/Recommendation Disconnect**: 8/10 displays as "Maybe" because logic is categorical (any "acceptable" factor = Maybe), not score-based
- **Arbitrary Time Windows**: Shows "06:00–09:00" instead of actual optimal times based on condition transitions

### 2. Home Screen "Best Bet" (discovery service)
- Already uses score-based match quality and condition-based windows with interpolation
- **Missing**: Per-beach wind thresholds (hardcoded), natural messages explaining WHY

**Root cause**: Two separate implementations that should share logic.

## Goals

- Unify scoring and window logic into a shared module
- Make score and recommendation labels consistent across both systems
- Calculate windows from actual condition transitions
- Generate natural, contextual messages explaining recommendations
- Support per-beach wind thresholds

## Non-Goals

- Populate all beaches with new fields (just Ocean Beach Pier for now)
- UI/design changes
- Push notification delivery

---

## Current State Analysis

### Discovery Service (Home Screen) — More Sophisticated

Located in `lib/services/surf-discovery-service.ts`:

**Already does well:**
- Score-based match quality mapping:
  ```
  >= 85 → "perfect"
  >= 70 → "excellent"
  >= 55 → "good"
  < 55  → "fair"
  ```
- Condition-based window with interpolation (produces times like "4-5:06pm")
- Sunset awareness (caps windows at sunset)
- Tide direction penalty (lines 816-829)
- Detailed subscores (wave height, period, wind, tide, affinity, distance)

**Missing:**
- Per-beach wind thresholds (uses hardcoded values)
- Natural message generation explaining the recommendation

### Morning Intel — Needs Upgrade

Located in `lib/analyzers/conditions-analyzer.ts` and `lib/scorers/session-window-scorer.ts`:

**Current issues:**
- Categorical recommendation logic disconnected from numeric score
- `bestWindowHeuristic()` returns arbitrary hour ranges, not condition-based
- No interpolation for transition times

---

## Design

### 1. Shared Scoring Module

Create `lib/scoring/surf-conditions-scorer.ts` with:

```typescript
interface ConditionScore {
  total: number;           // 0-100
  subscores: {
    waveHeightFit: number;
    periodEnergy: number;
    windAlignment: number;
    tideFit: number;
  };
  matchQuality: 'perfect' | 'excellent' | 'good' | 'fair' | 'skip';
  reasons: string[];       // What's working
  warnings: string[];      // What to watch
  message: string;         // Natural language summary
}

function scoreConditions(
  forecast: ForecastData,
  beach: BeachWithThresholds,
  userPrefs?: UserSurfPreferences
): ConditionScore;
```

**Match quality thresholds** (aligned with discovery service):
```
>= 85 → "perfect"   → "Worth it"
>= 70 → "excellent" → "Worth it"
>= 55 → "good"      → "Maybe"
>= 40 → "fair"      → "Maybe"
< 40  → "skip"      → "Skip"
```

**Skip conditions** (override score):
- Swell direction > 45° off window → Skip regardless of score
- Wind > `beach.max_wind_any_mph` → Skip
- Wind > `beach.max_wind_onshore_mph` AND onshore → Skip

### 2. Shared Window Calculator

Create `lib/scoring/window-calculator.ts` with:

```typescript
interface OptimalWindow {
  start: Date;
  end: Date;
  startReason: string;     // "tide enters range"
  endReason: string;       // "wind picks up"
  message: string;         // "06:15–08:45; ride the incoming before wind picks up"
}

function calculateOptimalWindow(
  forecasts: ForecastData[],
  beach: BeachWithThresholds,
  options?: {
    horizonHours?: number;
    sunsetTime?: Date;
  }
): OptimalWindow | null;
```

**Algorithm** (adapted from discovery service's `selectBestWindow`):

1. Score all forecasts, filter past times
2. For each viable start time:
   - Skip if score < threshold (40)
   - Skip if < 1 hour until sunset
   - Extend window until conditions degrade
   - Use linear interpolation for precise transition times
   - Cap at sunset
3. Track what's driving each boundary for message generation
4. Return best window with natural language explanation

### 3. Natural Message Generation

Messages constructed from condition factors:

**Worth it (score >= 70)**:
- "Worth it — offshore winds and tide in the sweet spot"
- "Worth it — swell is dialed, conditions are clean"

**Maybe (score 40-69)**:
- "Maybe — swell looks good but wind picks up after 8"
- "Maybe — brief window while tide is in range"

**Skip (score < 40 or override)**:
- "Skip — swell direction is off for this spot"
- "Skip — onshore winds all morning"

**Window context**:
- "Window ends when wind picks up around 9"
- "Best on the incoming tide before it gets too high"

---

## Schema Changes

### New columns on `beaches` table

| Column | Type | Purpose |
|--------|------|---------|
| `preferred_tide_direction` | `text` | `'rising'`, `'falling'`, `'any'`, or `null` |
| `max_wind_onshore_mph` | `numeric` | Wind speed that degrades conditions when onshore |
| `max_wind_any_mph` | `numeric` | Wind speed that's too much regardless of direction |

**Note**: Column `preferred_tide_direction` already exists but isn't populated. Wind columns are new.

### Migration

```sql
ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS max_wind_onshore_mph numeric,
ADD COLUMN IF NOT EXISTS max_wind_any_mph numeric;

-- Populate Ocean Beach Pier
UPDATE beaches
SET
  preferred_tide_direction = 'any',
  max_wind_onshore_mph = 10,
  max_wind_any_mph = 18
WHERE lower(name) = 'ocean beach pier';
```

---

## Example Output

### Morning Intel

**Before:**
```
Maybe (8/10) • Best: 06:00–09:00; cleaner before onshores
• Surf 1.7–2.8ft • Wind 0mph SW • Tide 2.9ft falling
• Maybe — keep an eye on the wind.
```

**After:**
```
Worth it (8/10) • Best: 06:15–08:45
• Surf 1.7–2.8ft • Wind 0mph SW • Tide 2.9ft falling
• Worth it — offshore winds and tide in the sweet spot. Window ends when wind picks up around 9.
```

### Home Screen Best Bet

**Before:**
```
Ocean Beach Pier is your best bet at 7.1/10.
4-5:06pm • Excellent Match
```

**After:**
```
Ocean Beach Pier is your best bet at 7.1/10.
4-5:06pm • Excellent Match
Offshore winds and tide dropping into the sweet spot.
```

### Skip Day (both systems)

```
Skip (3/10) • No good window
• Surf 2.0–3.0ft • Wind 15mph W • Tide 3.2ft falling
• Skip — onshore winds all morning.
```

---

## Implementation Plan

### Phase 1: Shared Module

1. **Create shared scoring module**
   - `lib/scoring/surf-conditions-scorer.ts` — unified condition scoring
   - `lib/scoring/window-calculator.ts` — unified window calculation
   - `lib/scoring/message-generator.ts` — natural language messages
   - `lib/scoring/types.ts` — shared types

2. **Database migration**
   - `supabase/migrations/YYYYMMDDHHMMSS_add_beach_wind_thresholds.sql`

### Phase 2: Morning Intel Integration

3. **Update Morning Intel to use shared module**
   - `scripts/morningIntel.ts` — use new scoring/window functions
   - `lib/analyzers/conditions-analyzer.ts` — deprecate old logic, re-export from shared
   - `lib/scorers/session-window-scorer.ts` — deprecate `bestWindowHeuristic`, re-export from shared

4. **Update tests**
   - `__tests__/lib/scoring/` — new tests for shared module
   - Update existing morning intel tests

### Phase 3: Discovery Service Integration

5. **Update Discovery Service to use shared module**
   - `lib/services/surf-discovery-service.ts` — import scoring from shared module
   - Keep discovery-specific logic (affinity, distance) in service
   - Add natural message to recommendation response

6. **Update home screen component**
   - `components/home-screen/hero-recommendation.tsx` — display natural message

### Files Summary

| Action | File |
|--------|------|
| **Create** | `lib/scoring/surf-conditions-scorer.ts` |
| **Create** | `lib/scoring/window-calculator.ts` |
| **Create** | `lib/scoring/message-generator.ts` |
| **Create** | `lib/scoring/types.ts` |
| **Create** | `lib/scoring/index.ts` |
| **Create** | `supabase/migrations/YYYYMMDDHHMMSS_add_beach_wind_thresholds.sql` |
| **Modify** | `scripts/morningIntel.ts` |
| **Modify** | `lib/services/surf-discovery-service.ts` |
| **Modify** | `components/home-screen/hero-recommendation.tsx` |
| **Deprecate** | `lib/analyzers/conditions-analyzer.ts` (re-export from shared) |
| **Deprecate** | `lib/scorers/session-window-scorer.ts` (re-export from shared) |

---

## Testing Strategy

1. **Unit tests for shared module**
   - Score calculation with various conditions
   - Window calculation with interpolation
   - Message generation for all match qualities
   - Skip condition overrides

2. **Integration tests**
   - Morning Intel produces correct output
   - Discovery Service produces correct output
   - Both use same thresholds for same beach

3. **Snapshot tests**
   - Example outputs match expected format

---

## Migration Path

1. Create shared module with new logic
2. Morning Intel imports from shared (breaking change contained to intel)
3. Discovery Service imports from shared (larger surface area, more careful)
4. Deprecate old modules with re-exports for backwards compatibility
5. Remove deprecated code after validation

---

## Appendix: Beach Data (Ocean Beach Pier)

**Current:**
```
preferred_tide_ft_min: 2.0
preferred_tide_ft_max: 5.0
swell_window_min_deg: 200
swell_window_max_deg: 320
preferred_tide_direction: null (column exists)
```

**Will add:**
```
preferred_tide_direction: 'any'
max_wind_onshore_mph: 10
max_wind_any_mph: 18
```
