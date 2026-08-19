# Services Library Architecture

## **PURPOSE**

The `/lib/services` directory provides comprehensive integration with external APIs and data sources, implementing reliable data fetching, caching, and synchronization services for oceanographic and weather data.

## **DIRECTORY STRUCTURE**

```
lib/services/
├── cdip-service.ts                           # CDIP buoy data integration
├── enhanced-forecast-service.ts              # Comprehensive forecast generation
├── implicit-preferences-service.ts           # Implicit preference learning (behavioral)
├── inactive-buoy-cleanup.ts                  # Buoy maintenance and cleanup
├── noaa-conditions-sync.ts                   # NOAA buoy conditions synchronization
├── noaa-coops-service.ts                     # NOAA CO-OPS tide data service
├── noaa-sync.ts                              # NOAA buoy station synchronization
├── noaa-wavewatch-service.ts                 # NOAA WaveWatch III wave data
├── personalization-milestone-service.ts      # User milestone detection and recording
├── personalized-scoring-service.ts           # User preference scoring
├── preference-learning-service.ts            # User preference learning (explicit)
├── surf-discovery-service.ts                 # Beach discovery and recommendations
├── spot-surf-report-service.ts                # Public cached spot surf reports
├── ccc/                                          # CCC Coastal Commission amenity sync
│   ├── ccc-sync-service.ts                      # API client, normalization, Haversine matching
│   └── index.ts                                  # Barrel exports
├── water-quality/                                # EPA/USGS water quality monitoring
│   ├── water-quality-sync-service.ts            # WQP station/sample sync, EPA evaluation
│   ├── water-quality-alerts-service.ts          # Push notifications for status changes
│   └── index.ts                                  # Barrel exports
```

**Note:** `personalized-home-forecast-service.ts` was deprecated in November 2025 and replaced by `surf-discovery-service.ts`. See `CHANGELOG.md` for details.

## **ARCHITECTURE PATTERNS**

### **Service Layer Architecture**

```typescript
ExternalServices
├── Data Source Services
│   ├── CDIP (Coastal Data Information Program)
│   ├── NOAA WaveWatch III (Wave forecasting)
│   ├── NOAA CO-OPS (Tide data)
│   └── NOAA Buoy Network (Real-time conditions)
├── Data Processing Services
│   ├── Enhanced Forecast Generation
│   ├── Data Combination and Validation
│   └── Quality Assessment
├── Personalization Services
│   ├── Surf Discovery Service (Beach recommendations)
│   ├── Personalized Scoring (Preference-based scoring)
│   ├── Preference Learning (Session history analysis)
│   ├── Implicit Preferences (Behavioral signal learning)
│   └── Personalization Milestones (Achievement tracking)
├── Maintenance Services
│   ├── Buoy Station Synchronization
│   ├── Inactive Buoy Cleanup
│   └── Conditions Data Sync
├── External Data Sync Services
│   ├── CCC Coastal Commission (Amenity data)
│   └── Water Quality Portal (EPA bacteria monitoring)
└── Caching and Optimization
    ├── Response Caching
    ├── Rate Limiting
    └── Error Handling
```

### **Forecast Timestamptz Convention (February 2026)**

**Canonical Field**: `forecast_at` (timestamptz)
**Deprecated**: `forecast_date` (text), `forecast_time` (text)

All forecast-consuming services use `forecast_at` for queries:

```typescript
.gte("forecast_at", startISO)
.lt("forecast_at", endISO)
.order("forecast_at")
```

Adapter utilities at `lib/utils/forecast-at-adapter.ts` for timezone conversions. See `supabase/ARCHITECTURE.md` for the full migration history and rationale.

### **Data Flow Pattern**

```typescript
DataFlow
├── External API → Service Layer → Data Processing → Cache/Database
├── Error Handling → Fallback Data → User Notification
└── Rate Limiting → Queue Management → Retry Logic
```

### **Spot Surf Report Service**

`spot-surf-report-service.ts` is the canonical server-only entry point for
cookie-free public spot surf reports. `getSpotSurfReportPublic(beach)` owns the
15-minute cached forecast read, timezone-aware today/tomorrow selection, surf
call computation, hourly forecast projection, and major-event hold boundary.

The service canonicalizes every beach projection before entering the cache.
The canonical field set must stay aligned with every beach field read by the
window selector and surf-call logic, including calibrated swell and wind
thresholds plus `shoaling_factors`; callers with narrow database selects must
include those fields or the report can silently lose calibrated behavior.

## **DEFENSIVE PARSING OF EXTERNAL API DATA**

### **Critical Pattern: Type Guards Before String Methods**

**Background (January 2026 Bug):** A critical bug caused 100% forecast sync failure across all beaches due to direction parsing functions calling `.trim()` or `.toUpperCase()` on values that were not strings. External API responses sometimes return unexpected types (objects, arrays, numbers) instead of expected string values.

**Lesson Learned:** NEVER call string methods (`.trim()`, `.toUpperCase()`, `.toLowerCase()`, `.split()`, etc.) on external API data without first verifying the value is a string.

### **Required Pattern**

```typescript
// WRONG - Will throw "X.trim is not a function" if dir is not a string
function parseDirection(dir: string | null | undefined): number | null {
  if (!dir) return null;
  const trimmed = dir.trim(); // CRASH if dir is object/array/number
  // ...
}

// CORRECT - Defensive type guard before string methods
function parseDirection(dir: string | null | undefined): number | null {
  // Guard 1: Check for null/undefined
  if (!dir) return null;

  // Guard 2: Verify it's actually a string before calling string methods
  if (typeof dir !== 'string') {
    return null; // Silently return null for unexpected types
  }

  const trimmed = dir.trim(); // Safe - dir is guaranteed to be a string
  // ...
}
```

### **Files Implementing This Pattern**

The following files have been updated with defensive type guards (January 2026):

| File | Function(s) | Guard Added |
|------|-------------|-------------|
| `lib/services/forecast/forecast-transformer.ts` | `cardinalToDegrees()` | `typeof dir !== 'string'` check before `.trim()` |
| `lib/services/discovery/window-selector/direction-utils.ts` | `parseWaveDirection()` | `typeof dir !== 'string'` check before `.toUpperCase()` |
| `lib/services/discovery/window-selector/direction-utils.ts` | `getDirectionDegrees()` | `typeof windDirectionText !== 'string'` check before `.trim()` |
| `lib/services/nws-wind-service.ts` | `parseNwsWindDirectionDeg()` | `typeof dir !== 'string'` check before `.trim()` |
| `lib/services/nws-wind-service.ts` | `parseNwsWindSpeedMs()` | `typeof windSpeed !== 'string'` check before `.trim()` |

### **When to Apply This Pattern**

Apply defensive type guards when:

1. **Parsing external API responses** - NOAA, CDIP, NWS, weather services
2. **Processing user input** - Form data, query parameters
3. **Reading from database JSONB columns** - Untyped JSON data
4. **Deserializing cached data** - Redis, localStorage, session storage
5. **Processing webhook payloads** - Third-party integrations

### **Error Handling Strategy**

For parsing functions, prefer **silent degradation** over throwing errors:

```typescript
// Preferred: Return null/default for invalid input
if (typeof value !== 'string') {
  return null; // Caller handles null case
}

// Alternative: Return sensible default
if (typeof value !== 'string') {
  return 0; // Default value (e.g., 0 degrees for direction)
}

// Avoid: Throwing errors (breaks batch processing)
if (typeof value !== 'string') {
  throw new Error('Invalid type'); // Stops entire forecast sync
}
```

### **Testing Considerations**

When writing tests for parsing functions, include test cases for:

```typescript
describe('parseDirection', () => {
  // Standard cases
  it('parses cardinal directions', () => { /* ... */ });
  it('returns null for null/undefined', () => { /* ... */ });

  // Defensive type guard cases (CRITICAL)
  it('returns null for object input', () => {
    expect(parseDirection({} as any)).toBeNull();
  });
  it('returns null for array input', () => {
    expect(parseDirection([] as any)).toBeNull();
  });
  it('returns null for number input', () => {
    expect(parseDirection(123 as any)).toBeNull();
  });
});
```

---

## **SERVICE RESPONSIBILITIES**

### **CDIPService** (Buoy Data Integration)

- **Purpose**: Real-time buoy data from CDIP (Scripps Institution of Oceanography)
- **Features**:
  - Multiple station data fetching
  - Data quality scoring
  - Intelligent caching with TTL
  - Nearest station finding
  - Comprehensive error handling

**Core Implementation:**

```typescript
export class CDIPService {
  private readonly userAgent = "quiver-surf-app/1.0 (contact@quiver-surf.com)";
  private readonly stationCache = new Map<string, CDIPStationConfig>();
  private readonly dataCache = new Map<
    string,
    { data: CDIPBuoyData; timestamp: number }
  >();
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes

  async fetchBuoyData(stationId: string): Promise<CDIPBuoyData | null> {
    // Check cache first
    const cached = this.getCachedData(stationId);
    if (cached) return cached;

    try {
      const rawData = await this.fetchCDIPRawData(stationId);
      if (!rawData) return null;

      const processedData = this.transformToCDIPBuoyData(stationId, rawData);
      if (processedData) {
        this.setCachedData(stationId, processedData);
      }

      return processedData;
    } catch (error) {
      console.error(
        `Failed to fetch CDIP data for station ${stationId}:`,
        error
      );
      return null;
    }
  }

  async getNearestStation(
    latitude: number,
    longitude: number,
    maxDistanceKm: number = 50
  ): Promise<string | null> {
    let nearestStation = null;
    let minDistance = Infinity;

    for (const [stationId, config] of Object.entries(CDIP_STATIONS)) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        config.latitude,
        config.longitude
      );

      if (distance < minDistance && distance <= maxDistanceKm) {
        minDistance = distance;
        nearestStation = stationId;
      }
    }

    return nearestStation;
  }

  getDataQualityScore(buoyData: CDIPBuoyData): number {
    let score = 0;
    let maxScore = 0;

    // Wave height quality (25 points)
    maxScore += 25;
    if (buoyData.wave_height !== undefined) {
      const height = buoyData.wave_height;
      if (height >= 0.3 && height <= 12) {
        score += 25;
      } else if (height >= 0.1 && height <= 15) {
        score += 15;
      } else if (height >= 0 && height <= 20) {
        score += 5;
      }
    }

    // Data freshness (25 points)
    maxScore += 25;
    if (buoyData.timestamp) {
      const ageMinutes = (Date.now() - buoyData.timestamp * 1000) / (1000 * 60);
      if (ageMinutes <= 30) score += 25;
      else if (ageMinutes <= 120) score += 20;
      else if (ageMinutes <= 360) score += 10;
      else if (ageMinutes <= 720) score += 5;
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }
}
```

### **EnhancedForecastService** (Comprehensive Forecasting)

- **Purpose**: Combines multiple data sources for comprehensive surf forecasts
- **Features**:
  - Multi-source data integration (WaveWatch, CDIP, CO-OPS, Weather)
  - Confidence scoring based on data availability
  - Fallback data generation
  - Automated forecast storage and updates

**Service Integration Pattern:**

```typescript
export class EnhancedForecastService {
  private waveWatchService: NOAAWaveWatchService;
  private coopsService: NOAACOOPSService;
  private cdipService: CDIPService;

  async generateComprehensiveForecast(
    beach: Beach
  ): Promise<EnhancedForecastEntity[]> {
    console.log(`Generating comprehensive forecast for ${beach.name}`);

    try {
      // Fetch all data sources in parallel with individual error handling
      const [waveData, tideData, weatherData, buoyData, cdipData] =
        await Promise.allSettled([
          this.fetchWaveDataWithRetry(beach),
          this.fetchTidalDataWithRetry(beach),
          this.fetchWeatherDataWithRetry(beach),
          this.fetchNearbyBuoyDataWithRetry(beach),
          this.fetchCDIPDataWithRetry(beach),
        ]);

      // Extract successful results
      const waveResult =
        waveData.status === "fulfilled" ? waveData.value : null;
      const tideResult =
        tideData.status === "fulfilled" ? tideData.value : null;
      const weatherResult =
        weatherData.status === "fulfilled" ? weatherData.value : null;
      const buoyResult =
        buoyData.status === "fulfilled" ? buoyData.value : null;
      const cdipResult =
        cdipData.status === "fulfilled" ? cdipData.value : null;

      // Combine all data sources
      const combinedForecasts = this.combineDataSources({
        beach,
        waveData: waveResult,
        tideData: tideResult,
        weatherData: weatherResult,
        buoyData: buoyResult,
        cdipData: cdipResult,
      });

      return combinedForecasts.map((forecast) => ({
        ...forecast,
        beach_id: beach.id,
        forecast_date: forecast.forecast_date,
        forecast_time: forecast.forecast_time,
      }));
    } catch (error) {
      console.error("Critical error in forecast generation:", error);
      throw error;
    }
  }

  private combineDataSources({
    beach,
    waveData,
    tideData,
    weatherData,
    buoyData,
    cdipData,
  }: CombineDataParams): EnhancedForecastWithRawData[] {
    const forecasts: EnhancedForecastWithRawData[] = [];
    const now = new Date();

    // Generate 48 hours of forecasts (every 2 hours)
    for (let hours = 0; hours < 48; hours += 2) {
      const forecastTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const waveInfo = this.getWaveDataForTime(waveData, forecastTime);
      const tideInfo = this.getTideInfoForTime(tideData, forecastTime);
      const weatherInfo = this.getWeatherDataForTime(weatherData, forecastTime);
      const cdipInfo = this.getCDIPDataForTime(cdipData, forecastTime);

      const confidence = this.calculateConfidenceScore({
        hasWaveData: !!waveInfo,
        hasTideData: !!tideInfo,
        hasWeatherData: !!weatherInfo,
        hasBuoyData: !!buoyData,
        hasCDIPData: !!cdipInfo,
        forecastHoursAhead: hours,
      });

      forecasts.push({
        forecast_date: this.getNormalizedDateString(forecastTime),
        forecast_time: this.getNormalizedTimeString(forecastTime),
        wave_height: waveInfo?.waveHeight || "1-2",
        wave_period: waveInfo?.wavePeriod || "8",
        wave_direction: waveInfo?.waveDirection || "SW",
        confidence_score: confidence,
        // ... more forecast properties
      });
    }

    return forecasts;
  }
}
```

### **NOAAWaveWatchService** (Wave Forecasting)

- **Purpose**: NOAA WaveWatch III wave forecast data
- **Features**:
  - Multiple API endpoint support
  - Fallback data generation
  - Grid-based forecast processing
  - Comprehensive error handling

### **NOAACOOPSService** (Tide Data)

- **Purpose**: NOAA CO-OPS tide predictions and water levels
- **Features**:
  - Station-based tide predictions
  - Current water level data
  - Tide extreme calculations
  - Fallback tide generation

**Tide Service Pattern:**

```typescript
export class NOAACOOPSService {
  async fetchCOOPSData(
    stationId: string,
    days: number = 10
  ): Promise<COOPSForecast | null> {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const formatDate = (date: Date) => {
        return date.toISOString().split("T")[0].replace(/-/g, "");
      };

      const [tides, waterLevel, stationInfo] = await Promise.allSettled([
        this.fetchTidePredictions(
          stationId,
          formatDate(now),
          formatDate(endDate)
        ),
        this.fetchCurrentWaterLevel(stationId),
        this.fetchStationInfo(stationId),
      ]);

      return {
        station_id: stationId,
        station_name:
          stationInfo.status === "fulfilled"
            ? stationInfo.value?.name || stationId
            : stationId,
        tides:
          tides.status === "fulfilled"
            ? tides.value
            : this.generateFallbackTideData(),
        water_level:
          waterLevel.status === "fulfilled" ? waterLevel.value : null,
      };
    } catch (error) {
      console.error(
        `Error fetching CO-OPS data for station ${stationId}:`,
        error
      );
      return null;
    }
  }

  getTideStatusAtTime(tides: TideData[], targetTime: Date): TideStatus {
    const targetTimestamp = targetTime.getTime() / 1000;

    // Find the closest past and future tides
    let pastTide: TideData | null = null;
    let futureTide: TideData | null = null;

    for (const tide of tides) {
      if (tide.time <= targetTimestamp) {
        if (!pastTide || tide.time > pastTide.time) {
          pastTide = tide;
        }
      } else {
        if (!futureTide || tide.time < futureTide.time) {
          futureTide = tide;
        }
      }
    }

    if (!pastTide && !futureTide) return "Unknown";
    if (!pastTide) return futureTide!.type === "high" ? "Rising" : "Falling";
    if (!futureTide) return pastTide.type === "high" ? "Falling" : "Rising";

    // Determine tide direction based on past and future tides
    if (pastTide.type === "low" && futureTide.type === "high") {
      return "Rising";
    } else if (pastTide.type === "high" && futureTide.type === "low") {
      return "Falling";
    }

    return "Stable";
  }
}
```

### **SurfDiscoveryService** (Beach Recommendations)

- **Purpose**: Generates personalized surf recommendations for home screen and discovery
- **Status**: Active (replaced deprecated PersonalizedHomeForecastService in November 2025)
- **Features**:
  - Cache-backed forecast retrieval (no on-demand API calls)
  - Candidate pool from home beach + favorites
  - Personalized scoring via personalized-scoring-service
  - Optimal time window selection
  - Human-readable summaries and reasons
  - Stale-data fallback: when all forecast data is stale, serves stale forecasts with `usingStaleData` flag rather than returning empty recommendations

**Service Location:** `lib/services/surf-discovery-service.ts`

**Key Improvements over Deprecated Service:**
- Uses `getFreshForecastFromCache()` instead of direct EnhancedForecastService calls
- No external API calls during user requests
- Consistent ~500ms response times
- Stale data marked clearly but still usable

**Dependencies:**
- `getFreshForecastFromCache()` - Cache-backed forecast access
- `personalized-scoring-service` - User preference scoring
- `user_surf_preferences` table - Learned preferences
- `user_beach_affinity` table - Beach familiarity
- `favorite_beaches` table - User favorites

### **Time Slot Capping Algorithm** (January 2026)

The surf discovery service includes a time slot capping algorithm that prevents recommendation windows from extending past the user's preferred time of day.

#### **Purpose**

When users filter by time slot (e.g., "dawn-patrol" or "morning"), they expect recommendations to respect those boundaries. Without capping, a window starting at 8am could extend to 12pm even when the user selected "dawn-patrol" (6am-9am). The capping algorithm ensures the recommended window ends at the time slot boundary.

#### **Time Slot Definitions**

| Time Slot    | Start Hour | End Hour | Caps Window At |
|--------------|------------|----------|----------------|
| dawn-patrol  | 6am        | 9am      | 9am            |
| morning      | 6am        | 12pm     | 12pm           |
| afternoon    | 12pm       | 6pm      | 6pm            |
| any          | 6am        | 9pm      | No capping     |

Time slots are defined in `types/personalization.ts` as `TIME_SLOT_RANGES`.

#### **Algorithm Details**

The `capEndTimeToTimeSlot()` function implements the capping logic:

```typescript
export function capEndTimeToTimeSlot(
  effectiveStartTime: Date,
  endTime: Date,
  timeSlot: TimeSlot | undefined,
  beachTz: string
): Date {
  // 1. If no time slot or "any", return uncapped
  if (!timeSlot || timeSlot === 'any') {
    return endTime;
  }

  // 2. Get end hour for the time slot
  const { endHour } = TIME_SLOT_RANGES[timeSlot];

  // 3. Extract local hour using Intl.DateTimeFormat for timezone awareness
  const startLocalHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: beachTz,
    }).format(effectiveStartTime),
    10
  );

  // 4. Calculate hours until slot end and cap if needed
  const hoursUntilSlotEnd = endHour - startLocalHour;
  if (hoursUntilSlotEnd > 0) {
    const timeSlotEnd = new Date(
      effectiveStartTime.getTime() + hoursUntilSlotEnd * 60 * 60 * 1000
    );
    if (timeSlotEnd < endTime) {
      return timeSlotEnd;
    }
  }

  return endTime;
}
```

**Key Implementation Details:**

1. **Timezone-Aware**: Uses `Intl.DateTimeFormat` to extract the local hour in the beach's timezone, ensuring correct capping regardless of user location or server timezone.

2. **Graceful Degradation**: If timezone conversion fails, the function returns the uncapped end time rather than crashing.

3. **Relative Calculation**: Calculates hours from window start to slot boundary, then creates the capped end time by adding that duration to start time.

#### **Interaction with Other Systems**

The capping algorithm interacts with several other window-limiting systems in `selectBestWindow()`:

1. **Sunset Capping**: Windows are first capped at sunset to avoid recommending sessions after dark.
2. **Time Slot Capping**: Applied after sunset capping, so whichever is earlier wins.
3. **Minimum Session Length**: After all capping, windows shorter than `MIN_SESSION_HOURS` (1 hour) are excluded.
4. **Scoring**: Capping happens before scoring, so capped windows may have different scores than uncapped versions.

**Processing Order:**
```
Window Selection -> Sunset Cap -> Time Slot Cap -> Duration Validation -> Scoring
```

#### **Performance Considerations**

- **Minimal Overhead**: Timezone conversion via `Intl.DateTimeFormat` adds < 1ms per call
- **Applied During Selection**: Capping is applied during `selectBestWindow()`, not as a post-filter
- **No Database Queries**: Pure in-memory calculation using the beach timezone

#### **Code Location**

- **Main Function**: `capEndTimeToTimeSlot()` in `lib/services/surf-discovery-service.ts` (lines 1374-1413)
- **Called From**: `selectBestWindow()` during window evaluation (line 1191)
- **Also Used**: Fallback window construction (line 1326)

#### **Testing**

The function is exported for unit testing:
```typescript
// Test helper export at line 1374
export function capEndTimeToTimeSlot(...): Date
```

Tests should verify:
- Capping at 9am for dawn-patrol
- Capping at 12pm for morning
- Capping at 6pm for afternoon
- No capping for "any" time slot
- Graceful handling of timezone conversion failures

### **PersonalizedScoringService** (Preference-Based Scoring)

- **Purpose**: Scores beaches for users by combining base score with personalization
- **Features**:
  - Onboarding preferences (wave size, break type)
  - Learned preferences (wave range, wind, tide from session history)
  - Beach affinity (familiarity bonus from past sessions)
  - Batch scoring optimization (3 DB queries instead of N*3)

**Scoring Breakdown:**
- Base score: From algorithmic scoring (0-100)
- Onboarding wave size match: +10 pts
- Onboarding break type match: +8 pts
- Learned wave range match: +15 pts * confidence
- Learned wind preferences: +10 pts * confidence
- Learned tide preferences: +8 pts * confidence
- Beach affinity: +affinity_score * 0.15 (max 15 pts)
- Implicit preferences: See ImplicitPreferencesService below
- Final score capped at 100

### **ImplicitPreferencesService** (Behavioral Preference Learning)

- **Purpose**: Solves cold-start personalization problem by inferring preferences from behavioral signals before users log explicit sessions
- **Status**: Active (January 2026)
- **Features**:
  - Event capture: beach views, discovery clicks, forecast checks, location updates
  - Weighted aggregation with time decay (14-day half-life)
  - Confidence-blended scoring integration
  - Privacy controls: opt-out toggle and data purge

**Service Location:** `lib/services/implicit-preferences-service.ts`

**Event Weights:**
| Event Type | Weight | Rationale |
|------------|--------|-----------|
| location_update | 10.0 | Strong signal of interest in nearby beaches |
| discovery_click | 3.0 | Active engagement with specific beach |
| forecast_check | 2.5 | Planning intent for session |
| beach_view | 0.5 | Passive browsing (low signal) |
| discovery_skip | -1.0 | Negative signal |

**Confidence Blend Formula:**
```typescript
implicitWeight = implicitPrefs.confidence * (1 - explicitConf)
```

This ensures graceful handoff from implicit (new users) to explicit (power users). When explicit confidence is high (user has logged sessions), implicit preferences have minimal impact. When explicit confidence is zero (new user), implicit preferences carry full weight.

**Scoring Bonus (when implicitWeight > 0.1):**
- Wave range match: +10 pts x implicitWeight
- Break type match: +8 pts x implicitWeight
- Top engaged beach: +2 pts (flat bonus)

**Key Functions:**
- `getImplicitPreferences(userId)` - Fetch computed preferences from database
- `matchesInferredWaveRange(forecast, prefs)` - Check if forecast matches inferred wave preference
- `matchesInferredBreakType(breakType, prefs)` - Check if break type weight >= 0.2 threshold
- `isWithinTravelRadius(beachLat, beachLon, prefs)` - Haversine distance check
- `isTopEngagedBeach(beachId, prefs)` - Check if beach in top engaged list
- `calculateImplicitBonus(...)` - Compute total scoring bonus

**Database Tables:**
- `user_events` - Raw behavioral events with 90-day retention
- `user_implicit_preferences` - Aggregated preferences per user

**Dependencies:**
- `profiles.allow_implicit_tracking` column controls opt-in/out
- `compute_implicit_preferences()` PostgreSQL function for aggregation
- `purge_implicit_history()` for GDPR-compliant data deletion

**Integration:**
- Events captured via `POST /api/events` with privacy gatekeeper
- `useTrackEvent` React hook provides debounced client-side capture
- Integrated into `scoreBeachForUser` and `scoreBeachesForUser` functions

### **PersonalizationMilestoneService** (Achievement Tracking)

- **Purpose**: Detects and records personalization milestones to gamify onboarding and encourage engagement
- **Service Location**: `lib/services/personalization-milestone-service.ts`
- **Main Export**: `checkAndRecordMilestones(userId: string): Promise<NewMilestone[]>`
- **Call Pattern**: Fire-and-forget by session actions, intel actions, preference learning cron
- **Features**:
  - Fetches user state from multiple tables in parallel (4 concurrent queries)
  - Compares against 9 milestone definitions from `lib/constants/personalization-milestones.ts`
  - Inserts via service role client with UNIQUE constraint protection (ON CONFLICT DO NOTHING)
  - Graceful degradation for missing tables (intel_confirmations fallback)

**9 Milestones:**
- `first_session_logged` - 1+ rated session
- `first_intel_posted` - 1+ intel post
- `wave_range_learned` - wave_min_ft is non-null
- `wind_pref_learned` - max_wind_mph is non-null
- `time_slot_detected` - any implicit time slot weight > 0.4
- `home_turf_established` - 3+ top engaged beach IDs
- `intel_confirmed_5x` - 5+ total confirmations on user's intel
- `local_authority` - 10+ intel posts at same beach
- `fully_personalized` - all 3 layers (learned + implicit + activity) + confidence > 0.7

**Related:**
- `personalization_milestones` table (UNIQUE constraint on user_id + milestone_key)
- `use-personalization-milestones` hook (client-side fetching and optimistic updates)
- Milestone constants and metadata in `lib/constants/personalization-milestones.ts`
- UI components: `PersonalizationProgress` (home screen), `FirstSessionCTA` (nudge)

### **SimilarityInsightsService** (ML-Powered Session Matching)

- **Purpose**: Compares current forecast conditions to user's past high-rated sessions using ML-powered similarity scoring
- **Status**: Active (December 2025)
- **Features**:
  - Bucket-based similarity scoring for robustness against exact value matching
  - Weighted multi-factor comparison (wave height 35%, period 25%, wind speed 20%, direction 10%, tide 10%)
  - Match quality labels: Perfect (>=80%), Great (60-79%), Good (40-59%), Low (<40%)
  - Board tip generation when >=60% of similar sessions used the same board
  - Cross-spot explanations when >50% of matches come from different beaches
  - Three insight states: ready (>=3 sessions), onboarding (<3 sessions), degraded (no snapshots)

**Service Location:** `lib/services/similarity-insights-service.ts`

**Algorithm Overview:**

1. **Data Fetching**: Query user's rated sessions (rating >=3) from last 12 months with forecast/board snapshots
2. **Similarity Scoring**: Compute bucket-based similarity using weighted factors:
   - Wave height buckets: 0-2 ft, 2-4 ft, 4-6 ft, 6-8 ft, 8+ ft (35% weight)
   - Wave period buckets: 0-8s, 8-12s, 12-16s, 16+s (25% weight)
   - Wind speed buckets: 0-5 mph, 5-10 mph, 10-15 mph, 15+ mph (20% weight)
   - Wind direction: 8 cardinal directions, 45 deg each (10% weight)
   - Tide height: simple range-based (10% weight)
3. **Match Filtering**: Select top 5 sessions above 60% similarity threshold
4. **Insight Generation**:
   - Calculate average match percent
   - Generate match quality label
   - Create 2-4 reason bullets explaining the match
   - Detect board patterns (>=60% threshold for tip)
   - Identify cross-spot opportunities (>50% threshold)

**Bucket Matching Details:**
- Exact bucket match: 100% score
- Adjacent bucket match: 50% score (provides tolerance for near-misses)
- Non-adjacent or missing: 0% score

**Dependencies:**
- `sessions` table with `board_snapshot` JSONB column
- `idx_sessions_user_rated_completed` composite index for performance
- `createSupabaseServiceRoleClient()` for data access (userId pre-validated in API layer)

**Response States:**
- **ready**: User has >=3 rated sessions, insights computed successfully
- **onboarding**: User has <3 rated sessions, encouragement to log more
- **degraded**: User has rated sessions but no forecast snapshots available

**Integration:**
- Called by `/api/surf/insights` endpoint
- Consumed by `useInsights` hook
- Displayed in `PersonalizedForecastCard` component
- Board tips shown in amber UI element when detected
- Similar sessions viewable in drawer component

**Performance:**
- Single database query with composite index
- Lookback limited to 12 months for relevance
- Top-K filtering (5 sessions) reduces computation
- Fast bucket lookups vs. continuous distance calculations

### **Cache-Backed Forecast Architecture** (November 2025)

#### **Operational Model**

All forecast-consuming services (e.g., `surf-discovery-service`) now operate in **CACHE-ONLY MODE**:

- **NO on-demand forecast regeneration** via EnhancedForecastService
- **NO external API calls** to NOAA/Open-Meteo during user requests
- **ONLY read from** `enhanced_forecasts` table in database

#### **Background Job Responsibility**

Forecast generation is exclusively handled by background jobs:

1. **Automated**: `.github/workflows/enhanced-forecast-sync.yml` (daily 6 AM UTC)
2. **Manual**: `npm run update-forecasts` (for immediate refresh)
3. **API endpoint**: `/api/cron/enhanced-forecast-sync` (Vercel Cron)

These jobs call `updateAllBeachForecasts()` which uses `EnhancedForecastService` to regenerate all forecasts.

#### **Shared Cache Helper**

**Function**: `getFreshForecastFromCache(beachId, windowHours)`
**Location**: `lib/utils/forecast-service-utils.ts`
**Purpose**: Single source of truth for cache-backed forecast access

**Behavior**:
- Returns cached data only when fresh
- If cached data is stale, returns an empty forecast array with `metadata.stale=true`
  so callers can fail/degrade safely without serving stale conditions
- Never calls external APIs
- Provides staleness details using source-specific thresholds:
  - CDIP: 4 hours (buoy cron doesn't reliably update every beach every cycle)
  - NOAA_NWS: 12 hours (enhanced forecasts regenerate daily)
  - FALLBACK: 12 hours (less critical data)

**Return Type**:
```typescript
{
  forecasts: EnhancedForecastEntity[];
  metadata: {
    cached: boolean;
    stale: boolean;
    missing: boolean;
    reason: string | null;
    stalenessDetails?: { hoursSinceUpdate, threshold, isStale, reason };
  };
}
```

#### **Service Integration**

`surf-discovery-service` and other forecast-consuming services now:

1. Call `getFreshForecastFromCache()` for all forecast access
2. Exclude stale cache from recommendations/responses (treat as missing/degraded)
3. Log stale/missing data for monitoring
4. Track data freshness in response metadata

**Performance Impact**:
- Cache hit: ~50ms (database query)
- Stale data: ~50ms (no API timeout waiting)
- Missing data: ~50ms (fail fast, no regeneration attempt)
- Old behavior (with regeneration): 3-8s per beach + frequent timeouts

#### **User Impact**

**Before** (with on-demand regeneration):
- Timeouts during peak hours (6h-12h after morning sync)
- Inconsistent response times (50ms cache vs 8s+ regeneration)
- Hammered external APIs during user requests
- "Stale cache" warnings triggered unnecessary regeneration

**After** (cache-only):
- Consistent ~500ms response times
- No user-facing timeouts from API calls
- Stale data is never served (callers can fail/degrade instead)
- Background jobs handle all API load

### **Maintenance Services**

#### **InactiveBuoyCleanup**

- **Purpose**: Automated maintenance of buoy data quality
- **Features**:
  - Identifies inactive/failing buoys
  - Deactivation vs removal options
  - Batch processing with progress tracking
  - Dry-run mode for testing

#### **NOAABuoySync**

- **Purpose**: Synchronizes NOAA buoy stations with database
- **Features**:
  - Station list fetching and parsing
  - Distance-based filtering for beaches
  - Upsert operations for station data
  - Comprehensive logging

## **PERFORMANCE OPTIMIZATIONS**

### **Intelligent Caching**

```typescript
// Multi-level caching strategy
class CacheManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes

  set(key: string, data: any, customTTL?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTTL || this.cacheTimeout,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }
}
```

### **Parallel Data Fetching**

```typescript
// Fetch multiple data sources in parallel
const [waveData, tideData, weatherData] = await Promise.allSettled([
  this.fetchWaveDataWithRetry(beach),
  this.fetchTidalDataWithRetry(beach),
  this.fetchWeatherDataWithRetry(beach),
]);
```

### **Rate Limiting Integration**

```typescript
// Service-specific rate limiting
async function fetchWithRateLimit<T>(
  operation: () => Promise<T>,
  rateLimiter: RateLimiter
): Promise<T> {
  if (!rateLimiter.canMakeRequest()) {
    await waitForRateLimit(rateLimiter);
  }

  rateLimiter.recordRequest();
  return operation();
}
```

## **INTEGRATION PATTERNS**

### **Service Composition**

```typescript
// Services are composed to provide comprehensive data
class ForecastOrchestrator {
  constructor(
    private cdipService: CDIPService,
    private waveWatchService: NOAAWaveWatchService,
    private coopsService: NOAACOOPSService
  ) {}

  async generateForecast(beach: Beach) {
    return new EnhancedForecastService().generateComprehensiveForecast(beach);
  }
}
```

### **Error Handling Chain**

```typescript
// Graceful degradation through service chain
async function fetchWaveDataWithFallback(location: Location) {
  try {
    return await primaryWaveService.fetch(location);
  } catch (primaryError) {
    try {
      return await secondaryWaveService.fetch(location);
    } catch (secondaryError) {
      return generateFallbackWaveData(location);
    }
  }
}
```

## **TESTING STRATEGIES**

### **Service Testing**

- Mock external API responses
- Test error handling and fallbacks
- Verify caching behavior
- Test rate limiting integration

### **Integration Testing**

- Test service composition
- Verify data transformation accuracy
- Test cache invalidation
- Validate error propagation

## **FUTURE ENHANCEMENTS**

### **Planned Features**

- WebSocket real-time data streams
- Machine learning forecast improvements
- Additional weather data sources
- Enhanced buoy network coverage
- Predictive maintenance for data sources

### **Performance Improvements**

- GraphQL API integration
- Advanced caching strategies
- Background data synchronization
- Optimistic updates
- Service worker caching

## **BEST PRACTICES**

### **Service Design Guidelines**

1. **Single Responsibility**: Each service handles one data source or function
2. **Error Resilience**: Comprehensive error handling with fallbacks
3. **Caching Strategy**: Intelligent caching with appropriate TTLs
4. **Rate Limiting**: Respect external API limitations
5. **Monitoring**: Comprehensive logging and metrics

### **Data Quality Guidelines**

1. **Validation**: Validate all incoming data
2. **Quality Scoring**: Assess and score data quality
3. **Fallback Data**: Provide reasonable fallbacks
4. **Freshness Tracking**: Monitor data age and relevance
5. **Source Attribution**: Track data sources for debugging

## **PERSONALIZATION ARCHITECTURE**

### **Data Flow: Surf Discovery Service**

```
User Request (userId)
    |
Build Candidate Pool (2 DB queries)
    |-- Home beach from profile
    +-- Favorites ordered by rank
    |
Fetch Forecasts from Cache (parallel)
    |-- getFreshForecastFromCache() per beach
    |-- No external API calls
    +-- Returns cached forecast data with staleness metadata
    |
Select Best Window (per beach)
    |-- Filter to next 48 hours
    |-- Apply time slot filter (if specified)
    |-- Score each 3-hour window
    |-- Cap at sunset
    |-- Cap at time slot boundary <-- NEW (Jan 2026)
    +-- Base score: wave + wind + tide
    |
Personalized Scoring (1 DB query)
    |-- Pre-load affinity map
    |-- Batch score via personalized-scoring-service
    +-- Apply: onboarding + learned + affinity bonuses
    |
Select Best Beach
    |
Generate Summary & Reasons
    |
Return Recommendation
```

### **Integration Points**

**Service-to-Service Composition:**
- `surf-discovery-service` -> `getFreshForecastFromCache()`
- `surf-discovery-service` -> `personalized-scoring-service`
- `personalized-scoring-service` -> `preference-learning-service`

**No HTTP Between Services:**
All services use direct TypeScript imports and function calls. This eliminates:
- Serialization/deserialization overhead
- Network latency
- Duplicate authentication/authorization checks
- Complex error handling across HTTP boundaries

**Database Access:**
All services use `createSupabaseServiceRoleClient()` for server-side access with RLS bypassed. This is appropriate because:
- Services run in trusted server context
- Business logic enforces access control
- Reduces query complexity
- Improves performance

---

## **CONFIDENCE SCORE CONVENTIONS**

### Scale Definitions

| System | Scale | Example |
|--------|-------|---------|
| `calculateConfidenceScore()` | 0-100 | 70 means 70% |
| Database `confidence_score` | 0-100 | Stored as integer |
| UI display | 0-100% | Shown with % suffix |

### Centralized Scale Conversion Utilities

**ALWAYS use these functions for scale conversion** (from `@/lib/services/forecast/confidence-scorer`):

```typescript
import { confidenceToDecimal, decimalToConfidence } from "@/lib/services/forecast/confidence-scorer";

// Convert 0-100 to 0-1 (before weighting, ML models)
const decimal = confidenceToDecimal(confidence_score); // 75 -> 0.75

// Convert 0-1 to 0-100 (after weighting, for storage/display)
const score = decimalToConfidence(decimal); // 0.75 -> 75
```

**DO NOT** use ad-hoc conversions like:
- `confidence / 100`
- `Math.round(confidence * 100)`
- `if (confidence > 1) confidence = confidence / 100`

### Confidence Types (Important Distinction)

The codebase has **two fundamentally different confidence concepts**:

| Type | Measures | Source of Truth | Scale |
|------|----------|-----------------|-------|
| **Forecast Data Quality** | How reliable is the forecast data? | `calculateConfidenceScore()` | 0-100 |
| **Recommendation Quality** | How well does this match user preferences? | Domain-specific logic | 0-1 |

**Forecast Data Quality** (CDIP/buoy availability, time decay):
- Use `calculateConfidenceScore()` or `calculateConfidenceFromForecastRow()`
- Stored in database as `confidence_score`

**Recommendation Quality** (board match, condition preferences):
- Domain-specific calculations in `gear-suggestions`, `magic-hour-finder`
- NOT the same as forecast data quality - don't mix them

### Boundary Conversion

**In `enhanced-forecast-service.ts`:**
- Before weighting: Use `confidenceToDecimal(confidence_score)`
- After weighting: Use `decimalToConfidence(weightedForecast.confidence)`

**Defensive minimum:** `Math.max(original, blended)` ensures confidence never
decreases after expert calibration. A Sentry warning fires if this applies,
helping detect potential issues or inform future product decisions.

---

## **SERVICE IMPLEMENTATION PATTERNS**

### When to Use Classes vs Functions

**Use Classes for:**
- External API clients with connection pooling (e.g., `CDIPService`, `NOAACOOPSService`)
- Services requiring shared state or configuration across method calls
- Services with lifecycle methods (initialize, cleanup, dispose)
- Services that benefit from dependency injection patterns
- Services with caching that needs to persist across calls

**Use Functions for:**
- Stateless business logic and orchestration
- Pure data transformations
- Services that don't need shared resources
- Simple operations without complex state
- Single-purpose utilities

### Pattern Examples

**Class-based Service (External API Client):**
```typescript
// lib/services/cdip-service.ts pattern
export class CDIPService {
  private readonly httpClient: HttpClient;
  private readonly cache: Cache;

  constructor(config: CDIPConfig) {
    this.httpClient = new HttpClient(config.baseUrl);
    this.cache = new Cache(config.cacheTTL);
  }

  async getBuoyData(stationId: string): Promise<BuoyData> {
    const cacheKey = `buoy:${stationId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.httpClient.get(`/buoy/${stationId}`);
    this.cache.set(cacheKey, data);
    return data;
  }
}
```

**Function-based Service (Business Logic):**
```typescript
// lib/services/preference-learning-service.ts pattern
export function calculateUserPreferences(
  sessions: Session[],
  conditions: Conditions[]
): UserPreferences {
  const avgWaveHeight = calculateAverageWaveHeight(sessions);
  const preferredTide = determineTidePreference(sessions, conditions);
  const skillLevel = inferSkillLevel(sessions);

  return {
    waveHeightRange: { min: avgWaveHeight * 0.8, max: avgWaveHeight * 1.5 },
    tidePreference: preferredTide,
    skillLevel,
  };
}
```

### Current Service Classification

| Service | Pattern | Reason |
|---------|---------|--------|
| `CDIPService` | Class | HTTP client, caching, connection state |
| `NOAACOOPSService` | Class | HTTP client, rate limiting |
| `EnhancedForecastService` | Class | Multi-source aggregation, caching |
| `surf-discovery-service` | Functions | Orchestration, stateless |
| `preference-learning-service` | Functions | Pure calculations |
| `personalized-scoring-service` | Functions | Scoring algorithms |

### Recommended Directory Organization

```
lib/services/
├── external/              # Third-party API clients (class-based)
│   ├── cdip-service.ts
│   ├── noaa-coops-service.ts
│   ├── noaa-wavewatch-service.ts
├── domain/                # Business logic (function-based)
│   ├── scoring/
│   │   └── personalized-scoring-service.ts
│   ├── discovery/
│   │   └── surf-discovery-orchestrator.ts
│   └── preferences/
│       └── preference-learning-service.ts
├── orchestration/         # Coordinate multiple services
│   └── enhanced-forecast-service.ts
├── maintenance/           # Background jobs, cleanup
│   ├── noaa-sync.ts
│   └── inactive-buoy-cleanup.ts
└── ARCHITECTURE.md
```

> **Note:** This is the recommended future organization. Current services are in the root `lib/services/` directory. Migration to this structure should be done incrementally during major refactoring efforts.

### Weekend Scout discovery services

The current-location Weekend Scout path is implemented as small stateless services under `lib/services/discovery/`:

- `weekend-scout-candidate-pool.ts` calls a service-role-only exhaustive nearby RPC and suppresses incomplete pools.
- `week-scout.ts` remains the canonical scorer; its internal day-count entry point allows the weekend flow to reuse the same scoring for two days without changing the public seven-day API.
- `weekend-scout.ts` enforces the 24-hour location limit, quality floor, one best window per beach, distance friction, and top-three uniqueness. Home and saved state is attached after ranking as labels.
- `weekend-scout-snapshots.ts` inserts once per user/weekend, reloads uniqueness-race winners, and reconstructs reads from stored count, lead, and ranking fields.

The live endpoint calls the ranking service directly. The notification cron calls snapshot creation first and derives its payload exclusively from the returned immutable row.

---

**Last Updated**: February 2026
**Status**: Production-ready with comprehensive external service integration and personalization
**Next Review**: After machine learning forecast enhancements and user preference algorithm tuning
