# Coverage Areas

> Geographic regions where Quiver provides surf forecasts and beach data.

## Overview

Quiver currently provides comprehensive surf forecasting coverage for the **entire United States** (all coasts), **Hawaii**, and **Northern Baja California** (Mexico). This includes real-time conditions, multi-day forecasts, and historical data for all beaches within these regions.

## Supported Regions

```
                              COVERAGE MAP
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │    ┌─────┐                          ┌────┐             │
    │    │ WA  │  Washington Coast         │ ME │             │
    │    └──┬──┘                           └─┬──┘             │
    │       │                                │                │
    │    ┌──┴──┐  Oregon Coast            ┌─┴─┐              │
    │    │ OR  │                          │ NY │ East Coast   │
    │    └──┬──┘                          ├───┤              │
    │       │    ┌─────────────────────┐  │NJ │              │
    │    ┌──┴──┐ │ California          │  └─┬─┘              │
    │    │     │ │ • Santa Barbara     │    │                │
    │    │     │ │ • Ventura County    │  ┌─┴─┐              │
    │    │ CA  │ │ • Los Angeles       │  │VA │              │
    │    │     │ │ • Orange County     │  └─┬─┘              │
    │    │     │ │ • San Diego         │    │                │
    │    └──┬──┘ │ • Central Coast     │  ┌─┴─┐ Southeast   │
    │       │    └─────────────────────┘  │NC │ & Gulf       │
    │    ┌──┴──────┐                      │SC │              │
    │    │  Baja   │  Northern Baja       │GA │              │
    │    │California│ California, MX      │FL │              │
    │    └─────────┘                      └─┬─┘              │
    │                                       │                │
    │       ┌──────┐                      ┌─┴─┐              │
    │       │  HI  │  Hawaii              │TX │ Gulf Coast   │
    │       └──────┘  (All Islands)       │AL │              │
    │                                     │MS │              │
    │                                     └───┘              │
    │                                                         │
    │                     ┌──────┐                            │
    │      Atlantic       │  PR  │  Puerto Rico               │
    │       Ocean         └──────┘                            │
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
| East Coast | New Jersey, USA | Active | Full coastline |
| East Coast | New York, USA | Active | Full coastline |
| East Coast | Rhode Island, USA | Active | Full coastline |
| East Coast | Virginia Beach, USA | Active | Full coastline |
| Southeast Coast | North Carolina, USA | Active | Full coastline |
| Southeast Coast | South Carolina, USA | Active | Full coastline |
| Southeast Coast | Georgia, USA | Active | Full coastline |
| Southeast Coast | Florida, USA | Active | Atlantic and Gulf coasts |
| Gulf Coast | Texas, USA | Active | Full coastline |
| Gulf Coast | Alabama, USA | Active | Full coastline |
| Gulf Coast | Mississippi, USA | Active | Full coastline |
| Puerto Rico | Puerto Rico | Active | All coasts |
| Northern Baja California | Mexico | Active | Tijuana to Ensenada |

## Feature Availability by Region

| Feature | CA | OR | WA | HI | Baja | EC | SE | Gulf | PR |
|---------|:--:|:--:|:--:|:--:|:----:|:--:|:--:|:----:|:--:|
| Surf Forecasts | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Real-time Buoy Data | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Partial | Partial |
| Tide Information | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Beach Details | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| User Reviews | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Session Logging | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Photo Galleries | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Partial | Partial |
| Wind Forecasts | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Water Temperature | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

**Notes:**
- **Partial** indicates limited data sources or coverage in that region
- All regions receive the same forecast refresh frequency (6 AM daily + on-demand)
- **Legend**: CA = California, OR = Oregon, WA = Washington, HI = Hawaii, EC = East Coast, SE = Southeast, Gulf = Gulf Coast, PR = Puerto Rico

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
| East Coast | 12+ | Multiple stations per state |
| Southeast | 8+ | Multiple stations per state |
| Gulf Coast | 6+ | Multiple stations per state |
| Puerto Rico | 3 | Station 41053 (San Juan) |
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
| Australia | ~7,500 miles | Not planned |
| Indonesia (Bali) | ~8,500 miles | Not planned |
| Portugal (Nazare) | ~5,800 miles | Not planned |

When users search for these locations, Quiver displays a helpful message and suggests nearby covered beaches.

## Expansion Roadmap

### Completed Expansions
1. **Northern California** (Complete - 2025) - Full coverage from SF to Oregon border
2. **Pacific Northwest** (Complete - 2025) - Oregon and Washington full coverage
3. **Hawaii** (Complete - 2025) - All major islands
4. **East Coast US** (Complete - December 2025) - New Jersey, New York, Rhode Island, Virginia Beach
5. **Southeast & Gulf Coast** (Complete - December 2025) - Florida, Georgia, Carolinas, Texas, Alabama, Mississippi
6. **Puerto Rico** (Complete - December 2025) - All coasts

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
**Coverage Status:** Active for US (All Coasts) + Puerto Rico + Baja
