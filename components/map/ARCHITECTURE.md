# Map Components Architecture

## 🎯 **PURPOSE**

The map components provide an interactive beach discovery system with dual map/list views, real-time wave data, search functionality, and location-based services.

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

### **BeachList** (List View)

- **Purpose**: Searchable, filterable beach list
- **Props**: Beaches, search state, user location, callbacks
- **Features**:
  - Beach card integration with reviews
  - Out-of-area search detection
  - Distance calculations
  - Coverage area messaging

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

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Real-time weather layer overlays
- Cluster markers for dense areas
- Satellite view toggle
- User location tracking
- Offline map support

### **Performance Improvements**

- WebGL marker optimization
- Progressive image loading
- Service worker caching
- Vector tile optimization

---

**Last Updated**: January 2025  
**Status**: Production-ready with real-time wave data and comprehensive search  
**Next Review**: After offline map support implementation
