# TideChart Component

A production-ready, accessible Recharts-based component for displaying a 48-hour tide forecast window starting from the current time, with high/low tide markers and labels.

## Usage

```tsx
import { TideChart } from "@/components/forecast/tide-chart-recharts";

// Option 1: Direct tide data
const tideData = [
  {
    t: "2024-01-15T06:00:00Z",
    h: 5.2,
    isHigh: true,
  },
  {
    t: "2024-01-15T12:30:00Z",
    h: -1.1,
    isLow: true,
  },
  // ... more data points
];

<TideChart data={tideData} now={new Date()} />

// Option 2: Legacy forecast data (backward compatible)
<TideChart forecasts={enhancedForecastEntities} />
```

## Props

```tsx
interface TideChartProps {
  data?: TidePoint[]; // Direct tide data (preferred)
  forecasts?: EnhancedForecastEntity[]; // Legacy forecast entities
  hourly?: {
    ts: string;
    height_m?: number | null;
    height_ft?: number | null;
  }[];
  events?: {
    ts: string;
    type: "HIGH" | "LOW";
    height_m?: number | null;
    height_ft?: number | null;
  }[];
  dayFormatter?: (d: Date) => string;
  now?: Date;
  yDomain?: [number, number] | "auto";
  unit?: string; // default "ft"
  compact?: boolean; // removes outer card styling
  className?: string; // Custom CSS classes for wrapper
  showNowLine?: boolean; // Toggle the "now" reference line (default: true)
  isAnimationActive?: boolean; // Control Recharts line animation
}

interface TidePoint {
  t: string | number | Date; // Tide sample timestamp
  h: number; // Tide height in feet
  isHigh?: boolean; // Highlight as high tide
  isLow?: boolean; // Highlight as low tide
}
```

## Features

### 🎨 **Visual Design**

- **Indigo line + soft gradient fill** (line `#2563EB`, fill `#60A5FA`) for smooth tide flow
- **High/Low emphasis halos**: Semi-transparent rings around peak dots, plus optional legend badges
- **Zero baseline reference line**: Subtle dashed line at 0 ft for context
- **"Now" reference line**: Red dashed line when the `now` value sits within range
- **Minimal grid**: Horizontal dashed guides only, no heavy axis chrome
- **Compact mode**: Toggle card chrome/legend off for embedding inside existing shells

### 📊 **Data Processing**

- **48-hour window**: Automatically filters and displays data from the current time (now) to 48 hours in the future
- **Fixed time domain**: X-axis always shows the full 48-hour window, regardless of available data points
- **Smart Y-axis**: Calculates domain with 15% padding around data range
- **Custom day formatter**: Defaults to weekday shorthand, override via `dayFormatter`
- **Dual data support**: Works with direct `TidePoint[]`, hourly/event feeds, or legacy forecasts

### ♿ **Accessibility**

- **ARIA labels**: Proper `role="img"` with descriptive `aria-label`
- **High contrast colors**: WCAG-compliant color choices
- **Keyboard navigation**: Full Recharts accessibility support
- **Screen reader friendly**: Semantic structure and labels
- **Descriptive tooltip**: Day/time + height strings surfaced for assistive tech

### ⚡ **Performance**

- **Memoized processing**: `useMemo` for data transformation and tick calculation
- **Animation control**: Disabled by default in production for better mobile performance
- **Responsive**: Uses `ResponsiveContainer` for automatic resizing
- **Optimized margins**: Compact chart padding keeps ticks legible on mobile

## Examples

### Basic Usage

```tsx
<TideChart data={tideData} />
```

### Custom Styling

```tsx
<TideChart data={tideData} className="my-4 shadow-lg" showNowLine={false} />
```

### Enable Animations (Development)

```tsx
<TideChart data={tideData} isAnimationActive={true} />
```

### Legacy Forecast Integration

```tsx
// Works seamlessly with existing enhanced forecast data
<TideChart forecasts={enhancedForecasts} />
```

## Edge Cases Handled

- **Empty data**: Shows "No tide data available" message
- **Single data point**: Renders chart with single marker
- **Extreme values**: Smart Y-axis scaling handles any height range
- **All negative/positive**: Proper domain calculation for any data range
- **Same timestamps**: Handles duplicate times gracefully
- **Extended datasets**: Automatically truncates to a 5-day window

## Integration Points

### Current Usage

- `components/beach-detail/forecast-and-tides.tsx` - Beach detail page tide chart tab
- `components/beaches-enhanced-forecast.tsx` - Enhanced forecast displays

### Data Sources

- **Direct**: `TidePoint[]` arrays from external APIs
- **Legacy**: `EnhancedForecastEntity[]` from existing forecast system
- **Future**: Easily extensible for new data sources

## Testing

Comprehensive test coverage includes:

- **Rendering**: Basic component rendering and styling
- **Data processing**: 5-day limit, Y-axis domains, smoothing
- **Accessibility**: ARIA labels, color contrast, semantic structure
- **Performance**: Animation controls, memoization
- **Edge cases**: Empty data, extreme values, negative/positive ranges
- **Backward compatibility**: Legacy forecast data support
- **Axis configuration**: Proper styling, labels, and tick marks

Run tests: `npx jest __tests__/components/forecast/tide-chart-recharts.*`

## Architecture Notes

### Why Recharts?

- **Accessibility**: Built-in ARIA support and keyboard navigation
- **Performance**: Optimized SVG rendering with animation controls
- **Flexibility**: Easy customization of all visual elements
- **Responsive**: Native responsive container support
- **TypeScript**: Full type safety and IntelliSense support

### Design Decisions

- **Zero baseline**: Area fill splits at 0ft for visual clarity
- **Label positioning**: Dynamic above/below placement prevents overlap
- **Color scheme**: Ocean theme with high contrast accessibility
- **Animation control**: Disabled in production for mobile performance
- **Data memoization**: Prevents unnecessary re-computation on re-renders
- **Direct Recharts axes**: Uses native `XAxis`/`YAxis` for full control and visible axis lines

### Axis Configuration

- **X-axis**: Fixed 48-hour time scale starting from current time, with day labels and 3-hour tick marks
  - Domain is always `[now, now + 48 hours]` regardless of available data
  - Time ticks generated at 3-hour intervals starting from current time
  - Day labels show date boundaries within the 48-hour window
  - Responsive tick display: shows all ticks on desktop, reduced on mobile (<480px)
- **Y-axis**: Smart domain calculation with automatic padding around data range
- **Reference lines**:
  - Zero baseline (horizontal dashed line at 0 ft)
  - "Now" line (vertical red dashed line at current time) shown at the left edge
- **Margins**: Generous spacing (`24px` top/bottom) prevents label clipping

### Future Enhancements

- **Time zone support**: Automatic local time zone conversion
- **Metric units**: Support for meter heights alongside feet
- **Tide predictions**: Integration with NOAA tide prediction APIs
- **Export functionality**: PNG/SVG export for sharing
- **Custom themes**: Theme provider integration for brand colors
