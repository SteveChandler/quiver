"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Beach } from "@/types/database";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { AlertTriangle } from "lucide-react";

// Mapbox CSS is imported globally in app/globals.css

interface HubMapViewProps {
  beaches: Beach[];
  centerLatitude: number;
  centerLongitude: number;
  zoom: number;
  className?: string;
}

/**
 * Escape HTML entities to prevent XSS attacks
 * Used for user-provided content in map popups
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Determine skill level from beach data
 * Returns: 'beginner', 'intermediate', or 'advanced'
 */
function getBeachSkillLevel(beach: Beach): string {
  const skillLevel = beach.skill_level?.toLowerCase() || "";
  if (skillLevel.includes("beginner") || skillLevel.includes("longboard")) {
    return "beginner";
  }
  if (skillLevel.includes("advanced") || skillLevel.includes("expert")) {
    return "advanced";
  }
  return "intermediate";
}

/**
 * Get marker color based on skill level
 */
function getMarkerColor(skillLevel: string): string {
  switch (skillLevel) {
    case "beginner":
      return "#22c55e"; // green
    case "intermediate":
      return "#3b82f6"; // blue
    case "advanced":
      return "#1e293b"; // dark slate
    default:
      return "#64748b"; // gray
  }
}

/**
 * Hub Map View Component
 *
 * Displays beaches on an interactive Mapbox GL map with:
 * - Color-coded markers by skill level
 * - Popups with beach name and link
 * - Legend for skill levels
 */
export function HubMapView({
  beaches,
  centerLatitude,
  centerLongitude,
  zoom,
  className = "h-full w-full",
}: HubMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("Mapbox token not found");
      setMapError("Map configuration error. Please try again later.");
      return;
    }

    mapboxgl.accessToken = accessToken;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [centerLongitude, centerLatitude], // Mapbox uses [lng, lat]
        zoom: zoom,
        attributionControl: true,
      });

      // Add navigation controls
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("load", () => {
        setIsMapReady(true);
      });

      mapRef.current = map;
    } catch (error) {
      console.error("Failed to initialize map:", error);
      setMapError("Failed to load map. Please refresh the page.");
    }

    return () => {
      // Cleanup markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      // Cleanup map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [centerLatitude, centerLongitude, zoom]);

  // Add beach markers when map is ready
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for each beach
    beaches.forEach((beach) => {
      if (
        typeof beach.lat !== "number" ||
        typeof beach.lon !== "number" ||
        !beach.name
      ) {
        return; // Skip beaches with invalid coordinates
      }

      const skillLevel = getBeachSkillLevel(beach);
      const markerColor = getMarkerColor(skillLevel);

      // Create marker element
      const el = document.createElement("div");
      el.className = "hub-map-marker";
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = markerColor;
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";

      // Create popup with beach info and link
      // Note: All user-provided content is escaped to prevent XSS
      const beachUrl = getBeachUrlSafe(beach);
      if (!beachUrl) return; // Skip beaches without valid URLs

      const safeName = escapeHtml(beach.name);
      const safeCity = beach.city ? escapeHtml(beach.city) : null;
      const safeUrl = escapeHtml(beachUrl);
      const popupContent = `
        <div style="padding: 8px; min-width: 150px;">
          <h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">
            ${safeName}
          </h3>
          <div style="margin-bottom: 4px; font-size: 12px; color: #64748b;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${markerColor}; margin-right: 4px;"></span>
            ${skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1)}
          </div>
          ${
            safeCity
              ? `<div style="margin-bottom: 8px; font-size: 12px; color: #64748b;">${safeCity}</div>`
              : ""
          }
          <a href="${safeUrl}" style="display: inline-block; margin-top: 8px; padding: 4px 12px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500;">
            View Details
          </a>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
      }).setHTML(popupContent);

      // Create marker
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([beach.lon, beach.lat]) // Mapbox uses [lng, lat]
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [isMapReady, beaches]);

  // Show error state if map failed to load
  if (mapError) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-center p-6">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unable to Load Map
          </h3>
          <p className="text-sm text-gray-600 max-w-xs">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className={className} />

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
        <h4 className="text-xs font-semibold mb-2 text-gray-900">
          Skill Level
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "#22c55e" }}
            />
            <span className="text-xs text-gray-700">Beginner</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "#3b82f6" }}
            />
            <span className="text-xs text-gray-700">Intermediate</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "#1e293b" }}
            />
            <span className="text-xs text-gray-700">Advanced</span>
          </div>
        </div>
      </div>

      {/* Beach count indicator */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 z-10">
        <p className="text-sm font-medium text-gray-900">
          {beaches.length} surf {beaches.length === 1 ? "spot" : "spots"}
        </p>
      </div>
    </div>
  );
}
