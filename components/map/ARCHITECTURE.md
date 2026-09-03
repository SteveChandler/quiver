# Map Components Architecture

## **PURPOSE**

The map components provide an interactive beach discovery system with real-time wave data, search functionality, location-based services, direct verdict-colored beach markers, WebGL swell/wind layers, and **Phase 2 enhanced motion interactions** for delightful user experiences.

## **COMPONENT STRUCTURE**

```
components/map/
├── map-content.tsx            # Main map container with dynamic loading
├── map-toolbar.tsx            # Single map toolbar with search, controls, and region/filter dropdown
├── interactive-map.tsx        # Mapbox interactive map core (~550 LOC, orchestration + lifecycle)
├── map-marker-builder.ts     # createWaveHeightBadge — verdict-colored beach dot DOM creation + styling
├── map-favorites-loader.ts   # loadFavoriteBeaches — async fetch of user's favorite beach IDs
├── map-beach-loader.ts       # loadBeachesAndWaveHeights — beach resolution + wave height fetching
├── map-beach-preview-popup.ts # createBeachPreviewPopupContent — marker hover/tap forecast preview
├── swell-field/              # WebGL swell/wind field sampling, controls, and custom layer
├── map-header.tsx            # Navigation header (legacy)
└── nearby-beach-scroll.tsx   # Horizontal beach scroller (no longer used in MapView)
```

### **InteractiveMap Module Decomposition**

The `interactive-map.tsx` component (originally 854 LOC) was split into pure, testable modules:

| Module | Responsibility | LOC |
|--------|---------------|-----|
| `interactive-map.tsx` | Component lifecycle, refs, effects, rendering | ~550 |
| `map-marker-builder.ts` | Verdict-colored beach dot DOM creation with MarkerBuilderDeps interface | ~180 |
| `map-beach-loader.ts` | Beach resolution + wave height fetching + interpolation | ~185 |
| `map-beach-preview-popup.ts` | Marker preview popup DOM creation | ~150 |
| `map-favorites-loader.ts` | Favorite beach ID fetching | ~40 |
| `swell-field/swell-particle-layer.ts` | WebGL custom layer for swell crest dashes and wind lines | ~460 |

**Design pattern**: Each extracted module receives all dependencies via explicit parameter interfaces
(e.g., `MarkerBuilderDeps`, `BeachLoaderDeps`) rather than closing over
component state. This makes them independently unit-testable.

## **DIRECT MAP MARKERS**

### **Beach Marker Rendering**

`interactive-map.tsx` renders the loaded `beaches` directly. After `loadBeachesAndWaveHeights()` resolves forecast data, the marker effect iterates `(beaches ?? [])` and creates one Mapbox marker per spot with valid `lat`/`lon`. `map-beach-loader.ts` caps the resolved beach set at 20.

Beach markers are small verdict-colored dots created by `components/map/map-marker-builder.ts`. `getConditionMarkerCall()` maps forecast scores/summaries to call labels, and `getConditionMarkerGradient()` supplies the marker color. Favorite spots switch the marker border to Quiver amber; selected/hovered states scale the dot and add the existing selection ring.

### **Preview Popup**

Hovering a beach dot on desktop, or tapping it on touch devices, opens `components/map/map-beach-preview-popup.ts`. The popup shows the call, surf height plus period, swell direction, wind direction/speed, break type, skill level, spot location, and a `Full forecast →` link when a safe beach URL is available.

### **Swell Field Layer**

The WebGL swell field lives under `components/map/swell-field/`. `swell-particle-layer.ts` draws swell components as perpendicular crest dash lines over the water. The wind layer uses sparse, thin directional lines with fading alpha so it reads Windy-style without a dot head.

## **PHASE 2 MOTION ENHANCEMENTS**

### **Enhanced Beach Marker Interactions**

```typescript
// Beach marker hover effects with motion
const createWaveHeightBadge = (location: Beach, waveHeight?: number) => {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-testid", "beach-marker");

  // Enhanced styling with motion states
  badge.style.cssText = `
    transform: scale(${
      isSelected ? "1.4" : isHovered ? "1.2" : "1"
    });
    transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    box-shadow: ${
      isSelected
        ? "0 0 20px rgba(0,119,182,0.5)"
        : isHovered
        ? "0 8px 20px rgba(0, 0, 0, 0.4)"
        : "0 4px 12px rgba(0, 0, 0, 0.3)"
    };
  `;

  // Selection ring animation
  if (isSelected) {
    const selectionRing = document.createElement("div");
    selectionRing.setAttribute("data-testid", "selection-ring");
    selectionRing.style.cssText = `
      position: absolute;
      border: 3px solid #0077B6;
      border-radius: 50%;
      animation: pulse 2s infinite;
    `;
  }
};
```

### **Forecast Popup Motion System**

```typescript
const ForecastPopup = ({ beach, position }) => {
  const popupMotion = PHASE2_ANIMATIONS.mapDiscovery.forecastPopup;

  return (
    <motion.div
      data-testid="forecast-popup"
      className="fixed z-50 bg-white rounded-lg shadow-xl"
      variants={popupMotion}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Forecast content with smooth reveal */}
      <motion.div className="forecast-data">
        <div className="wave-height">{formatWaveHeight(beach.forecast?.waveHeight)}</div>
        <div className="conditions">Click marker for details</div>
      </motion.div>
    </motion.div>
  );
};
```

### **Location Selection Excitement**

```typescript
const LocationSelector = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const locationSelectionMotion = PHASE2_ANIMATIONS.mapDiscovery.locationSelection;

  return (
    <motion.div
      variants={locationSelectionMotion}
      animate={isSelecting ? "selecting" : "initial"}
      data-testid="location-selector"
    >
      {/* Search results with staggered animations */}
      <motion.div variants={PHASE2_ANIMATIONS.mapDiscovery.searchResults}>
        {searchResults.map((result, index) => (
          <motion.div
            key={result.id}
            data-testid="search-result-item"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ backgroundColor: "#f9fafb", x: 4 }}
          >
            {result.name}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};
```

## **ARCHITECTURE PATTERNS**

### **Map View System**

```typescript
MapView
├── MapToolbar (Search + location + swell toggle + region/filter dropdown)
└── MapContent (Interactive/Static Map)
```

**Note**: Map browsing is full-width on desktop and mobile. Marker taps navigate directly to beach detail pages; list browsing is intentionally outside the map surface.

### **Dynamic Map Loading**

```typescript
// SSR-safe dynamic import
const InteractiveMap = dynamic(
  () =>
    import("@/components/map/interactive-map").then((mod) => ({
      default: mod.InteractiveMap,
    })),
  { ssr: false }
);
```

### **Real-Time Data Integration**

```typescript
// Direct marker rendering with forecast data
const populateLocations = async (lat: number, lng: number) => {
  const result = await loadBeachesAndWaveHeights(lat, lng, beaches, deps);
  setWaveHeightMap(result.waveHeightMap);
  setDisplayForecastMap(result.displayForecastMap);
  setConditionSummaryMap(result.conditionSummaryMap);

  (beaches ?? []).forEach((location) => {
    const marker = createWaveHeightBadge(
      location,
      result.waveHeightMap.get(location.id),
      markerBuilderDeps
    );
    new mapboxgl.Marker({ element: marker }).setLngLat([location.lon, location.lat]);
  });
};
```

### **Embedded Native Selection Contract**

`EmbedMapEvent`'s `spotSelected` payload is additive because installed native
clients may consume older shapes. Its required fields remain `beachId`, `name`,
`lat`, and `lon`; `slug`, `conditionSummary`, `waveHeight`, `swellPeriod`,
`swellDirection`, `isCalibrated`, `windSpeed`, `windDirection`, `tideState`, and
`tideHeight` are optional and nullable. Display metrics come from the same bulk
forecast maps and active swell/wind partition used by the marker and conditions
callout. The embed does not retain tide readings, so its tide fields remain null.

## **COMPONENT RESPONSIBILITIES**

### **MapContent** (Primary Container)

- **Purpose**: Main map display coordinator
- **Props**: Location data, search state, beach selection
- **Features**:
  - Dynamic InteractiveMap loading
  - Coordinate calculation and centering
  - Location error handling
  - Coverage area messaging

**Coordinate Priority Logic:**

```typescript
const mapCenter = useMemo(() => {
  if (selectedBeach) return beachCoords;
  if (searchQuery && filteredBeaches.length > 0) return searchResultCoords;
  if (focusCenter) return focusCenter;          // region-pill jump (leash-safe, see below)
  if (userLocation) return userLocation;
  return defaultOceanBeachCoords;
}, [selectedBeach, searchQuery, filteredBeaches, focusCenter, userLocation]);
```

**Region navigation & the swell-field leash.** `InteractiveMap` is keyed on `mapCenter`
(``key={`${lat.toFixed(4)}-${lon.toFixed(4)}`}``), so any center change **remounts** the map.
Toolbar search (`searchQuery` → first result) and region pills (`focusCenter`, set by
`MapToolbar` from `map-regions.ts`) both recenter through this remount path. Remount is what
makes cross-region nav **leash-safe**: when the swell field is ON, `interactive-map.tsx` pins
`maxBounds` + zoom 9–16 to the current coast, but a remount starts a fresh map (no leash)
and the leash re-derives around the new region. The retired region *tabs* used in-place
`fitBounds`, which the leash silently clamped. `focusCenter` is cleared on every other
camera-pinning action (beach select, search change, "use my location") so it never pins the
camera.

**Verifying /map changes.** The map exposes `window.__quiverMapInstance` in non-prod. The
canvas paints slowly (~30s locally — a too-early screenshot looks blank/navy but is **not** a
broken layout), and `canvas.toDataURL()` returns blank for Mapbox. See the `quiver-map-verify`
skill for the full gotchas (wait-for-idle, compositor screenshots, animation diffing, the
leash assertions, and the known-flaky map e2e).

### **InteractiveMap** (Mapbox Integration)

- **Purpose**: Real-time interactive map with wave data, direct beach markers, and the swell field
- **Features**:
  - Mapbox GL JS integration
  - Direct one-marker-per-beach rendering from loaded `beaches`
  - Verdict-colored dot markers with hover/tap preview popup
  - Optional WebGL swell/wind field with layer selector and timeline controls
  - Debounced viewport change detection
  - Cached API requests for performance
  - Favorite beach highlighting

**Beach Marker System:**

```typescript
const createWaveHeightBadge = (
  location: Beach,
  waveHeight: number | string | undefined,
  deps: MarkerBuilderDeps
) => {
  const call = getConditionMarkerCall({
    conditionSummary: deps.conditionSummary,
    conditionScore: deps.conditionScore,
  });

  const badge = document.createElement("div");
  badge.setAttribute("data-marker-badge", "true");
  badge.style.cssText = `
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: ${call.gradient};
    border: 2.5px solid #ffffff;
    cursor: pointer;
  `;

  badge.addEventListener("mouseenter", () => {
    deps.onPreviewOpen?.(location, deps.previewLngLat, {
      waveLabel: deps.waveHeightLabel,
      conditionSummary: call.summary,
      conditionScore: deps.conditionScore,
    });
  });

  return badge;
};
```

**Performance Optimizations:**

```typescript
// Debounced map movement with viewport change detection
const handleMoveEnd = useCallback(
  debounce(async () => {
    const center = mapRef.current.getCenter();
    const zoom = mapRef.current.getZoom();

    // Only fetch if viewport significantly changed
    if (!hasViewportChanged(center.lat, center.lng, zoom)) return;

    await populateLocations(center.lat, center.lng);
  }, 1500), // Aggressive debounce since we cache
  [populateLocations, hasViewportChanged]
);
```

### **BeachList** (Legacy Standalone List) - **Enhanced with Motion**

- **Purpose**: Searchable, filterable beach list with staggered animations (not mounted by the current `/map` toolbar flow)
- **Props**: Beaches, search state, user location, callbacks
- **Features**:
  - Beach card integration with reviews
  - **Staggered entrance animations**
  - **Hover interactions and selection feedback**
  - **Smooth filtering with motion**
  - Out-of-area search detection
  - Distance calculations
  - Coverage area messaging

**Motion Implementation:**

```typescript
// Staggered list animations
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }}
>
  {beachCardData.map((beach, index) => (
    <motion.div
      key={beach.id}
      data-testid="beach-item"
      variants={{
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 }
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      layout
    >
      {/* Selection indicator with spring animation */}
      {isSelected && (
        <motion.div
          data-testid="selection-indicator"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.3 }}
        >
          check
        </motion.div>
      )}
    </motion.div>
  ))}
</motion.div>
```

**Search Logic:**

```typescript
// Out-of-area detection
{
  isLikelyOutOfAreaSearch(searchQuery) ? (
    <div className="text-amber-700 bg-amber-50">
      <p>{COVERAGE_MESSAGES.getOutOfAreaMessage(searchQuery)}</p>
      <p>{COVERAGE_MESSAGES.COVERAGE_AREA_INFO}</p>
    </div>
  ) : (
    <StandardNoResultsMessage />
  );
}
```

### **MapToolbar** (Search + Controls)

- **Purpose**: Single sticky `/map` toolbar with always-visible search, location, swell-field toggle, and region/filter dropdown
- **Props**: Search state, suggestions, region pills, filters, swell-field state, callbacks
- **Features**:
  - Anonymous/mobile beach search with suggestions
  - Region quick-jumps that recenter through the remount path
  - Filter chips inside a compact dropdown

### **Viewport Filter Utility** (`lib/utils/viewport-filter.ts`)

- **Purpose**: Pure function for filtering beaches by geographic bounds
- **Usage**: Designed for `useMemo` hooks to prevent unnecessary re-renders
- **Features**:
  - Filters beaches to viewport bounds
  - Handles null/missing coordinates
  - Returns original array if bounds is null
  - No side effects, deterministic output

**API:**

```typescript
export interface ViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function filterBeachesByViewport(
  beaches: Beach[],
  bounds: ViewportBounds | null
): Beach[];

// Example usage:
const visibleBeaches = useMemo(() => {
  return filterBeachesByViewport(allBeaches, mapBounds);
}, [allBeaches, mapBounds]);
```

## **MAPBOX INTEGRATION**

### **Setup and Configuration**

```typescript
// Environment-based access token
useEffect(() => {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
}, []);

// Map initialization with error handling
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: "mapbox://styles/mapbox/streets-v11",
  center: [initialCenter[1], initialCenter[0]], // lng, lat
  zoom: initialZoom,
});
```

### **Marker Management**

```typescript
// Marker lifecycle management
const markersRef = useRef<Record<string, mapboxgl.Marker>>({});

const cleanupMarkers = useCallback(() => {
  Object.values(markersRef.current).forEach((marker) => marker.remove());
  markersRef.current = {};
}, []);

// Marker placement uses canonical beach coordinates
new mapboxgl.Marker({ element: badgeElement })
  .setLngLat([location.lon, location.lat])
  .addTo(map);
```

## **ENHANCED BEACH CARDS WITH MOTION**

### **Interactive Beach Card System**

```typescript
const BeachCard = ({ beach }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      data-testid="beach-card"
      whileHover={{
        scale: 1.02,
        y: -4,
        boxShadow: "0 8px 25px rgba(0,0,0,0.15)"
      }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <Card>
        {/* Enhanced image with motion */}
        <motion.div
          className="relative h-48 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3 }}
        >
          <MapImage src={imageUrl} alt={name} />
        </motion.div>

        {/* Expandable content with smooth reveal */}
        <AnimatePresence>
          {(showForecastPreview || isExpanded) && (
            <motion.div
              data-testid="expanded-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="forecast-info">
                <ForecastPreview />
              </div>
              <div className="conditions-grid">
                {/* Current conditions with staggered reveal */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};
```

### **Motion-Enhanced Interactive Elements**

```typescript
// Buttons with micro-interactions
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  onClick={toggleExpanded}
>
  {isExpanded ? <ChevronUp /> : <ChevronDown />}
</motion.button>

```

## **DESIGN PATTERNS**

### **Responsive Layout System**

```typescript
// Mobile-first map container
<div className="flex-1 relative overflow-hidden min-h-[400px]">

// Overlay information cards
<div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md">

// Responsive controls
<div className="absolute top-4 right-4 z-10">
```

### **Color-Coded Wave Information**

```typescript
const waveQualityColors = {
  small: "bg-red-500", // < 2ft
  good: "bg-blue-500", // 2-4ft
  great: "bg-green-500", // 4-6ft
  epic: "bg-purple-500", // > 6ft
};

const favoriteColors = {
  favorite: "linear-gradient(to right, #3b82f6, #2563eb)",
  normal: "linear-gradient(to right, #fbbf24, #f59e0b)",
};
```

### **Loading State Management**

```typescript
// Map skeleton for loading
{
  loading && <MapSkeleton />;
}

// Beach list skeleton
{
  loading && <BeachCardListSkeleton count={6} />;
}

// Progressive loading states
{
  isMapReady ? <FullMapFeatures /> : <LoadingState />;
}
```

## **PERFORMANCE OPTIMIZATIONS**

### **Caching Strategy**

```typescript
// API response caching
const fetchNearbyBeaches = useRef(
  createCachedMapFetch<Beach[]>(
    "/api/beaches/nearby",
    CACHE_TTL.MAP_NEARBY_BEACHES
  )
);

// Location-based cache keys
const cacheKey = createLocationCacheKey(latitude, longitude);
```

### **Viewport Change Detection**

```typescript
const hasViewportChanged = useCallback(
  (lat: number, lng: number, zoom: number): boolean => {
    return checkViewportChanged({ lat, lng, zoom }, lastViewportRef.current);
  },
  []
);
```

### **Batch Data Loading**

```typescript
// Parallel forecast requests
const beachForecastPromises = locations.map(async (beach) => {
  const response = await fetch(
    `/api/forecasts/update-enhanced?beachId=${beach.id}`
  );
  const currentForecast = getCurrentForecast(data.forecasts);
  return { beachId: beach.id, waveHeight: currentForecast?.wave_height };
});

const beachForecasts = await Promise.all(beachForecastPromises);
```

## **SEARCH AND FILTERING**

### **Search Integration**

```typescript
// Real-time search with debouncing (handled at parent level)
const filteredBeaches = beaches.filter((beach) =>
  beach.name.toLowerCase().includes(searchQuery.toLowerCase())
);

// Distance-based filtering
const nearbyBeaches = filteredBeaches.filter(
  (beach) =>
    getDistanceFromUser(beach.lat, beach.lon) <= MAX_DISTANCE_MILES
);
```

### **Coverage Area Detection**

```typescript
// Smart out-of-area detection
const isLikelyOutOfAreaSearch = (query: string) => {
  const outOfAreaPatterns = [
    /hawaii/i,
    /maui/i,
    /oahu/i,
    /santa monica/i,
    /malibu/i,
    /ventura/i,
    /san francisco/i,
    /half moon bay/i,
    /oregon/i,
    /washington/i,
  ];

  return outOfAreaPatterns.some((pattern) => pattern.test(query));
};
```

## **MOBILE OPTIMIZATION**

### **Touch-Friendly Markers**

```typescript
// Large touch targets for mobile
badge.style.cssText = `
  min-width: 70px;
  padding: 6px 14px;
  cursor: pointer;
  user-select: none;
`;

// Touch interaction prevention on map
badge.addEventListener("mousedown", (e) => e.preventDefault());
badge.addEventListener("dragstart", (e) => e.preventDefault());
```

### **Responsive Map Sizing**

```typescript
// Flexible map container
style={{ width: "100%", height: "100%", minHeight: "400px" }}

// Mobile-optimized overlays
<div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md max-w-xs z-10">
```

## **TESTING CONSIDERATIONS**

### **Component Testing**

- Map initialization and cleanup
- Marker placement and interaction
- Beach preview popup content
- Custom spot marker rendering
- Swell/wind field layer toggles
- Search functionality
- View mode switching

### **Integration Testing**

- Real Mapbox API integration
- Beach data loading
- Location services
- Error state handling

## **MOTION PERFORMANCE OPTIMIZATION**

### **Reduced Motion Support**

```typescript
// Respect user's reduced motion preferences
const respectReducedMotion = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Disable complex animations, keep essential feedback
    const reducedMotion = {
      duration: 0.01,
      scale: 1,
      transition: { duration: 0.01 }
    };
    return reducedMotion;
  }
  return fullMotionVariants;
};
```

### **60fps Performance Monitoring**

```typescript
// Frame rate monitoring during interactions
const monitorPerformance = () => {
  let frameCount = 0;
  let lastTime = performance.now();

  const countFrames = () => {
    frameCount++;
    const currentTime = performance.now();
    if (currentTime - lastTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      if (fps < 50) {
        console.warn(`Performance warning: ${fps}fps during map interactions`);
      }
      frameCount = 0;
      lastTime = currentTime;
    }
    requestAnimationFrame(countFrames);
  };
  requestAnimationFrame(countFrames);
};
```

## **FUTURE ENHANCEMENTS**

### **Planned Features**

- Real-time weather layer overlays
- Satellite view toggle
- User location tracking
- Offline map support
- **Advanced gesture-based map interactions**
- **3D beach terrain visualization**
- **Augmented reality beach preview**

### **Performance Improvements**

- WebGL marker optimization
- Progressive image loading
- Service worker caching
- Vector tile optimization
- **GPU-accelerated motion rendering**
- **Virtualized list rendering for large datasets**
- **Predictive animation preloading**

## **MOTION TESTING STRATEGY**

### **Component Test IDs**

```typescript
// Essential test identifiers for motion validation
data-testid="beach-marker"        // Beach markers with hover/selection
data-testid="selection-ring"      // Selection animation rings
data-testid="beach-preview-popup-content" // Marker preview popup content
data-testid="beach-list"          // Staggered list container
data-testid="beach-item"          // Individual list items
data-testid="beach-card"          // Enhanced beach cards
data-testid="expanded-content"    // Expandable card content
data-testid="location-selector"   // Location search with excitement
data-testid="search-input"        // Search input field
data-testid="search-result-item"  // Search result items
data-testid="selection-indicator" // Selection checkmarks
```

### **Accessibility Compliance**

```typescript
// Keyboard navigation support
const handleKeyboardInteraction = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    // Trigger same interaction as click with motion
    handleBeachSelect(beach);
  }
};

// Screen reader announcements
const announceSelection = (beachName: string) => {
  const announcement = `Selected ${beachName}. Beach details loading.`;
  // ARIA live region update
  setAriaLiveText(announcement);
};
```

---

**Last Updated**: February 23, 2026
**Status**: Production-ready with direct verdict-colored beach markers, WebGL swell/wind layers, **Phase 2 motion enhancements**, real-time wave data, and comprehensive search
**Motion Features**: Beach marker interactions, preview popups, staggered animations, location selection excitement
**Next Review**: After the next map rendering or field-layer milestone
