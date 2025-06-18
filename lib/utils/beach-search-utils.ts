import { getBeaches } from "@/actions/beach-actions";
import type { Beach } from "@/types/database";

/**
 * Search for beaches by name with fuzzy matching
 */
export async function searchBeachesByName(
  searchText: string
): Promise<Beach | null> {
  try {
    const allBeachesResult = await getBeaches();

    if (!allBeachesResult.success || !allBeachesResult.data) {
      return null;
    }

    // Normalize the search text (lowercase, trim whitespace)
    const normalizedSearch = searchText.toLowerCase().trim();

    // Look for exact or partial matches
    const matchingBeaches = allBeachesResult.data.filter((beach) => {
      const beachName = beach.name.toLowerCase();
      const beachLocation = (beach.location || "").toLowerCase();

      // Check for matches in name or location
      return (
        beachName.includes(normalizedSearch) ||
        beachLocation.includes(normalizedSearch)
      );
    });

    if (matchingBeaches.length > 0) {
      // Return the first match
      return matchingBeaches[0];
    }

    return null;
  } catch (error) {
    console.error("Error searching beaches by name:", error);
    return null;
  }
}

/**
 * Get the best current forecast for a beach
 */
export async function getBeachCurrentForecast(beachId: string) {
  try {
    const response = await fetch(
      `/api/forecasts/update-enhanced?beachId=${beachId}&days=1`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch enhanced forecast");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch forecast");
    }

    // Get today's forecast (best available for today)
    const today = new Date().toISOString().split("T")[0];
    const todaysForecasts = data.data?.forecastsByDate?.[today] || [];

    if (todaysForecasts.length > 0) {
      // Find the forecast closest to current time
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const bestForecast = todaysForecasts.reduce((best: any, current: any) => {
        const [hours, minutes] = current.forecast_time.split(":").map(Number);
        const forecastTime = hours * 60 + minutes;

        const [bestHours, bestMinutes] = best.forecast_time
          .split(":")
          .map(Number);
        const bestTime = bestHours * 60 + bestMinutes;

        const currentDiff = Math.abs(forecastTime - currentTime);
        const bestDiff = Math.abs(bestTime - currentTime);

        return currentDiff < bestDiff ? current : best;
      });

      return bestForecast;
    }

    return null;
  } catch (err) {
    console.error("Error fetching enhanced forecast:", err);
    throw err;
  }
}

/**
 * Combined beach search and forecast fetch
 */
export async function searchBeachWithForecast(beachName: string) {
  const beach = await searchBeachesByName(beachName);

  if (!beach) {
    throw new Error(`No beach found matching "${beachName}"`);
  }

  const forecast = await getBeachCurrentForecast(beach.id);

  if (!forecast) {
    throw new Error("No forecast data available for this beach");
  }

  return { beach, forecast };
}
