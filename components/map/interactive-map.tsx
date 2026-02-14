"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import { debounce } from "@/lib/utils/debounce";
import type { Beach } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { createCachedMapFetch } from "@/hooks/use-cached-api";
import { hasViewportChanged as checkViewportChanged } from "@/lib/utils/map-utilities";
import { CACHE_TTL } from "@/lib/constants/ui";
import { useBeachClustering, type ClusterPoint } from "@/hooks/use-beach-clustering";
import { loadFavoriteBeaches } from "@/components/map/map-favorites-loader";
import { createWaveHeightBadge, type MarkerBuilderDeps } from "@/components/map/map-marker-builder";
import { loadBeachesAndWaveHeights } from "@/components/map/map-beach-loader";
import { createClusterMapMarker, type ClusterRendererDeps } from "@/components/map/map-cluster-renderer";

// Mapbox CSS is imported globally in app/globals.css

interface InteractiveMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  initialZoom?: number;
  onLocationClick?: (beach: Beach) => void;
  onMapClick?: (latlng: mapboxgl.LngLat) => void;
  onLocationMove?: (latlng: mapboxgl.LngLat, beach: Beach) => void;
  onBoundsChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  onWaveHeightsChange?: (map: Map<string, number | undefined>) => void;
  className?: string;
  regionViewport?: {
    region: string;
    key: string;
    center: [number, number];
    bounds?: [[number, number], [number, number]];
    zoom?: number;
  } | null;
  beaches?: Beach[]; // Filtered beaches to display on map (if provided, skips API fetch)
}

const SAN_DIEGO: [number, number] = [32.7157, -117.1611];

export function InteractiveMap({
  initialCenter = SAN_DIEGO,
  initialZoom = 13,
  onLocationClick,
  onMapClick,
  onLocationMove,
  onBoundsChange,
  onWaveHeightsChange,
  className = "h-full w-full",
  regionViewport,
  beaches,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const lastPopulateKeyRef = useRef<string | null>(null);
  // Popup instance used for displaying click coordinates on the map
  const mapClickPopupRef = useRef<mapboxgl.Popup | null>(null);
  const lastViewportRef = useRef<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [favoriteBeachIds, setFavoriteBeachIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);
  const [hoveredBeachId, setHoveredBeachId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [waveHeightMap, setWaveHeightMap] = useState<Map<string, number | undefined>>(new Map());
  const isMapReadyRef = useRef(false);
  const favoriteBeachIdsRef = useRef<Set<string>>(new Set());
  const selectedBeachIdRef = useRef<string | null>(null);
  const hoveredBeachIdRef = useRef<string | null>(null);
  const lastRegionViewportKeyRef = useRef<string | null>(null);
  const clusterCleanupRef = useRef<Map<string, () => void>>(new Map());
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onWaveHeightsChangeRef = useRef(onWaveHeightsChange);
  const initialCenterRef = useRef(initialCenter);
  const onMapClickRef = useRef(onMapClick);
  // Typed broadly; handleMoveEnd & populateLocations are assigned via sync effects below
  const handleMoveEndRef = useRef<((...args: any[]) => any) | null>(null);
  const populateLocationsRef = useRef<((lat: number, lng: number) => Promise<void>) | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    isMapReadyRef.current = isMapReady;
  }, [isMapReady]);

  useEffect(() => {
    favoriteBeachIdsRef.current = new Set(favoriteBeachIds);
  }, [favoriteBeachIds]);

  useEffect(() => {
    selectedBeachIdRef.current = selectedBeachId;
  }, [selectedBeachId]);

  useEffect(() => {
    hoveredBeachIdRef.current = hoveredBeachId;
  }, [hoveredBeachId]);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onWaveHeightsChangeRef.current = onWaveHeightsChange;
  }, [onWaveHeightsChange]);

  useEffect(() => {
    initialCenterRef.current = initialCenter;
  }, [initialCenter]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Use clustering hook
  const { clusters, getExpansionZoom } = useBeachClustering({
    beaches: beaches || [],
    waveHeights: waveHeightMap,
    bounds: mapBounds || { west: -118, south: 32, east: -117, north: 33 },
    zoom: currentZoom,
    favoriteBeachIds,
  });

  // Create cached fetch functions for map APIs
  const fetchNearbyBeaches = useRef(
    createCachedMapFetch<Beach[]>(
      "/api/beaches/nearby",
      CACHE_TTL.MAP_NEARBY_BEACHES
    )
  );

  // Helper: remove all markers
  const cleanupMarkers = useCallback(() => {
    // Clean up cluster event listeners
    clusterCleanupRef.current.forEach((cleanup) => cleanup());
    clusterCleanupRef.current.clear();

    // Remove all markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};
  }, []);

  // Helper: full cleanup
  const cleanupMap = useCallback(() => {
    cleanupMarkers();
    if (mapClickPopupRef.current) mapClickPopupRef.current.remove();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    lastPopulateKeyRef.current = null;
    selectedBeachIdRef.current = null;
    hoveredBeachIdRef.current = null;
    favoriteBeachIdsRef.current = new Set();
    isMapReadyRef.current = false;
    setIsMapReady(false);
  }, [cleanupMarkers]);

  // Helper to check if viewport has significantly changed
  const hasViewportChanged = useCallback(
    (lat: number, lng: number, zoom: number): boolean => {
      return checkViewportChanged({ lat, lng, zoom }, lastViewportRef.current);
    },
    []
  );

  // Load user's favorite beaches (delegated to pure module)
  const loadFavorites = useCallback(async () => {
    const ids = await loadFavoriteBeaches(user?.id);
    setFavoriteBeachIds(ids);
  }, [user?.id]);

  // Load favorites when user changes
  useEffect(() => {
    if (user?.id) {
      loadFavorites();
    } else {
      setFavoriteBeachIds(new Set());
    }
  }, [user?.id, loadFavorites]);

  // Ensure access token
  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }, []);

  // Create wave height badge using extracted module with deps from refs
  const buildWaveHeightBadge = useCallback(
    (location: Beach, waveHeight?: number | string): HTMLElement => {
      const deps: MarkerBuilderDeps = {
        favoriteBeachIds: favoriteBeachIdsRef.current,
        selectedBeachId: selectedBeachIdRef.current,
        hoveredBeachId: hoveredBeachIdRef.current,
        onHoverChange: setHoveredBeachId,
        onSelectChange: setSelectedBeachId,
        onLocationClick,
        router,
      };
      return createWaveHeightBadge(location, waveHeight, deps);
    },
    [onLocationClick, router]
  );

  // Create cluster marker using extracted module with deps from refs
  const buildClusterMarker = useCallback(
    (cluster: ClusterPoint): mapboxgl.Marker => {
      const deps: ClusterRendererDeps = {
        favoriteBeachIds: favoriteBeachIdsRef.current,
        clusterCleanupMap: clusterCleanupRef.current,
        getExpansionZoom,
        flyTo: (center, zoom) => {
          mapRef.current?.flyTo({ center, zoom, duration: 500 });
        },
      };
      return createClusterMapMarker(cluster, deps);
    },
    [getExpansionZoom]
  );

  /** Populate beach markers with enhanced forecast data */
  const populateLocations = useCallback(
    async (latitude: number, longitude: number) => {
      const map = mapRef.current;
      if (!map || !isMapReadyRef.current) return;
      const zoom = map.getZoom();
      // Include beaches state in cache key: undefined vs empty array vs populated array
      const beachesKey = beaches === undefined ? "none" : `${beaches.length}`;
      const populateKey = `${latitude.toFixed(4)}-${longitude.toFixed(
        4
      )}-${zoom.toFixed(2)}-${beachesKey}`;

      if (lastPopulateKeyRef.current === populateKey) {
        return;
      }

      lastPopulateKeyRef.current = populateKey;
      try {
        // Clean up existing markers when provided beaches change
        if (beaches && beaches.length > 0) {
          cleanupMarkers();
        }

        const result = await loadBeachesAndWaveHeights(
          latitude,
          longitude,
          beaches,
          { fetchNearbyBeaches: fetchNearbyBeaches.current }
        );

        // Store wave heights for clustering
        setWaveHeightMap(result.waveHeightMap);
        onWaveHeightsChangeRef.current?.(result.waveHeightMap);
      } catch (e) {
        lastPopulateKeyRef.current = null;
        console.error("Error populating locations", e);
      }
    },
    [beaches, cleanupMarkers]
  );

  useEffect(() => {
    populateLocationsRef.current = populateLocations;
  }, [populateLocations]);

  // Optimized and debounced map move handler with viewport change detection
  const handleMoveEnd = useMemo(
    () =>
      debounce(async () => {
        if (!mapRef.current) return;
        const center = mapRef.current.getCenter();
        const zoom = mapRef.current.getZoom();
        const bounds = mapRef.current.getBounds();

        // Update bounds and zoom for clustering
        if (bounds) {
          const boundsObj = {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          };
          setMapBounds(boundsObj);
          onBoundsChangeRef.current?.(boundsObj);
        }
        setCurrentZoom(zoom);

        // Only fetch if viewport has significantly changed
        if (!hasViewportChanged(center.lat, center.lng, zoom)) {
          return;
        }
        lastViewportRef.current = { lat: center.lat, lng: center.lng, zoom };

        // Only populate locations with enhanced forecast data
        await populateLocations(center.lat, center.lng);
      }, 1500), // Increased debounce time since we're caching aggressively
    [populateLocations, hasViewportChanged]
  );

  useEffect(() => {
    handleMoveEndRef.current = handleMoveEnd;
  }, [handleMoveEnd]);

  // Initialize map — runs once. Uses refs for values that change over time
  // so the effect never re-fires and the map is never destroyed/recreated.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [initialCenterRef.current[1], initialCenterRef.current[0]], // lng, lat
      zoom: initialZoom,
    });

    mapRef.current = map;

    map.on("load", async () => {
      setIsMapReady(true);
      // Initialize bounds for clustering
      const bounds = map.getBounds();
      if (bounds) {
        const boundsObj = {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        };
        setMapBounds(boundsObj);
        onBoundsChangeRef.current?.(boundsObj);
      }
      setCurrentZoom(map.getZoom());
    });

    map.on("error", (e) => {
      console.error("Map error:", e);
    });

    // Stable wrapper — delegates to the latest debounced handler via ref
    const moveEndHandler = () => handleMoveEndRef.current?.();
    map.on("moveend", moveEndHandler);

    // Map click — delegates to the latest onMapClick via ref
    map.on("click", async (e) => {
      onMapClickRef.current?.(e.lngLat);
      if (!mapClickPopupRef.current) {
        mapClickPopupRef.current = new mapboxgl.Popup();
      }
      mapClickPopupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`)
        .addTo(map);
    });

    return () => {
      map.off("moveend", moveEndHandler);
      (handleMoveEndRef.current as any)?.cancel?.();
      cleanupMap();
    };
  }, [initialZoom, cleanupMap]);

  // Initial population when map becomes ready
  useEffect(() => {
    if (isMapReady && mapRef.current) {
      const center = mapRef.current.getCenter();
      populateLocations(center.lat, center.lng);
    }
  }, [isMapReady, populateLocations]);

  // Apply region viewport focus when provided
  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    if (!regionViewport) {
      lastRegionViewportKeyRef.current = null;
      return;
    }

    if (lastRegionViewportKeyRef.current === regionViewport.key) {
      return;
    }

    const map = mapRef.current;

    if (regionViewport.bounds) {
      map.fitBounds(regionViewport.bounds, {
        padding: 48,
        animate: true,
        maxZoom: regionViewport.zoom ?? 13,
      });
    } else {
      map.easeTo({
        center: [regionViewport.center[1], regionViewport.center[0]],
        zoom: regionViewport.zoom ?? Math.min(map.getZoom(), 13),
        duration: 800,
      });
    }

    lastRegionViewportKeyRef.current = regionViewport.key;
  }, [regionViewport, isMapReady]);

  // Update markers when selection state changes
  useEffect(() => {
    if (!isMapReady) return;

    // Update all markers to reflect current selection state
    Object.entries(markersRef.current).forEach(([markerId, marker]) => {
      const beachId = markerId.replace("location-", "");
      const element = marker.getElement();
      const badge = element.querySelector('div[style*="padding"]');
      const existingRing = element.querySelector(
        '[data-testid="selection-ring"]'
      );

      if (selectedBeachId === beachId) {
        // Add selection ring if not present
        if (!existingRing && badge) {
          const selectionRing = document.createElement("div");
          selectionRing.setAttribute("data-testid", "selection-ring");
          selectionRing.style.cssText = `
            position: absolute;
            top: -8px;
            left: -8px;
            right: -8px;
            bottom: -8px;
            border: 3px solid #0077B6;
            border-radius: 50%;
            pointer-events: none;
            animation: pulse 2s infinite;
          `;
          element.appendChild(selectionRing);
        }

        // Update badge scale and background
        if (badge) {
          (badge as HTMLElement).style.transform = "scale(1.4)";
          (badge as HTMLElement).style.background =
            "linear-gradient(to right, #0077B6, #005f8a)";
        }
      } else {
        // Remove selection ring if present
        if (existingRing) {
          existingRing.remove();
        }

        // Reset badge scale and background
        if (badge) {
          const isHovered = hoveredBeachId === beachId;
          (badge as HTMLElement).style.transform = isHovered
            ? "scale(1.2)"
            : "scale(1)";

          const isFavorite = favoriteBeachIds.has(beachId);
          (badge as HTMLElement).style.background = isFavorite
            ? "linear-gradient(to right, #3b82f6, #2563eb)"
            : "linear-gradient(to right, #fbbf24, #f59e0b)";
        }
      }
    });
  }, [selectedBeachId, hoveredBeachId, favoriteBeachIds, isMapReady]);

  // Update map center when initialCenter prop changes
  useEffect(() => {
    if (isMapReady && mapRef.current && initialCenter) {
      const currentCenter = mapRef.current.getCenter();
      const [newLat, newLng] = initialCenter;

      // Only update if the center has actually changed significantly (avoid unnecessary updates)
      const threshold = 0.001; // ~100 meters
      const latDiff = Math.abs(currentCenter.lat - newLat);
      const lngDiff = Math.abs(currentCenter.lng - newLng);

      if (latDiff > threshold || lngDiff > threshold) {
        mapRef.current.flyTo({
          center: [newLng, newLat],
          zoom: mapRef.current.getZoom(),
          duration: 1000,
        });

        // Also populate locations for the new center
        populateLocationsRef.current?.(newLat, newLng);
      }
    }
  }, [isMapReady, initialCenter]);

  // Re-populate locations when beaches prop changes (filters applied)
  useEffect(() => {
    if (isMapReady && mapRef.current && beaches && beaches.length > 0) {
      const center = mapRef.current.getCenter();
      populateLocations(center.lat, center.lng);
    }
  }, [isMapReady, beaches, populateLocations]);

  // Render clusters and individual markers
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    // Clean up existing markers
    cleanupMarkers();

    clusters.forEach((cluster) => {
      if (cluster.isCluster && cluster.clusterId !== undefined) {
        // Render cluster marker
        const marker = buildClusterMarker(cluster);
        const markerId = `cluster-${cluster.clusterId}`;
        if (mapRef.current?.getCanvasContainer()) {
          marker.addTo(mapRef.current);
        }
        markersRef.current[markerId] = marker;
      } else if (!cluster.isCluster && cluster.beach) {
        // Render individual beach marker
        const location = cluster.beach;
        const markerId = `location-${location.id}`;
        const waveHeight = cluster.waveHeight;

        const badgeElement = buildWaveHeightBadge(location, waveHeight);

        const marker = new mapboxgl.Marker({
          element: badgeElement,
          draggable: false,
          anchor: "center",
        }).setLngLat([cluster.longitude, cluster.latitude]);

        if (mapRef.current?.getCanvasContainer()) {
          marker.addTo(mapRef.current);
        }
        markersRef.current[markerId] = marker;
      }
    });
  }, [clusters, isMapReady, buildClusterMarker, buildWaveHeightBadge, cleanupMarkers]);

  // Add CSS for popup animations
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .forecast-popup-mapbox .mapboxgl-popup-content {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 16px;
        animation: popupFadeIn 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        transform-origin: bottom center;
      }
      
      .forecast-popup-mapbox .mapboxgl-popup-tip {
        border-top-color: white;
      }
      
      @keyframes popupFadeIn {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      @media (prefers-reduced-motion: reduce) {
        .forecast-popup-mapbox .mapboxgl-popup-content {
          animation: none;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className={`${className} mapbox-container`}
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    />
  );
}
