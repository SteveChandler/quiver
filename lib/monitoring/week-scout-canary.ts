import { generateWeekScoutForecast } from "@/lib/services/discovery/week-scout";

/**
 * Fixed San Diego and Orange County beaches. Week Scout fails closed across a
 * whole request, so a canary over a few beaches sees the same outage users do.
 */
export const WEEK_SCOUT_CANARY_BEACH_IDS = [
  "65d177de-e75a-4ad8-aa0d-48a67c0851b0", // Ocean Beach Pier
  "65809772-20bc-4009-b9b2-89c8ef3c4127", // Pacific Beach
  "d291411d-d331-4bf1-ad1a-302da3c69de0", // La Jolla Shores
  "5e72b79d-a12d-4cd3-8da4-b7b92069efbf", // Del Mar
  "cceecad1-7668-4ad8-88ff-ade893c605cd", // Oceanside Pier
  "193a3f9a-66d0-4362-bf55-d25bb831dae4", // Lower Trestles
  "a4575b12-2bc3-44d4-ba53-4415707f3851", // Doheny State Beach
  "071db1df-b5ee-4af6-a022-ea8a09667cbe", // Huntington Beach Pier
] as const;

/** No profile: the canary checks availability, not personalization. */
const CANARY_USER_ID = "00000000-0000-0000-0000-000000000000";
const CANARY_TIMEZONE = "America/Los_Angeles";
/** Home Best promises the next 72 hours. */
const CANARY_DAY_COUNT = 3;

export type WeekScoutCanaryResult =
  | { healthy: true; rankedWindows: number; heldBy?: string }
  | { healthy: false; reason: "hold_state_unavailable" | "no_windows" | "threw"; detail: string };

interface WeekScoutCanaryDependencies {
  generate: typeof generateWeekScoutForecast;
  now: () => Date;
}

function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function runWeekScoutCanary(
  dependencies: WeekScoutCanaryDependencies = {
    generate: generateWeekScoutForecast,
    now: () => new Date(),
  },
): Promise<WeekScoutCanaryResult> {
  let forecast: Awaited<ReturnType<typeof generateWeekScoutForecast>>;
  try {
    forecast = await dependencies.generate(CANARY_USER_ID, {
      candidateBeachIds: [...WEEK_SCOUT_CANARY_BEACH_IDS],
      localTimezone: CANARY_TIMEZONE,
      startLocalDate: localDate(dependencies.now(), CANARY_TIMEZONE),
      dayCount: CANARY_DAY_COUNT,
      requirePerRowFreshness: true,
    });
  } catch (error) {
    return {
      healthy: false,
      reason: "threw",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const availability = forecast.recommendationAvailability;
  if (availability.state === "none" && availability.reasonCode === "hold_state_unavailable") {
    return {
      healthy: false,
      reason: "hold_state_unavailable",
      detail: "Week Scout withheld every pick: hold_state_unavailable",
    };
  }

  const rankedWindows = forecast.days.reduce(
    (count, day) => count + day.windows.filter((window) => (window.rankedSpots?.length ?? 0) > 0).length,
    0,
  );
  // A major-event or water-quality hold is the system working, not an outage.
  if (availability.state === "none") {
    return { healthy: true, rankedWindows, heldBy: availability.reasonCode ?? "unknown" };
  }
  if (rankedWindows === 0) {
    return {
      healthy: false,
      reason: "no_windows",
      detail: `Week Scout ranked no window for ${WEEK_SCOUT_CANARY_BEACH_IDS.length} beaches over ${CANARY_DAY_COUNT} days`,
    };
  }
  return { healthy: true, rankedWindows };
}
