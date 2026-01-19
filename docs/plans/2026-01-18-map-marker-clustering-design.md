# Map Marker Clustering Design

**Date:** 2026-01-18
**Status:** Approved
**Problem:** Beach markers overlap when multiple beaches are in close proximity, creating visual clutter

## Solution Overview

Implement marker clustering using Supercluster to group nearby beaches into single cluster markers that expand when clicked or zoomed.

## Clustering Behavior

### Grouping Logic
- Beaches within close proximity get grouped into a single cluster marker
- Clusters automatically break apart as user zooms in (around zoom level 13-14)
- Clicking a cluster smoothly zooms the map until individual beaches are visible

### Zoom Thresholds
| Zoom Level | Behavior |
|------------|----------|
| 0-11 | Aggressive clustering (large regions grouped) |
| 12-13 | Medium clustering (nearby beaches grouped) |
| 14+ | No clustering (all individual markers visible) |

### Click Behavior
- Clicking a cluster triggers `map.flyTo()` to the cluster's expansion zoom
- 500ms smooth animation centers on the cluster location
- Individual beaches become visible after zoom completes

## Cluster Marker Design

### Display Format
```
┌─────────────────┐
│  1-3ft      ×5  │   ← Wave range + beach count
└─────────────────┘
```

### Visual Specifications
- **Size:** 90-100px wide (vs 70px for individual markers)
- **Shape:** Pill/rounded rectangle (matches existing markers)
- **Wave range:** Min to max wave height in cluster (e.g., "1-3ft")
- **Count badge:** "×5" on right side, muted color
- **Color:** Based on best wave height in cluster (orange/yellow gradient)
- **Border:** Slightly darker than individual markers to distinguish

### States
| State | Appearance |
|-------|------------|
| Default | Standard cluster badge |
| Hover | Scale 1.1x, tooltip: "5 surf spots - click to explore" |
| Active | N/A - clusters expand, not select |

## Edge Cases

### Single-Beach Clusters
- Render as normal individual marker (no "×1" badge)

### Missing Wave Data
- Show "—" in range calculation
- Still cluster by geographic location

### Same Wave Height
- Display single value: "2ft ×3" instead of "2-2ft ×3"

### Mixed Favorites
- Cluster uses normal orange color
- Favorites highlighted when cluster expands to individual markers

## Technical Implementation

### Library: Supercluster
- Industry-standard clustering library
- O(n log n) performance
- Dynamic cluster calculation based on zoom and bounds
- Compatible with Mapbox GL

### Integration Flow
1. Load beach coordinates into Supercluster index with wave height properties
2. On map load/move/zoom, query Supercluster for visible clusters
3. Render clusters as custom HTML markers
4. Individual beaches use existing wave height badge component
5. On cluster click, get expansion zoom and fly to that level

### Performance Benefits
- Only visible clusters rendered (reduced DOM nodes)
- Can increase current 20-marker limit since clustering reduces clutter
- Supercluster handles 1000+ points efficiently

## Files to Modify

| File | Changes |
|------|---------|
| `components/map/interactive-map.tsx` | Add Supercluster integration, cluster marker rendering |
| `package.json` | Add `supercluster` and `@types/supercluster` dependencies |

## Files Unchanged
- Individual beach marker design (existing wave height badges)
- MapContent, MapSearchHeader, BeachList components
- Search, filter, and region functionality

## Mobile Considerations
- Same tap-to-zoom behavior as desktop
- No hover states on touch devices
- Cluster badges slightly smaller but maintain readability
- Touch targets remain 44px minimum for accessibility

## Animation Details
- Cluster click: 500ms fly-to animation
- Marker fade in/out: 200ms when clusters split/merge during zoom
- Respects `prefers-reduced-motion` media query
