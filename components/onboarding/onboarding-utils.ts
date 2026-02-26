const SNOOZE_DURATIONS = [
  24 * 60 * 60 * 1000,      // 1 day
  3 * 24 * 60 * 60 * 1000,  // 3 days
  7 * 24 * 60 * 60 * 1000,  // 7 days
];

/**
 * Handles escalating snooze logic for onboarding dismissals.
 * - 1st dismiss: snooze 24h
 * - 2nd dismiss: snooze 3 days
 * - 3rd dismiss: snooze 7 days
 * - 4th+ dismiss: permanent skip (caller must call skipOnboarding())
 *
 * Returns 'snoozed' if the dismiss was temporary, or 'permanent' if the
 * caller should invoke skipOnboarding() to permanently mark it done.
 */
export function handleOnboardingDismiss(userId: string): 'snoozed' | 'permanent' {
  const countKey = `onboarding_dismiss_count_${userId}`;
  const untilKey = `onboarding_dismissed_until_${userId}`;

  try {
    const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10) || 0;
    const newCount = currentCount + 1;
    localStorage.setItem(countKey, String(newCount));

    if (newCount >= 4) {
      return 'permanent';
    }

    const duration = SNOOZE_DURATIONS[newCount - 1] ?? SNOOZE_DURATIONS[SNOOZE_DURATIONS.length - 1];
    localStorage.setItem(untilKey, String(Date.now() + duration));
    return 'snoozed';
  } catch {
    return 'snoozed';
  }
}
