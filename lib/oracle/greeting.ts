/**
 * Oracle greeting logic — conditions-reactive, tone-matched to surf culture.
 *
 * Priority order (first match wins):
 * 1. High score + early morning → dawn patrol callout
 * 2. High score → fire alert
 * 3. Long-period swell → period callout
 * 4. Flat conditions → rest day
 * 5. Onshore wind → blown out
 * 6. Very early hour → pre-dawn acknowledgment
 * 7. Returning after absence → welcome back
 * 8. Default → time-of-day greeting
 */

export interface GreetingContext {
  score: number | null;        // surf call score (0-10)
  hour: number;                // current hour (0-23)
  swellPeriod: number | null;  // dominant swell period in seconds
  windCondition: string | null; // "offshore", "onshore", "cross-shore", etc.
  userName: string;
  beachName: string | null;
  daysAbsent: number;          // days since last visit
}

export function getOracleGreeting(ctx: GreetingContext): string {
  const { score, hour, swellPeriod, windCondition, userName, beachName, daysAbsent } = ctx;

  // 1. Firing + dawn patrol window
  if (score !== null && score > 7 && hour < 7) {
    return `It's going off. Dawn patrol, ${userName}.`;
  }

  // 2. Firing (any hour)
  if (score !== null && score > 7) {
    return beachName
      ? `It's firing at ${beachName}. Don't sleep on this.`
      : "It's firing out there. Don't sleep on this.";
  }

  // 3. Long-period swell
  if (swellPeriod !== null && swellPeriod > 12) {
    return "Long-period swell rolling in. Could be fun.";
  }

  // 4. Flat / poor conditions
  if (score !== null && score < 3) {
    return "Flat as a lake today. Good day for a coffee.";
  }

  // 5. Onshore wind → blown out
  if (windCondition !== null && windCondition.toLowerCase().includes("onshore")) {
    return "Blown out. Rest day.";
  }

  // 6. Very early (pre-dawn)
  if (hour < 6) {
    return "You're up before the sun. Respect.";
  }

  // 7. Returning after absence
  if (daysAbsent > 3) {
    return `Missed you out there. Here's what's been happening.`;
  }

  // 8. Default: time-of-day greeting
  if (hour < 12) return `Good morning, ${userName}.`;
  if (hour < 17) return `Good afternoon, ${userName}.`;
  return `Good evening, ${userName}.`;
}
