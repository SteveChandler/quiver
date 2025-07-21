"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import { debounce } from "lodash";
import type { Beach } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  createCachedMapFetch,
  createLocationCacheKey,
} from "@/hooks/use-cached-api";
import {
  formatWaveHeight,
  getWaveHeightValue,
} from "@/lib/utils/wave-height-formatter";
import {
  getOffshorePosition,
  hasViewportChanged as checkViewportChanged,
} from "@/lib/utils/map-utilities";
import { CACHE_TTL } from "@/lib/constants/ui";

// Mapbox CSS is imported globally in app/globals.css

interface InteractiveMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  initialZoom?: number;
  onLocationClick?: (beach: Beach) => void;
  onMapClick?: (latlng: mapboxgl.LngLat) => void;
  onLocationMove?: (latlng: mapboxgl.LngLat, beach: Beach) => void;
  className?: string;
}

const SAN_DIEGO: [number, number] = [32.7157, -117.1611];

export function InteractiveMap({
  initialCenter = SAN_DIEGO,
  initialZoom = 13,
  onLocationClick,
  onMapClick,
  onLocationMove,
  className = "h-full w-full",
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const lastViewportRef = useRef<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [favoriteBeachIds, setFavoriteBeachIds] = useState<Set<string>>(
    new Set()
  );
  const [beachConditions, setBeachConditions] = useState<
    Record<string, { wave_height?: number | string }>
  >({});

  const { user } = useAuth();
  const router = useRouter();

  // Create cached fetch functions for map APIs
  const fetchNearbyBeaches = useRef(
    createCachedMapFetch<Beach[]>(
      "/api/beaches/nearby",
      CACHE_TTL.MAP_NEARBY_BEACHES
    )
  );

  // Load favorites when user changes
  useEffect(() => {
    if (user?.id) {
      loadFavoriteBeaches();
    } else {
      setFavoriteBeachIds(new Set());
    }
  }, [user?.id]);

  // Ensure access token
  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }, []);

  // Helper: remove all markers
  const cleanupMarkers = useCallback(() => {
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};
  }, []);

  // Helper: full cleanup
  const cleanupMap = useCallback(() => {
    cleanupMarkers();
    if (popupRef.current) popupRef.current.remove();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
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
  const loadFavoriteBeaches = async () => {
    try {
      if (!user?.id) {
        setFavoriteBeachIds(new Set());
        return;
      }

      // For now, just use an empty set until we properly implement client-side favorites loading
      // TODO: Create a client-side API route to fetch favorites
      setFavoriteBeachIds(new Set());
    } catch (e) {
      console.error("Error loading favorite beaches", e);
      setFavoriteBeachIds(new Set());
    }
  };

  // Wave height formatting moved to utility function

  // Create wave height badge element with wrapper for Mapbox positioning
  const createWaveHeightBadge = (
    location: Beach,
    waveHeight?: number | string
  ): HTMLElement => {
    try {
      const isFavorite = favoriteBeachIds.has(location.id);
      const waveText = formatWaveHeight(waveHeight);

      // Create wrapper element that Mapbox will position
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

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
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        background: ${
          isFavorite
            ? "linear-gradient(to right, #3b82f6, #2563eb)"
            : "linear-gradient(to right, #fbbf24, #f59e0b)"
        };
      `;
      badge.innerHTML = waveText;

      // Add hover effects to the badge only
      badge.addEventListener("mouseenter", () => {
        badge.style.transform = "scale(1.05)";
        badge.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.4)";
      });
      badge.addEventListener("mouseleave", () => {
        badge.style.transform = "scale(1)";
        badge.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
      });

      // Click handler on the badge
      badge.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Navigate to beach detail page
        router.push(`/beach/${location.id}`);
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
  };

  // Offshore position calculation moved to utility function

  /** Populate beach markers with enhanced forecast data */
  const populateLocations = useCallback(
    async (latitude: number, longitude: number) => {
      if (!mapRef.current || !isMapReady) return;
      try {
        // Use cached fetch for beaches
        let locations: Beach[] = await fetchNearbyBeaches.current(
          latitude,
          longitude
        );

        // Limit to 20 beaches max
        locations = locations.slice(0, 20);

        // Fetch enhanced forecast data for each beach
        const beachForecastPromises = locations.map(async (beach) => {
          try {
            const response = await fetch(
              `/api/forecasts/update-enhanced?beachId=${beach.id}&days=2`
            );

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data?.forecasts?.length > 0) {
                // Use time-aware selection to get the most appropriate forecast
                const { getCurrentForecast } = await import("@/lib/utils/current-forecast-utils");
                const currentForecast = getCurrentForecast(data.data.forecasts);
                
                if (currentForecast) {
                  return {
                    beachId: beach.id,
                    waveHeight: currentForecast.wave_height, // Keep as string/number, formatter will handle it
                  };
                }
              }
            }
          } catch (error) {
            console.warn(
              `Failed to fetch forecast for beach ${beach.id}:`,
              error
            );
          }
          return {
            beachId: beach.id,
            waveHeight: undefined,
          };
        });

        // Wait for all forecast requests to complete
        const beachForecasts = await Promise.all(beachForecastPromises);

        // Create a map of beach ID to wave height
        const waveHeightMap = new Map<string, number | string | undefined>();
        beachForecasts.forEach(({ beachId, waveHeight }) => {
          waveHeightMap.set(beachId, waveHeight);
        });

        // Update beach conditions state for consistency
        const updatedConditions: Record<
          string,
          { wave_height?: number | string }
        > = {};
        beachForecasts.forEach(({ beachId, waveHeight }) => {
          updatedConditions[beachId] = { wave_height: waveHeight };
        });
        setBeachConditions((prev) => ({ ...prev, ...updatedConditions }));

        // Create markers for each beach
        locations.forEach((location) => {
          const markerId = `location-${location.id}`;
          // Remove existing
          markersRef.current[markerId]?.remove();

          // Use the enhanced forecast wave height
          const waveHeight = waveHeightMap.get(location.id);

          // Create custom wave height badge
          const badgeElement = createWaveHeightBadge(location, waveHeight);

          // Position slightly offshore
          const [offsetLng, offsetLat] = getOffshorePosition(
            location.latitude,
            location.longitude
          );

          const marker = new mapboxgl.Marker({
            element: badgeElement,
            draggable: false,
          })
            .setLngLat([offsetLng, offsetLat])
            .setPopup(
              new mapboxgl.Popup().setHTML(
                `<b>${location.name}</b><br/>${
                  location.location || ""
                }<br/>Wave Height: ${
                  waveHeight ? formatWaveHeight(waveHeight) : "No forecast data"
                }`
              )
            )
            .addTo(mapRef.current!);

          markersRef.current[markerId] = marker;
        });
      } catch (e) {
        console.error("Error populating locations", e);
      }
    },
    [isMapReady, favoriteBeachIds, router]
  );

  // Optimized and debounced map move handler with viewport change detection
  const handleMoveEnd = useCallback(
    debounce(async () => {
      if (!mapRef.current) return;
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();

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
    });

    map.on("error", (e) => {
      console.error("Map error:", e);
    });

    map.on("moveend", handleMoveEnd);

    // Map click
    map.on("click", async (e) => {
      onMapClick?.(e.lngLat);
      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup();
      }
      popupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`)
        .addTo(map);
    });

    return () => {
      map.off("moveend", handleMoveEnd);
      cleanupMap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial population when map becomes ready
  useEffect(() => {
    if (isMapReady && mapRef.current) {
      const center = mapRef.current.getCenter();
      populateLocations(center.lat, center.lng);
    }
  }, [isMapReady, populateLocations]);

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
        mapRef.current.setCenter([newLng, newLat]);

        // Also populate locations for the new center
        populateLocations(newLat, newLng);
      }
    }
  }, [isMapReady, initialCenter, populateLocations]);

  return (
    <div
      ref={mapContainerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    />
  );
}
