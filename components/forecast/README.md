# TideChart Component

A production-ready, accessible Recharts-based component for displaying 5-day tide data with high/low tide markers and labels.

## Usage

```tsx
import { TideChart } from "@/components/forecast/tide-chart-recharts";

// Option 1: Direct tide data
const tideData = [
  {
    time: new Date("2024-01-15T06:00:00Z"),
    height: 5.2,
    type: "high",
  },
  {
    time: new Date("2024-01-15T12:30:00Z"),
    height: -1.1,
    type: "low",
  },
  // ... more data points
];

<TideChart data={tideData} />

// Option 2: Legacy forecast data (backward compatible)
<TideChart forecasts={enhancedForecastEntities} />
```

## Props

```tsx
interface TideChartProps {
  data?: TideDataPoint[]; // Direct tide data
  forecasts?: EnhancedForecastEntity[]; // Legacy forecast entities
  className?: string; // Custom CSS classes
  showNowLine?: boolean; // Show current time reference line (default: true)
  isAnimationActive?: boolean; // Enable chart animations (default: false in production)
}

interface TideDataPoint {
  time: Date; // Tide event timestamp
  height: number; // Tide height in feet
  type: "high" | "low"; // Tide type
}
```

## Features

### 🎨 **Visual Design**

- **Ocean-blue area + line charts** (`#0077B6`) for smooth tide flow
- **High tide markers**: Orange circles (`#FF7F11`) with labels above
- **Low tide markers**: Grey circles (`#6B7280`) with labels below
- **Zero baseline reference line**: Subtle dashed line at 0ft
- **"Now" reference line**: Red dashed line showing current time
- **Clean grid**: Minimal horizontal-only grid for readability
- **Visible axis lines**: Professional grey (`#9CA3AF`) axis and tick lines
- **Clear axis labels**: "Day" on X-axis and "Tide (ft)" on Y-axis

### 📊 **Data Processing**

- **5-day limit**: Automatically filters to max 5 days from first data point
- **Smart Y-axis**: Calculates domain with 10% padding around data range
- **Today/Tomorrow labels**: X-axis shows "Today", "Tomorrow", then day names
- **Dual data support**: Works with both direct `TideDataPoint[]` and legacy `EnhancedForecastEntity[]`

### ♿ **Accessibility**

- **ARIA labels**: Proper `role="img"` with descriptive `aria-label`
- **High contrast colors**: WCAG-compliant color choices
- **Keyboard navigation**: Full Recharts accessibility support
- **Screen reader friendly**: Semantic structure and labels
- **Clear axis labels**: Readable "Day" and "Tide (ft)" labels for context

### ⚡ **Performance**

- **Memoized processing**: `useMemo` for data transformation and tick calculation
- **Animation control**: Disabled by default in production for better mobile performance
- **Responsive**: Uses `ResponsiveContainer` for automatic resizing
- **Optimized margins**: `top: 50px, bottom: 50px` prevents label clipping

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
- **Extended datasets**: Automatically truncates to 10-day window

## Integration Points

### Current Usage

- `components/beach-detail.tsx` - Beach detail page tide charts
- `components/beaches-enhanced-forecast.tsx` - Enhanced forecast displays

### Data Sources

- **Direct**: `TideDataPoint[]` arrays from external APIs
- **Legacy**: `EnhancedForecastEntity[]` from existing forecast system
- **Future**: Easily extensible for new data sources

## Testing

Comprehensive test coverage includes:

- **Rendering**: Basic component rendering and styling
- **Data processing**: 10-day limits, Y-axis domains, scatter separation
- **Accessibility**: ARIA labels, color contrast, semantic structure
- **Performance**: Animation controls, memoization
- **Edge cases**: Empty data, extreme values, negative/positive ranges
- **Backward compatibility**: Legacy forecast data support
- **Axis configuration**: Proper styling, labels, and tick marks

Run tests: `npm test -- tide-chart-recharts.test.tsx`

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

- **X-axis**: Time scale with "Today"/"Tomorrow" labels, grey tick marks. We
  explicitly pass a unique-per-day `ticks` array derived from the dataset and
  set `interval={0}` with `allowDuplicatedCategory={false}` to prevent
  Recharts from auto-generating duplicate day labels on narrow/mobile
  viewports. `minTickGap` and `tickMargin` are tuned for mobile landscape.
- **Y-axis**: Smart domain calculation with "Tide (ft)" label, professional styling
- **Reference lines**: Zero baseline and optional "Now" line for context
- **Margins**: Generous spacing (`50px` top/bottom) prevents label clipping

### Future Enhancements

- **Time zone support**: Automatic local time zone conversion
- **Metric units**: Support for meter heights alongside feet
- **Tide predictions**: Integration with NOAA tide prediction APIs
- **Export functionality**: PNG/SVG export for sharing
- **Custom themes**: Theme provider integration for brand colors
