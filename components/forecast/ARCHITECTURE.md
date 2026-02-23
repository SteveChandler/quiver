# Forecast Components Architecture

## Overview

The `/components/forecast` directory implements a comprehensive, data-driven forecast system for the Quiver surf platform. Built on React + TypeScript with Recharts visualization, it integrates multiple NOAA data sources to provide accurate, transparent, and accessible surf forecasting with confidence scoring and data quality indicators.

## Architecture Principles

### 🌊 **Multi-Source Data Integration**

#### **NOAA Data Sources**

- **WaveWatch III**: Global wave model predictions
- **CO-OPS**: Tidal predictions and water levels
- **National Weather Service**: Weather forecasts
- **NDBC**: Real-time buoy measurements
- **CDIP**: California Data Information Program buoys

#### **Data Transparency Framework**

```typescript
interface DataQuality {
  cdip?: number; // CDIP buoy data quality (0-100)
  noaa?: number; // NOAA data quality (0-100)
  overall?: number; // Combined quality score
}

interface ForecastDataSource {
  primary: "CDIP" | "NOAA_NWS" | "FALLBACK";
  sources: string[]; // All contributing data sources
  confidence: number; // Overall confidence (0-100)
  fallbackInfo?: {
    type: string;
    distance?: number;
    reason: string;
  };
}
```

#### **Confidence Scoring System**

- **Multi-factor Analysis**: Data freshness, source reliability, historical accuracy
- **Real-time Calibration**: Continuous accuracy assessment
- **User Feedback Integration**: Community-driven accuracy improvements
- **Transparency Indicators**: Clear explanation of confidence factors

---

## Core Architecture Components

### 📊 **Display Components**

#### **`forecast-display.tsx`** - Primary Forecast Orchestrator

```typescript
interface ForecastDisplayProps {
  forecasts: EnhancedForecastEntity[];
  beach: BeachContext | null;
  loading: boolean;
  error: string | null;
  // Progressive enhancement props
  showTransparency?: boolean;
  showQualitySummary?: boolean;
  showFallbackInfo?: boolean;
  allowToggleTransparency?: boolean;
  className?: string;
}
```

**Features:**

- **Progressive Enhancement**: Opt-in transparency features
- **Fallback Handling**: Graceful degradation for missing data
- **Error Boundaries**: Comprehensive error state management
- **Loading States**: Accessible loading indicators

#### **`forecast-display-with-transparency.tsx`** - Enhanced Transparency Interface

- **Advanced Data Quality Indicators**: Multi-source transparency
- **Interactive Quality Controls**: User-controlled visibility settings
- **Quality Summary Analytics**: Aggregated data quality metrics
- **Expandable Details**: Progressive disclosure of technical information

#### **`beaches-enhanced-forecast-with-transparency.tsx`** - Beach-Specific Orchestrator

```typescript
interface TransparencySummary {
  total: number;
  highConfidence: number;
  highConfidencePercent: number;
  fallbackPercent: number;
  cdipPercent: number;
  qualityLevel: "high" | "medium" | "low";
}
```

**Capabilities:**

- **Real-time Quality Assessment**: Live calculation of forecast quality
- **Source Distribution Analysis**: Breakdown of data source usage
- **Mobile Optimization**: Touch-friendly transparency controls
- **Compact Mode**: Space-efficient display options

---

### 📋 **Tabular Display Components**

#### **`forecast-table.tsx`** - Unified Tabular Display

```typescript
interface ForecastTableProps {
  forecasts: ForecastData[]; // Supports both EnhancedForecast and EnhancedForecastEntity
  variant?: "standard" | "simplified";
  className?: string;
}

// Backward-compatible exports
export const MultiDayForecastTable = (props) => (
  <ForecastTable {...props} variant="standard" />
);
export const SimplifiedForecastTable = (props) => (
  <ForecastTable {...props} variant="simplified" />
);
```

**Features:**

- **Unified Component**: Single component with variant support
- **Expandable Day Views**: Progressive disclosure of hourly data
- **Key Time Highlighting**: Dawn patrol, mid-day, evening sessions
- **Dual Variants**: Standard (confidence %) vs Simplified (consistency badges)
- **Type Flexibility**: Works with both forecast data types
- **Responsive Design**: Mobile-optimized table layouts
- **Accessibility**: Screen reader friendly with ARIA labels
- **Backward Compatibility**: Maintains existing component exports

---

### 📈 **Data Visualization Components**

#### **`tide-chart-recharts.tsx`** - Professional Tide Visualization

```typescript
interface TideChartProps {
  data?: TideDataPoint[]; // Direct tide data
  forecasts?: EnhancedForecastEntity[]; // Legacy forecast entities
  className?: string;
  showNowLine?: boolean; // Current time reference
  isAnimationActive?: boolean; // Performance control
}

interface TideDataPoint {
  time: Date; // Tide event timestamp
  height: number; // Tide height in feet
  type: "high" | "low"; // Tide type classification
}
```

**Visual Design:**

- **Ocean-Blue Theme**: `#0077B6` area charts with smooth flow
- **High/Low Markers**: Orange/grey circles with positioned labels
- **Reference Lines**: Zero baseline and current time indicators
- **Professional Styling**: Visible axis lines and clear labeling
- **Responsive Container**: Auto-scaling with margin optimization

**Data Processing:**

- **5-Day Filtering**: Automatic date range limiting
- **Smart Y-Axis**: Dynamic domain calculation with padding
- **Today/Tomorrow Labels**: Intelligent date labeling
- **Dual Data Support**: Direct data and legacy format compatibility

---

### 🔍 **Data Quality & Transparency Components**

#### **`forecast-data-source-indicator.tsx`** - Comprehensive Source Display

```typescript
interface ForecastDataSourceIndicatorProps {
  dataSource: string;
  confidenceScore: number;
  dataSources: string[];
  fallbackLocation?: string;
  nearestBuoyDistance?: number;
  nearestBuoyName?: string;
  dataQuality?: DataQuality;
  isRealTimeData?: boolean;
  isStaleData?: boolean;
  lastUpdated?: string;
  hasConnectionError?: boolean;
  showDetailedTooltip?: boolean;
  expandable?: boolean;
  onRetry?: () => void;
  className?: string;
}
```

**Data Source Classification:**

- **CDIP**: Real-time buoy measurements (highest quality)
- **NOAA_NWS**: National Weather Service predictions (medium quality)
- **FALLBACK**: Nearest location data (lower quality with distance indication)
- **Error States**: Connection failures with retry mechanisms

**Quality Indicators:**

- **Confidence Scoring**: 0-100% with color-coded display
- **Data Freshness**: Last updated timestamps
- **Buoy Distance**: Nearest measurement station information
- **Real-time Status**: Live data vs. cached data indicators

#### **`buoy-station-link.tsx`** - Interactive Buoy Station Links

```typescript
interface BuoyStationLinkProps {
  stationId: string;              // Buoy station ID (e.g., "220")
  stationName: string;            // Human-readable name (e.g., "Scripps Pier")
  distance?: number;              // Distance in kilometers
  beachLocation?: {               // Beach coordinates for reference
    latitude: number;
    longitude: number;
  };
  variant?: "default" | "compact" | "inline";
  showIcon?: boolean;
  className?: string;
}
```

**Display Variants:**

- **Default**: Full badge with station info and distance
- **Compact**: Minimal inline display with icon
- **Inline**: Plain text link with hover tooltip

**Features:**

- **Clickable Links**: Navigate to buoy station detail pages (`/buoys/[stationId]`)
- **Distance Display**: Automatic km/m formatting (km for >1km, m for <1km)
- **Interactive Tooltips**: Detailed station information on hover
- **Accessibility**: Full ARIA labels and keyboard navigation
- **Distance Conversion**: Handles miles-to-km conversion automatically

**Integration:**

Used in `ForecastDataSourceIndicator` to provide direct access to buoy data sources:

```typescript
<ForecastDataSourceIndicator
  nearestBuoyStationId="220"
  nearestBuoyName="Scripps Pier"
  nearestBuoyDistance={2.5}  // miles
  beachLocation={{ latitude: 32.8674, longitude: -117.2548 }}
/>
// Automatically renders BuoyStationLink in compact variant
```

#### **`confidence-score-explanation.tsx`** - User-Friendly Quality Explanation

```typescript
interface ConfidenceFactors {
  dataFreshness?: number; // 0-100%
  sourceReliability?: number; // 0-100%
  weatherConditions?: number; // 0-100%
  historicalAccuracy?: number; // 0-100%
}

interface HistoricalAccuracy {
  last30Days?: number | null;
  last7Days?: number | null;
  totalSessions: number;
}
```

**Explanation Features:**

- **Factor Breakdown**: Individual component scoring
- **Historical Context**: Past accuracy performance
- **User-Friendly Language**: Plain English explanations
- **Interactive Tooltips**: Educational content about confidence factors
- **Expandable Details**: Progressive disclosure of technical information

#### **`forecast-fallback-messaging.tsx`** - Fallback Communication

```typescript
interface ForecastFallbackMessagingProps {
  fallbackType:
    | "nearest_beach"
    | "nearest_buoy"
    | "regional"
    | "out_of_area"
    | "unknown";
  originalLocation: string;
  fallbackLocation: string;
  distance?: number;
  reason: string;
  accuracyImpact?: "low" | "medium" | "high";
  confidenceReduction?: number;
  isOutOfArea?: boolean;
  isTemporary?: boolean;
  showRequestDataOption?: boolean;
  alternatives?: AlternativeLocation[];
  fallbackChain?: FallbackChainItem[];
  onRefresh?: () => void;
  onRequestData?: (location: string) => void;
}
```

**Fallback Types:**

- **Nearest Beach**: Using closest available beach data
- **Nearest Buoy**: Using closest buoy measurements
- **Regional**: Using regional forecast model
- **Out of Area**: Location outside coverage area
- **Unknown**: Unclassified fallback scenario

---

### 📊 **Statistics & Analytics Components**

#### **`forecast-stats.tsx`** - Comprehensive Metrics Display

```typescript
interface DataSourceInfo {
  name: string;
  type: "wave" | "tide" | "weather" | "buoy";
  status: "active" | "fallback" | "unavailable";
  confidence: number;
  lastUpdated?: string;
}
```

**Metrics Tracking:**

- **Data Quality**: Average confidence across all forecasts
- **Source Distribution**: NOAA WaveWatch III, CO-OPS, Weather Service, NDBC
- **Availability Indicators**: Real-time status of data sources
- **Quality Trends**: Confidence scoring over time

#### **`forecast-accuracy-card.tsx`** - Historical Performance

- **Accuracy Tracking**: Historical forecast vs. actual comparison
- **Beach-Specific Tuning**: Location-based accuracy metrics
- **Trend Analysis**: Accuracy improvement over time
- **User Feedback Integration**: Community accuracy validation

#### **`session-forecast-comparison.tsx`** - User Validation

```typescript
interface ComparisonMetric {
  forecast: string | number;
  actual: string | number;
  accuracy: "good" | "fair" | "poor";
  delta?: number;
}
```

**Comparison Features:**

- **Wave Height Accuracy**: Forecast vs. reported conditions
- **Wind Condition Validation**: Direction and speed comparison
- **Overall Rating**: User satisfaction with forecast accuracy
- **Learning Integration**: Feedback loop for model improvement

---

### 🎯 **Specialized Display Components**

#### **`enhanced-forecast-with-transparency.tsx`** - Single Forecast Enhancement

- **Individual Forecast Focus**: Detailed single-forecast analysis
- **Transparency Integration**: Data source and confidence display
- **Compact Mode**: Space-efficient single forecast display
- **Interactive Features**: Expandable details and user controls

#### **`forecast-preview-with-transparency.tsx`** - Quick Preview Cards

```typescript
interface ForecastPreviewData {
  wave_height: string;
  wind_speed: string;
  weather_condition: string;
  confidence_score: number;
  data_source: string;
  data_sources: string[];
  fallback_info?: {
    type: string;
    distance?: number;
  };
}
```

**Preview Features:**

- **Quick Overview**: Essential forecast information
- **Source Attribution**: Clear data source indication
- **Confidence Display**: Quality scoring integration
- **Fallback Indication**: Distance and type information
- **Multiple Variants**: Grid and inline display options

---

### 📝 **User Interaction Components**

#### **`forecast-feedback-form.tsx`** - Community Validation

```typescript
interface ForecastFeedback {
  waveHeight: number; // Actual wave height experienced
  windCondition: string; // Actual wind conditions
  windSpeed?: number; // Measured wind speed
  notes?: string; // Additional observations
  overallAccuracy: number; // 1-5 star rating
}
```

**Feedback Collection:**

- **Structured Input**: Standardized feedback format
- **Accuracy Rating**: 1-5 star overall assessment
- **Condition Validation**: Specific condition verification
- **Free-form Notes**: Additional user observations
- **Skip Options**: Non-mandatory feedback collection

#### **`date-navigation.tsx`** - Temporal Navigation

- **Date Selection**: Multi-day forecast navigation
- **Today/Tomorrow Shortcuts**: Quick navigation to key dates
- **Available Dates**: Dynamic date range based on data availability
- **Mobile Optimization**: Touch-friendly date selection

---

## Data Flow Architecture

### 🔄 **Data Pipeline**

#### **Source Integration**

```typescript
// Multi-source data aggregation
interface ForecastSources {
  waveWatch: NOAAWaveWatchData; // Wave predictions
  coOps: NOAATidalData; // Tide predictions
  weather: NOAAWeatherData; // Weather conditions
  ndbc: BuoyMeasurements; // Real-time buoy data
  cdip: CDIPBuoyData; // California buoy network
}

// Quality-weighted aggregation
const aggregatedForecast = combineSourcesWithWeighting(sources, qualityWeights);
```

#### **Confidence Calculation**

```typescript
interface ConfidenceFactors {
  dataFreshness: number; // 0-100 based on data age
  sourceReliability: number; // 0-100 based on source quality
  weatherConditions: number; // 0-100 based on weather clarity
  historicalAccuracy: number; // 0-100 based on past performance
}

const calculateConfidence = (factors: ConfidenceFactors): number => {
  const weights = {
    dataFreshness: 0.3,
    sourceReliability: 0.4,
    weatherConditions: 0.2,
    historicalAccuracy: 0.1,
  };

  return Object.entries(factors).reduce((total, [key, value]) => {
    return total + value * weights[key];
  }, 0);
};
```

#### **Fallback Strategy**

```typescript
const fallbackChain = [
  "CDIP_REALTIME", // Highest priority: Real-time CDIP buoys
  "NOAA_NDBC", // High priority: NOAA buoy network
  "NOAA_WAVEWATCH", // Medium priority: Wave model predictions
  "NEAREST_BEACH", // Low priority: Nearest beach with data
  "REGIONAL_MODEL", // Lowest priority: Regional averages
];

const getForecastWithFallback = async (
  location: Coordinates
): Promise<ForecastData> => {
  for (const source of fallbackChain) {
    try {
      const data = await fetchFromSource(source, location);
      if (data.quality > MINIMUM_QUALITY_THRESHOLD) {
        return {
          ...data,
          dataSource: source,
          fallbackInfo:
            source !== fallbackChain[0]
              ? {
                  type: source,
                  reason: "Primary source unavailable",
                }
              : undefined,
        };
      }
    } catch (error) {
      console.warn(`Source ${source} failed:`, error);
      continue;
    }
  }

  throw new Error("All forecast sources unavailable");
};
```

### 📊 **State Management Patterns**

#### **Forecast State**

```typescript
interface ForecastState {
  // Core data
  forecasts: EnhancedForecastEntity[];
  availableDates: string[];
  selectedDate: string;

  // UI state
  loading: boolean;
  error: string | null;
  updating: boolean;
  autoGenerating: boolean;

  // Transparency state
  transparencyVisible: boolean;
  transparencyExpanded: boolean;
  showQualitySummary: boolean;

  // Quality metrics
  confidenceDistribution: ConfidenceDistribution;
  sourceBreakdown: SourceBreakdown;
}
```

#### **Data Fetching Hook**

```typescript
const useEnhancedForecast = ({
  beachId,
  defaultDays = 10,
  immediate = true,
  autoGenerate = false,
}) => {
  const [state, setState] = useState<ForecastState>(initialState);

  const fetchForecast = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await getForecastData(beachId, defaultDays);
      setState((prev) => ({
        ...prev,
        forecasts: data.forecasts,
        availableDates: data.availableDates,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error.message,
        loading: false,
      }));
    }
  }, [beachId, defaultDays]);

  // Auto-refresh stale data
  useEffect(() => {
    if (immediate) fetchForecast();

    if (autoGenerate) {
      const interval = setInterval(() => {
        const lastUpdate = state.forecasts[0]?.updated_at;
        if (lastUpdate && isStale(lastUpdate, 6 * 60 * 60 * 1000)) {
          fetchForecast();
        }
      }, 30 * 60 * 1000); // Check every 30 minutes

      return () => clearInterval(interval);
    }
  }, [immediate, autoGenerate, fetchForecast]);

  return {
    ...state,
    refetch: fetchForecast,
    handleRefresh: fetchForecast,
  };
};
```

---

## Performance Architecture

### ⚡ **Optimization Strategies**

#### **Data Caching**

```typescript
// Multi-level caching strategy
interface CacheStrategy {
  // Browser cache: 5 minutes for real-time data
  realTimeCache: CacheConfig = {
    duration: 5 * 60 * 1000,
    strategy: "stale-while-revalidate",
  };

  // Memory cache: 30 minutes for processed forecasts
  forecastCache: CacheConfig = {
    duration: 30 * 60 * 1000,
    strategy: "cache-first",
  };

  // Database cache: 6 hours for NOAA data
  noaaCache: CacheConfig = {
    duration: 6 * 60 * 60 * 1000,
    strategy: "cache-first-then-network",
  };
}
```

#### **Component Optimization**

```typescript
// Memoized chart components
const TideChart = React.memo(
  ({ data, forecasts, ...props }) => {
    const processedData = useMemo(() => {
      return data || extractTideEvents(forecasts);
    }, [data, forecasts]);

    const chartConfig = useMemo(
      () => ({
        // Chart configuration that doesn't change
        margin: { top: 50, right: 30, left: 20, bottom: 50 },
        isAnimationActive: process.env.NODE_ENV !== "production",
      }),
      []
    );

    return (
      <ResponsiveContainer>
        <AreaChart data={processedData} {...chartConfig}>
          {/* Chart implementation */}
        </AreaChart>
      </ResponsiveContainer>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for optimal re-rendering
    return (
      JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data) &&
      prevProps.forecasts?.length === nextProps.forecasts?.length
    );
  }
);
```

#### **Lazy Loading**

```typescript
// Progressive component loading
const ForecastDisplay = lazy(() => import("./forecast-display"));
const TideChart = lazy(() => import("./tide-chart-recharts"));
const ConfidenceExplanation = lazy(
  () => import("./confidence-score-explanation")
);

// Suspense boundary with skeleton
<Suspense fallback={<ForecastSkeleton />}>
  <ForecastDisplay forecasts={forecasts} />
</Suspense>;
```

### 📱 **Mobile Optimization**

#### **Touch-Friendly Interactions**

- **Minimum Touch Targets**: 44px minimum for all interactive elements
- **Swipe Navigation**: Horizontal swiping for date navigation
- **Pinch-to-Zoom**: Chart zooming capabilities
- **Pull-to-Refresh**: Native refresh gestures

#### **Responsive Breakpoints**

```typescript
const breakpoints = {
  mobile: "0px", // 0-640px: Single column, compact displays
  tablet: "641px", // 641-1024px: Two column, medium displays
  desktop: "1025px", // 1025px+: Multi-column, full displays
};

// Responsive component variants
const ForecastTable = ({ compact = false }) => {
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.tablet})`);

  return isMobile || compact ? <CompactForecastTable /> : <FullForecastTable />;
};
```

---

## Accessibility Architecture

### ♿ **WCAG 2.1 AA Compliance**

#### **Screen Reader Support**

```typescript
// Comprehensive ARIA implementation
<div
  role="grid"
  aria-label="10-day surf forecast table"
  aria-describedby="forecast-description"
>
  <div role="row" aria-rowindex="1">
    <div role="columnheader" aria-sort="none">
      Date
    </div>
    <div role="columnheader">Wave Height</div>
    <div role="columnheader">Confidence</div>
  </div>
  {forecasts.map((forecast, index) => (
    <div
      key={forecast.id}
      role="row"
      aria-rowindex={index + 2}
      aria-expanded={expandedDates.includes(forecast.date)}
    >
      <div role="gridcell" aria-describedby={`date-${forecast.date}`}>
        {formatDate(forecast.date)}
      </div>
      <div role="gridcell" aria-describedby={`wave-${forecast.date}`}>
        <span aria-label={`Wave height ${forecast.wave_height}`}>
          {forecast.wave_height}
        </span>
      </div>
      <div role="gridcell" aria-describedby={`confidence-${forecast.date}`}>
        <span
          aria-label={`Confidence score ${forecast.confidence_score} percent`}
          aria-describedby="confidence-explanation"
        >
          {forecast.confidence_score}%
        </span>
      </div>
    </div>
  ))}
</div>
```

#### **Keyboard Navigation**

```typescript
// Comprehensive keyboard support
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case "ArrowRight":
      // Navigate to next date
      navigateToDate(getNextDate(selectedDate));
      break;
    case "ArrowLeft":
      // Navigate to previous date
      navigateToDate(getPreviousDate(selectedDate));
      break;
    case "Enter":
    case " ":
      // Toggle expanded state
      toggleExpandedDate(selectedDate);
      break;
    case "Escape":
      // Close expanded views
      closeAllExpanded();
      break;
    case "Home":
      // Navigate to first date
      navigateToDate(availableDates[0]);
      break;
    case "End":
      // Navigate to last date
      navigateToDate(availableDates[availableDates.length - 1]);
      break;
  }
};
```

#### **Color Accessibility**

```typescript
// High contrast, colorblind-friendly palette
const accessibleColors = {
  confidence: {
    high: "#16A34A", // Green - WCAG AA compliant
    medium: "#D97706", // Orange - WCAG AA compliant
    low: "#DC2626", // Red - WCAG AA compliant
  },
  dataSource: {
    cdip: "#0077B6", // Ocean blue
    noaa: "#2563EB", // Sky blue
    fallback: "#6B7280", // Gray
    error: "#DC2626", // Error red
  },
  // Ensure 4.5:1 contrast ratio minimum
  text: {
    primary: "#111827", // Nearly black
    secondary: "#4B5563", // Dark gray
    muted: "#9CA3AF", // Medium gray
  },
};
```

### 🔊 **Live Regions & Announcements**

```typescript
// Dynamic content announcements
const ForecastUpdater = () => {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (updating) {
      setAnnouncement("Updating forecast data...");
    } else if (error) {
      setAnnouncement(`Error loading forecast: ${error}`);
    } else if (forecasts.length > 0) {
      setAnnouncement(`Forecast updated with ${forecasts.length} predictions`);
    }
  }, [updating, error, forecasts]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
};
```

---

## Testing Architecture

### 🧪 **Testing Strategy**

#### **Unit Testing**

```typescript
// Component behavior testing
describe("ForecastDisplay", () => {
  it("renders forecast data correctly", () => {
    const mockForecasts = createMockForecasts();

    render(
      <ForecastDisplay
        forecasts={mockForecasts}
        beach={mockBeach}
        loading={false}
        error={null}
      />
    );

    expect(screen.getByText(mockBeach.name)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("handles loading state", () => {
    render(
      <ForecastDisplay
        forecasts={[]}
        beach={mockBeach}
        loading={true}
        error={null}
      />
    );

    expect(screen.getByText(/loading forecasts/i)).toBeInTheDocument();
  });

  it("displays error state with retry option", () => {
    const errorMessage = "Failed to fetch forecast data";

    render(
      <ForecastDisplay
        forecasts={[]}
        beach={mockBeach}
        loading={false}
        error={errorMessage}
      />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
```

#### **Integration Testing**

```typescript
// Data flow testing
describe("ForecastDataFlow", () => {
  it("integrates multiple data sources correctly", async () => {
    const mockSources = {
      cdip: mockCDIPData,
      noaa: mockNOAAData,
      ndbc: mockNDBCData,
    };

    const forecast = await generateEnhancedForecast(mockSources);

    expect(forecast.confidence_score).toBeGreaterThan(0);
    expect(forecast.data_source).toBeDefined();
    expect(forecast.wave_height).toMatch(/\d+-\d+ ft/);
  });

  it("handles fallback scenarios gracefully", async () => {
    // Simulate primary source failure
    mockCDIPService.mockRejectedValue(new Error("CDIP unavailable"));

    const forecast = await generateEnhancedForecast({});

    expect(forecast.data_source).toBe("FALLBACK");
    expect(forecast.fallback_info).toBeDefined();
    expect(forecast.confidence_score).toBeLessThan(75);
  });
});
```

#### **Accessibility Testing**

```typescript
// A11y compliance testing
describe("ForecastAccessibility", () => {
  it("meets WCAG 2.1 AA requirements", async () => {
    const { container } = render(<ForecastDisplay {...defaultProps} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("supports keyboard navigation", async () => {
    render(<MultiDayForecastTable forecasts={mockForecasts} />);

    const firstRow = screen.getAllByRole("button")[0];
    firstRow.focus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { expanded: true })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("region", { expanded: true })
    ).not.toBeInTheDocument();
  });

  it("announces dynamic content changes", async () => {
    const { rerender } = render(
      <ForecastDisplay {...defaultProps} loading={true} />
    );

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);

    rerender(<ForecastDisplay {...defaultProps} loading={false} />);

    expect(screen.getByRole("status")).toHaveTextContent(/forecast updated/i);
  });
});
```

#### **Performance Testing**

```typescript
// Performance benchmark testing
describe("ForecastPerformance", () => {
  it("renders large datasets efficiently", async () => {
    const largeDataset = generateMockForecasts(1000);

    const startTime = performance.now();
    render(<ForecastDisplay forecasts={largeDataset} {...defaultProps} />);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
  });

  it("memoizes expensive calculations", () => {
    const expensiveCalc = jest.fn();

    const { rerender } = render(
      <TideChart forecasts={mockForecasts} onExpensiveCalc={expensiveCalc} />
    );

    // Rerender with same props
    rerender(
      <TideChart forecasts={mockForecasts} onExpensiveCalc={expensiveCalc} />
    );

    expect(expensiveCalc).toHaveBeenCalledTimes(1);
  });
});
```

---

## Development Guidelines

### 🔧 **Component Development Standards**

#### **File Naming Convention**

```
forecast-{function}-{variant}.tsx

Examples:
- forecast-display.tsx           // Main display component
- forecast-display-with-transparency.tsx  // Enhanced variant
- tide-chart-recharts.tsx       // Technology-specific implementation
- confidence-score-explanation.tsx  // Descriptive functionality
```

#### **Interface Patterns**

```typescript
// Standard forecast component interface
interface ForecastComponentProps {
  // Core data (required)
  forecasts: EnhancedForecastEntity[];

  // Context (optional but common)
  beach?: BeachContext;
  selectedDate?: string;

  // Display options (optional with defaults)
  variant?: "compact" | "detailed" | "mobile";
  showConfidence?: boolean;
  showTransparency?: boolean;

  // Behavior (optional)
  loading?: boolean;
  error?: string | null;
  onDateSelect?: (date: string) => void;
  onRefresh?: () => void;

  // Styling (always optional)
  className?: string;
}
```

#### **Data Transformation Patterns**

```typescript
// Consistent data processing utilities
export const forecastUtils = {
  // Date normalization
  normalizeDate: (date: string | Date): string => {
    return new Date(date).toISOString().split("T")[0];
  },

  // Wave height parsing
  parseWaveHeight: (height: string): number => {
    const match = height.match(/(\d+)-?(\d+)?/);
    if (!match) return 0;
    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    return (min + max) / 2;
  },

  // Confidence level classification
  getConfidenceLevel: (score: number): ConfidenceLevel => {
    if (score >= 75) return "high";
    if (score >= 50) return "medium";
    return "low";
  },

  // Group forecasts by date
  groupByDate: (
    forecasts: EnhancedForecastEntity[]
  ): Record<string, EnhancedForecastEntity[]> => {
    return forecasts.reduce((groups, forecast) => {
      const date = normalizeDate(forecast.forecast_date);
      groups[date] = groups[date] || [];
      groups[date].push(forecast);
      return groups;
    }, {} as Record<string, EnhancedForecastEntity[]>);
  },
};
```

### 📝 **Documentation Standards**

#### **Component Documentation Template**

````typescript
/**
 * ForecastDisplay - Primary forecast visualization component
 *
 * Displays 10-day surf forecasts with optional transparency features.
 * Supports progressive enhancement for data quality indicators.
 *
 * @example
 * ```tsx
 * <ForecastDisplay
 *   forecasts={enhancedForecasts}
 *   beach={beachContext}
 *   showTransparency={true}
 *   onDateSelect={(date) => console.log('Selected:', date)}
 * />
 * ```
 *
 * @see {@link TideChart} for tide-specific visualization
 * @see {@link ConfidenceScoreExplanation} for quality metrics
 */
export function ForecastDisplay(props: ForecastDisplayProps) {
  // Implementation
}
````

#### **README Structure**

Each complex component should include:

1. **Purpose & Overview**: What the component does
2. **Usage Examples**: Basic and advanced usage patterns
3. **Props Documentation**: Interface definitions with examples
4. **Features List**: Key capabilities and highlights
5. **Architecture Notes**: Design decisions and technical details
6. **Testing Information**: How to test and validate

---

## Future Roadmap

### 🚀 **Planned Enhancements**

#### **Advanced Visualization**

- **Interactive 3D Wave Models**: WebGL-based wave visualization
- **Real-time Animation**: Live wave and tide animations
- **Satellite Integration**: Satellite imagery overlay
- **AR/VR Support**: Immersive forecast experiences

#### **Machine Learning Integration**

- **Personalized Accuracy**: User-specific forecast calibration
- **Crowd-Sourced Validation**: Community-driven accuracy improvements
- **Predictive Modeling**: Advanced wave prediction algorithms
- **Local Knowledge Integration**: Surf local expertise incorporation

#### **Enhanced Accessibility**

- **Voice Interface**: Voice-controlled forecast navigation
- **Haptic Feedback**: Touch-based condition communication
- **High Contrast Modes**: Enhanced visual accessibility
- **Multi-language Support**: International accessibility

#### **Performance Improvements**

- **Edge Computing**: CDN-based forecast generation
- **Progressive Web App**: Offline forecast capability
- **WebAssembly**: High-performance data processing
- **Real-time Updates**: WebSocket-based live updates

### 🎯 **Component Priorities**

#### **High Priority**

1. **Real-time Chart Updates** - Live data streaming visualization
2. **Enhanced Mobile Experience** - Native app-like interactions
3. **Advanced Error Recovery** - Intelligent fallback strategies
4. **Performance Monitoring** - Real-time performance metrics

#### **Medium Priority**

1. **Custom Chart Themes** - User-customizable visualization
2. **Export Capabilities** - PDF/image export functionality
3. **Bookmark System** - Favorite forecast configurations
4. **Social Sharing** - Forecast sharing capabilities

## Conclusion

The `/components/forecast` directory represents a sophisticated, production-ready forecasting system that balances technical accuracy with user accessibility. Through multi-source data integration, transparency frameworks, and comprehensive accessibility features, it provides reliable surf forecasting while maintaining performance and usability standards.

The architecture supports both current requirements and future scalability, making it suitable for growth and continuous improvement as the Quiver platform evolves. The emphasis on data transparency, user feedback integration, and community validation creates a foundation for increasingly accurate and trustworthy surf forecasting.
