import { getBeachesFromDb } from "@/lib/services/beach-query-service";
import type { Beach } from "@/types/database";
import {
  normalizeSearchText,
  BEACH_ALIASES,
} from "@/lib/utils/text-normalization";
import { matchBeach } from "@/lib/utils/beach-search/match-beach";
import { BeachRelevanceScorer } from "@/lib/utils/beach-search/beach-relevance-scorer";

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

    // Initialize scorer
    const scorer = new BeachRelevanceScorer(normalizedSearch, aliasTarget);

    // Find and score matches
    const scoredMatches = allBeachesResult.data
      .map((beach) => {
        const result = matchBeach(beach, normalizedSearch, aliasTarget);
        return result.matches
          ? scorer.score(beach, result.matchType!, result.score)
          : null;
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
