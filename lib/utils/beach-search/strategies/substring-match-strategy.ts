import type { Beach } from "@/types/database";
import type { MatchStrategy, MatchResult } from "../match-strategy";
import { normalizeSearchText } from "@/lib/utils/text-normalization";

/**
 * SubstringMatchStrategy - Medium priority strategy
 * Matches when the search is a substring of the beach name/city or vice versa
 * Examples: "scripps" matches "Scripps Pier", "la jo" matches "La Jolla Shores"
 */
export class SubstringMatchStrategy implements MatchStrategy {
  readonly name = "SubstringMatch";
  readonly priority = 80;

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
    const beachState = normalizeSearchText(beach.state || "");

    // Search term is contained in beach name
    if (beachName.includes(normalizedSearch)) {
      return {
        matches: true,
        score: 700,
        matchType: "substring-name",
      };
    }

    // Search term is contained in city or state name
    if (beachCity.includes(normalizedSearch) || beachState.includes(normalizedSearch)) {
      return {
        matches: true,
        score: 600,
        matchType: "substring-city",
      };
    }

    // Beach name is contained in search term (reverse match)
    // Example: searching "black beach san diego" matches "Blacks Beach"
    if (normalizedSearch.includes(beachName)) {
      return {
        matches: true,
        score: 500,
        matchType: "substring-reverse",
      };
    }

    return {
      matches: false,
      score: 0,
    };
  }
}
