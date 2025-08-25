# Map Components Architecture

## 🎯 **PURPOSE**

The map components provide an interactive beach discovery system with dual map/list views, real-time wave data, search functionality, location-based services, and **Phase 2 enhanced motion interactions** for delightful user experiences.

## 📁 **COMPONENT STRUCTURE**

```
components/map/
├── map-content.tsx           # Main map container with dynamic loading
├── interactive-map.tsx       # Mapbox interactive map with wave markers
├── map-display.tsx           # Static map with wave height overlays
├── beach-list.tsx           # Searchable beach list with reviews
├── map-header.tsx           # Navigation header (legacy)
├── map-search-header.tsx    # Search header with view toggles
├── nearby-beach-scroll.tsx  # Horizontal beach scroller
└── selected-beach-card.tsx  # Selected beach detail card
```

## 🎨 **PHASE 2 MOTION ENHANCEMENTS**

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

## 🏗️ **ARCHITECTURE PATTERNS**

### **Dual View System**

```typescript
MapContainer
├── MapContent (Interactive/Static Map)
├── BeachList (List View)
├── MapSearchHeader (Search + View Toggle)
└── NearbyBeachScroll (Preview Cards)
```

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
// Wave height markers with forecast data
const populateLocations = async (lat: number, lng: number) => {
  // Fetch beaches + enhanced forecasts in parallel
  const locations = await fetchNearbyBeaches(lat, lng);
  const forecastPromises = locations.map(fetchEnhancedForecast);
  const forecasts = await Promise.all(forecastPromises);

  // Create wave height badges for each beach
  locations.forEach((location) => {
    const waveHeight = forecastMap.get(location.id);
    const marker = createWaveHeightBadge(location, waveHeight);
    addMarkerToMap(marker);
  });
};
```

## 📊 **COMPONENT RESPONSIBILITIES**

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
  if (userLocation) return userLocation;
  return defaultOceanBeachCoords;
}, [selectedBeach, searchQuery, filteredBeaches, userLocation]);
```

### **InteractiveMap** (Mapbox Integration)

- **Purpose**: Real-time interactive map with wave data
- **Features**:
  - Mapbox GL JS integration
  - Custom wave height markers
  - Debounced viewport change detection
  - Cached API requests for performance
  - Favorite beach highlighting

**Wave Height Marker System:**

```typescript
const createWaveHeightBadge = (
  location: Beach,
  waveHeight?: number | string
) => {
  const isFavorite = favoriteBeachIds.has(location.id);
  const waveText = formatWaveHeight(waveHeight);

  // Create styled badge with click handling
  const badge = document.createElement("div");
  badge.style.cssText = `
    background: ${isFavorite ? "blue-gradient" : "orange-gradient"};
    padding: 6px 14px;
    border-radius: 9999px;
    cursor: pointer;
  `;

  badge.addEventListener("click", () => {
    router.push(`/beach/${location.id}`);
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

### **MapDisplay** (Static Alternative)

- **Purpose**: Static map with wave height overlays (legacy)
- **Features**:
  - Static Mapbox image generation
  - Wave height data integration
  - Fallback for interactive map issues

### **BeachList** (List View) - **Enhanced with Motion**

- **Purpose**: Searchable, filterable beach list with staggered animations
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
          ✓
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

### **MapSearchHeader** (Search Interface)

- **Purpose**: Search input with view mode toggles
- **Props**: Search state, view mode, callbacks
- **Features**:
  - Real-time search input
  - Map/List view toggle
  - Search clearing functionality

### **NearbyBeachScroll** (Preview Interface)

- **Purpose**: Horizontal scrollable beach previews
- **Features**:
  - Beach selection preview
  - Distance display
  - Forecast preview integration
  - Responsive design

### **SelectedBeachCard** (Detail Preview)

- **Purpose**: Detailed view of selected beach
- **Features**:
  - Comprehensive beach information
  - Distance and rating display
  - Action buttons for navigation

## 🗺️ **MAPBOX INTEGRATION**

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

// Offshore positioning for clarity
const [offsetLng, offsetLat] = getOffshorePosition(
  location.latitude,
  location.longitude
);
```

## 🃏 **ENHANCED BEACH CARDS WITH MOTION**

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

// View mode toggle with motion feedback
<motion.div className="flex-1">
  <Button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => onViewModeChange("list")}
  >
    <List className="h-4 w-4 mr-1" />
    List
  </Button>
</motion.div>
```

## 🎨 **DESIGN PATTERNS**

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

## 🚀 **PERFORMANCE OPTIMIZATIONS**

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

## 🔍 **SEARCH AND FILTERING**

### **Search Integration**

```typescript
// Real-time search with debouncing (handled at parent level)
const filteredBeaches = beaches.filter((beach) =>
  beach.name.toLowerCase().includes(searchQuery.toLowerCase())
);

// Distance-based filtering
const nearbyBeaches = filteredBeaches.filter(
  (beach) =>
    getDistanceFromUser(beach.latitude, beach.longitude) <= MAX_DISTANCE_MILES
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

## 📱 **MOBILE OPTIMIZATION**

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

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- Map initialization and cleanup
- Marker placement and interaction
- Search functionality
- View mode switching

### **Integration Testing**

- Real Mapbox API integration
- Beach data loading
- Location services
- Error state handling

## 📊 **MOTION PERFORMANCE OPTIMIZATION**

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

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Real-time weather layer overlays
- Cluster markers for dense areas  
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

## 🧪 **MOTION TESTING STRATEGY**

### **Component Test IDs**

```typescript
// Essential test identifiers for motion validation
data-testid="beach-marker"        // Beach markers with hover/selection
data-testid="selection-ring"      // Selection animation rings
data-testid="forecast-popup"      // Forecast popups with motion
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

**Last Updated**: January 2025  
**Status**: Production-ready with **Phase 2 motion enhancements**, real-time wave data, and comprehensive search  
**Motion Features**: Beach marker interactions, forecast popups, staggered animations, location selection excitement  
**Next Review**: After implementing Phase 3 form validation motion
