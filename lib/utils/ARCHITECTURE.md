# Utilities Library Architecture

## PURPOSE

The `/lib/utils` directory provides a comprehensive collection of utility functions and helpers that support core functionality across the Quiver surf community platform, offering reusable solutions for common operations.

## DIRECTORY STRUCTURE

```
lib/utils/
├── beach-card-utils.ts         # Beach card data preparation and formatting
├── beach-search-utils.ts       # Beach search and area detection
├── condition-tier-utils.ts     # Condition tier calculations and badge configs (NEW)
├── coordinate-parser.ts        # Geographic coordinate parsing and validation
├── current-forecast-utils.ts   # Current forecast time calculations
├── date-utils.ts               # Date manipulation and formatting
├── distance-utils.ts           # Geographic distance calculations
├── forecast-analytics.ts       # Forecast accuracy analysis and metrics
├── forecast-freshness.ts       # Forecast data recency + freshness/confidence helpers
├── forecast-service-utils.ts   # Forecast service orchestration
├── forecast-ui-utils.tsx       # Forecast UI formatting and components
├── horizon-strip-utils.ts      # Horizon strip formatting (uses condition-tier-utils)
├── loading-utils.tsx           # Loading state management utilities
├── map-utilities.ts            # Map positioning and viewport utilities
├── performance-utils.ts        # Performance monitoring and optimization
├── rate-limiter.ts             # API rate limiting utilities
├── request-cache.ts            # Request caching implementation
├── session-utils.ts            # Session data formatting
├── toast-utils.ts              # Toast notification helpers
├── wave-height-formatter.ts    # Wave height parsing, formatting, and source selection
├── wave-height-transformer.ts  # Beach-specific wave height transformation (NEW)
└── wind-direction.ts           # Wind direction utilities
```

## ARCHITECTURE PATTERNS

### Utility Classification System

```typescript
UtilityCategories
├── Data Processing Utilities
│   ├── Geographic (coordinate-parser, distance-utils, map-utilities)
│   ├── Temporal (date-utils, current-forecast-utils)
│   ├── Formatting (wave-height-formatter, wind-direction)
│   ├── Transformation (beach-card-utils, wave-height-transformer)
│   └── Scoring (condition-tier-utils)
├── Search and Discovery
│   ├── Search Logic (beach-search-utils)
│   ├── Area Detection (coverage validation)
│   └── Fallback Handling (out-of-area messaging)
├── Performance and Caching
│   ├── Rate Limiting (rate-limiter)
│   ├── Request Caching (request-cache)
│   ├── Performance Monitoring (performance-utils)
│   └── Loading States (loading-utils)
├── Analytics and Analysis
│   ├── Forecast Analytics (forecast-analytics)
│   ├── Accuracy Metrics (session analysis)
│   └── Trend Analysis (data correlation)
└── UI and User Experience
    ├── Toast Notifications (toast-utils)
    ├── Forecast UI (forecast-ui-utils)
    ├── Horizon Strip (horizon-strip-utils)
    └── Session Display (session-utils)
```

### Pure Function Design Pattern

```typescript
// All utilities follow pure function principles
type UtilityFunction<T, R> = (input: T) => R;
type AsyncUtilityFunction<T, R> = (input: T) => Promise<R>;

// Predictable inputs and outputs
// No side effects
// Testable and composable
```

## COMPONENT RESPONSIBILITIES

### Condition Tier Utilities (NEW)

#### **condition-tier-utils.ts** (Condition Scoring)

- **Purpose**: Centralized utilities for condition tier calculations, badge configurations, and headline text generation based on surf condition scores
- **Used by**: HeroRecommendation, HorizonStrip, CompactSpotCard, share data builder
- **Features**:
  - Score-based tier calculation
  - Tailwind color class mapping
  - Badge configuration with labels and styles
  - Headline text generation with time context
  - Timezone-aware tomorrow detection

```typescript
/**
 * Condition tier based on score thresholds
 * - great: Score >= 80
 * - good: Score 60-79
 * - fair: Score 40-59
 * - marginal: Score < 40
 */
export type ConditionTier = "great" | "good" | "fair" | "marginal";

export const CONDITION_TIER_THRESHOLDS = {
  great: 80,
  good: 60,
  fair: 40,
  marginal: 0,
} as const;

// Get condition tier based on score
export function getConditionTier(score: number): ConditionTier {
  if (score >= CONDITION_TIER_THRESHOLDS.great) return "great";
  if (score >= CONDITION_TIER_THRESHOLDS.good) return "good";
  if (score >= CONDITION_TIER_THRESHOLDS.fair) return "fair";
  return "marginal";
}

// Get Tailwind color class for score display
export function getScoreColorClass(tier: ConditionTier): string {
  switch (tier) {
    case "great":
    case "good":
      return "text-accent-orange";
    case "fair":
      return "text-amber-400";
    case "marginal":
      return "text-white/60";
  }
}

// Get condition badge configuration
export function getConditionBadge(tier: ConditionTier): ConditionBadgeConfig | null;

// Build headline text parts based on tier and time context
export function buildHeadlineText(
  beachName: string,
  tier: ConditionTier,
  isTomorrow: boolean,
  timeSlot?: TimeSlot
): HeadlineText;

// Check if a date is tomorrow in a given timezone
export function isFutureDayInTimezone(date: Date, timezone: string): boolean;
```

### Wave Height Transformation (NEW)

#### **wave-height-transformer.ts** (Beach-Specific Wave Transformation)

- **Purpose**: Transform raw buoy significant wave height (Hs) into estimated face heights that match surfer expectations
- **Features**:
  - Base shoaling factor (1.0x) - neutral baseline (raw model data may already account for shoaling)
  - Period amplification (0.8x-1.4x) - longer periods = bigger faces
  - Beach-specific direction factor (0.6x-1.0x) using terrain swell_access_factors
  - Wave height range calculation for average to set waves

```typescript
// Transformation constants
export const BASE_SHOALING = 1.0; // Reduced from 1.6 on Feb 4, 2026 (commit 0317b83)
export const PERIOD_REF = 10;
export const PERIOD_MULT = 0.05;
export const PERIOD_FACTOR_MIN = 0.8;
export const PERIOD_FACTOR_MAX = 1.4;
export const DIRECTION_FACTOR_MIN = 0.6;
export const DIRECTION_FACTOR_RANGE = 0.4;
export const SET_WAVE_VARIANCE = 1.5;

// Calculate period amplification factor
export function calculatePeriodFactor(periodS: number | null): number;

// Calculate direction factor based on beach terrain
export function calculateDirectionFactor(
  swellDirectionDeg: number | null,
  beach?: BeachTerrainConfig | null
): number;

// Transform raw Hs to face height
export function transformToFaceHeight(params: TransformParams): number;

// Get all transformation factors for debugging
export function getTransformationFactors(params: TransformParams): {
  rawHeightFt: number;
  baseShoaling: number;
  periodFactor: number;
  directionFactor: number;
  faceHeightFt: number;
};

// Transform to face height range (average to set waves)
export function transformToFaceHeightRange(params: TransformParams): WaveHeightRange;
```

**Example transformation:**
```typescript
// 1.9ft Hs @ 16s with good SW access
// = 1.9 x 1.0 (shoaling) x 1.3 (period) x 1.0 (direction)
// = 2.5ft face height
transformToFaceHeight({
  rawHeightFt: 1.9,
  periodS: 16,
  swellDirectionDeg: 225,
  beach: { terrain_enabled: true, swell_access_factors: [...] }
});
```

#### **wave-height-formatter.ts** (Wave Height Utilities)

- **Purpose**: Comprehensive wave height parsing, formatting, and source selection
- **Features**:
  - Numeric extraction from wave height strings
  - Source priority selection (CDIP sig > model swell > CDIP swell > model Hs)
  - Range formatting with appropriate precision
  - Integration with wave-height-transformer

```typescript
// Pattern for extracting numeric values
export const WAVE_HEIGHT_NUMBER_PATTERN = /(\d+(?:\.\d+)?)/;

// Extract numeric value from wave height string
export function extractNumericWaveHeight(heightString: string): number | null;

// Round and clamp utilities
export function roundWaveHeight(ft: number): number;
export function clampWaveHeight(ft: number): number;

// Source selection with priority rules
export function selectWaveHeightSource(
  params: WaveHeightSourceParams
): WaveHeightSource | null;

// Format wave height for display
export function formatWaveHeight(waveHeight?: number | string | null): string;

// Format wave height range
export function formatWaveHeightRangeString(low: number, high: number): string;

// Convert to face height with beach-specific transformation
export function toFaceHeightFeet(params: FaceHeightParams): string | null;
export function toFaceHeightRangeFeet(params: FaceHeightParams): string | null;
```

### Geographic and Spatial Utilities

#### **coordinate-parser.ts** (Coordinate Processing)

- **Purpose**: Parse and validate geographic coordinates from various formats
- **Features**:
  - Multiple coordinate format support
  - NOAA format parsing
  - US coordinate validation
  - HTML entity decoding

```typescript
export class CoordinateParser {
  static parseNOAAFormat(coordString: string): [number, number] | null {
    try {
      const decoded = this.decodeHTMLEntities(coordString);

      // Try different parsing strategies
      return (
        this.parseSimpleFormat(decoded) ||
        this.parseComplexFormat(decoded) ||
        this.parseWithRegex(decoded)
      );
    } catch (error) {
      console.error("Error parsing NOAA coordinates:", error);
      return null;
    }
  }

  static isValidUSCoordinates(coordinates: [number, number]): boolean {
    const [lat, lng] = coordinates;

    // US bounding box (approximate)
    const US_BOUNDS = {
      north: 71.5, // Alaska
      south: 18.0, // Hawaii/Florida Keys
      east: -66.0, // Maine
      west: -179.0, // Alaska (Aleutians)
    };

    return (
      lat >= US_BOUNDS.south &&
      lat <= US_BOUNDS.north &&
      lng >= US_BOUNDS.west &&
      lng <= US_BOUNDS.east
    );
  }

  static validateCoordinates(lat: number, lng: number): boolean {
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      isFinite(lat) &&
      isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
}
```

#### **distance-utils.ts** (Distance Calculations)

- **Purpose**: Calculate distances between geographic points
- **Features**: Haversine formula implementation, multiple unit support

```typescript
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: "miles" | "km" | "meters" = "miles"
): number {
  const R = unit === "miles" ? 3959 : unit === "km" ? 6371 : 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 100) / 100;
}
```

### Search and Discovery Utilities

#### **beach-search-utils.ts** (Search Logic)

- **Purpose**: Beach search with intelligent area detection and fallback handling
- **Features**:
  - Name-based beach searching
  - Out-of-area detection
  - Forecast integration
  - Fallback messaging

```typescript
export interface SearchResult {
  beach: Beach | null;
  isOutOfAreaSearch: boolean;
  detectedLocation?: string;
  suggestedMessage?: string;
}

export async function searchBeachesWithAreaDetection(
  searchText: string
): Promise<SearchResult>;
```

### Performance and Caching Utilities

#### **rate-limiter.ts** (API Rate Limiting)

- **Purpose**: Comprehensive rate limiting for external API calls
- **Features**:
  - Configurable rate limits
  - Request history tracking
  - Automatic cleanup
  - Service-specific limiters (CDIP, NOAA)

#### **request-cache.ts** (Request Caching)

- **Purpose**: Intelligent request caching with TTL and size management
- **Features**: TTL-based expiration, LRU eviction, cache statistics

### Analytics and Analysis Utilities

#### **forecast-analytics.ts** (Forecast Analysis)

- **Purpose**: Comprehensive forecast accuracy analysis and trend tracking
- **Features**:
  - Accuracy score calculations
  - Confidence correlation analysis
  - Data quality assessment
  - Trend analysis over time

### UI and Formatting Utilities

#### **forecast-ui-utils.tsx** (Forecast Display)

- **Purpose**: Forecast data formatting and UI utilities
- **Features**:
  - Time and date formatting
  - Confidence color coding
  - Forecast grouping and organization
  - Loading and error components

## PERFORMANCE OPTIMIZATIONS

### Memoization and Caching

```typescript
// Memoized expensive calculations
const memoizedDistanceCalculation = useMemo(() => {
  return beaches.map((beach) => ({
    ...beach,
    distance: calculateDistance(
      userLat,
      userLng,
      beach.latitude,
      beach.longitude
    ),
  }));
}, [beaches, userLat, userLng]);
```

### Debouncing and Throttling

```typescript
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void;

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void;
```

## TESTING STRATEGIES

### Pure Function Testing

- Test all input/output combinations
- Verify edge cases and error conditions
- Test performance with large datasets
- Validate type safety and null handling

### Test Coverage

| Utility | Tests | Coverage |
|---------|-------|----------|
| condition-tier-utils | 188+ | 100% |
| wave-height-transformer | 61+ | 100% |
| wave-height-formatter | 114+ | 100% |

### Integration Testing

- Test utility composition
- Verify cache behavior
- Test rate limiting scenarios
- Validate error propagation

## BEST PRACTICES

### Utility Design Guidelines

1. **Pure Functions**: Avoid side effects, ensure predictable outputs
2. **Type Safety**: Comprehensive TypeScript coverage
3. **Error Handling**: Graceful error handling with fallbacks
4. **Performance**: Optimize for common use cases
5. **Documentation**: Clear JSDoc comments and examples

### Code Organization Guidelines

1. **Single Responsibility**: Each utility has a focused purpose
2. **Composability**: Utilities can be combined effectively
3. **Testability**: Easy to test in isolation
4. **Reusability**: Generic implementations where possible
5. **Maintainability**: Clear naming and logical organization

### DRY Compliance

When adding new utilities:
1. Check if similar logic exists in other utilities
2. Extract shared patterns into dedicated utility files
3. Use existing utilities (e.g., `condition-tier-utils`) rather than duplicating logic
4. Add comprehensive tests to prevent regression

---

**Last Updated**: February 2026
**Status**: Production-ready with comprehensive utility library
**Recent Changes**:
- Fixed stale `BASE_SHOALING` constant in docs (1.6 -> 1.0, reduced Feb 4 2026 commit 0317b83)
- Added `condition-tier-utils.ts` for centralized condition tier logic
- Added `wave-height-transformer.ts` for beach-specific wave height transformation
- Enhanced `wave-height-formatter.ts` with shared utilities and source selection
- Updated horizon-strip-utils to use condition-tier-utils
