"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import { debounce } from "@/lib/utils/debounce";
import type { Beach } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { createCachedMapFetch } from "@/hooks/use-cached-api";
import {
  formatWaveHeight,
  getWaveHeightValue,
} from "@/lib/utils/wave-height-formatter";
import { hasViewportChanged as checkViewportChanged } from "@/lib/utils/map-utilities";
import { CACHE_TTL, API_BATCH_CONFIG } from "@/lib/constants/ui";
import { fetchInBatches } from "@/lib/utils/batch-fetch";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { useBeachClustering, type ClusterPoint } from "@/hooks/use-beach-clustering";
import { createClusterMarkerElement } from "@/components/map/cluster-marker";

// Mapbox CSS is imported globally in app/globals.css

interface InteractiveMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  initialZoom?: number;
  onLocationClick?: (beach: Beach) => void;
  onMapClick?: (latlng: mapboxgl.LngLat) => void;
  onLocationMove?: (latlng: mapboxgl.LngLat, beach: Beach) => void;
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

  // Load user's favorite beaches
  const loadFavoriteBeaches = useCallback(async () => {
    try {
      if (!user?.id) {
        setFavoriteBeachIds(new Set());
        return;
      }

      // Client-side fetch (avoid calling server actions from client components)
      const res = await fetch("/api/beaches/favorites", {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        // Silently handle error - favorite beaches are non-critical for map functionality
        setFavoriteBeachIds(new Set());
        return;
      }

      const json = await res.json().catch(() => null);
      const beaches = (json?.data?.beaches ?? json?.beaches ?? []) as Beach[];
      const beachIds = new Set(
        beaches.map((beach) => beach.id).filter(Boolean)
      );
      setFavoriteBeachIds(beachIds);
    } catch (e) {
      // Silently handle error - favorite beaches are non-critical for map functionality
      console.debug(
        "Error loading favorite beaches:",
        e instanceof Error ? e.message : String(e)
      );
      setFavoriteBeachIds(new Set());
    }
  }, [user?.id]);

  // Load favorites when user changes
  useEffect(() => {
    if (user?.id) {
      loadFavoriteBeaches();
    } else {
      setFavoriteBeachIds(new Set());
    }
  }, [user?.id, loadFavoriteBeaches]);

  // Ensure access token
  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }, []);

  // Wave height formatting moved to utility function

  // Create enhanced wave height badge element with motion capabilities
  const createWaveHeightBadge = useCallback(
    (location: Beach, waveHeight?: number | string): HTMLElement => {
      try {
        const isFavorite = favoriteBeachIdsRef.current.has(location.id);
        const waveText = formatWaveHeight(waveHeight);
        const isSelected = selectedBeachIdRef.current === location.id;
        const isHovered = hoveredBeachIdRef.current === location.id;

        // Create wrapper element that Mapbox will position
        const wrapper = document.createElement("div");
        wrapper.setAttribute("data-testid", "beach-marker");
        wrapper.setAttribute("data-beach-id", location.id);
        wrapper.style.cssText = `
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

        // Create selection ring for selected state
        if (isSelected) {
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
          wrapper.appendChild(selectionRing);
        }

        // Create the actual badge element as a child
        const badge = document.createElement("div");
        badge.style.cssText = `
        padding: 6px 14px;
        border-radius: 9999px;
        color: white;
        font-size: 16px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        min-width: 70px;
        text-align: center;
        border: 2px solid white;
        user-select: none;
        transform-origin: center;
        transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        transform: scale(${isSelected ? "1.4" : isHovered ? "1.2" : "1"});
        background: ${
          isFavorite
            ? "linear-gradient(to right, #3b82f6, #2563eb)"
            : isSelected
            ? "linear-gradient(to right, #0077B6, #005f8a)"
            : "linear-gradient(to right, #fbbf24, #f59e0b)"
        };
        box-shadow: ${
          isSelected
            ? "0 0 20px rgba(0,119,182,0.5), 0 8px 25px rgba(0, 0, 0, 0.3)"
            : isHovered
            ? "0 8px 20px rgba(0, 0, 0, 0.4)"
            : "0 4px 12px rgba(0, 0, 0, 0.3)"
        };
      `;
        badge.innerHTML = waveText;

        // Enhanced hover effects with motion
        badge.addEventListener("mouseenter", () => {
          setHoveredBeachId(location.id);
        });

        badge.addEventListener("mouseleave", () => {
          setHoveredBeachId(null);
        });

        // Enhanced click handler with selection animation
        badge.addEventListener("click", async (e) => {
          e.stopPropagation();
          e.preventDefault();

          // Set selection state for animation
          setSelectedBeachId(location.id);

          // Track marker click
          try {
            track("map_marker_click", {
              beach_slug: slugify(location.name),
              region:
                (location as any).region ||
                (location as any).location ||
                undefined,
            });
          } catch {}

          // Trigger location click callback if provided
          if (onLocationClick) {
            onLocationClick(location);
          }

          // Animate selection and navigate after slight delay using hierarchical URL
          setTimeout(() => {
            const beachUrl = getBeachUrlSafe(location);
            if (beachUrl) router.push(beachUrl);
          }, 400);
        });

        // Prevent any dragging or selection on the badge
        badge.addEventListener("mousedown", (e) => {
          e.preventDefault();
        });
        badge.addEventListener("dragstart", (e) => {
          e.preventDefault();
        });

        // Append badge to wrapper
        wrapper.appendChild(badge);

        return wrapper;
      } catch (e) {
        console.error("Error creating wave height badge:", e);
        // Fallback to simple wrapper with basic badge
        const fallbackWrapper = document.createElement("div");
        fallbackWrapper.style.cssText = "pointer-events: auto;";
        const fallbackBadge = document.createElement("div");
        fallbackBadge.style.cssText =
          "width: 20px; height: 20px; background: orange; border-radius: 50%; border: 2px solid white;";
        fallbackWrapper.appendChild(fallbackBadge);
        return fallbackWrapper;
      }
    },
    [onLocationClick, router]
  );

  // Offshore position calculation moved to utility function

  // Create cluster marker for rendering clustered beaches
  const createClusterMarker = useCallback(
    (cluster: ClusterPoint): mapboxgl.Marker => {
      const hasFavorite = cluster.beachIds?.some((id) =>
        favoriteBeachIdsRef.current.has(id)
      ) || false;

      const { element, cleanup } = createClusterMarkerElement({
        waveHeights: cluster.waveHeights || [],
        pointCount: cluster.pointCount || 0,
        hasFavorite,
        onHover: () => {}, // Can add tooltip later
        onLeave: () => {},
      });

      // Store cleanup function
      const clusterId = `cluster-${cluster.clusterId}`;
      clusterCleanupRef.current.set(clusterId, cleanup);

      // Handle cluster click - zoom to expansion level
      element.addEventListener("click", (e) => {
        e.stopPropagation();
        if (mapRef.current && cluster.clusterId !== undefined) {
          const expansionZoom = getExpansionZoom(cluster.clusterId);
          mapRef.current.flyTo({
            center: [cluster.longitude, cluster.latitude],
            zoom: Math.min(expansionZoom, 16),
            duration: 500,
          });
        }
      });

      const marker = new mapboxgl.Marker({
        element,
        anchor: "center",
      }).setLngLat([cluster.longitude, cluster.latitude]);

      return marker;
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
        let locations: Beach[] = [];

        // Use provided beaches prop first (filtered beaches from parent)
        if (beaches && beaches.length > 0) {
          // Clean up existing markers to ensure fresh state when filters change
          cleanupMarkers();
          locations = beaches.slice(0, 20); // Limit to 20 for performance
        } else {
          // Fallback to API fetch when no beaches prop provided
          // Prefer nearby endpoint first (faster and already filtered), fallback to public list
          try {
            const response = await fetchNearbyBeaches.current(
              latitude,
              longitude
            );
            locations = (response as any)?.data || [];
          } catch (err) {
            console.warn("Nearby beaches API failed", err);
          }

          // Fallback to public beaches list and filter by distance client-side
          if (locations.length === 0) {
            try {
              const res = await fetch("/api/beaches", {
                headers: { Accept: "application/json" },
              });
              if (res.ok) {
                const json = await res.json();
                const all: Beach[] = json?.beaches || json?.data?.beaches || [];
                const { calculateDistanceInMiles } = await import(
                  "@/lib/utils/distance-utils"
                );
                locations = all
                  .map((b) => ({
                    ...b,
                    _d: calculateDistanceInMiles(
                      { lat: latitude, lon: longitude },
                      { lat: b.lat ?? NaN, lon: b.lon ?? NaN }
                    ),
                  }))
                  .filter((b: any) => isFinite(b._d) && b._d <= 30)
                  .sort((a: any, b: any) => a._d - b._d)
                  .slice(0, 20);
              }
            } catch (fallbackErr) {
              console.error("Public beaches list fetch failed", fallbackErr);
            }
          }

          // Limit to 20 beaches max
          locations = locations.slice(0, 20);
        }

        // Fetch wave heights for ALL beaches that clustering will use (not just displayed locations)
        const localWaveHeightMap = new Map<string, number | undefined>();
        const beachesForWaveData = beaches?.length ? beaches : locations;

        if (beachesForWaveData.length > 0) {
          try {
            const allBeachIds = beachesForWaveData
              .map((beach) => beach.id)
              .filter(Boolean) as string[];

            const results = await fetchInBatches({
              items: allBeachIds,
              batchSize: API_BATCH_CONFIG.BEACH_ID_BATCH_SIZE,
              fetchBatch: async (batchIds) => {
                const response = await fetch(
                  `/api/forecasts/bulk?beachIds=${batchIds.join(",")}`
                );
                if (!response.ok) {
                  if (response.status !== 400) {
                    throw new Error(`Bulk forecast API returned ${response.status}`);
                  }
                  return null;
                }
                return response.json();
              },
              onBatchError: (error, batchIndex) => {
                console.warn(`Wave height batch ${batchIndex} failed:`, error);
              },
            });

            results.forEach((data) => {
              const forecasts = data?.data?.forecasts || {};
              Object.entries(forecasts).forEach(([beachId, waveHeight]) => {
                // wave_height may be a string from DB — parse to number
                const parsed = typeof waveHeight === "number" ? waveHeight : parseFloat(waveHeight as string);
                if (!isNaN(parsed)) {
                  localWaveHeightMap.set(beachId, parsed);
                }
              });
            });
          } catch (error) {
            console.warn("Failed to fetch bulk forecasts:", error);
          }
        }

        // Fill missing wave heights from nearest beach with data
        if (localWaveHeightMap.size > 0 && beachesForWaveData.length > 0) {
          const beachesWithData = beachesForWaveData.filter(
            (b) => localWaveHeightMap.has(b.id)
          );
          const beachesWithoutData = beachesForWaveData.filter(
            (b) => !localWaveHeightMap.has(b.id)
          );

          for (const beach of beachesWithoutData) {
            let nearestDistance = Infinity;
            let nearestHeight: number | undefined;

            for (const dataBeach of beachesWithData) {
              const dist = Math.hypot(
                (beach.lat ?? 0) - (dataBeach.lat ?? 0),
                (beach.lon ?? 0) - (dataBeach.lon ?? 0)
              );
              if (dist < nearestDistance) {
                nearestDistance = dist;
                nearestHeight = localWaveHeightMap.get(dataBeach.id);
              }
            }

            if (nearestHeight !== undefined) {
              localWaveHeightMap.set(beach.id, nearestHeight);
            }
          }
        }

        // Store wave heights for clustering
        setWaveHeightMap(localWaveHeightMap);

        // Marker rendering is now handled by the clusters useEffect
      } catch (e) {
        lastPopulateKeyRef.current = null;
        console.error("Error populating locations", e);
      }
    },
    [beaches, cleanupMarkers]
  );

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
          setMapBounds({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          });
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

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [initialCenter[1], initialCenter[0]], // lng, lat
      zoom: initialZoom,
    });

    mapRef.current = map;

    map.on("load", async () => {
      setIsMapReady(true);
      // Initialize bounds for clustering
      const bounds = map.getBounds();
      if (bounds) {
        setMapBounds({
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        });
      }
      setCurrentZoom(map.getZoom());
    });

    map.on("error", (e) => {
      console.error("Map error:", e);
    });

    map.on("moveend", handleMoveEnd);

    // Map click
    map.on("click", async (e) => {
      onMapClick?.(e.lngLat);
      if (!mapClickPopupRef.current) {
        mapClickPopupRef.current = new mapboxgl.Popup();
      }
      mapClickPopupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`)
        .addTo(map);
    });

    return () => {
      map.off("moveend", handleMoveEnd);
      (handleMoveEnd as any)?.cancel?.();
      cleanupMap();
    };
  }, [initialCenter, initialZoom, handleMoveEnd, onMapClick, cleanupMap]);

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
        populateLocations(newLat, newLng);
      }
    }
  }, [isMapReady, initialCenter, populateLocations]);

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
        const marker = createClusterMarker(cluster);
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

        const badgeElement = createWaveHeightBadge(location, waveHeight);

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
  }, [clusters, isMapReady, createClusterMarker, createWaveHeightBadge, cleanupMarkers]);

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
