"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { createElement } from "react";
import {
  getMilestoneCopy,
  type MilestoneMetadata,
} from "@/lib/utils/personalization-messaging";
import type { MilestoneKey } from "@/lib/constants/personalization-milestones";

/**
 * Milestone record returned from the API.
 */
interface UnshownMilestone {
  id: string;
  milestone_key: MilestoneKey;
  achieved_at: string;
  metadata: Record<string, unknown>;
}

/**
 * Delay before first toast appears (ms).
 */
const INITIAL_DELAY_MS = 2000;

/**
 * Stagger between consecutive toasts (ms).
 */
const STAGGER_MS = 1500;

/**
 * Maximum milestones to display per visit.
 */
const MAX_TOASTS_PER_VISIT = 2;

/**
 * Toast display duration (ms).
 */
const TOAST_DURATION_MS = 6000;

/**
 * Shows a single milestone toast using Sonner with a styled card.
 */
function showMilestoneToast(milestone: UnshownMilestone): void {
  const meta: MilestoneMetadata = {
    min: typeof milestone.metadata?.min === "number" ? milestone.metadata.min : undefined,
    max: typeof milestone.metadata?.max === "number" ? milestone.metadata.max : undefined,
    timeSlot: typeof milestone.metadata?.timeSlot === "string" ? milestone.metadata.timeSlot : undefined,
    beach: typeof milestone.metadata?.beach === "string" ? milestone.metadata.beach : undefined,
  };
  const copy = getMilestoneCopy(milestone.milestone_key, meta);

  toast(copy.title, {
    description: copy.description,
    duration: TOAST_DURATION_MS,
    icon: createElement(Sparkles, {
      className: "h-5 w-5 text-blue-500",
    }),
    className:
      "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
  });
}

/**
 * Marks milestones as shown via PATCH /api/me/milestones.
 */
async function markMilestonesShown(keys: MilestoneKey[]): Promise<void> {
  try {
    await fetch("/api/me/milestones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneKeys: keys }),
    });
  } catch {
    // Non-critical — milestone will show again next visit
  }
}

/**
 * Hook that fetches unshown personalization milestones on mount and
 * displays them as styled Sonner toasts. Max 2 per visit with a
 * 2-second initial delay.
 *
 * Call this once on the home screen layout or dashboard.
 *
 * Only fetches when `isAuthenticated` is true to avoid 401s for anonymous visitors.
 *
 * @example
 * ```tsx
 * function HomeScreen() {
 *   usePersonalizationMilestones(!!profile);
 *   return <div>...</div>;
 * }
 * ```
 */
export function usePersonalizationMilestones(isAuthenticated: boolean): void {
  const hasRun = useRef(false);

  useEffect(() => {
    // Skip for unauthenticated users — no milestones to fetch
    if (!isAuthenticated) return;

    // Prevent double-fire in React strict mode
    if (hasRun.current) return;
    hasRun.current = true;

    let cancelled = false;

    async function fetchAndShow() {
      try {
        const res = await fetch("/api/me/milestones");
        if (!res.ok) return;

        const json = await res.json();
        const milestones: UnshownMilestone[] = json?.data ?? [];

        if (milestones.length === 0 || cancelled) return;

        // Cap at MAX_TOASTS_PER_VISIT
        const toShow = milestones.slice(0, MAX_TOASTS_PER_VISIT);
        const keysToMark = toShow.map((m) => m.milestone_key);

        // Show toasts with staggered delay, mark as shown after last toast fires
        const lastToastDelay =
          INITIAL_DELAY_MS + (toShow.length - 1) * STAGGER_MS;

        toShow.forEach((milestone, index) => {
          setTimeout(() => {
            if (!cancelled) {
              showMilestoneToast(milestone);
            }
          }, INITIAL_DELAY_MS + index * STAGGER_MS);
        });

        // Defer markShown until after toasts are scheduled to display
        // (prevents marking-without-viewing on fast navigation)
        setTimeout(() => {
          if (!cancelled) {
            markMilestonesShown(keysToMark);
          }
        }, lastToastDelay + 500);
      } catch {
        // Silent failure — milestones are non-critical
      }
    }

    fetchAndShow();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
}
