export type TideDirection = "rising" | "falling" | "slack";
export type TidePreference = "rising" | "falling" | "slack" | "either";

/**
 * Returns a multiplier (0.0-1.0) based on how well the current tide direction
 * matches the beach's preference.
 *
 * - Perfect match or "either" preference: 1.0
 * - Slack preference but not slack: 0.85
 * - Mismatch: 0.7
 */
export function getDirectionMultiplier(
  beachPref: TidePreference | string | null,
  currentDir: TideDirection | null
): number {
  // No preference or unknown direction = no adjustment
  if (!beachPref || beachPref === "either" || !currentDir) {
    return 1.0;
  }

  // Perfect match
  if (beachPref === currentDir) {
    return 1.0;
  }

  // Slack preference has softer penalty
  if (beachPref === "slack") {
    return 0.85;
  }

  // Mismatch (rising vs falling, or vice versa)
  return 0.7;
}

export interface TideAlert {
  status: "optimal" | "waiting" | "neutral";
  message: string;
}

/**
 * Generates an alert message based on tide direction match.
 */
export function getTideAlert(
  beachPref: TidePreference | string | null,
  currentDir: TideDirection | null,
  minutesToChange: number | null
): TideAlert {
  if (!beachPref || beachPref === "either") {
    return { status: "neutral", message: "Good on any tide" };
  }

  if (!currentDir) {
    return { status: "neutral", message: "Tide data unavailable" };
  }

  if (beachPref === currentDir) {
    return {
      status: "optimal",
      message: `Optimal now – tide is ${currentDir}`,
    };
  }

  const hours = minutesToChange ? Math.round(minutesToChange / 60) : null;
  const timeStr = hours !== null ? (hours > 0 ? `in ${hours}h` : "soon") : "";

  return {
    status: "waiting",
    message: `Better ${timeStr} (${beachPref} tide)`.trim(),
  };
}
