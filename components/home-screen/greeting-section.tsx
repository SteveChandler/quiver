/**
 * GreetingSection Component
 *
 * Displays a time-aware greeting to the user on the home screen.
 * Shows "Good morning/afternoon/evening, [Name]." based on current time.
 * Includes subtle fade-in animation.
 */

"use client";

import { motion } from "framer-motion";
import { getGreetingWithName, type TimeOfDay } from "@/lib/utils/greeting-utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

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
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`space-y-2 px-4 sm:px-0 ${className}`.trim()}
      data-testid="greeting-section"
      initial={reducedMotion ? false : HOME_HEADER_MOTION.entryItem.initial}
      animate={reducedMotion ? { opacity: 1, y: 0 } : HOME_HEADER_MOTION.entryItem.animate}
      transition={reducedMotion ? { duration: 0 } : HOME_HEADER_MOTION.entryItem.transition}
    >
      <h1 className="text-base xs:text-lg sm:text-xl font-normal text-white/80 leading-tight">
        {greeting}
      </h1>
    </motion.div>
  );
}
