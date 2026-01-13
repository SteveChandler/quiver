/**
 * GreetingSection Component
 *
 * Displays a time-aware greeting to the user on the home screen.
 * Shows "Good morning/afternoon/evening, [Name]." based on current time.
 *
 * Part of the Quiver home screen redesign.
 */

"use client";

import { getGreetingWithName, type TimeOfDay } from "@/lib/utils/greeting-utils";

export interface GreetingSectionProps {
  /**
   * User's display name. Falls back to "Surfer" if null.
   */
  userName: string | null;

  /**
   * Time of day classification for greeting.
   */
  timeOfDay: TimeOfDay;

  /**
   * Optional CSS classes for customization.
   */
  className?: string;
}

/**
 * Greeting section component for the home screen.
 *
 * Displays a personalized, time-aware greeting with clean typography.
 *
 * @example
 * ```tsx
 * <GreetingSection
 *   userName={user?.full_name}
 *   timeOfDay="morning"
 * />
 * // Renders: "Good morning, John."
 * ```
 *
 * @example
 * ```tsx
 * // With useTimeOfDay hook
 * const { timeOfDay } = useTimeOfDay();
 * <GreetingSection
 *   userName={user?.full_name}
 *   timeOfDay={timeOfDay}
 * />
 * ```
 */
export function GreetingSection({
  userName,
  timeOfDay,
  className = "",
}: GreetingSectionProps) {
  const greeting = getGreetingWithName(userName, timeOfDay);

  return (
    <div
      className={`space-y-2 px-4 sm:px-0 ${className}`.trim()}
      data-testid="greeting-section"
    >
      <h1 className="text-base xs:text-lg sm:text-xl font-normal text-white/80 leading-tight">
        {greeting}
      </h1>
    </div>
  );
}
