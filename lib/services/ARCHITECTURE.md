# Services Library Architecture

## 🎯 **PURPOSE**

The `/lib/services` directory provides comprehensive integration with external APIs and data sources, implementing reliable data fetching, caching, and synchronization services for oceanographic and weather data.

## 📁 **DIRECTORY STRUCTURE**

```
lib/services/
├── cdip-service.ts                  # CDIP buoy data integration
├── enhanced-forecast-service.ts     # Comprehensive forecast generation
├── inactive-buoy-cleanup.ts         # Buoy maintenance and cleanup
├── noaa-conditions-sync.ts          # NOAA buoy conditions synchronization
├── noaa-coops-service.ts            # NOAA CO-OPS tide data service
├── noaa-sync.ts                     # NOAA buoy station synchronization
└── noaa-wavewatch-service.ts        # NOAA WaveWatch III wave data
```

## 🏗️ **ARCHITECTURE PATTERNS**

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
├── Maintenance Services
│   ├── Buoy Station Synchronization
│   ├── Inactive Buoy Cleanup
│   └── Conditions Data Sync
└── Caching and Optimization
    ├── Response Caching
    ├── Rate Limiting
    └── Error Handling
```

### **Data Flow Pattern**

```typescript
DataFlow
├── External API → Service Layer → Data Processing → Cache/Database
├── Error Handling → Fallback Data → User Notification
└── Rate Limiting → Queue Management → Retry Logic
```

## 📊 **SERVICE RESPONSIBILITIES**

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

  getTideStatusAtTime(tides: TideData[], targetTime: Date): string {
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

## 🚀 **PERFORMANCE OPTIMIZATIONS**

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

## 🔧 **INTEGRATION PATTERNS**

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

## 🧪 **TESTING STRATEGIES**

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

## 🔮 **FUTURE ENHANCEMENTS**

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

## 🏆 **BEST PRACTICES**

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

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive external service integration  
**Next Review**: After machine learning forecast enhancements
