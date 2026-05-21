"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePathname } from "next/navigation";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { trackSignupCtaClick } from "@/lib/analytics/signup-conversion-tracking";

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
  /** Called when the user clicks to open the alert creation/management flow */
  onOpenAlerts?: () => void;
}

export function BeachAlertCta({
  beachId,
  beachName,
  compact,
  className,
  refreshKey,
  onOpenAlerts,
}: BeachAlertCtaProps) {
  const { user } = useAuth();
  const { pendingAction, setPendingAction, clearPendingAction } = usePendingAction();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const previousRefreshKey = useRef(refreshKey);

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

  function handleClick() {
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
    onOpenAlerts?.();
  }

  if (compact) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          aria-label={hasAlerts ? `Alerts active (${ruleCount})` : "Set up alerts"}
          className={className}
        >
          {hasAlerts ? (
            <BellRing className="h-4 w-4 text-[#F78E42]" />
          ) : (
            <Bell className="h-4 w-4 text-[#F78E42]" />
          )}
          {showAlertCount && hasAlerts && (
            <span
              className="ml-1 inline-flex items-center justify-center rounded-full text-[11px] font-semibold leading-none w-4 h-4 text-white bg-[#F78E42]"
            >
              {ruleCount}
            </span>
          )}
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
          aria-label={hasAlerts ? `Manage alerts (${ruleCount} active)` : "Get alerts"}
          className={`h-12 w-full px-6 text-base font-semibold rounded-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 transition-all border-2 ${
            showAlertCount && hasAlerts
              ? "bg-[#F78E42] border-[#F78E42] text-white hover:bg-[#F78E42]/90 motion-safe:animate-[alertBreath_3s_ease-in-out_infinite] alert-breath"
              : "border-[#F78E42] text-[#F78E42] hover:bg-[#F78E42]/10"
          } ${className ?? ""}`}
        >
          {hasAlerts ? (
            <BellRing className="h-5 w-5 mr-2" />
          ) : (
            <Bell className="h-5 w-5 mr-2 text-[#F78E42]" />
          )}
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
            "Get alerts"
          )}
        </Button>
        <p className="text-xs text-gray-400 text-center">
          {showAlertCount && hasAlerts ? "Tap to manage your alerts" : "Notify me when conditions are ideal"}
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
