"use client";

/**
 * SetHomeBreakCta — a prominent banner shown on /profile for users who have
 * not yet set a home_beach_id. Tapping it re-opens the OnboardingDialog via
 * the reopenOnboarding server action (which clears onboarding_completed_at)
 * plus a local store reset so the dialog's `shouldRender` check flips back
 * to true.
 *
 * Rendered from components/profile-view.tsx. Only visible when
 * `profile.home_beach_id IS NULL`. See Fix 4 in plans/majestic-squishing-newell.md.
 */

import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reopenOnboarding } from "@/actions/onboarding-actions";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useProfileContext } from "@/context/profile-context";
import { useTrackEvent } from "@/hooks/use-track-event";

export function SetHomeBreakCta() {
  const [isLoading, setIsLoading] = useState(false);
  const { reset, openDialog } = useOnboardingStore();
  const { refreshProfile } = useProfileContext();
  const { track } = useTrackEvent();

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);

    track("onboarding_step", {
      metadata: {
        step: "reopen_from_profile_clicked",
        step_name: "reopen_from_profile_clicked",
      },
      debounceMs: 0,
    });

    try {
      const result = await reopenOnboarding();
      if (!result.success) {
        toast.error("Couldn't re-open onboarding. Please try again.");
        return;
      }

      // Reset the onboarding store so isCompleted flips back to false.
      // Without this, the dialog's shouldRender stays false even after the
      // profile refetches with a null onboarding_completed_at.
      reset();

      // Refetch the profile so the dialog's profile-based gates see the
      // newly-nulled onboarding_completed_at.
      await refreshProfile();

      // Open the dialog immediately (no setTimeout delay — the user explicitly
      // invoked this, they're ready).
      openDialog();
    } catch (err) {
      console.error("reopenOnboarding failed:", err);
      toast.error("Couldn't re-open onboarding. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-[#F78E42]/10 to-[#F78E42]/5 border border-[#F78E42]/30 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F78E42]/15 flex items-center justify-center">
          <MapPin className="h-5 w-5 text-[#F78E42]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">
            Set up your home break
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Pick where you surf most so Quiver can tailor forecasts to your spot.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          className="flex-shrink-0 px-4 py-2 rounded-full bg-ocean-blue text-white text-sm font-semibold hover:bg-ocean-blue/90 transition-colors disabled:opacity-50 focus-ring"
          data-testid="set-home-break-cta"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Set up"
          )}
        </button>
      </div>
    </div>
  );
}
