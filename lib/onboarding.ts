export type MinimalProfile = { id: string; onboarding_completed_at: string | null } | null;

/**
 * Decide whether to show the onboarding wizard.
 * - Honors developer override via URL (?showTour=1)
 * - Returns false while profile is loading (pass undefined), preventing modal flash
 */
export const shouldShowOnboarding = (
  profile: MinimalProfile | undefined,
  params?: URLSearchParams
): boolean => {
  if (params?.get("showTour") === "1") return true;
  if (!profile) return false; // no flash until loaded
  return profile?.onboarding_completed_at == null;
};


