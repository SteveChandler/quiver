import type { Beach } from "@/types/database";
import type { MatchStrategy, MatchResult } from "../match-strategy";
import { normalizeSearchText } from "@/lib/utils/text-normalization";

/**
 * WordMatchStrategy - Lower priority strategy for multi-word searches
 * Matches when all words in the search appear in the beach name or city
 * Examples: "black beach" matches "Blacks Beach", "la jolla shores" matches "La Jolla Shores"
 */
export class WordMatchStrategy implements MatchStrategy {
  readonly name = "WordMatch";
  readonly priority = 60;

  matches(
    beach: Beach,
    normalizedSearch: string,
    _aliasTarget: string | null
  ): MatchResult {
    const searchWords = this.extractWords(normalizedSearch);

    // Only apply this strategy for multi-word searches
    if (searchWords.length <= 1) {
      return {
        matches: false,
        score: 0,
      };
    }

    const beachName = normalizeSearchText(beach.name);
    const beachCity = normalizeSearchText(beach.city || "");
    const beachState = normalizeSearchText(beach.state || "");

    const nameWords = this.extractWords(beachName);
    const cityWords = this.extractWords(beachCity);
    const stateWords = this.extractWords(beachState);

    // Check if all search words match in the beach name
    const allWordsInName = this.allWordsMatch(searchWords, nameWords);
    if (allWordsInName) {
      return {
        matches: true,
        score: 400,
        matchType: "word-match-name",
      };
    }

    // Check if all search words match in the city or state name
    const allWordsInCity = this.allWordsMatch(searchWords, cityWords);
    const allWordsInState = this.allWordsMatch(searchWords, stateWords);
    if (allWordsInCity || allWordsInState) {
      return {
        matches: true,
        score: 300,
        matchType: "word-match-city",
      };
    }

    return {
      matches: false,
      score: 0,
    };
  }

  /**
   * Extract non-empty words from text
   */
  private extractWords(text: string): string[] {
    return text.split(" ").filter((word) => word.length > 0);
  }

  /**
   * Check if all search words are found in target words (with partial matching)
   */
  private allWordsMatch(searchWords: string[], targetWords: string[]): boolean {
    return searchWords.every((searchWord) =>
      targetWords.some(
        (targetWord) =>
          targetWord.includes(searchWord) || searchWord.includes(targetWord)
      )
    );
  }
}
