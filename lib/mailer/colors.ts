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

import { EPIC_LABEL_ENABLED } from "@/lib/utils/score-color-utils";

const PARADISE_GOLD = "#FDB84B";
const PACIFIC_TEAL = "#00D4AA";
const MUTED_SLATE = "#6B7280";

/**
 * Map a 0–10 match score to the band color used for the accompanying label
 * (EPIC / GOOD / FAIR / RIDEABLE).
 *
 *   >= 8.5  → Paradise Gold (EPIC; Pacific Teal while EPIC_LABEL_ENABLED is false)
 *   >= 6.0  → Pacific Teal  (GOOD / FAIR)
 *   else    → muted slate   (RIDEABLE / MEH)
 */
export function colorForScore(score: number): string {
  if (EPIC_LABEL_ENABLED && score >= 8.5) return PARADISE_GOLD;
  if (score >= 6.0) return PACIFIC_TEAL;
  return MUTED_SLATE;
}
