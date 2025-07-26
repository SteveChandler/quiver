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
    console.log(`🔍 searchBeachesByName called with: "${searchText}"`);
    const allBeachesResult = await getBeaches();

    if (!allBeachesResult.success || !allBeachesResult.data) {
      console.log(`❌ Failed to get beaches:`, allBeachesResult.error);
      return null;
    }

    console.log(`📊 Found ${allBeachesResult.data.length} beaches in database`);

    // Normalize the search text (lowercase, trim whitespace, remove extra spaces)
    const normalizedSearch = searchText
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

    console.log(`🔧 Normalized search: "${normalizedSearch}"`);

    // Look for exact or partial matches with improved fuzzy matching
    const matchingBeaches = allBeachesResult.data.filter((beach) => {
      const beachName = beach.name.toLowerCase().replace(/\s+/g, " ");
      const beachLocation = (beach.location || "")
        .toLowerCase()
        .replace(/\s+/g, " ");

      // Check for matches in name or location with multiple strategies:

      // 1. Exact match (highest priority)
      if (
        beachName === normalizedSearch ||
        beachLocation === normalizedSearch
      ) {
        return true;
      }

      // 2. Direct substring match in name or location
      if (
        beachName.includes(normalizedSearch) ||
        beachLocation.includes(normalizedSearch)
      ) {
        return true;
      }

      // 3. Reverse substring match (search term contains beach name)
      if (normalizedSearch.includes(beachName)) {
        return true;
      }

      // 4. Word-by-word matching for multi-word searches
      const searchWords = normalizedSearch
        .split(" ")
        .filter((word) => word.length > 0);
      const nameWords = beachName.split(" ").filter((word) => word.length > 0);
      const locationWords = beachLocation
        .split(" ")
        .filter((word) => word.length > 0);

      // Check if all search words are found in the beach name or location
      const allWordsInName = searchWords.every((searchWord) =>
        nameWords.some(
          (nameWord) =>
            nameWord.includes(searchWord) || searchWord.includes(nameWord)
        )
      );
      const allWordsInLocation = searchWords.every((searchWord) =>
        locationWords.some(
          (locationWord) =>
            locationWord.includes(searchWord) ||
            searchWord.includes(locationWord)
        )
      );

      if (allWordsInName || allWordsInLocation) {
        return true;
      }

      // 5. Common abbreviations and variations
      const commonVariations = {
        jolla: "la jolla",
        ob: "ocean beach",
        pb: "pacific beach",
        mb: "mission beach",
        tourmaline: "tourmaline surf park",
        windansea: "windansea beach",
        blacks: "blacks beach",
        sunset: "sunset cliffs",
        crystal: "crystal pier",
      };

      // Check if search matches any common abbreviations
      for (const [abbrev, fullName] of Object.entries(commonVariations)) {
        if (normalizedSearch === abbrev && beachName.includes(fullName)) {
          return true;
        }
        if (normalizedSearch.includes(abbrev) && beachName.includes(fullName)) {
          return true;
        }
      }

      return false;
    });

    console.log(
      `🎯 Found ${matchingBeaches.length} matching beaches:`,
      matchingBeaches.map((b) => b.name)
    );

    if (matchingBeaches.length > 0) {
      // Sort matches by relevance (exact matches first, then by name length)
      matchingBeaches.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Exact matches first
        if (aName === normalizedSearch && bName !== normalizedSearch) return -1;
        if (bName === normalizedSearch && aName !== normalizedSearch) return 1;

        // Then by how well the search term matches (shorter names are better matches)
        return aName.length - bName.length;
      });

      console.log(`🏆 Returning best match: "${matchingBeaches[0].name}"`);
      return matchingBeaches[0];
    }

    console.log(`❌ No matches found for: "${searchText}"`);
    return null;
  } catch (error) {
    console.error("💥 Error searching beaches by name:", error);
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
    const { getCurrentForecast } = await import(
      "@/lib/utils/current-forecast-utils"
    );
    const allForecasts = data.data?.forecasts || [];

    if (allForecasts.length > 0) {
      const bestForecast = getCurrentForecast(allForecasts);

      if (bestForecast) {
        const { formatCurrentTime } = await import(
          "@/lib/utils/current-forecast-utils"
        );
        console.log(
          `🕐 Current time: ${formatCurrentTime()}, selected forecast: ${
            bestForecast.forecast_date
          } ${bestForecast.forecast_time}`
        );
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
  try {
    const searchResult = await searchBeachesWithAreaDetection(beachName);

    if (!searchResult.beach) {
      // Return structured response for no beach found
      return {
        success: false,
        error: `No beach found matching "${beachName}"`,
        data: null,
        searchMetadata: {
          isOutOfAreaSearch: searchResult.isOutOfAreaSearch,
          detectedLocation: searchResult.detectedLocation,
          suggestedMessage: searchResult.suggestedMessage,
        },
      };
    }

    const forecast = await getBeachCurrentForecast(searchResult.beach.id);

    if (!forecast) {
      return {
        success: false,
        error: "No forecast data available for this beach",
        data: null,
        searchMetadata: {
          isOutOfAreaSearch: searchResult.isOutOfAreaSearch,
          detectedLocation: searchResult.detectedLocation,
          suggestedMessage: searchResult.suggestedMessage,
        },
      };
    }

    return {
      success: true,
      error: null,
      data: {
        beach: searchResult.beach,
        forecast,
      },
      searchMetadata: {
        isOutOfAreaSearch: searchResult.isOutOfAreaSearch,
        detectedLocation: searchResult.detectedLocation,
        suggestedMessage: searchResult.suggestedMessage,
      },
    };
  } catch (error) {
    console.error("Error in searchBeachWithForecast:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      data: null,
      searchMetadata: {
        isOutOfAreaSearch: false,
        detectedLocation: undefined,
        suggestedMessage: undefined,
      },
    };
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function searchBeachWithForecastLegacy(beachName: string) {
  try {
    const beach = await searchBeachesByName(beachName);

    if (!beach) {
      return {
        success: false,
        error: `No beach found matching "${beachName}"`,
        data: null,
      };
    }

    const forecast = await getBeachCurrentForecast(beach.id);

    if (!forecast) {
      return {
        success: false,
        error: "No forecast data available for this beach",
        data: null,
      };
    }

    return {
      success: true,
      error: null,
      data: {
        beach,
        forecast,
      },
    };
  } catch (error) {
    console.error("Error in searchBeachWithForecastLegacy:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      data: null,
    };
  }
}
