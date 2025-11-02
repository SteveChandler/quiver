import type { Beach } from "@/types/database";

/**
 * Represents a match result with score and metadata
 */
export interface MatchResult {
  matches: boolean;
  score: number;
  matchType?: string;
}

/**
 * Strategy interface for different beach matching approaches
 * Each strategy implements a specific matching logic (exact, substring, word-based, alias)
 */
export interface MatchStrategy {
  /**
   * Name of the strategy for debugging and logging
   */
  readonly name: string;

  /**
   * Priority of this strategy (higher = checked first)
   */
  readonly priority: number;

  /**
   * Check if a beach matches the search query
   * @param beach The beach to check
   * @param normalizedSearch The normalized search text
   * @param aliasTarget Optional alias target if search matches an alias
   * @returns Match result with score
   */
  matches(
    beach: Beach,
    normalizedSearch: string,
    aliasTarget: string | null
  ): MatchResult;
}

/**
 * Context for beach matching containing normalized data
 */
export interface BeachMatchContext {
  beach: Beach;
  normalizedName: string;
  normalizedCity: string;
  normalizedLocation: string;
}
