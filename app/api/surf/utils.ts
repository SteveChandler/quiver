import {
  beachCoordinates,
  beachNames,
} from "@/lib/constants/beach-coordinates";
import {
  getBeachForecasts,
  getLatestBeachForecast,
} from "@/actions/forecast-actions";
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

export interface ForecastData {
  wave_height: string;
  water_temp: string;
  wind_speed: string;
  wind_direction?: string;
  tide?: string;
  weather_condition?: string;
  forecast_date: string;
  forecast_time: string;
}

export interface ForecastResponse {
  beach: string;
  coords: Coordinates;
  forecast: ForecastData;
}

// Cache for beaches to avoid repeated database calls
let cachedBeaches: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Get cached beaches or fetch from database
 */
async function getCachedBeaches() {
  const now = Date.now();
  if (cachedBeaches && now - cacheTimestamp < CACHE_DURATION) {
    return cachedBeaches;
  }

  const allBeachesResult = await getBeaches();
  if (!allBeachesResult.success || !allBeachesResult.data) {
    throw new Error("Failed to fetch beaches from database");
  }

  cachedBeaches = allBeachesResult.data;
  cacheTimestamp = now;
  return cachedBeaches;
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

    // Fuzzy match - find beaches where either:
    // 1. The beach name is contained in the search term (e.g., "Ocean Beach, San Diego" contains "ocean beach")
    // 2. The search term is contained in the beach name
    const matches = beachNames.filter((name) => {
      return normalizedName.includes(name) || name.includes(normalizedName);
    });

    if (matches.length > 0) {
      // Sort by best match (exact match first, then by length)
      matches.sort((a, b) => {
        if (a === normalizedName) return -1;
        if (b === normalizedName) return 1;
        return a.length - b.length;
      });

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
    // Use cached beaches to reduce database calls
    const allBeaches = await getCachedBeaches();

    // Find the nearest beach in the database
    let nearestBeach = null;
    let minDistance = Number.MAX_VALUE;

    for (const beach of allBeaches) {
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

    if (
      !forecastResult.success ||
      !forecastResult.data ||
      forecastResult.data.length === 0
    ) {
      // Try to get the most recent forecast (including past forecasts)
      console.log(
        `No current forecast data for ${nearestBeach.name}, trying latest available forecast`
      );
      const latestForecastResult = await getLatestBeachForecast(
        nearestBeach.id
      );

      if (
        latestForecastResult.success &&
        latestForecastResult.data &&
        latestForecastResult.data.length > 0
      ) {
        console.log(
          `Using latest available forecast for ${nearestBeach.name} from ${latestForecastResult.data[0].forecast_date}`
        );
        return latestForecastResult.data[0];
      }

      // Try to find a nearby beach with forecast data (optimized search)
      console.log(
        `No forecast data for ${nearestBeach.name}, looking for nearby beaches with data`
      );

      // Sort beaches by distance and check closest ones first
      const nearbyBeaches = allBeaches
        .filter((beach) => beach.id !== nearestBeach.id)
        .map((beach) => ({
          ...beach,
          distance: getDistanceInKm(
            { lat, lng },
            { lat: beach.latitude, lng: beach.longitude }
          ),
        }))
        .filter((beach) => beach.distance <= 32) // 20 miles
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5); // Only check 5 closest beaches

      for (const beach of nearbyBeaches) {
        const nearbyForecastResult = await getLatestBeachForecast(beach.id);
        if (
          nearbyForecastResult.success &&
          nearbyForecastResult.data &&
          nearbyForecastResult.data.length > 0
        ) {
          console.log(
            `Using forecast from nearby ${beach.name} (${beach.distance.toFixed(
              1
            )} km away) from ${nearbyForecastResult.data[0].forecast_date}`
          );
          return nearbyForecastResult.data[0];
        }
      }

      // No forecast data available
      console.log(
        `No forecast data found in database for ${nearestBeach.name} or nearby beaches`
      );
      throw new Error(
        `No forecast data available for ${nearestBeach.name} or nearby beaches`
      );
    }

    return forecastResult.data[0]; // Use first forecast entry
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
        try {
          const resolvedBeach = resolveBeach(beach);
          beachName = resolvedBeach.name;
          coordinates = { lat: resolvedBeach.lat, lng: resolvedBeach.lng };

          forecast = await fetchForecast(coordinates.lat, coordinates.lng);
        } catch (staticError) {
          // Provide more helpful error message
          const availableBeaches = allBeachesResult.data
            .map((b) => b.name)
            .slice(0, 10) // Show first 10 beaches
            .join(", ");

          const errorMessage =
            staticError instanceof Error
              ? staticError.message
              : String(staticError);
          throw new Error(
            `Beach "${beach}" not found in database. Available beaches include: ${availableBeaches}${
              allBeachesResult.data.length > 10
                ? `, and ${allBeachesResult.data.length - 10} more`
                : ""
            }. Also tried static beach list but failed: ${errorMessage}`
          );
        }
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

        if (
          !forecastResult.success ||
          !forecastResult.data ||
          forecastResult.data.length === 0
        ) {
          // Try to get the most recent forecast (including past forecasts)
          console.log(
            `No current forecast data for ${matchedBeach.name}, trying latest available forecast`
          );
          const latestForecastResult = await getLatestBeachForecast(
            matchedBeach.id
          );

          if (
            latestForecastResult.success &&
            latestForecastResult.data &&
            latestForecastResult.data.length > 0
          ) {
            console.log(
              `Using latest available forecast for ${matchedBeach.name} from ${latestForecastResult.data[0].forecast_date}`
            );
            forecast = latestForecastResult.data[0];
          } else {
            // Try to find a nearby beach with forecast data
            console.log(
              `No forecast data for ${matchedBeach.name}, looking for nearby beaches with data`
            );

            let foundNearbyForecast = false;
            for (const beach of allBeachesResult.data) {
              if (beach.id === matchedBeach.id) continue; // Skip the current beach

              const distance = getDistanceInKm(
                { lat: matchedBeach.latitude, lng: matchedBeach.longitude },
                { lat: beach.latitude, lng: beach.longitude }
              );

              // Look for beaches within 20 miles (32 km)
              if (distance <= 32) {
                const nearbyForecastResult = await getLatestBeachForecast(
                  beach.id
                );
                if (
                  nearbyForecastResult.success &&
                  nearbyForecastResult.data &&
                  nearbyForecastResult.data.length > 0
                ) {
                  console.log(
                    `Using forecast from nearby ${
                      beach.name
                    } (${distance.toFixed(1)} km away) from ${
                      nearbyForecastResult.data[0].forecast_date
                    }`
                  );
                  forecast = nearbyForecastResult.data[0];
                  foundNearbyForecast = true;
                  break;
                }
              }
            }

            if (!foundNearbyForecast) {
              // No forecast data available
              console.log(
                `No forecast data found in database for ${matchedBeach.name} or nearby beaches`
              );
              throw new Error(
                `No forecast data available for ${matchedBeach.name} or nearby beaches`
              );
            }
          }
        } else {
          forecast = forecastResult.data[0]; // Use first forecast entry
        }
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
