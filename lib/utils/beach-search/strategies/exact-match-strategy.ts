import type { Beach } from "@/types/database";
import type { MatchStrategy, MatchResult } from "../match-strategy";
import { normalizeSearchText } from "@/lib/utils/text-normalization";

/**
 * ExactMatchStrategy - Highest priority strategy
 * Matches when the search exactly matches the beach name or city
 * Examples: "Blacks Beach" matches beach named "Blacks Beach"
 */
export class ExactMatchStrategy implements MatchStrategy {
  readonly name = "ExactMatch";
  readonly priority = 100;

  matches(
    beach: Beach,
    normalizedSearch: string,
    _aliasTarget: string | null
  ): MatchResult {
    // Guard against empty search
    if (!normalizedSearch) {
      return { matches: false, score: 0 };
    }

    const beachName = normalizeSearchText(beach.name);
    const beachCity = normalizeSearchText(beach.city || "");
    const beachLocation = normalizeSearchText((beach as any).location || "");

    // Exact name match - highest confidence
    if (beachName === normalizedSearch) {
      return {
        matches: true,
        score: 1000,
        matchType: "exact-name",
      };
    }

    // Exact city/location match - high confidence
    if (beachCity === normalizedSearch || beachLocation === normalizedSearch) {
      return {
        matches: true,
        score: 800,
        matchType: "exact-city",
      };
    }

    return {
      matches: false,
      score: 0,
    };
  }
}
