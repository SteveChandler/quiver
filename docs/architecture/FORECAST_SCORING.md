# Forecast Scoring Architecture

> Algorithm documentation for surf condition scoring and personalized recommendations.

## Overview

Quiver uses a multi-layered scoring system to rate surf conditions:

1. **Base Scoring** - Algorithmic score based on wind, tide, and swell direction
2. **Personalization** - User-specific boosts based on preferences and history
3. **Best Times** - Time window selection for optimal conditions

## Scoring Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     Final Score (0-100)                         │
│                    Capped, Personalized                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │ Onboarding    │  │ Learned       │  │ Beach Affinity    │   │
│  │ Preferences   │  │ Preferences   │  │ (Familiarity)     │   │
│  │ +10-18 pts    │  │ +0-33 pts     │  │ +0-15 pts         │   │
│  └───────┬───────┘  └───────┬───────┘  └────────┬──────────┘   │
│          │                  │                   │               │
│          └──────────────────┼───────────────────┘               │
│                             │                                   │
│                     ┌───────▼───────┐                           │
│                     │ Base Score    │                           │
│                     │ (0-100)       │                           │
│                     └───────┬───────┘                           │
│                             │                                   │
│  ┌───────────────┐  ┌───────▼───────┐  ┌───────────────────┐   │
│  │ Wind Score    │  │ Combined      │  │ Swell Direction   │   │
│  │ Weight: 40%   │  │ Algorithm     │  │ Weight: 40%       │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Tide Score                              │ │
│  │                    Weight: 20%                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Base Scoring Algorithm

**Location:** `lib/surf/scoring.ts`

### Component Weights

| Component | Weight | Description |
|-----------|--------|-------------|
| Wind Score | 40% | How favorable the wind direction and speed |
| Swell Direction Score | 40% | How well swell direction matches beach window |
| Tide Score | 20% | How close tide is to optimal range |

### Wind Score Calculation

```typescript
function computeWindScore(
  windDirectionDeg: number | null,
  windSpeedMs: number | null,
  offshoreDeg: number,    // Beach's ideal offshore direction
  crossOkKts: number      // Max tolerable cross-shore wind
): number
```

**Algorithm:**
1. Calculate angular distance from ideal offshore direction
2. Apply cosine falloff (0° off = 1.0, 180° off = 0.0)
3. Penalize onshore winds exceeding threshold

```typescript
// Cosine falloff: 0° off = 1, 180° off = 0
const facing = (1 + Math.cos((offBy * Math.PI) / 180)) / 2;

// Penalize high onshore speed beyond threshold
const onshorePenalty = Math.max(0, toKnots(windSpeedMs) - crossOkKts) / 10;

return clamp01(facing * (1 - onshorePenalty));
```

### Swell Direction Score Calculation

```typescript
function computeSwellDirScore(
  waveDirectionDeg: number | null,
  windowMinDeg: number,   // Beach's swell window start
  windowMaxDeg: number    // Beach's swell window end
): number
```

**Algorithm:**
1. Calculate center of beach's swell window
2. Measure angular distance from center
3. Full score inside window, fade to 0 over 30° beyond

```typescript
// Inside window: proportional to distance from center
const base = span > 0 ? inside / (span / 2 || 1) : 0;

// Beyond window: fade over 30 degrees
const fade = Math.max(0, 1 - beyond / 30);

return clamp01(Math.max(base, fade));
```

### Tide Score Calculation

```typescript
function computeTideScore(
  tideHeightM: number | null,
  tideMinFt: number,      // Beach's min preferred tide
  tideMaxFt: number       // Beach's max preferred tide
): number
```

**Algorithm:**
- Triangle band centered on optimal tide range
- Score = 1 at center, linear falloff to edges, 0 outside

```typescript
const center = (tideMinFt + tideMaxFt) / 2;
const half = (tideMaxFt - tideMinFt) / 2;
const score = 1 - Math.abs(tideFt - center) / half;
return clamp01(score);
```

### Beach Configuration Parameters

Each beach has scoring parameters:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `wind_offshore_deg` | number | Ideal offshore wind direction | - |
| `wind_cross_ok_kts` | number | Max acceptable cross-shore wind | 15 |
| `swell_window_min_deg` | number | Start of swell window | 0 |
| `swell_window_max_deg` | number | End of swell window | 0 |
| `tide_min_ft` | number | Minimum preferred tide | 0.5 |
| `tide_max_ft` | number | Maximum preferred tide | 3.5 |

### Grade Mapping

```typescript
function boardCall(score0to100: number): Grade {
  if (score0to100 >= 85) return "epic";
  if (score0to100 >= 70) return "good";
  if (score0to100 >= 55) return "fair";
  return "poor";
}
```

| Grade | Score Range | Description |
|-------|-------------|-------------|
| Epic | 85-100 | Exceptional conditions |
| Good | 70-84 | Favorable conditions |
| Fair | 55-69 | Acceptable conditions |
| Poor | 0-54 | Suboptimal conditions |

## Personalized Scoring

**Location:** `lib/services/personalized-scoring-service.ts`

### Score Breakdown

```typescript
interface PersonalizedScore {
  score: number;           // Final score (0-100)
  personalized: boolean;   // Whether personalization applied
  breakdown: {
    base: number;          // Base algorithmic score
    onboardingPrefs: number; // Bonus from onboarding
    learnedPrefs: number;    // Bonus from history
    affinity: number;        // Bonus from familiarity
  };
}
```

### Personalization Bonuses

| Source | Max Bonus | Condition |
|--------|-----------|-----------|
| **Onboarding - Wave Size** | +10 pts | Matches preferred wave size |
| **Onboarding - Break Type** | +8 pts | Matches preferred break type |
| **Learned - Wave Range** | +15 pts | Within historical 10th-90th percentile |
| **Learned - Wind Prefs** | +10 pts | Below max wind, matches direction |
| **Learned - Tide Prefs** | +8 pts | Matches preferred tide status |
| **Beach Affinity** | +15 pts | Familiarity from past sessions |

**Total Maximum Personalization:** +66 points (capped at 100 final)

### Wave Size Matching

```typescript
function matchesWaveSize(forecast, pref: string): boolean {
  const height = parseFloat(forecast.wave_height || '0');
  switch (pref) {
    case 'small':  return height >= 1 && height <= 3;
    case 'medium': return height > 3 && height <= 6;
    case 'large':  return height > 6;
    default: return false;
  }
}
```

### Learned Preferences

Derived from user's session history:

```typescript
interface UserSurfPreferences {
  confidence: number;              // 0-1, requires > 0.5 to apply
  wave_min_ft: number | null;      // 10th percentile
  wave_max_ft: number | null;      // 90th percentile
  max_wind_mph: number | null;     // Max tolerable wind
  preferred_wind_directions: number[] | null; // ±30° match
  preferred_tide_statuses: string[] | null;   // rising, high, etc.
}
```

### Beach Affinity

```typescript
// Affinity bonus calculation
if (affinity.affinity_score > 10) {
  const bonus = Math.min(affinity.affinity_score * 0.15, 15);
  score += bonus;
}
```

**Affinity Score** is computed from:
- Number of sessions at the beach
- Recency of sessions
- Session ratings

## Batch Scoring Optimization

**Location:** `lib/services/personalized-scoring-service.ts:196`

For scoring multiple beaches efficiently:

```typescript
async function scoreBeachesForUser(
  userId: string,
  beaches: Array<{ beachId, forecast, baseScore }>,
  affinityMap: Map<string, { affinity_score, session_count }>
): Promise<Map<string, PersonalizedScore>>
```

**Optimization:** 3 database queries total (not N*3):
1. User profile (onboarding preferences)
2. All beach break types (batch)
3. Learned preferences

## Database Views

### Materialized View: `mv_beach_hourly_scores`

Pre-computed hourly scores for all beaches:

```sql
-- Refresh every 2 hours via cron
SELECT refresh_mv_beach_hourly_scores();
```

### View: `v_beach_hourly_scores`

Real-time scoring view combining:
- Marine forecast data
- Tide predictions
- Beach configuration

## Best Times Algorithm

**Location:** `lib/bestTimes.ts`

Identifies optimal surf windows:

```typescript
interface BestTimeWindow {
  start: Date;
  end: Date;
  score: number;
  conditions: {
    waveHeight: string;
    windSpeed: string;
    tideStatus: string;
  };
}
```

### Window Selection Criteria

1. Score above threshold (default: 55)
2. Consecutive hours grouped into windows
3. Windows ranked by average score
4. Top 3-5 windows returned

## Usage Examples

### Get Base Score

```typescript
import { computeHourScore, boardCall } from '@/lib/surf/scoring';

const score = computeHourScore(beach, marineConditions, tideHeightFt);
const grade = boardCall(score); // "epic" | "good" | "fair" | "poor"
```

### Get Personalized Score

```typescript
import { scoreBeachForUser } from '@/lib/services/personalized-scoring-service';

const result = await scoreBeachForUser(userId, beachId, forecast, baseScore);

console.log(result.score);        // 87
console.log(result.personalized); // true
console.log(result.breakdown);    // { base: 72, onboardingPrefs: 10, ... }
```

### Get Score Breakdown

```typescript
import { computeHourScore } from '@/lib/surf/scoring';

const breakdown = computeHourScore({
  waveDirectionDeg: 270,
  wavePeriodS: 12,
  windDirectionDeg: 315,
  windSpeedMs: 3.5,
  tideHeightM: 0.8,
  params: {
    windOffshoreDeg: 315,
    windCrossOkKts: 15,
    swellWindowMinDeg: 250,
    swellWindowMaxDeg: 310,
    tidePreferredFtMin: 1,
    tidePreferredFtMax: 4,
  }
});

console.log(breakdown);
// {
//   windScore: 0.95,
//   tideScore: 0.67,
//   swellDirScore: 0.85,
//   periodScore: 0,
//   heightScore: 0,
//   total0to100: 82
// }
```

## Performance Considerations

### Caching Strategy

| Data | Cache TTL | Refresh |
|------|-----------|---------|
| Base scores | 2 hours | Materialized view |
| Personalized scores | 5 minutes | On-demand |
| Beach config | 24 hours | Database cache |

### Query Optimization

- Materialized views for hourly scores
- Batch queries for personalization
- Pre-loaded affinity maps
- Indexed forecast lookups

## Related Documentation

- [Personalization Strategy](/docs/reference/PERSONALIZATION_STRATEGY.md)
- [Forecast Implementation](/docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md)
- [Beach Data Structure](/docs/archive/reports/BEACH_DATA_STRUCTURE_ANALYSIS.md)
- [Database Schema](/docs/diagrams/database-schema.md)

---

**Last Updated:** December 2025
