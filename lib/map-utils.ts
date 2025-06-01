/**
 * Utility functions for generating map images
 */

// You can use either Mapbox or Google Maps Static API
// For Mapbox: Sign up at https://www.mapbox.com/ and get an access token
// For Google Maps: Get an API key from https://console.cloud.google.com/

// Option 1: Mapbox Static Images API
export function getMapboxStaticImageUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    style?: string;
    markerColor?: string;
  } = {}
) {
  const {
    width = 300,
    height = 120,
    zoom = 14,
    style = "mapbox/outdoors-v12",
    markerColor = "3b82f6", // blue-500 color
  } = options;

  // Get the Mapbox access token from environment variable
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    console.warn("Mapbox access token not found. Using placeholder image.");
    return `/placeholder.svg?height=${height}&width=${width}`;
  }

  // Create marker overlay
  const marker = `pin-s+${markerColor}(${longitude},${latitude})`;

  return `https://api.mapbox.com/styles/v1/${style}/static/${marker}/${longitude},${latitude},${zoom},0/${width}x${height}@2x?access_token=${accessToken}`;
}

// Option 2: Google Maps Static API
export function getGoogleMapsStaticImageUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    mapType?: string;
    markerColor?: string;
  } = {}
) {
  const {
    width = 300,
    height = 120,
    zoom = 14,
    mapType = "roadmap",
    markerColor = "blue",
  } = options;

  // Get the Google Maps API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn("Google Maps API key not found. Using placeholder image.");
    return `/placeholder.svg?height=${height}&width=${width}`;
  }

  const center = `${latitude},${longitude}`;
  const marker = `color:${markerColor}|${latitude},${longitude}`;

  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&maptype=${mapType}&markers=${marker}&key=${apiKey}&scale=2`;
}

// Option 3: OpenStreetMap via Geoapify (with API key)
export function getGeoapifyStaticImageUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
  } = {}
) {
  const { width = 300, height = 120, zoom = 14 } = options;

  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

  if (!apiKey) {
    return null;
  }

  return `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=${width}&height=${height}&center=lonlat:${longitude},${latitude}&zoom=${zoom}&marker=lonlat:${longitude},${latitude};color:%233b82f6;size:medium&apiKey=${apiKey}`;
}

// Option 4: Free OpenStreetMap static image (no API key required)
export function getOpenStreetMapStaticImageUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
  } = {}
) {
  const { width = 300, height = 120, zoom = 14 } = options;

  // Using MapTiler's static map API with OpenStreetMap data (no API key required for basic usage)
  // This creates a simple map with a marker
  const bbox = [
    longitude - 0.005,
    latitude - 0.005,
    longitude + 0.005,
    latitude + 0.005,
  ].join(",");

  // StaticMapLite is a free service for OpenStreetMap static images
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik&markers=${latitude},${longitude},lightblue`;
}

// Main function to get static map image URL
// This will try different providers based on available API keys
export function getStaticMapImageUrl(
  latitude: number | undefined,
  longitude: number | undefined,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
  } = {}
): string {
  // If no coordinates, return placeholder
  if (!latitude || !longitude) {
    return `/placeholder.svg?height=${options.height || 120}&width=${
      options.width || 300
    }`;
  }

  // Try Mapbox first (best for outdoor/surf maps)
  if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return getMapboxStaticImageUrl(latitude, longitude, options);
  }

  // Try Google Maps
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return getGoogleMapsStaticImageUrl(latitude, longitude, options);
  }

  // Try Geoapify
  const geoapifyUrl = getGeoapifyStaticImageUrl(latitude, longitude, options);
  if (geoapifyUrl) {
    return geoapifyUrl;
  }

  // Fallback to free OpenStreetMap static service
  return getOpenStreetMapStaticImageUrl(latitude, longitude, options);
}

// Helper function to extract coordinates from Beach object
export function getBeachCoordinates(
  beach: any
): { latitude: number; longitude: number } | null {
  // Check if beach has direct latitude/longitude properties
  if (beach.latitude && beach.longitude) {
    return { latitude: beach.latitude, longitude: beach.longitude };
  }

  // Check if beach has location object with x/y coordinates
  if (beach.location?.x && beach.location?.y) {
    // In PostGIS, x is longitude and y is latitude
    return { latitude: beach.location.y, longitude: beach.location.x };
  }

  // Check if beach has lat/lng properties
  if (beach.lat && beach.lng) {
    return { latitude: beach.lat, longitude: beach.lng };
  }

  return null;
}

/**
 * Comprehensive beach coordinate resolution function
 * Tries multiple strategies to get beach coordinates:
 * 1. Direct coordinates from beach object
 * 2. Hardcoded coordinates based on beach name
 */
export function resolveBeachCoordinates(
  beach: any
): { latitude: number; longitude: number } | null {
  // First try to get coordinates from the beach object
  const coords = getBeachCoordinates(beach);
  if (coords) return coords;

  // If no coordinates found and we have a beach name, try hardcoded list
  if (beach?.name) {
    // Import beachCoordinates at the top if not already imported
    const { beachCoordinates } = require("@/app/api/surf/beaches");

    const beachNameLower = beach.name.toLowerCase().trim();
    const hardcodedCoords = beachCoordinates[beachNameLower];

    if (hardcodedCoords) {
      return {
        latitude: hardcodedCoords.lat,
        longitude: hardcodedCoords.lng,
      };
    }
  }

  return null;
}
