import { BOARD_WAVE_MATCHING, BoardTypeKey } from "@/lib/constants/user-preferences";

/**
 * Pure function for board-to-wave matching logic.
 * Volume-aware: high-volume boards (>35L) can handle smaller waves better.
 *
 * @param boardType - Board type (e.g., "shortboard", "longboard", "Mid-Length")
 * @param waveHeightFt - Wave height in feet
 * @param boardName - Optional custom board name for display
 * @param volume - Optional board volume in liters
 * @returns Object with isMatch boolean and reasoning string (or null)
 */
export function matchBoardToWaves(
  boardType: string,
  waveHeightFt: number,
  boardName?: string,
  volume?: number | null
): { isMatch: boolean; reasoning: string | null } {
  // Normalize board type: "Mid-Length" -> "mid-length"
  const normalized = boardType.toLowerCase().replace(/\s+/g, "-") as BoardTypeKey;
  const range = BOARD_WAVE_MATCHING[normalized];

  if (!range) {
    // Unknown board type - assume it matches
    return { isMatch: true, reasoning: null };
  }

  const displayName = boardName || range.label;

  // Smart Volume Logic: High volume (>35L) makes small waves surfable
  if (waveHeightFt < range.min && volume && volume > 35) {
    return {
      isMatch: true,
      reasoning: `Small but surfable with your ${volume}L volume.`,
    };
  }

  if (waveHeightFt < range.min) {
    return {
      isMatch: false,
      reasoning: `Too small for your ${displayName}.`,
    };
  }

  if (waveHeightFt > range.max) {
    return {
      isMatch: false,
      reasoning: `Too heavy for your ${displayName}.`,
    };
  }

  return {
    isMatch: true,
    reasoning: `Perfect size for your ${displayName}!`,
  };
}
