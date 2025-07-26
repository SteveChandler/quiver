import { getBeaches } from "@/actions/beach-actions";
import {
  isLikelyOutOfAreaSearch,
  COVERAGE_MESSAGES,
  OUT_OF_AREA_EXAMPLES,
} from "@/lib/constants/coverage-areas";
import type { Beach } from "@/types/database";

export interface SearchResult {
  beach: Beach | null;
  isOutOfAreaSearch: boolean;
  detectedLocation?: string;
  suggestedMessage?: string;
}

/**
 * Search for beaches by name with fuzzy matching and out-of-area detection
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
 * Enhanced search with out-of-area detection and messaging
 */
export async function searchBeachesWithAreaDetection(
  searchText: string
): Promise<SearchResult> {
  try {
    // First try normal search
    const beach = await searchBeachesByName(searchText);

    if (beach) {
      // Found a match in our database
      return {
        beach,
        isOutOfAreaSearch: false,
      };
    }

    // No match found - check if it's a known out-of-area search
    const isOutOfArea = isLikelyOutOfAreaSearch(searchText);
    const normalizedSearch = searchText.toLowerCase().trim();

    let detectedLocation: string | undefined;
    let suggestedMessage: string | undefined;

    if (isOutOfArea) {
      // Check if we have specific information about this location
      const knownLocation =
        OUT_OF_AREA_EXAMPLES[
          normalizedSearch as keyof typeof OUT_OF_AREA_EXAMPLES
        ];
      if (knownLocation) {
        detectedLocation = knownLocation.location;
        suggestedMessage = COVERAGE_MESSAGES.getOutOfAreaMessage(
          searchText,
          knownLocation.location
        );
      } else {
        suggestedMessage = COVERAGE_MESSAGES.getOutOfAreaMessage(searchText);
      }
    }

    return {
      beach: null,
      isOutOfAreaSearch: isOutOfArea,
      detectedLocation,
      suggestedMessage,
    };
  } catch (error) {
    console.error("Error in enhanced beach search:", error);
    return {
      beach: null,
      isOutOfAreaSearch: false,
    };
  }
}

/**
 * Get the best current forecast for a beach using forward-looking time logic
 */
export async function getBeachCurrentForecast(beachId: string) {
  try {
    // Fetch forecasts for today and tomorrow to handle forward-looking logic
    const response = await fetch(
      `/api/forecasts/update-enhanced?beachId=${beachId}&days=2`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch enhanced forecast");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch forecast");
    }

    // Use the new time-aware logic to get the most appropriate forecast
    const { getCurrentForecast } = await import("@/lib/utils/current-forecast-utils");
    const allForecasts = data.data?.forecasts || [];

    if (allForecasts.length > 0) {
      const bestForecast = getCurrentForecast(allForecasts);
      
      if (bestForecast) {
        const { formatCurrentTime } = await import("@/lib/utils/current-forecast-utils");
        console.log(`🕐 Current time: ${formatCurrentTime()}, selected forecast: ${bestForecast.forecast_date} ${bestForecast.forecast_time}`);
        return bestForecast;
      }
    }

    return null;
  } catch (err) {
    console.error("Error fetching enhanced forecast:", err);
    throw err;
  }
}

/**
 * Combined beach search and forecast fetch with enhanced area detection
 */
export async function searchBeachWithForecast(beachName: string) {
  const searchResult = await searchBeachesWithAreaDetection(beachName);

  if (!searchResult.beach) {
    const error = new Error(`No beach found matching "${beachName}"`);
    // Attach search metadata for better error handling
    (error as any).searchMetadata = {
      isOutOfAreaSearch: searchResult.isOutOfAreaSearch,
      detectedLocation: searchResult.detectedLocation,
      suggestedMessage: searchResult.suggestedMessage,
    };
    throw error;
  }

  const forecast = await getBeachCurrentForecast(searchResult.beach.id);

  if (!forecast) {
    throw new Error("No forecast data available for this beach");
  }

  return {
    beach: searchResult.beach,
    forecast,
    searchMetadata: {
      isOutOfAreaSearch: searchResult.isOutOfAreaSearch,
      detectedLocation: searchResult.detectedLocation,
      suggestedMessage: searchResult.suggestedMessage,
    },
  };
}

/**
 * Legacy function for backward compatibility
 */
export async function searchBeachWithForecastLegacy(beachName: string) {
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
