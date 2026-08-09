# Wind Forecast Chart Design

## Problem

The wind checker tool's "24-Hour Wind Forecast" section renders an empty/invisible chart. The current implementation is a custom CSS bar chart (`WindTimeline`) with 40px max-height bars that don't display properly. The tide clock tool has a polished Recharts-based area chart — the wind chart should match that quality.

## Solution

Replace the custom `WindTimeline` component with a Recharts `AreaChart` that shows wind speed and gusts over 24 hours, with fill color reflecting wind quality (offshore/cross-shore/onshore).

## Design

### Chart Type
Recharts `AreaChart` — matching the tide chart's visual language.

### Data
- **Source**: `OpenMeteoWindPoint[]` from `lib/services/open-meteo-wind-service.ts`
- **Fields used**: `ts`, `wind_speed_mph`, `wind_gust_mph`, `wind_direction_deg`
- **Time range**: 24 hours (already sliced in current `WindTimeline`)

### Visual Elements
1. **Primary area**: `wind_speed_mph` — solid line with gradient fill
2. **Secondary line**: `wind_gust_mph` — dashed line above speed, no fill (subtle, shows gust peaks)
3. **Fill color**: Based on wind quality classification at each point
   - Green (`#4ade80`) = offshore
   - Yellow (`#facc15`) = cross-shore
   - Red (`#f87171`) = onshore
   - Muted blue (`#404C92`) = no orientation data (fallback)
4. **X-axis**: Time labels (every 3 hours), same style as tide chart
5. **Y-axis**: Wind speed in mph
6. **Now line**: Red vertical reference line at current time
7. **Tooltip**: Custom tooltip showing speed, gust, direction (cardinal), and quality label

### Color Strategy
Since Recharts `Area` fill can't change color per-segment natively, use a single gradient fill based on the **dominant** quality across the 24h window. The line stroke color can similarly reflect overall quality. Individual hour quality is already communicated by the "Best:" time windows header.

Alternative: Use a simple blue gradient (like the tide chart) and rely on the "Best:" annotation + legend for quality communication. This is simpler and more consistent with the tide chart aesthetic.

**Decision**: Use blue gradient fill (matches tide chart), keep the existing legend and "Best:" windows for quality context. This avoids complexity and stays consistent.

### Layout
- Replaces the current `WindTimeline` component in-place
- Same card container styling (noise-texture, border, navy gradient background)
- Keep the "24-HOUR WIND FORECAST" header and "Best:" annotation
- Keep the legend below (offshore/cross-shore/onshore dots)
- `ResponsiveContainer` at `h-48` (192px) — shorter than tide chart since it's a secondary tool

### Component Structure
New component: `WindForecastChart` in `components/tools/wind-forecast-chart.tsx`
- Extracted from `wind-checker-client.tsx` for cleanliness
- Props: `wind: OpenMeteoWindPoint[]`, `offshoreDeg: number | null`, `toleranceDeg: number | null`
- Uses Recharts (already a dependency at v2.15.0)

## Files to Modify

1. **Create** `components/tools/wind-forecast-chart.tsx` — new Recharts area chart component
2. **Edit** `components/tools/wind-checker-client.tsx` — replace `WindTimeline` with `WindForecastChart`, remove old component

## Verification

1. Navigate to `/tools/wind-checker`, select a beach — chart should render with wind speed area and gust line
2. Hover over chart — tooltip shows speed, gust, direction, quality
3. Now line visible at current time
4. Responsive: check mobile and desktop breakpoints
5. `yarn typecheck` passes
6. `yarn lint` passes
