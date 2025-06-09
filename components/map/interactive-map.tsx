"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { debounce } from "lodash";
import type { Beach } from "@/types/database";

// Fix for Leaflet default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const SAN_DIEGO = [32.7157, -117.1611] as [number, number];

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
  initialCenter?: [number, number];
  initialZoom?: number;
  onLocationClick?: (beach: Beach) => void;
  onMapClick?: (latlng: L.LatLng) => void;
  onLocationMove?: (latlng: L.LatLng, beach: Beach) => void;
  onBuoyConditions?: (conditions: BuoyConditions) => void;
  className?: string;
}

export function InteractiveMap({
  initialCenter = SAN_DIEGO,
  initialZoom = 13,
  onLocationClick,
  onMapClick,
  onLocationMove,
  onBuoyConditions,
  className = "h-full w-full",
}: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const popupRef = useRef<L.Popup | null>(null);
  const eventListenersRef = useRef<Array<() => void>>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  // Cleanup function to remove all markers and clear references
  const cleanupMarkers = useCallback(() => {
    Object.values(markersRef.current).forEach((marker) => {
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
        marker.remove();
      } catch (error) {
        console.warn("Error removing marker:", error);
      }
    });
    markersRef.current = {};
  }, []);

  // Cleanup function to remove all event listeners
  const cleanupEventListeners = useCallback(() => {
    eventListenersRef.current.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.warn("Error cleaning up event listener:", error);
      }
    });
    eventListenersRef.current = [];
  }, []);

  // Cleanup function to remove popup
  const cleanupPopup = useCallback(() => {
    if (popupRef.current && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.closePopup(popupRef.current);
        popupRef.current = null;
      } catch (error) {
        console.warn("Error cleaning up popup:", error);
      }
    }
  }, []);

  // Complete cleanup function
  const cleanupMap = useCallback(() => {
    cleanupEventListeners();
    cleanupMarkers();
    cleanupPopup();

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (error) {
        console.warn("Error removing map instance:", error);
      }
      mapInstanceRef.current = null;
    }
    setIsMapReady(false);
  }, [cleanupEventListeners, cleanupMarkers, cleanupPopup]);

  // Debounced function for handling map position changes
  const debouncedMapMove = useCallback(
    debounce(async (center: L.LatLng) => {
      if (!mapInstanceRef.current) return;
      await Promise.all([
        populateLocations(center.lat, center.lng),
        populateBuoys(center.lat, center.lng),
      ]);
    }, 500),
    []
  );

  // Add event listener cleanup tracking
  const addTrackedEventListener = useCallback((cleanup: () => void) => {
    eventListenersRef.current.push(cleanup);
  }, []);

  // Fetch buoy conditions (matches Stimulus controller functionality)
  const fetchBuoyConditions = async (latitude: number, longitude: number) => {
    try {
      // Note: Our API uses latitude first, longitude second (opposite of Rails)
      const response = await fetch(
        `/api/buoys/conditions?latitude=${latitude}&longitude=${longitude}`,
        {
          headers: { Accept: "application/json" },
        }
      );

      if (!response.ok) {
        console.warn("Failed to fetch buoy conditions");
        return;
      }

      const buoy = await response.json();

      // Transform data to match expected structure
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

      // Call callback if provided (for displaying conditions in parent component)
      if (onBuoyConditions) {
        onBuoyConditions(conditions);
      }

      return conditions;
    } catch (error) {
      console.error("Error fetching buoy conditions:", error);
    }
  };

  // Initialize map with proper cleanup tracking
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      // Create map instance
      const map = L.map(mapRef.current).setView(initialCenter, initialZoom);

      // Add tile layer
      const tileLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }
      ).addTo(map);

      // Create popup instance
      popupRef.current = L.popup();

      // Handle map clicks with cleanup tracking
      const mapClickHandler = async (e: L.LeafletMouseEvent) => {
        if (onMapClick) {
          onMapClick(e.latlng);
        }

        // Fetch buoy conditions for this location
        await fetchBuoyConditions(e.latlng.lat, e.latlng.lng);

        // Show coordinates popup
        if (popupRef.current) {
          popupRef.current
            .setLatLng(e.latlng)
            .setContent(
              `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
            )
            .openOn(map);
        }
      };

      map.on("click", mapClickHandler);
      addTrackedEventListener(() => map.off("click", mapClickHandler));

      // Handle map movement with cleanup tracking
      const mapMoveHandler = () => {
        const center = map.getCenter();
        debouncedMapMove(center);
      };

      map.on("move", mapMoveHandler);
      addTrackedEventListener(() => map.off("move", mapMoveHandler));

      mapInstanceRef.current = map;
      setIsMapReady(true);

      // Initial population
      debouncedMapMove(L.latLng(initialCenter[0], initialCenter[1]));
    } catch (error) {
      console.error("Error initializing map:", error);
    }

    // Cleanup function
    return () => {
      cleanupMap();
    };
  }, [
    initialCenter,
    initialZoom,
    onMapClick,
    debouncedMapMove,
    addTrackedEventListener,
    cleanupMap,
    fetchBuoyConditions,
  ]);

  // Populate beaches/locations on the map
  const populateLocations = useCallback(
    async (latitude: number, longitude: number) => {
      if (!mapInstanceRef.current || !isMapReady) return;

      try {
        const response = await fetch(
          `/api/beaches/nearby?latitude=${latitude}&longitude=${longitude}`
        );

        if (!response.ok) {
          console.warn("Failed to fetch locations");
          return;
        }

        const locations: Beach[] = await response.json();

        locations.forEach((location) => {
          const markerId = `location-${location.id}`;

          // Remove existing marker if it exists
          if (markersRef.current[markerId]) {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(markersRef.current[markerId]);
            }
            markersRef.current[markerId].remove();
            delete markersRef.current[markerId];
          }

          if (!markersRef.current[markerId] && mapInstanceRef.current) {
            const marker = L.marker([location.latitude, location.longitude], {
              draggable: true,
            });

            marker.addTo(mapInstanceRef.current);

            // Handle location clicks
            const locationClickHandler = async () => {
              if (onLocationClick) {
                onLocationClick(location);
              }
              await fetchBuoyConditions(location.latitude, location.longitude);
            };

            marker.on("click", locationClickHandler);

            // Handle location moves (dragging)
            const locationMoveHandler = async (e: L.DragEndEvent) => {
              if (onLocationMove) {
                onLocationMove(e.target.getLatLng(), location);
              }
              const latlng = e.target.getLatLng();
              await fetchBuoyConditions(latlng.lat, latlng.lng);
            };

            marker.on("dragend", locationMoveHandler);

            marker.bindPopup(
              `<b>${location.name}</b><br/>${location.location || ""}`
            );

            markersRef.current[markerId] = marker;
          }
        });
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    },
    [isMapReady, onLocationClick, onLocationMove, fetchBuoyConditions]
  );

  // Populate weather buoys on the map
  const populateBuoys = useCallback(
    async (latitude: number, longitude: number) => {
      if (!mapInstanceRef.current || !isMapReady) return;

      try {
        const response = await fetch(
          `/api/buoys/nearby?latitude=${latitude}&longitude=${longitude}`
        );

        if (!response.ok) {
          console.warn("Failed to fetch buoys");
          return;
        }

        const buoys: BuoyData[] = await response.json();

        // Create custom buoy icon
        const buoyIcon = L.icon({
          iconUrl: "/images/buoy.png",
          iconSize: [24, 32],
          iconAnchor: [12, 32],
          popupAnchor: [0, -32],
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
          shadowSize: [41, 41],
          shadowAnchor: [13, 41],
        });

        buoys.forEach((buoy) => {
          const markerId = `buoy-${buoy.id}`;

          // Remove existing buoy marker if it exists
          if (markersRef.current[markerId]) {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(markersRef.current[markerId]);
            }
            markersRef.current[markerId].remove();
            delete markersRef.current[markerId];
          }

          if (mapInstanceRef.current) {
            const buoyMarker = L.marker([buoy.latitude, buoy.longitude], {
              icon: buoyIcon,
            });

            buoyMarker.addTo(mapInstanceRef.current);

            const popupContent = `
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
                    buoy.measurements?.wind_direction || ""
                  }`
                : ""
            }
          `;

            buoyMarker.bindPopup(popupContent);
            markersRef.current[markerId] = buoyMarker;
          }
        });
      } catch (error) {
        console.error("Error fetching buoys:", error);
      }
    },
    [isMapReady]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMap();
    };
  }, [cleanupMap]);

  return (
    <div className={className}>
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
}
