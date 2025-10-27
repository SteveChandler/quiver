import { getBeaches } from "@/actions/beach-actions";
import {
  isLikelyOutOfAreaSearch,
  COVERAGE_MESSAGES,
  OUT_OF_AREA_EXAMPLES,
} from "@/lib/constants/coverage-areas";
import type { Beach } from "@/types/database";
import {
  normalizeSearchText,
  BEACH_ALIASES,
} from "@/lib/utils/text-normalization";

interface SearchResult {
  beach: Beach | null;
  isOutOfAreaSearch: boolean;
  detectedLocation?: string;
  suggestedMessage?: string;
}

/**
 * Search for beaches by name with fuzzy matching - returns array of all matches
 */
export async function searchBeachesMultiple(
  searchText: string
): Promise<Beach[]> {
  try {
    console.log(`🔍 searchBeachesMultiple called with: "${searchText}"`);
    const allBeachesResult = await getBeaches();

    if (!allBeachesResult.success || !allBeachesResult.data) {
      console.log(`❌ Failed to get beaches:`, allBeachesResult.error);
      return [];
    }

    console.log(`📊 Found ${allBeachesResult.data.length} beaches in database`);

    // Normalize the search text (punctuation-insensitive, case-insensitive)
    const normalizedSearch = normalizeSearchText(searchText);

    console.log(`🔧 Normalized search: "${normalizedSearch}"`);

    const aliasTarget = BEACH_ALIASES[normalizedSearch] || null;

    // Look for exact or partial matches with improved fuzzy matching
    const matchingBeaches = allBeachesResult.data.filter((beach) => {
      const beachName = normalizeSearchText(beach.name);
      const beachCity = normalizeSearchText(beach.city || "");

      // Check for matches in name or city with multiple strategies:

      // 1. Exact match (highest priority)
      if (
        beachName === normalizedSearch ||
        beachCity === normalizedSearch
      ) {
        return true;
      }

      // 2. Direct substring match in name or city
      if (
        beachName.includes(normalizedSearch) ||
        beachCity.includes(normalizedSearch)
      ) {
        return true;
      }

      // 3. Reverse substring match (search term contains beach name)
      if (normalizedSearch.includes(beachName)) {
        return true;
      }

      // 4. Word-by-word matching for multi-word searches
      const searchWords: string[] = normalizedSearch
        .split(" ")
        .filter((word: string) => word.length > 0);
      if (searchWords.length > 1) {
        const nameWords: string[] = beachName
          .split(" ")
          .filter((word: string) => word.length > 0);
        const cityWords: string[] = beachCity
          .split(" ")
          .filter((word: string) => word.length > 0);

        // Check if all search words are found in the beach name or city
        const allWordsInName = searchWords.every((searchWord: string) =>
          nameWords.some(
            (nameWord: string) =>
              nameWord.includes(searchWord) || searchWord.includes(nameWord)
          )
        );
        const allWordsInCity = searchWords.every((searchWord: string) =>
          cityWords.some(
            (cityWord: string) =>
              cityWord.includes(searchWord) ||
              searchWord.includes(cityWord)
          )
        );

        if (allWordsInName || allWordsInCity) {
          return true;
        }
      }

      // 5. Common abbreviations and variations
      if (aliasTarget) {
        if (beachName === aliasTarget) {
          return true;
        }
        if (beachName.startsWith(`${aliasTarget} `)) {
          return true;
        }
        if (aliasTarget.startsWith(beachName)) {
          return true;
        }
      }

      return false;
    });

    // Sort matches by relevance (using normalized text for consistency)
    matchingBeaches.sort((a, b) => {
      const aName = normalizeSearchText(a.name);
      const bName = normalizeSearchText(b.name);
      const aLocation = normalizeSearchText(a.location || "");
      const bLocation = normalizeSearchText(b.location || "");

      if (aliasTarget) {
        const aliasScore = (name: string) => {
          if (name === aliasTarget) return 3;
          if (name.startsWith(`${aliasTarget} `)) return 2;
          if (aliasTarget.startsWith(name)) return 1;
          return 0;
        };

        const aAliasScore = aliasScore(aName);
        const bAliasScore = aliasScore(bName);
        if (aAliasScore !== bAliasScore) {
          return bAliasScore - aAliasScore;
        }
      }

      // 1. Exact name matches first
      if (aName === normalizedSearch && bName !== normalizedSearch) return -1;
      if (bName === normalizedSearch && aName !== normalizedSearch) return 1;

      // 2. Name contains search term (higher priority)
      const aNameContains = aName.includes(normalizedSearch);
      const bNameContains = bName.includes(normalizedSearch);
      if (aNameContains && !bNameContains) return -1;
      if (bNameContains && !aNameContains) return 1;

      // 3. Among name matches, shorter names are more specific
      if (aNameContains && bNameContains) {
        return aName.length - bName.length;
      }

      // 4. Location matches (secondary priority)
      const aLocationContains = aLocation.includes(normalizedSearch);
      const bLocationContains = bLocation.includes(normalizedSearch);
      if (aLocationContains && !bLocationContains) return -1;
      if (bLocationContains && !aLocationContains) return 1;

      // 5. Finally, sort by name length
      return aName.length - bName.length;
    });

    console.log(
      `🎯 Found ${matchingBeaches.length} matching beaches:`,
      matchingBeaches.map((b) => b.name)
    );

    if (matchingBeaches.length > 0) {
      console.log(`🏆 Returning best match: "${matchingBeaches[0].name}"`);
    }

    return matchingBeaches;
  } catch (error) {
    console.error("💥 Error searching beaches by name:", error);
    return [];
  }
}

/**
 * Search for beaches by name with fuzzy matching and out-of-area detection
 * Returns single best match for backward compatibility
 */
export async function searchBeachesByName(
  searchText: string
): Promise<Beach | null> {
  const matches = await searchBeachesMultiple(searchText);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Enhanced search with out-of-area detection and messaging
 */
async function searchBeachesWithAreaDetection(
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
async function getBeachCurrentForecast(beachId: string) {
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
