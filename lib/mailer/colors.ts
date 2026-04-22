/**
 * Score-band colors for email templates.
 *
 * Ported from the native MatchScoreBadge (quiver-native/src/components/shared/
 * match-score-badge.tsx). Paradise Gold is reserved for EPIC "best-of"
 * surfaces per the Phase 2 design-system amendment — lower bands use Pacific
 * Teal (GOOD / FAIR) or muted slate (RIDEABLE / MEH).
 *
 * Centralizing here keeps templates focused on layout and avoids drifting
 * from the native color bands.
 */

export const PARADISE_GOLD = "#FDB84B";
export const PACIFIC_TEAL = "#00D4AA";
export const MUTED_SLATE = "#6B7280";

/**
 * Map a 0–10 match score to the band color used for the accompanying label
 * (EPIC / GOOD / FAIR / RIDEABLE).
 *
 *   >= 8.5  → Paradise Gold (EPIC)
 *   >= 6.0  → Pacific Teal  (GOOD / FAIR)
 *   else    → muted slate   (RIDEABLE / MEH)
 */
export function colorForScore(score: number): string {
  if (score >= 8.5) return PARADISE_GOLD;
  if (score >= 6.0) return PACIFIC_TEAL;
  return MUTED_SLATE;
}
