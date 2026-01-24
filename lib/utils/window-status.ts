export type WindowStatusType = "upcoming" | "current" | "passed" | "unknown";

export interface WindowStatus {
  status: WindowStatusType;
  message: string;
}

/**
 * Determine whether a surf window is upcoming, current, or passed.
 */
export function getWindowStatus(
  windowStart: string | null,
  windowEnd: string | null,
  forecastDate: string,
  now: Date = new Date()
): WindowStatus {
  if (!windowStart || !windowEnd) {
    return { status: "unknown", message: "" };
  }

  const startTime = new Date(`${forecastDate}T${windowStart}`);
  const endTime = new Date(`${forecastDate}T${windowEnd}`);

  if (now < startTime) {
    const hoursUntil = Math.round(
      (startTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    );
    const minsUntil = Math.round(
      (startTime.getTime() - now.getTime()) / (1000 * 60)
    );

    if (hoursUntil >= 1) {
      return {
        status: "upcoming",
        message: `Starts in ${hoursUntil} hour${hoursUntil > 1 ? "s" : ""}`,
      };
    }
    return {
      status: "upcoming",
      message: `Starts in ${minsUntil} minutes`,
    };
  }

  if (now >= startTime && now <= endTime) {
    const minsRemaining = Math.round(
      (endTime.getTime() - now.getTime()) / (1000 * 60)
    );
    return {
      status: "current",
      message:
        minsRemaining > 60
          ? `${Math.floor(minsRemaining / 60)}h ${minsRemaining % 60}m remaining`
          : `${minsRemaining} mins remaining`,
    };
  }

  return {
    status: "passed",
    message: "Window has passed",
  };
}
