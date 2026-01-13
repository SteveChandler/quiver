/**
 * useTimeOfDay Hook
 *
 * Custom React hook that returns the current time of day and updates
 * when the time period changes (morning/afternoon/evening).
 *
 * Uses a smart update mechanism that only re-renders when the time
 * period actually changes, not every second.
 */

import { useState, useEffect } from "react";
import { getTimeOfDay, type TimeOfDay } from "@/lib/utils/greeting-utils";

export interface UseTimeOfDayOptions {
  /**
   * Enable automatic updates when time period changes.
   * Default: true
   */
  enableAutoUpdate?: boolean;
}

export interface UseTimeOfDayReturn {
  timeOfDay: TimeOfDay;
}

/**
 * Hook to get the current time of day with automatic updates.
 *
 * @param options - Configuration options
 * @returns Object containing current time of day
 *
 * @example
 * function MyComponent() {
 *   const { timeOfDay } = useTimeOfDay();
 *   return <div>It's {timeOfDay}</div>;
 * }
 *
 * @example
 * // Disable auto-updates
 * const { timeOfDay } = useTimeOfDay({ enableAutoUpdate: false });
 */
export function useTimeOfDay(
  options: UseTimeOfDayOptions = {}
): UseTimeOfDayReturn {
  const { enableAutoUpdate = true } = options;

  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());

  useEffect(() => {
    if (!enableAutoUpdate) {
      return;
    }

    // Declare timeoutId before functions that reference it
    let timeoutId: ReturnType<typeof setTimeout>;

    /**
     * Calculate milliseconds until the next time period change.
     * This allows us to schedule the next update efficiently.
     */
    function getMillisecondsUntilNextPeriod(): number {
      const now = new Date();
      const currentHour = now.getHours();

      let targetHour: number;

      // Determine next boundary hour
      if (currentHour >= 5 && currentHour < 12) {
        // Morning -> Afternoon at 12:00
        targetHour = 12;
      } else if (currentHour >= 12 && currentHour < 17) {
        // Afternoon -> Evening at 17:00
        targetHour = 17;
      } else {
        // Evening -> Morning at 5:00
        targetHour = currentHour < 5 ? 5 : 5 + 24;
      }

      // Calculate milliseconds until target hour using Date arithmetic
      // This avoids the double-counting bug from manual calculations
      const target = new Date(now);
      target.setHours(targetHour, 0, 0, 0);

      // If target is in the past (e.g., we're past 5am calculating for next 5am)
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      return target.getTime() - now.getTime();
    }

    function updateTimeOfDay() {
      const newTimeOfDay = getTimeOfDay();
      setTimeOfDay((prev) => {
        // Only update if time period has actually changed
        if (prev !== newTimeOfDay) {
          return newTimeOfDay;
        }
        return prev;
      });

      // Schedule next update
      const msUntilNext = getMillisecondsUntilNextPeriod();
      timeoutId = setTimeout(updateTimeOfDay, msUntilNext);
    }

    // Initial schedule
    timeoutId = setTimeout(updateTimeOfDay, getMillisecondsUntilNextPeriod());

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [enableAutoUpdate]);

  return { timeOfDay };
}
