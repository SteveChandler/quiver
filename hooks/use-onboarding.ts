"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { shouldShowOnboarding } from "@/lib/onboarding";
import { ensureProfile, getProfileMinimal, markOnboardingDone } from "@/lib/profile";
import { track } from "@/lib/analytics";

export function useOnboarding(userId?: string | null) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!userId) return undefined; // guest/anonymous: do nothing
    await ensureProfile(userId);
    const p = await getProfileMinimal(userId);
    return p;
  }, [userId]);

  const { data: profile, loading, error } = useDataFetcher(fetchProfile, {
    skip: !userId,
    initialData: undefined,
    onSuccess: (p) => {
      // Decide visibility when profile loads
      const show = shouldShowOnboarding(p as any, params);
      if (show) {
        setOpen(true);
        // Analytics event
        if (userId) track("onboarding_shown", { user_id: userId, forced: params.get("showTour") === "1" });
      }
    },
  });

  // Developer override: react to changes in ?showTour=1
  const forceShow = useMemo(() => params.get("showTour") === "1", [params]);
  useEffect(() => {
    if (!loading && forceShow) setOpen(true);
  }, [forceShow, loading]);

  const complete = useCallback(async (action: "completed" | "skipped" = "completed") => {
    // Optimistic close
    setOpen(false);
    if (!userId) return;
    // Do not mutate flag when forced via query param
    if (forceShow) {
      track(action === "completed" ? "onboarding_completed" : "onboarding_skipped", { user_id: userId, forced: true });
      return;
    }

    try {
      await markOnboardingDone(userId);
      track(action === "completed" ? "onboarding_completed" : "onboarding_skipped", { user_id: userId, forced: false });
    } catch {
      // Silent failure; we already closed the modal. Next fetch will re-evaluate.
    }
  }, [userId, forceShow]);

  return { open, setOpen, loading: !!userId && loading, error: userId ? error : null, complete } as const;
}


