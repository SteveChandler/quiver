/**
 * Greeting Utilities
 *
 * Time-based greeting utilities for the Quiver home screen.
 * Determines appropriate greeting based on time of day.
 */

export type TimeOfDay = "morning" | "afternoon" | "evening";

/**
 * Determine the current time of day based on the hour.
 *
 * Time ranges:
 * - Morning: 5am - 12pm (5:00 - 11:59)
 * - Afternoon: 12pm - 5pm (12:00 - 16:59)
 * - Evening: 5pm - 5am (17:00 - 4:59)
 *
 * @param date - Optional Date object (defaults to current time)
 * @returns "morning" | "afternoon" | "evening"
 *
 * @example
 * getTimeOfDay(new Date('2024-01-15T08:00:00')) // "morning"
 * getTimeOfDay(new Date('2024-01-15T14:00:00')) // "afternoon"
 * getTimeOfDay(new Date('2024-01-15T19:00:00')) // "evening"
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "morning";
  } else if (hour >= 12 && hour < 17) {
    return "afternoon";
  } else {
    return "evening";
  }
}

/**
 * Get a greeting message based on time of day.
 *
 * @param timeOfDay - Time of day classification
 * @returns Greeting string (e.g., "Good morning")
 *
 * @example
 * getGreeting("morning") // "Good morning"
 * getGreeting("afternoon") // "Good afternoon"
 * getGreeting("evening") // "Good evening"
 */
export function getGreeting(timeOfDay: TimeOfDay): string {
  const greetings: Record<TimeOfDay, string> = {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
  };

  return greetings[timeOfDay];
}

/**
 * Get a complete greeting with user name.
 *
 * @param userName - User's display name (null defaults to "Surfer")
 * @param timeOfDay - Optional time of day (defaults to current)
 * @returns Complete greeting string (e.g., "Good morning, Surfer.")
 *
 * @example
 * getGreetingWithName("John") // "Good morning, John."
 * getGreetingWithName(null) // "Good morning, Surfer."
 */
export function getGreetingWithName(
  userName: string | null,
  timeOfDay?: TimeOfDay
): string {
  const time = timeOfDay || getTimeOfDay();
  const greeting = getGreeting(time);
  const name = userName || "Surfer";

  return `${greeting}, ${name}.`;
}
