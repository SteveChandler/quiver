import { getBeachesFromDb } from "@/lib/services/beach-query-service";
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
import type { MatchStrategy } from "@/lib/utils/beach-search/match-strategy";
import {
  ExactMatchStrategy,
  AliasMatchStrategy,
  SubstringMatchStrategy,
  WordMatchStrategy,
} from "@/lib/utils/beach-search/strategies";
import { BeachRelevanceScorer } from "@/lib/utils/beach-search/beach-relevance-scorer";

interface SearchResult {
  beach: Beach | null;
  isOutOfAreaSearch: boolean;
  detectedLocation?: string;
  suggestedMessage?: string;
}

/**
 * Search for beaches by name with fuzzy matching - returns array of all matches
 * Refactored to use Strategy pattern for maintainability and reduced complexity
 */
export async function searchBeachesMultiple(
  searchText: string
): Promise<Beach[]> {
  try {
    console.log(`🔍 searchBeachesMultiple called with: "${searchText}"`);

    // Fetch all beaches
    const allBeachesResult = await getBeachesFromDb();
    if (!allBeachesResult.success || !allBeachesResult.data) {
      console.log(`❌ Failed to get beaches:`, allBeachesResult.error);
      return [];
    }

    console.log(`📊 Found ${allBeachesResult.data.length} beaches in database`);

    // Normalize search text and check for aliases
    const normalizedSearch = normalizeSearchText(searchText);
    const aliasTarget = BEACH_ALIASES[normalizedSearch] || null;
    console.log(`🔧 Normalized search: "${normalizedSearch}"`, aliasTarget ? `(alias: ${aliasTarget})` : "");

    // Initialize strategies in priority order
    const strategies: MatchStrategy[] = [
      new ExactMatchStrategy(),
      new AliasMatchStrategy(),
      new SubstringMatchStrategy(),
      new WordMatchStrategy(),
    ];

    // Initialize scorer
    const scorer = new BeachRelevanceScorer(normalizedSearch, aliasTarget);

    // Find and score matches
    const scoredMatches = allBeachesResult.data
      .map((beach) => {
        // Try each strategy until we get a match
        for (const strategy of strategies) {
          const result = strategy.matches(beach, normalizedSearch, aliasTarget);
          if (result.matches) {
            return scorer.score(beach, result.matchType || strategy.name, result.score);
          }
        }
        return null;
      })
      .filter((match): match is NonNullable<typeof match> => match !== null);

    // Sort and extract beaches
    const sortedBeaches = BeachRelevanceScorer.sort(scoredMatches);

    console.log(
      `🎯 Found ${sortedBeaches.length} matching beaches:`,
      sortedBeaches.map((b) => b.name)
    );

    if (sortedBeaches.length > 0) {
      console.log(`🏆 Best match: "${sortedBeaches[0].name}"`);
    }

    return sortedBeaches;
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
