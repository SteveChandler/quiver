# Domains Architecture

This directory contains the domain-driven scoring architecture for surf condition evaluation. Each domain is a self-contained module with clear boundaries and responsibilities.

## Overview

```
lib/domains/
├── spot-profile/     # Beach characteristics and thresholds
├── conditions/       # Forecast interpretation and trend analysis
├── scoring/          # Pluggable scoring engine
├── user-preferences/ # User preference types
└── shared/           # Common utilities (angle math)
```

## Design Principles

1. **Immutable Data**: All domain types are readonly to prevent accidental mutation
2. **Pure Functions**: No side effects in scoring logic - same input always produces same output
3. **Plugin Architecture**: Scorers are independent modules that can be added/removed
4. **Backwards Compatibility**: Discovery adapter bridges new architecture with existing services

## Domains

### spot-profile

Converts Beach database rows into SpotProfile value objects.

**Key Types:**
- `SpotProfile` - Immutable beach characteristics (swell window, wind thresholds, tide preferences)
- `SwellWindow` - Angular range for optimal swell directions
- `WindThresholds` - Wind speed/direction limits
- `TidePreferences` - Preferred tide height and direction

**Key Functions:**
- `createSpotProfile(beach: Beach): SpotProfile` - Factory function for beach conversion
- `isDirectionInWindow(directionDeg, window): boolean` - Check if swell is in window
- `calculateWindowAlignment(directionDeg, window): number` - Score swell alignment (0-100)

**Usage:**
```typescript
import { createSpotProfile, isDirectionInWindow } from '@/lib/domains/spot-profile';

const profile = createSpotProfile(beach);
const isGoodSwell = isDirectionInWindow(270, profile.swellWindow);
```

### conditions

Interprets forecast data into structured snapshots and windows.

**Key Types:**
- `ConditionsSnapshot` - Single point-in-time conditions (wave, wind, tide)
- `ConditionsWindow` - Multiple snapshots with trend analysis
- `SwellComponent` - Individual swell data with computed energy
- `TrendDirection` - 'improving' | 'stable' | 'degrading'

**Key Functions:**
- `createSwellComponent(height, period, direction): SwellComponent`
- `analyzeSwell(profile, primary, secondary): SwellAnalysis`
- `detectTrend(snapshots, metric): TrendDirection`

**Usage:**
```typescript
import { createSwellComponent, analyzeSwell } from '@/lib/domains/conditions';

const swell = createSwellComponent(4, 12, 270);
const analysis = analyzeSwell(profile, swell, null);
```

### scoring

The core scoring engine with pluggable scorer architecture.

**Architecture:**
```
ScoringEngine
    ├── register(scorer) → Add scorer plugin
    ├── score(input) → Run all scorers
    └── getScorerNames() → List registered scorers

ScorerPlugin interface:
    ├── name: string
    ├── weight: number (0-1)
    └── score(input) → ScorerResult
```

**Built-in Scorers (8 total):**

| Scorer | Weight | Description |
|--------|--------|-------------|
| `baseConditionsScorer` | 0.25 | Wave height and period vs thresholds |
| `swellAlignmentScorer` | 0.15 | Primary swell direction vs beach window |
| `swellInterferenceScorer` | 0.15 | Primary vs secondary swell crossing |
| `windQualityScorer` | 0.15 | Offshore/cross/onshore wind evaluation |
| `tideFitScorer` | 0.05 | Tide height preferences |
| `tideDirectionScorer` | 0.15 | Tide direction (rising/falling) vs beach preferences |
| `windowStabilityScorer` | 0.05 | Conditions consistency over time |
| `trendPreferenceScorer` | 0.05 | Improving vs degrading trend bonus |

**Usage:**
```typescript
import { ScoringEngine, baseConditionsScorer, windQualityScorer } from '@/lib/domains/scoring';

const engine = new ScoringEngine();
engine.register(baseConditionsScorer);
engine.register(windQualityScorer);

const result = engine.score({
  profile,
  snapshot,
  window: null,
  preferences: null,
});
```

### Discovery Adapter

Bridges the new scoring architecture with the existing `surf-discovery-service.ts`.

**Key Functions:**
- `createDiscoveryScoringEngine()` - Pre-configured engine with all standard scorers
- `beachToSpotProfile(beach)` - Convert Beach → SpotProfile
- `forecastToSnapshot(forecast)` - Convert EnhancedForecastEntity → ConditionsSnapshot
- `scoreBeachWithEngine(engine, beach, forecast, options)` - Full scoring pipeline

**Migration Path:**

```typescript
// OLD (surf-discovery-service.ts)
const score = scoreBeachForDiscovery(beach, forecast, userLoc);

// NEW (using discovery adapter)
import { createDiscoveryScoringEngine, scoreBeachWithEngine } from '@/lib/domains/scoring';

const engine = createDiscoveryScoringEngine();
const score = scoreBeachWithEngine(engine, beach, forecast, {
  affinityBonus: 5,
  distancePenalty: -10,
});
```

### user-preferences

Types for user preference data used in personalized scoring.

**Key Types:**
- `UserPreferences` - User's preferred wave sizes, skill level, favorite spots

### shared

Common utilities shared across domains.

**Key Functions:**
- `normalizeAngle(deg): number` - Normalize angle to 0-360 range
- `angleDifference(deg1, deg2): number` - Shortest angular distance (0-180)
- `getCardinalDirection(deg): string` - Convert degrees to cardinal string

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Beach (DB)     │ ──► │  SpotProfile     │ ──► │                 │
└─────────────────┘     └──────────────────┘     │                 │
                                                  │  ScorerInput    │
┌─────────────────┐     ┌──────────────────┐     │                 │
│  Forecast (DB)  │ ──► │  ConditionsSnap  │ ──► │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                              ┌───────────────────┐
                                              │   ScoringEngine   │
                                              │   (8 scorers)     │
                                              └─────────┬─────────┘
                                                        │
                                                        ▼
                                              ┌───────────────────┐
                                              │  CompositeScore   │
                                              └─────────┬─────────┘
                                                        │
                                              ┌─────────▼─────────┐
                                              │  DetailedScore    │
                                              │  (legacy format)  │
                                              └───────────────────┘
```

## Creating Custom Scorers

Scorers implement the `ScorerPlugin` interface:

```typescript
import type { ScorerPlugin, ScorerInput, ScorerResult } from '@/lib/domains/scoring';

export const myCustomScorer: ScorerPlugin = {
  name: 'myCustomScorer',
  weight: 0.1,
  score: (input: ScorerInput): ScorerResult => {
    const { profile, snapshot } = input;

    // Your scoring logic here
    const score = 75;

    return {
      name: 'myCustomScorer',
      score,
      weight: 0.1,
      reasons: ['Custom reason'],
      warnings: [],
      skip: false,
      skipReason: null,
    };
  },
};
```

## Testing

All domains have comprehensive test coverage in `__tests__/lib/domains/`.

```bash
# Run domain tests
yarn test:unit --testPathPattern="domains"

# Run specific domain tests
yarn test:unit --testPathPattern="domains/scoring"
```

## Files Reference

```
lib/domains/
├── ARCHITECTURE.md              # This file
├── spot-profile/
│   ├── index.ts                 # Barrel exports
│   ├── types.ts                 # SpotProfile, SwellWindow, etc.
│   └── spot-profile.ts          # createSpotProfile factory
├── conditions/
│   ├── index.ts                 # Barrel exports
│   ├── types.ts                 # ConditionsSnapshot, SwellComponent, etc.
│   ├── swell-analyzer.ts        # Swell analysis functions
│   └── trend-detector.ts        # Trend detection algorithms
├── scoring/
│   ├── index.ts                 # Barrel exports
│   ├── types.ts                 # ScorerPlugin, CompositeScore, etc.
│   ├── scoring-engine.ts        # ScoringEngine class
│   ├── discovery-adapter.ts     # Backwards compatibility adapter
│   └── scorers/
│       ├── index.ts             # Scorer barrel exports
│       ├── base-conditions-scorer.ts
│       ├── swell-alignment-scorer.ts
│       ├── swell-interference-scorer.ts
│       ├── wind-quality-scorer.ts
│       ├── tide-fit-scorer.ts
│       ├── tide-direction-scorer.ts
│       ├── window-stability-scorer.ts
│       └── trend-preference-scorer.ts
├── user-preferences/
│   ├── index.ts                 # Barrel exports
│   └── types.ts                 # UserPreferences type
└── shared/
    ├── index.ts                 # Barrel exports
    └── angle-utils.ts           # Angle math utilities
```
