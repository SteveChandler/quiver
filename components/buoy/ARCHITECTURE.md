# Buoy Components Architecture

## 🎯 **PURPOSE**

The buoy components provide a comprehensive system for displaying real-time ocean and weather conditions from CDIP buoys with multiple display variants and measurement types.

## 📁 **COMPONENT STRUCTURE**

```
components/buoy/
├── index.ts                  # Barrel exports for all buoy components
├── buoy-card.tsx            # Main buoy display with multiple variants
├── measurement-display.tsx   # Reusable measurement components
├── status-indicators.tsx     # Status badges and data freshness
└── tides-display.tsx        # Tide charts and next tide info
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Component Composition Pattern**

```typescript
BuoyCard (Container)
├── MeasurementDisplay (Temperature, Wind, Wave, Pressure)
├── StatusIndicators (Status, Quality, Freshness)
└── TidesDisplay (Tides, NextTide, TideChart)
```

### **Variant System**

```typescript
type BuoyVariant = "default" | "compact" | "detailed";

// Each variant controls:
// - Layout density
// - Information depth
// - Visual hierarchy
// - Responsive behavior
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **BuoyCard** (Main Container)

- **Purpose**: Flexible buoy data display with multiple variants
- **Props**: `BuoyCardProps` with conditions, variant, display options
- **Features**:
  - Three display variants (default, compact, detailed)
  - Optional click handling for navigation
  - Conditional content based on available data
  - Responsive grid layouts

**Variant Behaviors:**

```typescript
compact: {
  layout: "minimal with essential data",
  content: "wave height + temperature",
  size: "small card format"
}

default: {
  layout: "balanced information display",
  content: "all measurements + quick tides",
  size: "standard card format"
}

detailed: {
  layout: "comprehensive data view",
  content: "all measurements + full tides + status",
  size: "expanded card format"
}
```

### **MeasurementDisplay** (Data Components)

- **Purpose**: Consistent measurement formatting and display
- **Components**:
  - `Measurement` - Base component with icon, label, value
  - `TemperatureMeasurement` - Water/air temperature with color coding
  - `WindMeasurement` - Speed, direction, gusts in compact format
  - `WaveMeasurement` - Height and period combination
  - `PressureMeasurement` - Atmospheric pressure display

**Measurement Pattern:**

```typescript
interface MeasurementProps {
  value: number | string;
  unit?: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "compact" | "large";
}
```

### **StatusIndicators** (Status Components)

- **Purpose**: Visual status communication and data quality
- **Components**:
  - `BuoyStatusIndicator` - Online/offline/stale/error states
  - `ConditionBadge` - Quality ratings (excellent/good/fair/poor)
  - `WaveQualityBadge` - Wave height quality assessment
  - `DataFreshnessIndicator` - Time-based data freshness

**Status Logic:**

```typescript
const getDataFreshness = (timestamp: Date) => {
  const hoursOld = (now - timestamp) / (1000 * 60 * 60);

  if (hoursOld < 1) return "online";
  if (hoursOld < 6) return "stale";
  return "offline";
};
```

### **TidesDisplay** (Tide Components)

- **Purpose**: Tide information and visualization
- **Components**:
  - `TidesDisplay` - Full tide list with times and heights
  - `NextTide` - Next upcoming tide with countdown
  - `TideChart` - Visual tide chart (basic bar chart)

**Tide Features:**

```typescript
// Time formatting
const formatTideTime = (timestamp: number) => {
  // 12-hour format with am/pm
  return `${hours}:${minutes} ${ampm}`;
};

// Next tide calculation
const nextTide = tides.find((tide) => tide.time > now);
```

## 🔄 **DATA FLOW PATTERNS**

### **BuoyConditionsData Interface**

```typescript
interface BuoyConditionsData {
  // Temperature measurements
  water_temperature?: number;
  air_temperature?: number;

  // Wind measurements
  wind_speed?: number;
  wind_direction?: number;
  wind_direction_name?: string;
  wind_gust?: number;

  // Wave measurements
  wave_height?: number;
  wave_period?: number;

  // Environmental data
  pressure?: number;
  tides?: TideData[];
  updated_at?: number;
}
```

### **Conditional Rendering Pattern**

```typescript
// Only render sections with available data
{
  conditions?.water_temperature && (
    <TemperatureMeasurement value={conditions.water_temperature} type="water" />
  );
}

// Fallback for missing data
{
  !conditions && (
    <div className="text-muted-foreground">No buoy data available</div>
  );
}
```

## 🎨 **DESIGN SYSTEM**

### **Color Coding by Data Type**

```typescript
const dataTypeColors = {
  temperature: {
    water: "text-blue-500",
    air: "text-orange-500",
  },
  wind: "text-gray-600",
  waves: "text-blue-600",
  pressure: "text-purple-600",
  tides: "text-indigo-600",
};
```

### **Status Color Mapping**

```typescript
const statusColors = {
  online: "bg-green-500",
  stale: "bg-yellow-500",
  offline: "bg-gray-500",
  error: "bg-red-500",
};

const qualityColors = {
  excellent: "bg-green-500",
  good: "bg-blue-500",
  fair: "bg-yellow-500",
  poor: "bg-red-500",
};
```

### **Responsive Icon Sizes**

```typescript
const iconSizes = {
  compact: "h-3 w-3",
  default: "h-4 w-4",
  large: "h-5 w-5",
};
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Conditional Component Loading**

- Only render measurement components with available data
- Lazy load tide charts when needed
- Memoize expensive calculations (time formatting)

### **Efficient Data Updates**

```typescript
// Use timestamp-based freshness checks
const isDataFresh = useCallback((timestamp: number) => {
  return Date.now() - timestamp * 1000 < FRESH_DATA_THRESHOLD;
}, []);
```

## 🔗 **INTEGRATION PATTERNS**

### **With Map Components**

```typescript
// Buoy cards used in map markers
<BuoyCard
  variant="compact"
  conditions={buoyData}
  onClick={() => navigate(`/buoy/${buoyId}`)}
/>
```

### **With Forecast Components**

```typescript
// Buoy data supplements forecast information
<ForecastCard>
  <BuoyCard variant="compact" conditions={nearbyBuoyData} />
</ForecastCard>
```

## 📱 **RESPONSIVE DESIGN**

### **Mobile Optimizations**

- Compact variant for mobile screens
- Touch-friendly click targets
- Simplified data display on small screens

### **Grid Layouts**

```typescript
// Responsive measurement grids
className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

// Flexible card layouts
className = "space-y-3"; // Default spacing
className = "space-y-2"; // Compact spacing
```

## 🧪 **TESTING STRATEGY**

### **Component Tests**

- Test all variant renderings
- Verify conditional data display
- Check status indicator logic
- Test time formatting functions

### **Integration Tests**

- Buoy card in different contexts
- Data freshness calculations
- Tide time calculations
- Wave quality assessments

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Historical data charts
- Weather alerts integration
- Buoy location maps
- Data export functionality

### **Performance Improvements**

- Virtual scrolling for large buoy lists
- WebSocket real-time updates
- Cached data strategies

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive CDIP buoy integration  
**Next Review**: After real-time updates implementation
