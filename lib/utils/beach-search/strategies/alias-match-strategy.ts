import type { Beach } from "@/types/database";
import type { MatchStrategy, MatchResult } from "../match-strategy";
import { normalizeSearchText } from "@/lib/utils/text-normalization";

/**
 * AliasMatchStrategy - Handles common abbreviations and aliases
 * Matches when the search is a known alias for a beach name
 * Examples: "pb" matches "Pacific Beach", "oc" matches "Ocean Beach"
 */
export class AliasMatchStrategy implements MatchStrategy {
  readonly name = "AliasMatch";
  readonly priority = 90;

  matches(
    beach: Beach,
    _normalizedSearch: string,
    aliasTarget: string | null
  ): MatchResult {
    // Only applies when an alias was detected
    if (!aliasTarget) {
      return {
        matches: false,
        score: 0,
      };
    }

    const beachName = normalizeSearchText(beach.name);

    // Exact alias match - very high confidence
    if (beachName === aliasTarget) {
      return {
        matches: true,
        score: 900,
        matchType: "alias-exact",
      };
    }

    // Beach name starts with alias target
    // Example: alias "pacific" matches "Pacific Beach"
    if (beachName.startsWith(`${aliasTarget} `)) {
      return {
        matches: true,
        score: 850,
        matchType: "alias-prefix",
      };
    }

    // Alias target starts with beach name
    // Example: beach "Pacific" matches alias "pacific beach"
    if (aliasTarget.startsWith(beachName)) {
      return {
        matches: true,
        score: 800,
        matchType: "alias-contains",
      };
    }

    return {
      matches: false,
      score: 0,
    };
  }
}
