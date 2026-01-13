/**
 * GreetingSection Usage Examples
 *
 * Demonstrates how to use the GreetingSection component with the useTimeOfDay hook.
 */

"use client";

import { GreetingSection } from "./greeting-section";
import { useTimeOfDay } from "./use-time-of-day";
import { useAuth } from "@/context/auth-context";
import { useCachedProfile } from "@/hooks/use-cached-profile";

/**
 * Example 1: Basic usage with static time
 */
export function GreetingSectionBasic() {
  return (
    <GreetingSection
      userName="John Doe"
      timeOfDay="morning"
    />
  );
}

/**
 * Example 2: With automatic time-of-day detection
 */
export function GreetingSectionWithAutoTime() {
  const { timeOfDay } = useTimeOfDay();

  return (
    <GreetingSection
      userName="Jane Smith"
      timeOfDay={timeOfDay}
    />
  );
}

/**
 * Example 3: With authenticated user profile (recommended)
 */
export function GreetingSectionWithAuth() {
  const { user } = useAuth();
  const { profile } = useCachedProfile();
  const { timeOfDay } = useTimeOfDay();

  return (
    <GreetingSection
      userName={user ? profile?.full_name || null : null}
      timeOfDay={timeOfDay}
    />
  );
}

/**
 * Example 4: With custom styling
 */
export function GreetingSectionCustom() {
  const { timeOfDay } = useTimeOfDay();

  return (
    <GreetingSection
      userName="Surfer"
      timeOfDay={timeOfDay}
      className="py-8 text-center"
    />
  );
}

/**
 * Example 5: Disabled auto-updates (static greeting)
 */
export function GreetingSectionStatic() {
  // Disable auto-updates if you want the time of day to stay constant
  // (useful for testing or when the component lifecycle is short)
  const { timeOfDay } = useTimeOfDay({ enableAutoUpdate: false });

  return (
    <GreetingSection
      userName="Alex"
      timeOfDay={timeOfDay}
    />
  );
}
