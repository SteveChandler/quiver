/**
 * Utility functions for generating map images
 */

// You can use either Mapbox or Google Maps Static API
// For Mapbox: Sign up at https://www.mapbox.com/ and get an access token
// For Google Maps: Get an API key from https://console.cloud.google.com/

// Simple LRU cache for map URLs to prevent duplicate generation
const mapUrlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedMapUrl(key: string): string | null {
  const cached = mapUrlCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }
  if (cached) {
    mapUrlCache.delete(key);
  }
  return null;
}

function setCachedMapUrl(key: string, url: string): void {
  // Simple LRU: if cache is full, remove oldest entry
  if (mapUrlCache.size >= CACHE_SIZE) {
    const firstKey = mapUrlCache.keys().next().value;
    if (firstKey) {
      mapUrlCache.delete(firstKey);
    }
  }
  mapUrlCache.set(key, { url, timestamp: Date.now() });
}

// Generate a simple SVG placeholder for when map services fail
function generateMapPlaceholder(
  latitude: number,
  longitude: number,
  width: number = 300,
  height: number = 120
): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#e0f2fe;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#b3e5fc;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="8" fill="#1976d2"/>
      <text x="${width / 2}" y="${
    height / 2 + 25
  }" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#424242">
        Beach Location
      </text>
      <text x="${width / 2}" y="${
    height / 2 + 40
  }" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#666">
        ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Generate enhanced SVG placeholder with wave height data or beach name
function generateEnhancedMapPlaceholder(
  latitude: number,
  longitude: number,
  width: number = 300,
  height: number = 120,
  labelText?: string
): string {
  // Determine if this is wave height data (contains "ft" or is numeric-ish) or a beach name
  const isWaveHeight = labelText && (labelText.includes('ft') || labelText.includes('-') || /^\d/.test(labelText));
  const displayLabel = labelText || (isWaveHeight ? "0-1ft" : "Beach Location");

  // If it's wave height, show the orange badge with wave height and generic location label
  if (isWaveHeight) {
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#e0f2fe;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#b3e5fc;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        
        <!-- Wave height badge -->
        <rect x="${width / 2 - 30}" y="${height / 2 - 15}" width="60" height="30" 
              rx="15" fill="url(#waveGradient)" stroke="white" stroke-width="2"/>
        <text x="${width / 2}" y="${
      height / 2 + 5
    }" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="white">
          ${displayLabel}
        </text>
        
        <!-- Location label -->
        <text x="${width / 2}" y="${
      height / 2 + 35
    }" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#424242">
          Beach Location
        </text>
        <text x="${width / 2}" y="${
      height / 2 + 48
    }" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#666">
          ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
        </text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  
  // Otherwise, show beach name prominently without the wave height badge
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#e0f2fe;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#b3e5fc;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      
      <!-- Beach name -->
      <text x="${width / 2}" y="${
    height / 2 + 5
  }" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#1976d2">
        ${displayLabel}
      </text>
      
      ${latitude && longitude && latitude !== 0 && longitude !== 0 ? `
      <!-- Coordinates -->
      <text x="${width / 2}" y="${
    height / 2 + 25
  }" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#666">
        ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
      </text>
      ` : ''}
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Option 1: Mapbox Static Images API with custom marker text
function getMapboxStaticImageUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    style?: string;
    markerColor?: string;
    markerText?: string;
  } = {}
) {
  const {
    width = 300,
    height = 120,
    zoom = 14,
    style = "mapbox/outdoors-v12",
    markerColor = "3b82f6", // blue-500 color
    markerText,
  } = options;

  // Get the Mapbox access token from environment variable (support alias)
  const accessToken =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    (process as any).env?.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!accessToken) {
    console.warn(
      "Mapbox access token not found. Using enhanced placeholder image."
    );
    return generateEnhancedMapPlaceholder(
      latitude,
      longitude,
      width,
      height,
      markerText
    );
  }

  // Validate coordinates
  if (!isValidCoordinates(latitude, longitude)) {
    console.warn("Invalid coordinates for Mapbox:", { latitude, longitude });
    return generateEnhancedMapPlaceholder(
      latitude,
      longitude,
      width,
      height,
      markerText
    );
  }

  // Create marker overlay - if we have text, we'll use a simpler approach
  // Note: Mapbox Static API doesn't support custom text on markers easily
  // So we'll fall back to enhanced placeholder when text is provided
  if (markerText) {
    return generateEnhancedMapPlaceholder(
      latitude,
      longitude,
      width,
      height,
      markerText
    );
  }

  const marker = `pin-s+${markerColor}(${longitude},${latitude})`;
  return `https://api.mapbox.com/styles/v1/${style}/static/${marker}/${longitude},${latitude},${zoom},0/${width}x${height}@2x?access_token=${accessToken}`;
}

// Option 2: Google Maps Static API with custom marker labels
function getGoogleMapsStaticImageUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    mapType?: string;
    markerColor?: string;
    markerText?: string;
  } = {}
) {
  const {
    width = 300,
    height = 120,
    zoom = 14,
    mapType = "roadmap",
    markerColor = "blue",
    markerText,
  } = options;

  // Get the Google Maps API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn(
      "Google Maps API key not found. Using enhanced placeholder image."
    );
    return generateEnhancedMapPlaceholder(
      latitude,
      longitude,
      width,
      height,
      markerText
    );
  }

  // Validate coordinates
  if (!isValidCoordinates(latitude, longitude)) {
    console.warn("Invalid coordinates for Google Maps:", {
      latitude,
      longitude,
    });
    return generateEnhancedMapPlaceholder(
      latitude,
      longitude,
      width,
      height,
      markerText
    );
  }

  const center = `${latitude},${longitude}`;

  // Google Maps supports custom labels on markers
  let marker;
  if (markerText) {
    // Create a custom marker with text label
    marker = `color:${markerColor}|label:${encodeURIComponent(
      markerText
    )}|${latitude},${longitude}`;
  } else {
    marker = `color:${markerColor}|${latitude},${longitude}`;
  }

  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&maptype=${mapType}&markers=${marker}&key=${apiKey}&scale=2`;
}

// Option 3: OpenStreetMap via Geoapify (with API key)
function getGeoapifyStaticImageUrl(
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

  // Validate coordinates
  if (!isValidCoordinates(latitude, longitude)) {
    console.warn("Invalid coordinates for Geoapify:", { latitude, longitude });
    return null;
  }

  return `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=${width}&height=${height}&center=lonlat:${longitude},${latitude}&zoom=${zoom}&marker=lonlat:${longitude},${latitude};color:%233b82f6;size:medium&apiKey=${apiKey}`;
}

// Option 4: Free OpenStreetMap static image (no API key required)
function getOpenStreetMapStaticImageUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
  } = {}
) {
  const { width = 300, height = 120, zoom = 14 } = options;

  // Validate coordinates
  if (!isValidCoordinates(latitude, longitude)) {
    console.warn("Invalid coordinates for OpenStreetMap:", {
      latitude,
      longitude,
    });
    return generateMapPlaceholder(latitude, longitude, width, height);
  }

  // StaticMapLite is a free service for OpenStreetMap static images
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik&markers=${latitude},${longitude},lightblue`;
}

// Helper function to validate coordinates
function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
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
    markerText?: string;
    style?: string;
  } = {}
): string {
  // If no coordinates, return enhanced placeholder with helpful message
  if (!latitude || !longitude) {
    console.warn("No coordinates provided for map image");
    return generateEnhancedMapPlaceholder(
      0,
      0,
      options.width || 300,
      options.height || 120,
      options.markerText || ""
    );
  }

  // Validate coordinates
  if (!isValidCoordinates(latitude, longitude)) {
    console.warn("Invalid coordinates provided:", { latitude, longitude });
    return generateEnhancedMapPlaceholder(
      latitude,
      longitude,
      options.width || 300,
      options.height || 120,
      options.markerText
    );
  }

  // Check cache first to prevent duplicate generation
  // Style is part of the key so satellite and outdoors URLs for the same coords don't collide
  const cacheKey = `${latitude},${longitude},${options.width || 300},${options.height || 120},${options.zoom || 14},${options.markerText || ''},${options.style || ''}`;
  const cachedUrl = getCachedMapUrl(cacheKey);
  if (cachedUrl) {
    return cachedUrl;
  }

  // Reduced logging to avoid console clutter - only log when no provider is available
  const hasAnyProvider =
    !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    !!(process as any).env?.NEXT_PUBLIC_MAPBOX_TOKEN ||
    !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    !!process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

  if (process.env.NODE_ENV === 'development' && !hasAnyProvider) {
    console.warn("No map provider available for coordinates:", { latitude, longitude });
  }

  // Use real providers in all environments; rely on graceful fallbacks below

  // Try Google Maps first if we have marker text (better text support)
  if (options.markerText && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    const url = getGoogleMapsStaticImageUrl(latitude, longitude, options);
    setCachedMapUrl(cacheKey, url);
    return url;
  }

  // Try Mapbox first (best for outdoor/surf maps)
  if (
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    (process as any).env?.NEXT_PUBLIC_MAPBOX_TOKEN
  ) {
    const url = getMapboxStaticImageUrl(latitude, longitude, options);
    setCachedMapUrl(cacheKey, url);
    return url;
  }

  // Try Google Maps
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    const url = getGoogleMapsStaticImageUrl(latitude, longitude, options);
    setCachedMapUrl(cacheKey, url);
    return url;
  }

  // Try Geoapify
  const geoapifyUrl = getGeoapifyStaticImageUrl(latitude, longitude, options);
  if (geoapifyUrl) {
    setCachedMapUrl(cacheKey, geoapifyUrl);
    return geoapifyUrl;
  }

  // Fallback to enhanced placeholder
  const fallbackUrl = generateEnhancedMapPlaceholder(
    latitude,
    longitude,
    options.width || 300,
    options.height || 120,
    options.markerText
  );
  setCachedMapUrl(cacheKey, fallbackUrl);
  return fallbackUrl;
}

/**
 * Generate a static map image URL with wave height data displayed on the pin
 * @param latitude Beach latitude
 * @param longitude Beach longitude
 * @param waveHeight Wave height in feet (will be formatted)
 * @param options Map display options
 * @returns Static map image URL with wave height pin
 */
export function getStaticMapImageUrlWithWaveHeight(
  latitude: number | undefined,
  longitude: number | undefined,
  waveHeight: number | undefined,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
  } = {}
): string {
  // Import wave height formatter
  const { formatWaveHeightBucket } = require("@/lib/utils/wave-formatters");

  // Format wave height for display
  const waveHeightText = formatWaveHeightBucket(waveHeight);

  // Use the main function with marker text
  return getStaticMapImageUrl(latitude, longitude, {
    ...options,
    markerText: waveHeightText,
  });
}

export interface StaticMapPin {
  latitude: number;
  longitude: number;
  /** Mapbox pin label — rank numbers 0-99 or a single letter */
  label?: string;
  /** Hex color without the leading hash */
  color?: string;
}

export function getStaticMapViewportImageUrl({
  latitude,
  longitude,
  width,
  height,
  zoom,
  style = "mapbox/streets-v11",
}: {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
  zoom: number;
  style?: string;
}): string | null {
  const accessToken =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    (process as any).env?.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!accessToken || !isValidCoordinates(latitude, longitude)) return null;

  const imageWidth = Math.max(1, Math.min(1280, Math.round(width)));
  const imageHeight = Math.max(1, Math.min(1280, Math.round(height)));
  const camera = `${longitude},${latitude},${zoom},0`;

  return `https://api.mapbox.com/styles/v1/${style}/static/${camera}/${imageWidth}x${imageHeight}@2x?access_token=${accessToken}`;
}

/**
 * Generate a multi-pin static map URL with an auto-fitted viewport.
 *
 * Returns null when the Mapbox token is missing or no valid pins remain —
 * callers should hide the map entirely. The single-coordinate SVG placeholder
 * is intentionally NOT used here because it cannot represent multiple pins.
 */
export function getStaticMapImageUrlWithPins(
  pins: StaticMapPin[],
  options: {
    width?: number;
    height?: number;
    style?: string;
    padding?: number;
  } = {}
): string | null {
  const {
    width = 768,
    height = 320,
    style = "mapbox/outdoors-v12",
    padding = 50,
  } = options;

  const accessToken =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    (process as any).env?.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!accessToken) return null;

  const validPins = pins.filter((pin) =>
    isValidCoordinates(pin.latitude, pin.longitude)
  );
  if (validPins.length === 0) return null;

  const markers = validPins
    .map((pin) => {
      const label = pin.label ? `-${pin.label}` : "";
      const color = pin.color ?? "F78E42"; // Charming Orange
      return `pin-s${label}+${color}(${pin.longitude},${pin.latitude})`;
    })
    .join(",");

  return `https://api.mapbox.com/styles/v1/${style}/static/${markers}/auto/${width}x${height}@2x?access_token=${accessToken}&padding=${padding}`;
}

// Helper function to extract coordinates from Beach object
export function getBeachCoordinates(
  beach: any
): { latitude: number; longitude: number } | null {
  if (!beach) return null;

  // Check if beach has direct latitude/longitude properties
  // Use Number.isFinite to exclude NaN, Infinity, and null/undefined
  if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) {
    return { latitude: beach.lat, longitude: beach.lon };
  }

  // Check if beach has location object with x/y coordinates
  if (Number.isFinite(beach.location?.x) && Number.isFinite(beach.location?.y)) {
    // In PostGIS, x is longitude and y is latitude
    return { latitude: beach.location.y, longitude: beach.location.x };
  }

  // Legacy support: tolerate lat/lng property names in tests and older code paths
  if (Number.isFinite(beach.lat) && Number.isFinite(beach.lng)) {
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
    // Import beachCoordinates from constants
    try {
      const { beachCoordinates } = require("@/lib/constants/beach-coordinates");

      const beachNameLower = beach.name.toLowerCase().trim();
      const hardcodedCoords = beachCoordinates[beachNameLower];

      if (hardcodedCoords) {
        return {
          latitude: hardcodedCoords.lat,
          longitude: hardcodedCoords.lng,
        };
      }
    } catch (error) {
      console.warn("Could not load hardcoded beach coordinates:", error);
    }
  }

  return null;
}
