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
import { hasViewportChanged as checkViewportChanged } from "@/lib/utils/map-utilities";
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
  const [beachConditions, setBeachConditions] = useState<
    Record<string, { wave_height?: number | string }>
  >({});
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);
  const [hoveredBeachId, setHoveredBeachId] = useState<string | null>(null);

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
    if (mapClickPopupRef.current) mapClickPopupRef.current.remove();
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

  // Create enhanced wave height badge element with motion capabilities
  const createWaveHeightBadge = (
    location: Beach,
    waveHeight?: number | string
  ): HTMLElement => {
    try {
      const isFavorite = favoriteBeachIds.has(location.id);
      const waveText = formatWaveHeight(waveHeight);
      const isSelected = selectedBeachId === location.id;
      const isHovered = hoveredBeachId === location.id;

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

        // Trigger location click callback if provided
        if (onLocationClick) {
          onLocationClick(location);
        }

        // Animate selection and navigate after slight delay
        setTimeout(() => {
          router.push(`/beach/${location.id}`);
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
  };

  // Offshore position calculation moved to utility function

  /** Populate beach markers with enhanced forecast data */
  const populateLocations = useCallback(
    async (latitude: number, longitude: number) => {
      if (!mapRef.current || !isMapReady) return;
      try {
        // Prefer nearby endpoint first (faster and already filtered), fallback to public list
        let locations: Beach[] = [];
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
                    latitude,
                    longitude,
                    b.latitude,
                    b.longitude
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

        // Fetch enhanced forecast data for each beach
        const beachForecastPromises = locations.map(async (beach) => {
          try {
            const response = await fetch(
              `/api/forecasts/update-enhanced?beachId=${beach.id}&days=2`
            );

            if (response.ok) {
              const data = await response.json();

              // Support both shapes: {success, data:{forecasts}} and legacy {forecasts}
              const forecasts = Array.isArray(data?.data?.forecasts)
                ? data.data.forecasts
                : Array.isArray(data?.forecasts)
                ? data.forecasts
                : [];

              if ((data.success ?? true) && forecasts.length > 0) {
                // Use time-aware selection to get the most appropriate forecast
                const { getCurrentForecast } = await import(
                  "@/lib/utils/current-forecast-utils"
                );
                const currentForecast = getCurrentForecast(forecasts) as any;


                if (currentForecast && currentForecast.wave_height) {
                  return {
                    beachId: beach.id,
                    waveHeight: currentForecast.wave_height,
                  };
                }
              }
            } else {
              console.warn(
                `Forecast API returned ${response.status} for ${beach.name}`
              );
            }
          } catch (error) {
            console.warn(
              `Failed to fetch forecast for beach ${beach.name} (${beach.id}):`,
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

          // Create custom wave height badge with current state
          const badgeElement = createWaveHeightBadge(location, waveHeight);

          // Create enhanced popup with motion
          const popupContent = `
            <div class="forecast-popup-content" data-testid="forecast-popup">
              <div class="text-center">
                <h4 class="font-semibold text-gray-900 mb-2">${
                  location.name
                }</h4>
                <div class="forecast-data space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Wave Height:</span>
                    <span class="font-medium">
                      ${waveHeight ? formatWaveHeight(waveHeight) : "N/A"}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Location:</span>
                    <span class="font-medium text-xs">${
                      location.location || "Unknown"
                    }</span>
                  </div>
                </div>
                <div class="mt-2 text-xs text-gray-500">
                  Click marker for details
                </div>
              </div>
            </div>
          `;

          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: "forecast-popup-mapbox",
            maxWidth: "200px",
          }).setHTML(popupContent);

          const marker = new mapboxgl.Marker({
            element: badgeElement,
            draggable: false,
            anchor: "center",
          })
            .setLngLat([
              Number(location.longitude),
              Number(location.latitude),
            ])
            .setPopup(popup);

          // Add hover event listeners to control popup visibility
          badgeElement.addEventListener("mouseenter", () => {
            if (mapRef.current) {
              marker.getPopup()?.addTo(mapRef.current);
            }
          });

          badgeElement.addEventListener("mouseleave", () => {
            marker.getPopup()?.remove();
          });

          // Only add to map if map is ready and has a canvas container
          if (mapRef.current && mapRef.current.getCanvasContainer()) {
            marker.addTo(mapRef.current);
          }

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
        mapRef.current.setCenter([newLng, newLat]);

        // Also populate locations for the new center
        populateLocations(newLat, newLng);
      }
    }
  }, [isMapReady, initialCenter, populateLocations]);

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
      className={className}
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    />
  );
}
