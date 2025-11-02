/**
 * Beach search strategies
 * Each strategy implements a specific matching approach
 * Strategies are applied in priority order (highest first)
 */

export { ExactMatchStrategy } from "./exact-match-strategy";
export { AliasMatchStrategy } from "./alias-match-strategy";
export { SubstringMatchStrategy } from "./substring-match-strategy";
export { WordMatchStrategy } from "./word-match-strategy";
