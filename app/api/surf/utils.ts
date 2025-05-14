import { beachCoordinates, beachNames } from "./beaches";
import { getBeachForecasts } from "@/actions/forecast-actions";
import { getBeaches } from "@/actions/beach-actions";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Beach {
  name: string;
  lat: number;
  lng: number;
}

export interface ForecastParams {
  beach?: string;
  coords?: Coordinates;
}

export interface ForecastResponse {
  beach: string;
  coords: Coordinates;
  forecast: any;
}

/**
 * Calculate distance between two coordinates in kilometers
 */
function getDistanceInKm(coords1: Coordinates, coords2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = (coords2.lat - coords1.lat) * (Math.PI / 180);
  const dLng = (coords2.lng - coords1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.lat * (Math.PI / 180)) *
      Math.cos(coords2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolves a beach name or coordinates to a beach object with name and coordinates
 */
export function resolveBeach(input: string | Coordinates): Beach {
  if (typeof input === "string") {
    // Handle beach name input
    const normalizedName = input.toLowerCase().trim();

    // Direct match
    if (beachCoordinates[normalizedName]) {
      const coords = beachCoordinates[normalizedName];
      return {
        name: normalizedName,
        lat: coords.lat,
        lng: coords.lng,
      };
    }

    // Fuzzy match - find closest matching beach name
    const matches = beachNames.filter((name) => name.includes(normalizedName));
    if (matches.length > 0) {
      const match = matches[0];
      return {
        name: match,
        lat: beachCoordinates[match].lat,
        lng: beachCoordinates[match].lng,
      };
    }

    throw new Error(`Beach "${input}" not found`);
  } else {
    // Handle coordinates input - find nearest beach
    let nearestBeach = "";
    let minDistance = Number.MAX_VALUE;

    for (const beach of beachNames) {
      const beachCoords = beachCoordinates[beach];
      const distance = getDistanceInKm(input, beachCoords);

      if (distance < minDistance) {
        minDistance = distance;
        nearestBeach = beach;
      }
    }

    return {
      name: nearestBeach,
      lat: beachCoordinates[nearestBeach].lat,
      lng: beachCoordinates[nearestBeach].lng,
    };
  }
}

/**
 * Fetches forecast data for given coordinates by using the existing app's API
 * This function is modified to work with the Supabase database
 */
export async function fetchForecast(lat: number, lng: number): Promise<any> {
  try {
    // First, find the beach in the database that most closely matches these coordinates
    const allBeachesResult = await getBeaches();

    if (!allBeachesResult.success || !allBeachesResult.data) {
      throw new Error("Failed to fetch beaches from database");
    }

    // Find the nearest beach in the database
    let nearestBeach = null;
    let minDistance = Number.MAX_VALUE;

    for (const beach of allBeachesResult.data) {
      const distance = getDistanceInKm(
        { lat, lng },
        { lat: beach.latitude, lng: beach.longitude }
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestBeach = beach;
      }
    }

    if (!nearestBeach) {
      throw new Error("No beaches found in database");
    }

    // Get forecast for the nearest beach
    const forecastResult = await getBeachForecasts(nearestBeach.id);

    if (!forecastResult.success || !forecastResult.data) {
      throw new Error("Failed to fetch forecast data");
    }

    return forecastResult.data;
  } catch (error) {
    console.error("Error in fetchForecast:", error);
    throw error;
  }
}

/**
 * High-level function to get surf forecast for a beach or coordinates
 * Modified to work with the existing app's database
 */
export async function getSurfForecast({
  beach,
  coords,
}: ForecastParams): Promise<ForecastResponse> {
  if (!beach && !coords) {
    throw new Error("Either beach name or coordinates must be provided");
  }

  try {
    let beachName: string;
    let coordinates: Coordinates;
    let forecast: any;

    if (beach) {
      // Find beach by name in the database
      const allBeachesResult = await getBeaches();

      if (!allBeachesResult.success || !allBeachesResult.data) {
        throw new Error("Failed to fetch beaches from database");
      }

      const normalizedSearch = beach.toLowerCase().trim();
      const matchingBeaches = allBeachesResult.data.filter((b) =>
        b.name.toLowerCase().includes(normalizedSearch)
      );

      if (matchingBeaches.length === 0) {
        // Try to resolve using our static beach list as fallback
        const resolvedBeach = resolveBeach(beach);
        beachName = resolvedBeach.name;
        coordinates = { lat: resolvedBeach.lat, lng: resolvedBeach.lng };
        forecast = await fetchForecast(coordinates.lat, coordinates.lng);
      } else {
        // Use the first match from the database
        const matchedBeach = matchingBeaches[0];
        beachName = matchedBeach.name;
        coordinates = {
          lat: matchedBeach.latitude,
          lng: matchedBeach.longitude,
        };

        // Get forecast from database
        const forecastResult = await getBeachForecasts(matchedBeach.id);

        if (!forecastResult.success || !forecastResult.data) {
          throw new Error("Failed to fetch forecast data");
        }

        forecast = forecastResult.data;
      }
    } else if (coords) {
      // Find nearest beach using coordinates
      const resolvedBeach = resolveBeach(coords);
      beachName = resolvedBeach.name;
      coordinates = { lat: resolvedBeach.lat, lng: resolvedBeach.lng };
      forecast = await fetchForecast(coordinates.lat, coordinates.lng);
    } else {
      throw new Error("Invalid input");
    }

    return {
      beach: beachName,
      coords: coordinates,
      forecast,
    };
  } catch (error) {
    console.error("Error in getSurfForecast:", error);
    throw error;
  }
}
