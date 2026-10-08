"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePathname } from "next/navigation";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useTrackEvent } from "@/hooks/use-track-event";
import { trackSignupCtaClick } from "@/lib/analytics/signup-conversion-tracking";
import { cn } from "@/lib/utils";

interface AlertRule {
  id: string;
  beach_id: string;
  preset_type?: string | null;
}

interface BeachAlertCtaProps {
  beachId: string;
  beachName: string;
  compact?: boolean;
  className?: string;
  refreshKey?: number;
  freeGrowthPhaseEnabled?: boolean;
  /** Called when the user clicks to open the alert creation/management flow */
  onOpenAlerts?: () => void;
}

export function BeachAlertCta({
  beachId,
  beachName,
  compact,
  className,
  refreshKey,
  freeGrowthPhaseEnabled = false,
  onOpenAlerts,
}: BeachAlertCtaProps) {
  const { user } = useAuth();
  const { track } = useTrackEvent();
  const { pendingAction, setPendingAction, clearPendingAction } = usePendingAction();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const previousRefreshKey = useRef(refreshKey);
  const freeGrowthImpressionKey = useRef<string | null>(null);

  // Fetch alert rules only for authenticated users — filter by beach_id client-side
  const fetchRules = useCallback(async (): Promise<AlertRule[]> => {
    const res = await fetch("/api/alerts/rules");
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []) as AlertRule[];
  }, []);

  const {
    data: allRules,
    loading: rulesLoading,
    refetch,
    invalidateCache,
  } = useDataFetcher(fetchRules, {
    skip: !user,
    cacheKey: user ? `alert-rules-${user.id}` : undefined,
  });

  // null while loading, 0+ once fetched
  const ruleCount = useMemo(
    () =>
      allRules === null
        ? null
        : allRules.filter(
            (rule) =>
              rule.beach_id === beachId &&
              rule.preset_type !== "similarity_match"
          ).length,
    [allRules, beachId]
  );

  const hasAlerts = ruleCount != null && ruleCount > 0;
  // Don't flash "no alerts" while rules are still loading
  const showAlertCount = !rulesLoading && ruleCount != null;
  const inactiveHelperCopy = freeGrowthPhaseEnabled
    ? "Watch this spot, free. Track up to 3 breaks and we'll call the window."
    : "Notify me when conditions are ideal";

  // Deferred action: after sign-in, open alert flow if pending action matches
  useEffect(() => {
    if (
      user &&
      pendingAction?.type === "alert" &&
      pendingAction.beachId === beachId
    ) {
      clearPendingAction();
      onOpenAlerts?.();
    }
  }, [user, pendingAction, beachId, clearPendingAction, onOpenAlerts]);

  useEffect(() => {
    if (!user || refreshKey === undefined) return;
    if (previousRefreshKey.current === refreshKey) return;

    previousRefreshKey.current = refreshKey;
    invalidateCache();
    void refetch();
  }, [user, refreshKey, invalidateCache, refetch]);

  useEffect(() => {
    if (!freeGrowthPhaseEnabled || hasAlerts) return;
    if (user && !showAlertCount) return;

    const impressionKey = `${user?.id ?? "anon"}:${beachId}`;
    if (freeGrowthImpressionKey.current === impressionKey) return;
    freeGrowthImpressionKey.current = impressionKey;

    void track("free_growth_education_impression", {
      beachId,
      metadata: {
        surface: "beach_detail_alert_cta",
        audience: user ? "authenticated" : "anonymous",
      },
    });
  }, [
    beachId,
    freeGrowthPhaseEnabled,
    hasAlerts,
    showAlertCount,
    track,
    user,
  ]);

  function handleClick() {
    if (freeGrowthPhaseEnabled && !hasAlerts) {
      void track("free_growth_education_cta_tapped", {
        beachId,
        metadata: {
          surface: "beach_detail_alert_cta",
          audience: user ? "authenticated" : "anonymous",
        },
      });
    }

    if (!user) {
      trackSignupCtaClick({
        source: "beach-alert-cta",
        surface: "beach-detail",
        beach_id: beachId,
        beach_name: beachName,
      });
      setPendingAction({ type: "alert", beachId, beachName });
      setAuthModalOpen(true);
      return;
    }

    if (hasAlerts) {
      void track("watch_spot_tapped", {
        beachId,
        metadata: {
          surface: "beach_detail_alert_cta",
          outcome: "tune",
        },
      });
    }

    onOpenAlerts?.();
  }

  if (compact) {
    const compactLabel = showAlertCount && hasAlerts ? "Active" : "Alert";

    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          aria-label={
            hasAlerts
              ? `Alerts active (${ruleCount})`
              : freeGrowthPhaseEnabled
                ? "Watch this spot, free"
                : "Set up alerts"
          }
          className={cn(
            "group relative h-9 w-[96px] shrink-0 overflow-visible rounded-none border-0 bg-transparent px-0 text-[#11100D] shadow-none hover:bg-transparent focus-visible:ring-2 focus-visible:ring-[#F78E42]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] min-[1100px]:h-10 min-[1100px]:w-[132px]",
            className
          )}
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-[36px] -translate-y-1/2 bg-[url('/images/alerts/condition-watch-button.webp')] bg-contain bg-center bg-no-repeat drop-shadow-[2px_2px_0_rgba(17,16,13,0.25)] transition-transform group-hover:-rotate-1 group-hover:scale-[1.03] min-[1100px]:h-[42px]"
          />
          <span className="relative z-10 flex w-full items-center justify-center gap-1 pr-4 pl-[34px] font-mono text-[9px] font-black uppercase leading-none tracking-[0.08em] text-[#11100D] min-[1100px]:gap-1.5 min-[1100px]:pr-7 min-[1100px]:pl-[44px] min-[1100px]:text-[10px] min-[1100px]:tracking-[0.1em]">
            <span className="min-[1100px]:hidden">{compactLabel}</span>
            <span className="hidden min-[1100px]:inline">
              {showAlertCount && hasAlerts ? "Active" : "Set alert"}
            </span>
            {showAlertCount && hasAlerts && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-[#11100D] bg-[#F78E42] px-1 text-[10px] leading-none text-[#11100D]">
                {ruleCount}
              </span>
            )}
          </span>
        </Button>

        {authModalOpen && (
          <UnifiedAuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            mode="signup"
            source="beach-alert-cta"
            contextMessage={{
              title: "Get Surf Alerts",
              description: `Get notified when ${beachName} hits your ideal conditions`,
            }}
            returnTo={pathname}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1 flex-1">
        <Button
          variant="outline"
          onClick={handleClick}
          aria-label={
            hasAlerts
              ? `Manage alerts (${ruleCount} active)`
              : freeGrowthPhaseEnabled
                ? "Watch this spot, free"
                : "Get alerts"
          }
          className={`h-12 w-full px-6 text-base font-semibold rounded-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 transition-[color,background-color,border-color,box-shadow,transform,opacity] border-2 ${
            showAlertCount && hasAlerts
              ? "bg-[#F78E42] border-[#F78E42] text-[#11100D] hover:bg-[#F78E42]/90 motion-safe:animate-[alertBreath_3s_ease-in-out_infinite] alert-breath"
              : "border-[#F78E42] text-[#F78E42] hover:bg-[#F78E42]/10"
          } ${className ?? ""}`}
        >
          <Waves
            className={`h-5 w-5 mr-2 ${
              showAlertCount && hasAlerts ? "" : "text-[#F78E42]"
            }`}
          />
          {showAlertCount && hasAlerts ? (
            <span className="flex items-center gap-1.5">
              Alerts active
              <span
                className="inline-flex items-center justify-center rounded-full font-bold leading-none w-5 h-5 bg-white/20 text-white text-[11px]"
              >
                {ruleCount}
              </span>
            </span>
          ) : (
            freeGrowthPhaseEnabled ? "Watch this spot" : "Get alerts"
          )}
        </Button>
        <p className="text-xs text-gray-400 text-center">
          {showAlertCount && hasAlerts ? "Tap to manage your alerts" : inactiveHelperCopy}
        </p>
      </div>

      {authModalOpen && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source="beach-alert-cta"
          contextMessage={{
            title: "Get Surf Alerts",
            description: `Get notified when ${beachName} hits your ideal conditions`,
          }}
          returnTo={pathname}
        />
      )}
    </>
  );
}
