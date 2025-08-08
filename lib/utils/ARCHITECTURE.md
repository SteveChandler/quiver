# Utilities Library Architecture

## 🎯 **PURPOSE**

The `/lib/utils` directory provides a comprehensive collection of utility functions and helpers that support core functionality across the Quiver surf community platform, offering reusable solutions for common operations.

## 📁 **DIRECTORY STRUCTURE**

```
lib/utils/
├── beach-card-utils.ts         # Beach card data preparation and formatting
├── beach-search-utils.ts       # Beach search and area detection
├── coordinate-parser.ts        # Geographic coordinate parsing and validation
├── current-forecast-utils.ts   # Current forecast time calculations
├── date-utils.ts               # Date manipulation and formatting
├── distance-utils.ts           # Geographic distance calculations
├── forecast-analytics.ts       # Forecast accuracy analysis and metrics
├── forecast-service-utils.ts   # Forecast service orchestration
├── forecast-ui-utils.tsx       # Forecast UI formatting and components
├── loading-utils.tsx           # Loading state management utilities
├── map-utilities.ts            # Map positioning and viewport utilities
├── performance-utils.ts        # Performance monitoring and optimization
├── posts-utils.ts              # Social post data transformation
├── rate-limiter.ts             # API rate limiting utilities
├── request-cache.ts            # Request caching implementation
├── session-utils.ts            # Session data formatting
├── toast-utils.ts              # Toast notification helpers
├── wave-height-formatter.ts    # Wave height parsing and formatting
└── wind-direction.ts           # Wind direction utilities
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Utility Classification System**

```typescript
UtilityCategories
├── Data Processing Utilities
│   ├── Geographic (coordinate-parser, distance-utils, map-utilities)
│   ├── Temporal (date-utils, current-forecast-utils)
│   ├── Formatting (wave-height-formatter, wind-direction)
│   └── Transformation (beach-card-utils, posts-utils)
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
    └── Session Display (session-utils)
```

### **Pure Function Design Pattern**

```typescript
// All utilities follow pure function principles
type UtilityFunction<T, R> = (input: T) => R;
type AsyncUtilityFunction<T, R> = (input: T) => Promise<R>;

// Predictable inputs and outputs
// No side effects
// Testable and composable
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **Geographic and Spatial Utilities**

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

export function calculateDistanceFormatted(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: "miles" | "km" = "miles"
): string {
  const distance = calculateDistance(lat1, lng1, lat2, lng2, unit);
  const unitLabel = unit === "miles" ? "mi" : "km";
  return `${distance} ${unitLabel}`;
}
```

### **Search and Discovery Utilities**

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
): Promise<SearchResult> {
  // First try direct beach search
  const beach = await searchBeachesByName(searchText);

  if (beach) {
    return {
      beach,
      isOutOfAreaSearch: false,
    };
  }

  // Check if this might be an out-of-area search
  const isOutOfArea = isLikelyOutOfAreaSearch(searchText);

  if (isOutOfArea) {
    return {
      beach: null,
      isOutOfAreaSearch: true,
      detectedLocation: searchText,
      suggestedMessage: `We currently focus on San Diego County beaches. "${searchText}" might be outside our coverage area. Try searching for beaches like "La Jolla Shores", "Windansea", or "Ocean Beach".`,
    };
  }

  return {
    beach: null,
    isOutOfAreaSearch: false,
    suggestedMessage: `No beaches found matching "${searchText}". Try searching for popular spots like "La Jolla Shores", "Windansea", or "Ocean Beach".`,
  };
}

export async function searchBeachWithForecast(beachName: string) {
  const searchResult = await searchBeachesWithAreaDetection(beachName);

  if (!searchResult.beach) {
    return {
      ...searchResult,
      currentForecast: null,
    };
  }

  const currentForecast = await getBeachCurrentForecast(searchResult.beach.id);

  return {
    ...searchResult,
    currentForecast,
  };
}
```

### **Performance and Caching Utilities**

#### **rate-limiter.ts** (API Rate Limiting)

- **Purpose**: Comprehensive rate limiting for external API calls
- **Features**:
  - Configurable rate limits
  - Request history tracking
  - Automatic cleanup
  - Service-specific limiters

```typescript
export class RateLimiter {
  private requestHistory: RequestRecord[] = [];
  private readonly config: RateLimiterConfig;
  private readonly name: string;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(name: string, config: RateLimiterConfig) {
    this.name = name;
    this.config = this.validateConfig(config);
    this.startCleanupInterval();
  }

  canMakeRequest(): boolean {
    this.cleanupOldRequests();

    // Check burst limit
    const recentRequests = this.requestHistory.filter(
      (record) => Date.now() - record.timestamp <= this.config.burstWindow
    );

    if (recentRequests.length >= this.config.burstLimit) {
      return false;
    }

    // Check sustained limit
    const windowRequests = this.requestHistory.filter(
      (record) => Date.now() - record.timestamp <= this.config.windowMs
    );

    return windowRequests.length < this.config.maxRequests;
  }

  recordRequest(endpoint?: string): void {
    const now = Date.now();
    this.requestHistory.push({
      timestamp: now,
      endpoint,
    });
  }

  getTimeUntilReset(): number {
    if (this.requestHistory.length === 0) return 0;

    const oldestRequest = Math.min(
      ...this.requestHistory.map((r) => r.timestamp)
    );

    const timeUntilOldestExpires =
      oldestRequest + this.config.windowMs - Date.now();

    return Math.max(0, timeUntilOldestExpires);
  }

  getStatus(): RateLimitStatus {
    this.cleanupOldRequests();

    const windowRequests = this.requestHistory.filter(
      (record) => Date.now() - record.timestamp <= this.config.windowMs
    );

    return {
      requestsRemaining: Math.max(
        0,
        this.config.maxRequests - windowRequests.length
      ),
      resetTime: this.getTimeUntilReset(),
      canMakeRequest: this.canMakeRequest(),
      totalRequests: windowRequests.length,
      windowMs: this.config.windowMs,
    };
  }
}

// Service-specific rate limiters
export const CDIPRateLimiter = {
  canMakeRequest: () => CDIPRateLimiterSingleton.canMakeRequest(),
  recordRequest: (endpoint?: string) =>
    CDIPRateLimiterSingleton.recordRequest(endpoint),
  getTimeUntilReset: () => CDIPRateLimiterSingleton.getTimeUntilReset(),
  getStatus: () => CDIPRateLimiterSingleton.getStatus(),
};

export const NOAARateLimiter = {
  canMakeRequest: () => NOAARateLimiterSingleton.canMakeRequest(),
  recordRequest: (endpoint?: string) =>
    NOAARateLimiterSingleton.recordRequest(endpoint),
  getTimeUntilReset: () => NOAARateLimiterSingleton.getTimeUntilReset(),
  getStatus: () => NOAARateLimiterSingleton.getStatus(),
};
```

#### **request-cache.ts** (Request Caching)

- **Purpose**: Intelligent request caching with TTL and size management
- **Features**: TTL-based expiration, LRU eviction, cache statistics

```typescript
class RequestCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number = 5 * 60 * 1000; // 5 minutes
  private readonly maxSize: number = 100;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  static createKey(
    ...parts: (string | number | boolean | undefined | null)[]
  ): string {
    return parts
      .filter((part) => part !== undefined && part !== null)
      .map((part) => String(part))
      .join("|");
  }
}
```

### **Analytics and Analysis Utilities**

#### **forecast-analytics.ts** (Forecast Analysis)

- **Purpose**: Comprehensive forecast accuracy analysis and trend tracking
- **Features**:
  - Accuracy score calculations
  - Confidence correlation analysis
  - Data quality assessment
  - Trend analysis over time

```typescript
export function analyzeSessionAccuracy(
  snapshot: SessionForecastSnapshot
): AccuracyAnalysis {
  const metrics: AccuracyMetric[] = [];

  // Wave height accuracy
  if (snapshot.forecast_wave_height && snapshot.actual_wave_height) {
    const forecastHeight = extractNumericValue(snapshot.forecast_wave_height);
    const actualHeight = extractNumericValue(snapshot.actual_wave_height);

    if (forecastHeight > 0 && actualHeight > 0) {
      const delta = Math.abs(forecastHeight - actualHeight);
      const relativeError = (delta / actualHeight) * 100;
      const accuracy = calculateAccuracyScore(
        forecastHeight,
        actualHeight,
        1.0
      );

      metrics.push({
        name: "Wave Height",
        forecast: forecastHeight,
        actual: actualHeight,
        delta,
        relativeError,
        accuracy,
      });
    }
  }

  // Calculate overall accuracy
  const overallAccuracy =
    metrics.length > 0
      ? metrics.reduce((sum, metric) => sum + metric.accuracy, 0) /
        metrics.length
      : 0;

  // Confidence correlation
  const confidenceCorrelation = calculateConfidenceCorrelation(
    snapshot.confidence_score || 0,
    overallAccuracy
  );

  // Data quality assessment
  const dataQuality = assessDataQuality(metrics, snapshot);

  // Generate recommendations
  const recommendations = generateRecommendations(
    metrics,
    overallAccuracy,
    snapshot.confidence_score || 0
  );

  return {
    overallAccuracy,
    metrics,
    confidenceCorrelation,
    dataQuality,
    recommendations,
  };
}

export function calculateAccuracyTrends(
  snapshots: SessionForecastSnapshot[]
): TrendPoint[] {
  const trendData = new Map<
    string,
    {
      accuracy: number[];
      sessionCount: number;
      avgConfidence: number[];
      avgWaveHeight: number[];
    }
  >();

  // Group by date
  snapshots.forEach((snapshot) => {
    const date = snapshot.session_date;
    if (!trendData.has(date)) {
      trendData.set(date, {
        accuracy: [],
        sessionCount: 0,
        avgConfidence: [],
        avgWaveHeight: [],
      });
    }

    const analysis = analyzeSessionAccuracy(snapshot);
    const dayData = trendData.get(date)!;

    dayData.accuracy.push(analysis.overallAccuracy);
    dayData.sessionCount++;
    dayData.avgConfidence.push(snapshot.confidence_score || 0);

    const waveHeight = extractNumericValue(snapshot.actual_wave_height);
    if (waveHeight > 0) {
      dayData.avgWaveHeight.push(waveHeight);
    }
  });

  // Convert to trend points
  return Array.from(trendData.entries())
    .map(([date, data]) => ({
      date,
      accuracy:
        data.accuracy.reduce((sum, acc) => sum + acc, 0) / data.accuracy.length,
      sessionCount: data.sessionCount,
      avgConfidence:
        data.avgConfidence.reduce((sum, conf) => sum + conf, 0) /
        data.avgConfidence.length,
      avgWaveHeight:
        data.avgWaveHeight.length > 0
          ? data.avgWaveHeight.reduce((sum, height) => sum + height, 0) /
            data.avgWaveHeight.length
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

### **UI and Formatting Utilities**

#### **forecast-ui-utils.tsx** (Forecast Display)

- **Purpose**: Forecast data formatting and UI utilities
- **Features**:
  - Time and date formatting
  - Confidence color coding
  - Forecast grouping and organization
  - Loading and error components

```typescript
export function formatForecastTime(timeString: string): string {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  } catch (error) {
    return timeString;
  }
}

export function formatForecastDate(dateString: string): string {
  const date = createDateFromString(dateString);

  if (isDateToday(dateString)) {
    return "Today";
  }

  if (isDateTomorrow(dateString)) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getConfidenceColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export function groupForecastsByWindDirection<
  T extends {
    wind_direction: string;
    forecast_time: string;
    [key: string]: any;
  }
>(
  forecasts: T[]
): Array<{
  direction: string;
  forecasts: T[];
  representative: T;
  timeRange: string;
  count: number;
}> {
  const groups = new Map<string, T[]>();

  // Group by wind direction
  forecasts.forEach((forecast) => {
    const direction = forecast.wind_direction || "Unknown";
    if (!groups.has(direction)) {
      groups.set(direction, []);
    }
    groups.get(direction)!.push(forecast);
  });

  // Convert to result format
  return Array.from(groups.entries()).map(([direction, groupForecasts]) => {
    const sortedForecasts = groupForecasts.sort((a, b) =>
      a.forecast_time.localeCompare(b.forecast_time)
    );

    const representative =
      sortedForecasts[Math.floor(sortedForecasts.length / 2)];
    const firstTime = formatForecastTime(sortedForecasts[0].forecast_time);
    const lastTime = formatForecastTime(
      sortedForecasts[sortedForecasts.length - 1].forecast_time
    );
    const timeRange =
      firstTime === lastTime ? firstTime : `${firstTime} - ${lastTime}`;

    return {
      direction,
      forecasts: sortedForecasts,
      representative,
      timeRange,
      count: groupForecasts.length,
    };
  });
}
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Memoization and Caching**

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

// Cached API responses
const cachedForecastData = useCallback(async (beachId: string) => {
  const cacheKey = `forecast-${beachId}-${new Date().toDateString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchForecastData(beachId);
  cache.set(cacheKey, data, 30 * 60 * 1000); // 30 minutes
  return data;
}, []);
```

### **Debouncing and Throttling**

```typescript
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
```

## 🧪 **TESTING STRATEGIES**

### **Pure Function Testing**

- Test all input/output combinations
- Verify edge cases and error conditions
- Test performance with large datasets
- Validate type safety and null handling

### **Integration Testing**

- Test utility composition
- Verify cache behavior
- Test rate limiting scenarios
- Validate error propagation

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Machine learning accuracy predictions
- Advanced caching strategies
- Real-time performance monitoring
- Automated optimization suggestions
- Cross-platform utility packages

### **Performance Improvements**

- Web Worker integration for heavy calculations
- Streaming data processing
- Advanced memoization strategies
- Memory usage optimization
- Bundle size reduction

## 🏆 **BEST PRACTICES**

### **Utility Design Guidelines**

1. **Pure Functions**: Avoid side effects, ensure predictable outputs
2. **Type Safety**: Comprehensive TypeScript coverage
3. **Error Handling**: Graceful error handling with fallbacks
4. **Performance**: Optimize for common use cases
5. **Documentation**: Clear JSDoc comments and examples

### **Code Organization Guidelines**

1. **Single Responsibility**: Each utility has a focused purpose
2. **Composability**: Utilities can be combined effectively
3. **Testability**: Easy to test in isolation
4. **Reusability**: Generic implementations where possible
5. **Maintainability**: Clear naming and logical organization

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive utility library  
**Next Review**: After machine learning integration and performance optimization
