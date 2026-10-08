type TideDirection = "rising" | "falling" | "slack";
type TidePreference = "rising" | "falling" | "slack" | "either";

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
