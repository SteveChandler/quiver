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
import { formatWaveHeight } from "@/lib/utils/wave-height-formatter";
import {
  getOffshorePosition,
  hasViewportChanged as checkViewportChanged,
} from "@/lib/utils/map-utilities";
import { CACHE_TTL } from "@/lib/constants/ui";

// Mapbox CSS is imported globally in app/globals.css

// Interface definitions replicated from the original Leaflet version
interface BuoyData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  measurements?: {
    water_temperature?: number;
    air_temperature?: number;
    wind_speed?: number;
    wind_direction?: string;
  };
}

interface BuoyConditions {
  water_temperature?: number;
  air_temperature?: number;
  wind_speed?: number;
  wind_direction?: number;
  wind_direction_name?: string;
  wind_gust?: number;
  wave_height?: number;
  wave_period?: number;
  tides?: Array<{
    time: number;
    height: number;
    name: string;
  }>;
}

interface InteractiveMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  initialZoom?: number;
  onLocationClick?: (beach: Beach) => void;
  onMapClick?: (latlng: mapboxgl.LngLat) => void;
  onLocationMove?: (latlng: mapboxgl.LngLat, beach: Beach) => void;
  onBuoyConditions?: (conditions: BuoyConditions) => void;
  className?: string;
}

const SAN_DIEGO: [number, number] = [32.7157, -117.1611];

export function InteractiveMap({
  initialCenter = SAN_DIEGO,
  initialZoom = 13,
  onLocationClick,
  onMapClick,
  onLocationMove,
  onBuoyConditions,
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
    Record<string, { wave_height?: number }>
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
  const fetchNearbyBuoys = useRef(
    createCachedMapFetch<BuoyData[]>(
      "/api/buoys/nearby",
      CACHE_TTL.MAP_NEARBY_BUOYS
    )
  );
  const fetchBuoyConditionsApi = useRef(
    createCachedMapFetch<any>(
      "/api/buoys/conditions",
      CACHE_TTL.MAP_BUOY_CONDITIONS
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

  // Fetch buoy conditions using cached API
  const fetchBuoyConditions = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const buoy = await fetchBuoyConditionsApi.current(latitude, longitude);
        const conditions: BuoyConditions = {
          water_temperature: buoy.measurements?.water_temperature,
          air_temperature: buoy.measurements?.air_temperature,
          wind_speed: buoy.measurements?.wind_speed,
          wind_direction: buoy.measurements?.wind_direction,
          wind_direction_name: buoy.measurements?.wind_direction_name,
          wind_gust: buoy.measurements?.wind_gust,
          wave_height: buoy.measurements?.wave_height,
          wave_period: buoy.measurements?.wave_period,
          tides: buoy.measurements?.tides || [],
        };
        if (onBuoyConditions) onBuoyConditions(conditions);
      } catch (e) {
        console.error("Error fetching buoy conditions", e);
      }
    },
    [onBuoyConditions]
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
    waveHeight?: number
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
        padding: 4px 12px;
        border-radius: 9999px;
        color: white;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        min-width: 60px;
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

  /** Populate beach markers with single viewport condition call */
  const populateLocations = useCallback(
    async (latitude: number, longitude: number) => {
      if (!mapRef.current || !isMapReady) return;
      console.log("Populating locations for:", latitude, longitude);
      try {
        // Use cached fetch for beaches
        let locations: Beach[] = await fetchNearbyBeaches.current(
          latitude,
          longitude
        );
        console.log("Found locations:", locations.length);

        // Limit to 20 beaches max
        locations = locations.slice(0, 20);

        // Make ONE call for the viewport area conditions (cached)
        let viewportConditions: any = null;
        try {
          viewportConditions = await fetchBuoyConditionsApi.current(
            latitude,
            longitude
          );
          console.log(
            "Fetched viewport conditions:",
            viewportConditions?.measurements?.wave_height
          );
        } catch (e) {
          console.error("Error fetching viewport conditions", e);
        }

        // Apply the same conditions to all beaches in this viewport
        if (viewportConditions?.measurements) {
          const waveHeight = viewportConditions.measurements.wave_height;
          const updatedConditions: Record<string, { wave_height?: number }> =
            {};

          locations.forEach((location) => {
            updatedConditions[location.id] = { wave_height: waveHeight };
          });

          setBeachConditions((prev) => ({ ...prev, ...updatedConditions }));

          // Call onBuoyConditions callback once for the viewport
          if (onBuoyConditions) {
            const conditions: BuoyConditions = {
              water_temperature:
                viewportConditions.measurements.water_temperature,
              air_temperature: viewportConditions.measurements.air_temperature,
              wind_speed: viewportConditions.measurements.wind_speed,
              wind_direction: viewportConditions.measurements.wind_direction,
              wind_direction_name:
                viewportConditions.measurements.wind_direction_name,
              wind_gust: viewportConditions.measurements.wind_gust,
              wave_height: viewportConditions.measurements.wave_height,
              wave_period: viewportConditions.measurements.wave_period,
              tides: viewportConditions.measurements.tides || [],
            };
            onBuoyConditions(conditions);
          }
        }

        locations.forEach((location) => {
          console.log("Adding marker for:", location.name);
          const markerId = `location-${location.id}`;
          // Remove existing
          markersRef.current[markerId]?.remove();

          // Get wave conditions for this beach (now from viewport conditions)
          const conditions = beachConditions[location.id];
          const waveHeight = conditions?.wave_height;
          console.log("Wave height for", location.name, ":", waveHeight);

          // Create custom wave height badge
          const badgeElement = createWaveHeightBadge(location, waveHeight);

          // Position slightly offshore
          const [offsetLng, offsetLat] = getOffshorePosition(
            location.latitude,
            location.longitude
          );
          console.log("Positioning marker at:", offsetLat, offsetLng);

          const marker = new mapboxgl.Marker({
            element: badgeElement,
            draggable: false,
          })
            .setLngLat([offsetLng, offsetLat])
            .setPopup(
              new mapboxgl.Popup().setHTML(
                `<b>${location.name}</b><br/>${location.location || ""}`
              )
            )
            .addTo(mapRef.current!);

          console.log("Added marker for:", location.name);

          markersRef.current[markerId] = marker;
        });
        console.log(
          "Total markers added:",
          Object.keys(markersRef.current).length
        );
      } catch (e) {
        console.error("Error populating locations", e);
      }
    },
    [isMapReady, beachConditions, favoriteBeachIds, router, onBuoyConditions]
  );

  /** Populate buoy markers with caching */
  const populateBuoys = useCallback(
    async (latitude: number, longitude: number) => {
      if (!mapRef.current || !isMapReady) return;
      try {
        // Use cached fetch
        const buoys: BuoyData[] = await fetchNearbyBuoys.current(
          latitude,
          longitude
        );

        buoys.forEach((buoy) => {
          const markerId = `buoy-${buoy.id}`;
          markersRef.current[markerId]?.remove();

          // Create a fresh buoy icon for each marker
          const buoyIcon = document.createElement("img");
          buoyIcon.src = "/images/buoy.png";
          buoyIcon.style.width = "24px";
          buoyIcon.style.height = "32px";

          const marker = new mapboxgl.Marker({
            element: buoyIcon,
          })
            .setLngLat([buoy.longitude, buoy.latitude])
            .setPopup(
              new mapboxgl.Popup().setHTML(`
              <b>${buoy.name}</b><br/>
              Buoy ${buoy.id}<br/>
              ${
                buoy.measurements?.water_temperature
                  ? `Water: ${buoy.measurements.water_temperature}°<br/>`
                  : ""
              }
              ${
                buoy.measurements?.air_temperature
                  ? `Air: ${buoy.measurements.air_temperature}°<br/>`
                  : ""
              }
              ${
                buoy.measurements?.wind_speed
                  ? `Wind: ${buoy.measurements.wind_speed} ${
                      buoy.measurements.wind_direction || ""
                    }`
                  : ""
              }`)
            )
            .addTo(mapRef.current!);

          markersRef.current[markerId] = marker;
        });
      } catch (e) {
        console.error("Error populating buoys", e);
      }
    },
    [isMapReady]
  );

  // Optimized and debounced map move handler with viewport change detection
  const handleMoveEnd = useCallback(
    debounce(async () => {
      if (!mapRef.current) return;
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();

      // Only fetch if viewport has significantly changed
      if (!hasViewportChanged(center.lat, center.lng, zoom)) {
        console.log(
          "Viewport hasn't changed significantly, skipping API calls"
        );
        return;
      }

      console.log("Viewport changed significantly, fetching new data");
      lastViewportRef.current = { lat: center.lat, lng: center.lng, zoom };

      await Promise.all([
        populateLocations(center.lat, center.lng),
        populateBuoys(center.lat, center.lng),
      ]);
    }, 1500), // Increased debounce time since we're caching aggressively
    [populateLocations, populateBuoys, hasViewportChanged]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log("Initializing Mapbox map...");

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [initialCenter[1], initialCenter[0]], // lng, lat
      zoom: initialZoom,
    });

    mapRef.current = map;

    map.on("load", async () => {
      console.log("Map loaded successfully");
      setIsMapReady(true);
    });

    map.on("error", (e) => {
      console.error("Map error:", e);
    });

    map.on("styledata", () => {
      console.log("Map style loaded");
    });

    map.on("moveend", handleMoveEnd);

    // Map click
    map.on("click", async (e) => {
      onMapClick?.(e.lngLat);
      await fetchBuoyConditions(e.lngLat.lat, e.lngLat.lng);
      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup();
      }
      popupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`)
        .addTo(map);
    });

    return () => {
      console.log("Cleaning up map...");
      map.off("moveend", handleMoveEnd);
      cleanupMap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial population when map becomes ready
  useEffect(() => {
    if (isMapReady && mapRef.current) {
      const center = mapRef.current.getCenter();
      console.log("Map ready - initial population at:", center.lat, center.lng);
      Promise.all([
        populateLocations(center.lat, center.lng),
        populateBuoys(center.lat, center.lng),
      ]);
    }
  }, [isMapReady, populateLocations, populateBuoys]);

  return (
    <div
      ref={mapContainerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    />
  );
}
