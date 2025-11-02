import type { Beach } from "@/types/database";
import { normalizeSearchText } from "@/lib/utils/text-normalization";

/**
 * Scored beach result with match metadata
 */
export interface ScoredBeach {
  beach: Beach;
  score: number;
  matchType: string;
  normalizedName: string;
  normalizedLocation: string;
}

/**
 * BeachRelevanceScorer handles scoring and sorting of beach matches
 * Extracts complex sorting logic from the main search function
 */
export class BeachRelevanceScorer {
  constructor(
    private readonly normalizedSearch: string,
    private readonly aliasTarget: string | null
  ) {}

  /**
   * Score a beach based on how well it matches the search
   */
  score(beach: Beach, matchType: string, baseScore: number): ScoredBeach {
    const normalizedName = normalizeSearchText(beach.name);
    // Handle both location (for compatibility) and city fields
    const normalizedLocation = normalizeSearchText(
      (beach as any).location || beach.city || ""
    );

    // Start with the base score from the matching strategy
    let finalScore = baseScore;

    // Boost for exact matches
    if (normalizedName === this.normalizedSearch) {
      finalScore += 1000;
    }

    // Boost for name matches over location matches
    if (normalizedName.includes(this.normalizedSearch)) {
      finalScore += 500;
    }

    // Boost for shorter names (more specific)
    const lengthPenalty = normalizedName.length;
    finalScore -= lengthPenalty;

    // Boost for alias matches
    if (this.aliasTarget) {
      const aliasScore = this.calculateAliasScore(normalizedName);
      finalScore += aliasScore;
    }

    return {
      beach,
      score: finalScore,
      matchType,
      normalizedName,
      normalizedLocation,
    };
  }

  /**
   * Calculate bonus score for alias matches
   */
  private calculateAliasScore(normalizedName: string): number {
    if (!this.aliasTarget) return 0;

    if (normalizedName === this.aliasTarget) return 300;
    if (normalizedName.startsWith(`${this.aliasTarget} `)) return 200;
    if (this.aliasTarget.startsWith(normalizedName)) return 100;
    return 0;
  }

  /**
   * Sort scored beaches by relevance (highest score first)
   */
  static sort(scoredBeaches: ScoredBeach[]): Beach[] {
    return scoredBeaches
      .sort((a, b) => {
        // Primary sort: by score (descending)
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        // Secondary sort: by name length (ascending - shorter is better)
        return a.normalizedName.length - b.normalizedName.length;
      })
      .map((scored) => scored.beach);
  }
}
