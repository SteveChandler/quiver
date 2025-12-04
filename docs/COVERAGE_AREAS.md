# Coverage Areas

> Geographic regions where Quiver provides surf forecasts and beach data.

## Overview

Quiver currently provides comprehensive surf forecasting coverage for the **US West Coast**, **Hawaii**, and **Northern Baja California** (Mexico). This includes real-time conditions, multi-day forecasts, and historical data for all beaches within these regions.

## Supported Regions

```
                              COVERAGE MAP
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │    ┌─────┐                                              │
    │    │ WA  │  Washington Coast                            │
    │    └──┬──┘                                              │
    │       │                                                 │
    │    ┌──┴──┐  Oregon Coast                                │
    │    │ OR  │                                              │
    │    └──┬──┘                                              │
    │       │    ┌─────────────────────────────────────────┐  │
    │    ┌──┴──┐ │ California                              │  │
    │    │     │ │ • Santa Barbara County                  │  │
    │    │     │ │ • Ventura County                        │  │
    │    │ CA  │ │ • Los Angeles County                    │  │
    │    │     │ │ • Orange County                         │  │
    │    │     │ │ • San Diego County                      │  │
    │    └──┬──┘ │ • Central Coast                         │  │
    │       │    └─────────────────────────────────────────┘  │
    │    ┌──┴──────┐                                          │
    │    │  Baja   │  Northern Baja California, Mexico        │
    │    │California│                                         │
    │    └─────────┘                                          │
    │                                                         │
    │                       ┌──────┐                          │
    │      Pacific          │  HI  │  Hawaii (All Islands)    │
    │       Ocean           └──────┘                          │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

### Region List

| Region | State/Country | Status | Notes |
|--------|---------------|--------|-------|
| San Diego County | California, USA | Active | Primary development region |
| Orange County | California, USA | Active | Full coverage |
| Los Angeles County | California, USA | Active | Full coverage |
| Ventura County | California, USA | Active | Full coverage |
| Santa Barbara County | California, USA | Active | Full coverage |
| Central Coast | California, USA | Active | San Luis Obispo to Monterey |
| Oregon Coast | Oregon, USA | Active | Full coastline |
| Washington Coast | Washington, USA | Active | Full coastline |
| Hawaii | Hawaii, USA | Active | All major islands |
| Northern Baja California | Mexico | Active | Tijuana to Ensenada |

## Feature Availability by Region

| Feature | CA | OR | WA | HI | Baja |
|---------|:--:|:--:|:--:|:--:|:----:|
| Surf Forecasts | Yes | Yes | Yes | Yes | Yes |
| Real-time Buoy Data | Yes | Yes | Yes | Yes | Partial |
| Tide Information | Yes | Yes | Yes | Yes | Yes |
| Beach Details | Yes | Yes | Yes | Yes | Yes |
| User Reviews | Yes | Yes | Yes | Yes | Yes |
| Session Logging | Yes | Yes | Yes | Yes | Yes |
| Photo Galleries | Yes | Yes | Yes | Yes | Partial |
| Wind Forecasts | Yes | Yes | Yes | Yes | Yes |
| Water Temperature | Yes | Yes | Yes | Yes | Yes |

**Notes:**
- **Partial** indicates limited data sources or coverage in that region
- All regions receive the same forecast refresh frequency (6 AM daily + on-demand)

## Data Sources

Quiver aggregates data from multiple authoritative sources:

### Wave & Swell Data
- **NOAA/NWS** - National Weather Service marine forecasts
- **NDBC** - National Data Buoy Center real-time buoy readings
- **CDIP** - Coastal Data Information Program wave models

### Tide Data
- **NOAA CO-OPS** - Tidal predictions for all US coastal stations

### Weather Data
- **NWS** - Wind speed, direction, and weather conditions
- **OpenWeather** - Supplementary weather data

### Buoy Stations

| Region | Active Buoys | Primary Station |
|--------|--------------|-----------------|
| San Diego | 3 | Station 46254 (Mission Beach) |
| Orange County | 2 | Station 46253 (San Pedro) |
| Los Angeles | 2 | Station 46253 (San Pedro) |
| Central CA | 4 | Station 46042 (Monterey) |
| Oregon | 3 | Station 46029 (Columbia River) |
| Washington | 2 | Station 46005 (Cape Flattery) |
| Hawaii | 6 | Station 51201 (Waimea) |
| Baja | 1 | Station 46254 (fallback) |

## Forecast Refresh Schedule

| Type | Frequency | Time (PT) |
|------|-----------|-----------|
| Full Forecast Refresh | Daily | 6:00 AM |
| Buoy Data | Hourly | Rolling |
| Tide Data | Daily | 12:00 AM |
| Weather | Every 3 hours | Rolling |

## Regions NOT Currently Covered

The following popular surf destinations are **not** currently in our coverage area:

| Location | Distance from SD | Status |
|----------|------------------|--------|
| Florida (East Coast) | ~2,200 miles | Planned for future |
| New Jersey | ~2,700 miles | Not planned |
| Australia | ~7,500 miles | Not planned |
| Indonesia (Bali) | ~8,500 miles | Not planned |
| Portugal (Nazare) | ~5,800 miles | Not planned |

When users search for these locations, Quiver displays a helpful message and suggests nearby covered beaches.

## Expansion Roadmap

### Planned Additions
1. **Northern California** (complete) - Full coverage from SF to Oregon border
2. **East Coast US** (planned) - Florida, Carolinas, New Jersey in evaluation

### Request New Coverage

Want to see Quiver in your area? We prioritize new regions based on:
- User demand and community size
- Data source availability
- Forecast accuracy potential

Contact us at `coverage@quiversurf.app` to request new regions.

## Technical Implementation

### Coverage Detection

The coverage detection logic lives in `lib/constants/coverage-areas.ts`:

```typescript
import { isLikelyOutOfAreaSearch, COVERED_REGIONS } from '@/lib/constants/coverage-areas';

// Check if a search is within coverage
if (isLikelyOutOfAreaSearch(searchTerm)) {
  // Show out-of-area message
}

// Get list of covered regions
console.log(COVERED_REGIONS);
// ["San Diego County, CA", "Orange County, CA", ...]
```

### Out-of-Area UX

When users search for uncovered locations:
1. Display friendly message explaining coverage limits
2. Show nearest covered beach as alternative
3. Offer option to request coverage expansion

### Default Location

When no user location is available, Quiver defaults to:
- **San Diego, CA** (Ocean Beach)
- Coordinates: `32.7503, -117.2534`

## Related Documentation

- [URL Routing Architecture](architecture/URL_ROUTING.md) - How beach URLs work across regions
- [Beach Data Structure](data/database-coordinate-conventions.md) - Database schema for beaches
- [Forecast Architecture](architecture/FORECAST_MONITORING_ARCHITECTURE.md) - How forecasts are generated

---

**Last Updated:** December 2025
**Coverage Status:** Active for West Coast + Hawaii + Baja
